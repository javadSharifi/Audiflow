use std::path::Path;

use crate::error::{AppError, Result};
use crate::ffmpeg::probe;
use crate::types::{AbPreviewResult, BoosterPreset, FileMeta, VolumeAnalysis};

/// Probe files for the UI list in parallel with a bounded worker pool.
/// Per-file errors land in `FileMeta.error` instead of failing the whole
/// call. Runs asynchronously without blocking Tauri's main loop.
#[tauri::command]
#[specta::specta]
pub async fn probe_files(paths: Vec<String>) -> Vec<FileMeta> {
    tauri::async_runtime::spawn_blocking(move || {
        let paths: Vec<String> = paths
            .into_iter()
            .map(|p| crate::android_fs::ensure_local_path(&p))
            .collect();

        let Ok(ffprobe) = crate::ffmpeg::locate::locate("ffprobe") else {
            return paths
                .into_iter()
                .map(|p| missing_tool_meta(&p, "ffprobe"))
                .collect();
        };

        if paths.len() <= 1 {
            return paths
                .into_iter()
                .map(|path| match probe_file_meta(&ffprobe, &path) {
                    Ok(meta) => meta,
                    Err(e) => FileMeta {
                        name: file_name_of(&path),
                        path,
                        size_bytes: 0,
                        duration_secs: 0.0,
                        format_name: String::new(),
                        has_audio: false,
                        error: Some(e.to_string()),
                    },
                })
                .collect();
        }

        // Parallel probe with a bounded worker pool — one thread + one ffprobe
        // process per file would thrash on large drops (300 files = 300 spawns).
        let max_workers = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4)
            .clamp(1, 8);
        let workers = max_workers.min(paths.len());
        let next = std::sync::atomic::AtomicUsize::new(0);
        let results: std::sync::Mutex<Vec<Option<FileMeta>>> =
            std::sync::Mutex::new(vec![None; paths.len()]);

        std::thread::scope(|s| {
            for _ in 0..workers {
                s.spawn(|| loop {
                    let i = next.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    if i >= paths.len() {
                        break;
                    }
                    let path = &paths[i];
                    let meta = match probe_file_meta(&ffprobe, path) {
                        Ok(meta) => meta,
                        Err(e) => FileMeta {
                            name: file_name_of(path),
                            path: path.clone(),
                            size_bytes: 0,
                            duration_secs: 0.0,
                            format_name: String::new(),
                            has_audio: false,
                            error: Some(e.to_string()),
                        },
                    };
                    results.lock().unwrap()[i] = Some(meta);
                });
            }
        });

        results
            .into_inner()
            .unwrap()
            .into_iter()
            .map(|m| m.expect("every probe slot filled"))
            .collect()
    })
    .await
    .unwrap_or_default()
}

fn probe_file_meta(ffprobe: &Path, path: &str) -> Result<FileMeta> {
    let probed = probe::probe_file(ffprobe, path)?;
    let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    Ok(FileMeta {
        name: file_name_of(path),
        path: path.to_string(),
        size_bytes: size,
        duration_secs: probed.duration_secs().unwrap_or(0.0),
        format_name: probed
            .format
            .as_ref()
            .and_then(|f| f.format_name.clone())
            .unwrap_or_default(),
        has_audio: true,
        error: None,
    })
}

fn missing_tool_meta(path: &str, tool: &str) -> FileMeta {
    FileMeta {
        name: file_name_of(path),
        path: path.to_string(),
        size_bytes: 0,
        duration_secs: 0.0,
        format_name: String::new(),
        has_audio: false,
        error: Some(format!("Bundled {tool} binary is missing")),
    }
}

fn file_name_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string())
}

/// Waveform peaks for the trim editor UI. Decodes only the first audio
/// stream (audio-only decode; no video work) into `buckets` min/max pairs.
/// Runs in a dedicated background task to prevent any UI freezing.
#[tauri::command]
#[specta::specta]
pub async fn waveform_peaks(path: String, buckets: Option<u32>) -> Result<Vec<[f32; 2]>> {
    let buckets = (buckets.unwrap_or(1000) as usize).clamp(16, 4000);
    tauri::async_runtime::spawn_blocking(move || {
        // Staging (potentially multi-GB copy on Android) MUST run on the
        // blocking pool — never on the async runtime's own threads.
        let path = crate::android_fs::ensure_local_path(&path);
        let ffmpeg = crate::ffmpeg::locate::ffmpeg_path()
            .map_err(|_| AppError::Other("Bundled ffmpeg binary is missing".into()))?;
        // A duration hint lets the peak extractor stream: buckets are aligned
        // to the FULL file duration and no large PCM buffer is allocated.
        let duration = probe::probe_file(
            &crate::ffmpeg::locate::locate("ffprobe")
                .map_err(|_| AppError::Other("Bundled ffprobe binary is missing".into()))?,
            &path,
        )
        .ok()
        .and_then(|p| p.duration_secs())
        .filter(|d| *d > 0.0);
        let peaks = crate::ffmpeg::waveform::extract_peaks(&ffmpeg, &path, buckets, duration)?;
        // Tauri IPC can't carry tuples directly — flatten to [min, max] arrays.
        Ok(peaks.into_iter().map(|(mn, mx)| [mn, mx]).collect())
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

/// Volume analysis for a media file (peak dB, mean dB, suggested gain).
#[tauri::command]
#[specta::specta]
pub async fn analyze_audio_volume(
    path: String,
    start_secs: Option<f64>,
    duration_secs: Option<f64>,
) -> Result<VolumeAnalysis> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = crate::android_fs::ensure_local_path(&path);
        let ffmpeg = crate::ffmpeg::locate::ffmpeg_path()
            .map_err(|_| AppError::Other("Bundled ffmpeg binary is missing".into()))?;
        let cancel = crate::ffmpeg::run::CancelToken::new();
        crate::processing::sound_booster::analyze_volume(
            &ffmpeg,
            Path::new(&path),
            start_secs,
            duration_secs,
            &cancel,
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

/// Fast A/B preview snippet generator for Sound Booster.
#[tauri::command]
#[specta::specta]
pub async fn generate_ab_preview(
    path: String,
    preset: BoosterPreset,
    manual_gain_percent: Option<f64>,
    start_time_secs: Option<f64>,
    duration_secs: Option<f64>,
) -> Result<AbPreviewResult> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = crate::android_fs::ensure_local_path(&path);
        let ffmpeg = crate::ffmpeg::locate::ffmpeg_path()
            .map_err(|_| AppError::Other("Bundled ffmpeg binary is missing".into()))?;
        let ffprobe = crate::ffmpeg::locate::locate("ffprobe")
            .map_err(|_| AppError::Other("Bundled ffprobe binary is missing".into()))?;
        let cancel = crate::ffmpeg::run::CancelToken::new();
        crate::processing::sound_booster::generate_ab_preview(
            &ffmpeg,
            &ffprobe,
            Path::new(&path),
            preset,
            manual_gain_percent,
            crate::processing::sound_booster::PreviewTimeWindow {
                start_time_secs,
                requested_duration: duration_secs,
            },
            &cancel,
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}
