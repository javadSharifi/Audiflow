use std::path::Path;

use serde::Serialize;
use tauri::State;

use crate::error::{AppError, Result};
use crate::ffmpeg::probe;
use crate::processing::transcribe::{
    GeminiClient, TranscriptionJob, TranscriptionRequestConfig, UsageStats,
};
use crate::queue::{JobRecord, QueueManager};
use crate::settings::Settings;
use crate::transcribe_queue::TranscribeQueueManager;
use crate::types::{ConversionOptions, FileMeta, TrimSpec};

/// Normalize a `file://` URI into a plain local path.
///
/// Linux "Open With" passes `%U` file:// URIs into argv, and pickers/drop
/// handlers may leak them too. The converter worker hands paths to ffmpeg
/// verbatim, so an un-normalized URI fails deep inside the job instead of at
/// ingest. Handles `file://`, `file://localhost/`, Windows drive form
/// (`file:///C:/...`), and `%XX` escapes. Non-file inputs (plain paths,
/// Android `content://`) pass through untouched.
fn normalize_file_uri(path: &str) -> String {
    let mut rest = match path.strip_prefix("file://") {
        Some(r) => r,
        None => return path.to_string(),
    };
    if let Some(stripped) = rest.strip_prefix("localhost") {
        rest = stripped;
    }
    let mut decoded = percent_decode(rest);
    // file:///C:/x → "/C:/x" is not a valid Windows path; drop the slash.
    // Harmless on Unix ("/C:/..." is never a real file there either way).
    let b = decoded.as_bytes();
    if b.len() >= 3 && b[0] == b'/' && b[1].is_ascii_alphabetic() && b[2] == b':' {
        decoded.remove(0);
    }
    decoded
}

/// Minimal `%XX` decoder (no new dependency for a 10-line job).
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(byte) = u8::from_str_radix(hex, 16) {
                    out.push(byte);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Result of pre-resolving one input path (e.g. Android Content URIs to
/// cached local files). `resolved` equals `input` when no staging happened
/// or when staging failed (the error field then explains why).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedMediaPath {
    pub input: String,
    pub resolved: String,
    pub error: Option<String>,
}

/// Pre-resolve media paths (e.g. Android Content URIs to cached files).
/// Never fails wholesale — each path carries its own optional error so one
/// bad URI cannot blank out the whole batch.
#[tauri::command]
#[specta::specta]
pub async fn resolve_media_paths(paths: Vec<String>) -> Vec<ResolvedMediaPath> {
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|input| {
                let resolved = crate::android_fs::ensure_local_path(&input);
                let error = (resolved == input && input.starts_with("content://"))
                    .then(|| "Could not copy the selected file into app storage".to_string());
                ResolvedMediaPath {
                    input,
                    resolved,
                    error,
                }
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

/// Explicitly delete a previously staged Android input file (user removed
/// the row / cleared the list). No-op on desktop and for any path outside
/// the app's staging directory.
#[tauri::command]
#[specta::specta]
pub fn delete_staged_input(path: String) {
    crate::android_fs::delete_staged_input(&path);
}

/// One entry of `stat_media_paths`: lightweight metadata for a picked URI —
/// NO file copying (staging happens lazily right before each conversion).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StatMediaPath {
    pub input: String,
    pub name: String,
    #[specta(type = u32)]
    pub size_bytes: u64,
    pub duration_secs: f64,
    pub error: Option<String>,
}

/// Lightweight metadata lookup (name / size / duration) for the picked
/// paths/URIs. Never fails wholesale — each path carries its own error.
#[tauri::command]
#[specta::specta]
pub async fn stat_media_paths(paths: Vec<String>) -> Vec<StatMediaPath> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "android")]
        {
            let joined = paths.join("\n");
            let raw = crate::android_fs::call_static_string_quiet("statUri", &joined);
            crate::log_info!("stat_media_paths: inputs={:?}, raw={:?}", paths, raw);
            let mut lines = raw.split('\n').filter(|l| !l.is_empty());
            paths
                .into_iter()
                .map(|input| {
                    let line = lines.next().unwrap_or("");
                    // Protocol: name\tsize\tdurationMs\tok\tperm
                    let mut parts = line.splitn(5, '\t');
                    let name = parts.next().unwrap_or("");
                    let size = parts.next().and_then(|s| s.parse::<i64>().ok());
                    let dur_ms = parts.next().and_then(|s| s.parse::<i64>().ok());
                    let ok = parts.next().map(|s| s.trim() == "1").unwrap_or(false);
                    let perm = parts.next().map(|s| s.trim() == "1").unwrap_or(false);
                    if raw.is_empty() {
                        StatMediaPath {
                            name: file_name_of(&input),
                            size_bytes: 0,
                            duration_secs: 0.0,
                            input,
                            error: Some(
                                "File access bridge is not ready — please reopen the app".into(),
                            ),
                        }
                    } else if !ok {
                        StatMediaPath {
                            name: file_name_of(&input),
                            size_bytes: 0,
                            duration_secs: 0.0,
                            input,
                            error: Some(
                                if perm {
                                    "Permission denied — please grant media access in Settings".into()
                                } else {
                                    "Could not read file info".into()
                                },
                            ),
                        }
                    } else {
                        StatMediaPath {
                            name: if name.is_empty() {
                                file_name_of(&input)
                            } else {
                                name.to_string()
                            },
                            size_bytes: size.unwrap_or(0).max(0) as u64,
                            duration_secs: dur_ms.unwrap_or(0).max(0) as f64 / 1000.0,
                            input,
                            error: None,
                        }
                    }
                })
                .collect()
        }
        #[cfg(not(target_os = "android"))]
        {
            paths
                .into_iter()
                .map(|input| match std::fs::metadata(&input) {
                    Ok(m) => StatMediaPath {
                        name: file_name_of(&input),
                        size_bytes: m.len(),
                        duration_secs: 0.0,
                        input,
                        error: None,
                    },
                    Err(_) => StatMediaPath {
                        name: file_name_of(&input),
                        size_bytes: 0,
                        duration_secs: 0.0,
                        input,
                        error: Some("Could not read file info".into()),
                    },
                })
                .collect()
        }
    })
    .await
    .unwrap_or_default()
}

/// Whether the required media permissions are granted (Android). Always true
/// on desktop.
#[tauri::command]
#[specta::specta]
pub fn has_media_permissions() -> bool {
    #[cfg(target_os = "android")]
    return crate::android_fs::call_static_bool("hasMediaPermissions");
    #[cfg(not(target_os = "android"))]
    true
}

/// Trigger the Android runtime permission dialog (no-op on desktop).
#[tauri::command]
#[specta::specta]
pub fn request_media_permissions() {
    #[cfg(target_os = "android")]
    let _ = crate::android_fs::call_static_void("requestMediaPermissions");
}

/// Trigger the Android runtime video/photos permission dialog (no-op on desktop).
#[tauri::command]
#[specta::specta]
pub fn request_video_permissions() {
    #[cfg(target_os = "android")]
    let _ = crate::android_fs::call_static_void("requestVideoPermissions");
}

/// Check Android video permission status across platforms.
#[tauri::command]
#[specta::specta]
pub fn get_video_permission_status() -> LibraryPermissionStatus {
    #[cfg(target_os = "android")]
    {
        let mut res = String::new();
        for _ in 0..4 {
            match crate::android_fs::call_static_string_no_arg("checkVideoPermission") {
                Ok(s) if !s.is_empty() => {
                    res = s;
                    break;
                }
                _ => {}
            }
            std::thread::sleep(std::time::Duration::from_millis(150));
        }
        match res.as_str() {
            "granted" => LibraryPermissionStatus::Granted,
            "permanently_denied" => LibraryPermissionStatus::PermanentlyDenied,
            _ => LibraryPermissionStatus::Denied,
        }
    }
    #[cfg(not(target_os = "android"))]
    LibraryPermissionStatus::NotRequired
}

/// Open the system app-settings page so the user can grant permissions.
#[tauri::command]
#[specta::specta]
pub fn open_app_settings() {
    #[cfg(target_os = "android")]
    let _ = crate::android_fs::call_static_void("openAppSettings");
}

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
        let peaks =
            crate::ffmpeg::waveform::extract_peaks(&ffmpeg, &path, buckets, duration)?;
        // Tauri IPC can't carry tuples directly — flatten to [min, max] arrays.
        Ok(peaks.into_iter().map(|(mn, mx)| [mn, mx]).collect())
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

/// Enqueue a conversion batch; returns job ids. Each input carries its own
/// optional trim window (`startTime`/`endTime` in seconds, both nullable).
#[tauri::command]
#[specta::specta]
pub async fn start_conversion(
    queue: State<'_, QueueManager>,
    items: Vec<TrimSpec>,
    options: ConversionOptions,
    concurrency: Option<u32>,
) -> Result<Vec<String>> {
    if items.is_empty() {
        return Err(AppError::InvalidInput("No input files selected".into()));
    }
    let mut items = items;
    // NOTE: no staging here — Android content URIs are resolved lazily by the
    // worker right before each conversion runs, so picking 20 files never
    // copies 20 files upfront.
    options.validate()?;
    // Linux "Open With" passes %U file:// URIs and pickers may leak them too;
    // normalize to plain paths here so the worker never hands ffmpeg a URI.
    for item in &mut items {
        item.path = normalize_file_uri(&item.path);
    }
    for item in &items {
        item.validate()?;
        let p = &item.path;
        let is_uri = p.starts_with("content://") || p.starts_with("file://");
        if !is_uri && !Path::new(p).exists() {
            return Err(AppError::NotFound(p.clone()));
        }
    }
    // Reject duplicate sources in one batch — two jobs writing
    // `{stem}.{ext}` next to the same source would collide via unique_path.
    // Windows paths are case-insensitive, so fold case there.
    let mut seen = std::collections::HashSet::new();
    for item in &items {
        let key = if cfg!(windows) {
            item.path.to_lowercase()
        } else {
            item.path.clone()
        };
        if !seen.insert(key) {
            return Err(AppError::InvalidInput(format!(
                "Duplicate input file: {}",
                item.path
            )));
        }
    }
    let conc = concurrency.unwrap_or_else(|| Settings::load().concurrency);
    crate::log_info!(
        "queue started: {} file(s), concurrency {conc}, {} trimmed",
        items.len(),
        items
            .iter()
            .filter(|i| i.start_time_secs.is_some() || i.end_time_secs.is_some())
            .count()
    );
    Ok(queue.enqueue(items, options, conc))
}

// In-memory, microsecond-fast — kept sync on purpose (async commands taking
// State must return Result in Tauri 2; not worth the churn here).
#[tauri::command]
#[specta::specta]
pub fn cancel_job(queue: State<'_, QueueManager>, job_id: String) {
    queue.cancel(&job_id);
}

#[tauri::command]
#[specta::specta]
pub fn cancel_all_jobs(queue: State<'_, QueueManager>) {
    queue.cancel_all();
}

#[tauri::command]
#[specta::specta]
pub fn clear_finished(queue: State<'_, QueueManager>) {
    queue.clear_finished();
}

#[tauri::command]
#[specta::specta]
pub fn get_queue(queue: State<'_, QueueManager>) -> Vec<JobRecord> {
    queue.snapshot()
}

#[derive(Serialize, serde::Deserialize, specta::Type)]
pub struct DiskFree {
    #[specta(type = u32)]
    pub free_bytes: u64,
}

/// Pre-flight disk space query for the chosen output location.
#[tauri::command]
#[specta::specta]
pub async fn disk_free(path: String) -> Result<DiskFree> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = Path::new(&path);
        let dir = if target.is_dir() {
            target
        } else {
            target.parent().unwrap_or(target)
        };
        crate::disk::free_bytes(dir)
            .map(|free_bytes| DiskFree { free_bytes })
            .ok_or_else(|| AppError::Io(format!("Cannot determine free space for {path}")))
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

#[tauri::command(async)]
#[specta::specta]
pub fn get_settings() -> Settings {
    Settings::load()
}

#[tauri::command(async)]
#[specta::specta]
pub fn save_settings(settings: Settings) -> Result<()> {
    settings.save().map_err(AppError::Other)?;
    crate::log_info!("settings saved");
    Ok(())
}

#[tauri::command(async)]
#[specta::specta]
pub fn log_frontend(level: String, msg: String) {
    crate::logger::log(&level, &format!("[FRONTEND] {msg}"));
}

use crate::types::{AbPreviewResult, BoosterJobSpec, BoosterPreset, VolumeAnalysis};

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
            start_time_secs,
            duration_secs,
            &cancel,
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

/// Enqueue sound booster batch conversion.
#[tauri::command]
#[specta::specta]
pub async fn start_sound_boost(
    queue: State<'_, QueueManager>,
    mut items: Vec<BoosterJobSpec>,
    options: ConversionOptions,
    concurrency: Option<u32>,
) -> Result<Vec<String>> {
    if items.is_empty() {
        return Err(AppError::InvalidInput("No input files selected".into()));
    }
    options.validate()?;
    for item in &mut items {
        item.trim.path = normalize_file_uri(&item.trim.path);
    }
    for item in &items {
        item.trim.validate()?;
        let p = &item.trim.path;
        let is_uri = p.starts_with("content://") || p.starts_with("file://");
        if !is_uri && !Path::new(p).exists() {
            return Err(AppError::NotFound(p.clone()));
        }
    }
    let mut seen = std::collections::HashSet::new();
    for item in &items {
        let key = if cfg!(windows) {
            item.trim.path.to_lowercase()
        } else {
            item.trim.path.clone()
        };
        if !seen.insert(key) {
            return Err(AppError::InvalidInput(format!(
                "Duplicate input file: {}",
                item.trim.path
            )));
        }
    }
    let conc = concurrency.unwrap_or_else(|| Settings::load().concurrency);
    crate::log_info!(
        "booster queue started: {} file(s), concurrency {conc}",
        items.len()
    );
    Ok(queue.enqueue_boost(items, options, conc))
}

pub use crate::music_library::models::{AudioTrackInfo, LibraryPermissionStatus};

/// Scan system audio files across platforms (MediaStore on Android, standard music/user directories on desktop).
/// Sorted by default by latest date added (created/modified timestamp descending).
///
/// Incremental rescans: unchanged files (same path, size, mtime) reuse the
/// previous scan's track record from a durable cache — only new/changed
/// files are stat'ed and parsed.
#[tauri::command]
#[specta::specta]
pub async fn scan_audio_files(custom_dirs: Option<Vec<String>>) -> Vec<AudioTrackInfo> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::scan_music_library(custom_dirs)
    })
    .await
    .unwrap_or_default()
}

/// Statistics from the last native library scan (walk cost vs reuse rate).
/// Diagnostic companion for the frontend boot-pref timeline.
#[tauri::command]
#[specta::specta]
pub fn scan_result_cache_stats() -> crate::music_library::ScanResultCacheStats {
    crate::music_library::last_scan_stats()
}

/// Check music permission status across platforms.
#[tauri::command]
#[specta::specta]
pub fn get_music_permission_status() -> LibraryPermissionStatus {
    crate::music_library::get_music_permission_status()
}

/// Delete audio track from the device library.
#[tauri::command]
#[specta::specta]
pub async fn delete_audio_track(path_or_uri: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::delete_audio_track(&path_or_uri)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set track as default ringtone (Android).
#[tauri::command]
#[specta::specta]
pub async fn set_as_ringtone(path_or_uri: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::set_as_ringtone(&path_or_uri)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Share track via system share sheet.
#[tauri::command]
#[specta::specta]
pub async fn share_audio_track(path_or_uri: String, title: String, mime_type: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::share_audio_track(&path_or_uri, &title, &mime_type)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

// --- Jetpack Media3 Android Audio Player Commands ---

/// Play a track or playlist via native Jetpack Media3 (Android).
#[tauri::command]
#[specta::specta]
pub async fn android_player_play(
    track_json: String,
    playlist_json: Option<String>,
    start_index: Option<i32>,
) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let playlist = playlist_json.unwrap_or_else(|| "[]".to_string());
        let index = start_index.unwrap_or(0);
        crate::android_fs::call_player_play_jni(&track_json, &playlist, index)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Pause playback via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_pause() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerPause")
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Resume playback via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_resume() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerResume")
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Seek playback to timestamp in milliseconds via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_seek_to(position_ms: u32) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_seek_jni(position_ms as i64)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Skip to next media item via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_next() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerNext")
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Skip to previous media item via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_previous() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerPrevious")
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set repeat mode ('off', 'one', 'all') via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_repeat_mode(mode: String) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_static_string_1arg("nativePlayerSetRepeatMode", &mode)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set shuffle mode enabled/disabled via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_shuffle_mode(enabled: bool) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_shuffle_jni(enabled)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set playback speed (e.g. 1.0, 1.25) via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_speed(speed: f64) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_speed_jni(speed as f32)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set output volume fraction (0.0..1.0) via native Jetpack Media3.
/// Values above 1.0 are clamped natively; true >100% boost needs a DSP
/// AudioProcessor (Rhythm pattern) and is intentionally not faked.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_volume(volume: f64) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_volume_jni(volume as f32)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set real-time loudness boost in dB (0 is off) via the native Android
/// LoudnessEnhancer attached to the ExoPlayer audio session. Desktop needs
/// no loudness DSP path (the WebAudio GainNode covers it).
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_booster_gain(gain_db: f64) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_booster_gain_jni(gain_db as f32)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set real-time loudness boost in millibels (0..8000 mB) via BoostEngine.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_booster_gain_mb(gain_mb: i32) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_booster_gain_mb_jni(gain_mb)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query currently active booster gain in millibels.
#[tauri::command]
#[specta::specta]
pub async fn android_player_get_booster_gain_mb() -> Result<i32> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_player_get_booster_gain_mb_jni()
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query hardware media volume step from AudioManager.
#[tauri::command]
#[specta::specta]
pub async fn android_get_stream_volume() -> Result<i32> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_get_stream_volume_jni()
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query hardware media max volume step from AudioManager.
#[tauri::command]
#[specta::specta]
pub async fn android_get_stream_max_volume() -> Result<i32> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_get_stream_max_volume_jni()
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set hardware media volume step directly on AudioManager.
#[tauri::command]
#[specta::specta]
pub async fn android_set_stream_volume(volume: i32, show_ui: bool) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_set_stream_volume_jni(volume, show_ui)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Apply reduce-hurt speaker protection to dampen volume and reset extreme gain.
#[tauri::command]
#[specta::specta]
pub async fn android_apply_reduce_hurt() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_apply_reduce_hurt_jni()
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Stop playback via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_stop() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerStop")
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query live playback state from native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub fn android_player_get_state() -> String {
    crate::android_fs::call_static_string_no_arg("nativePlayerGetState")
        .unwrap_or_else(|_| "{}".to_string())
}

/// Query and drain any files/URIs opened by the OS (e.g. cold-start or before frontend event listeners registered).
#[tauri::command]
#[specta::specta]
pub async fn get_pending_open_files(
    state: State<'_, crate::AppOpenFileQueue>,
) -> Result<Vec<String>> {
    let mut files = {
        let mut lock = state.0.lock().unwrap();
        std::mem::take(&mut *lock)
    };
    let android_files = crate::android_fs::drain_pending_opened_uris();
    files.extend(android_files);
    Ok(files)
}

/// Resolve a single audio file path or content:// URI into an AudioTrackInfo struct.
#[tauri::command]
#[specta::specta]
pub async fn resolve_audio_track(path_or_uri: String) -> Result<crate::music_library::AudioTrackInfo> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::resolve_single_track(&path_or_uri)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Lazily resolve one track cover art to a readable cached JPEG path.
/// Takes the audio reference (track uri or path, never an artwork URI).
/// Repeat calls are a near-free cache hit. Returns null when the file has
/// no embedded picture.
#[tauri::command]
#[specta::specta]
pub async fn get_track_artwork(path_or_uri: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::artwork::get_track_artwork(&path_or_uri)
    })
    .await
    .unwrap_or_default()
}

/// Whether system notifications are allowed for this app.
/// Always true on desktop. The media notification and lock-screen player
/// disappear when this is denied, so the UI shows a guidance banner.
#[tauri::command]
#[specta::specta]
pub fn get_notification_permission_status() -> bool {
    #[cfg(target_os = "android")]
    return crate::android_fs::call_static_bool("areNotificationsEnabled");
    #[cfg(not(target_os = "android"))]
    true
}

/// Exit the app (used for Android double-back-to-exit).
/// On desktop this terminates via Tauri; on Android the Kotlin
/// `exitApp` bridge finishes the activity.
#[tauri::command]
#[specta::specta]
pub fn exit_app(app: tauri::AppHandle) {
    #[cfg(target_os = "android")]
    {
        // Ask Kotlin to finish the activity on the main thread.
        let _ = crate::android_fs::call_static_void("exitApp");
        // Fallback: also ask the runtime to exit in case the bridge is dead.
        app.exit(0);
    }
    #[cfg(not(target_os = "android"))]
    {
        app.exit(0);
    }
}

// --- Transcribe Studio (Gemini cloud transcription) ---------------------------
// The API key lives in the OS keychain and every Gemini call runs in Rust;
// the frontend only ever touches these IPC commands.

/// Persist the user's Gemini API key to the OS keychain.
#[tauri::command]
#[specta::specta]
pub fn save_gemini_api_key(key: String) -> Result<()> {
    crate::secrets::save_gemini_api_key(&key)
}

/// Cheap onboarding check against `GET /v1beta/models` using the *unsaved*
/// pasted key. Touches no audio. `Ok(true)` = key works; classified
/// `AppError::Gemini(..)` otherwise.
#[tauri::command]
#[specta::specta]
pub async fn validate_gemini_api_key(key: String) -> Result<bool> {
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("API key is empty".into()));
    }
    GeminiClient::new(trimmed).validate_api_key().await
}

#[tauri::command]
#[specta::specta]
pub fn has_gemini_api_key() -> bool {
    crate::secrets::has_gemini_api_key()
}

#[tauri::command]
#[specta::specta]
pub fn clear_gemini_api_key() -> Result<()> {
    crate::secrets::delete_gemini_api_key()
}

/// Enqueue one transcription; returns the job id. Progress and results arrive
/// via the `transcription-event` channel.
#[tauri::command]
#[specta::specta]
pub fn start_transcription(
    manager: State<'_, TranscribeQueueManager>,
    file_path: String,
    config: TranscriptionRequestConfig,
) -> Result<String> {
    if file_path.trim().is_empty() {
        return Err(AppError::InvalidInput("No input file selected".into()));
    }
    manager.start_transcription(file_path, config)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_transcription(manager: State<'_, TranscribeQueueManager>, job_id: String) {
    manager.cancel(&job_id);
}

#[tauri::command]
#[specta::specta]
pub fn get_transcription_queue(manager: State<'_, TranscribeQueueManager>) -> Vec<TranscriptionJob> {
    manager.snapshot()
}

#[tauri::command]
#[specta::specta]
pub fn clear_finished_transcriptions(manager: State<'_, TranscribeQueueManager>) {
    manager.clear_finished();
}

/// App-local usage log + last observed real quota (see `usage_tracker.rs`).
#[tauri::command]
#[specta::specta]
pub fn get_usage_stats() -> UsageStats {
    crate::processing::transcribe::usage_tracker::get_usage_stats()
}

/// Render a finished transcript to txt/srt/vtt (atomic write, no overwrite).
/// SRT/VTT require word timestamps from the original request.
#[tauri::command]
#[specta::specta]
pub fn export_transcript(
    manager: State<'_, TranscribeQueueManager>,
    job_id: String,
    format: String,
) -> Result<String> {
    manager.export_transcript(&job_id, &format)
}






#[cfg(test)]
mod normalize_file_uri_tests {
    use super::{normalize_file_uri, percent_decode};

    #[test]
    fn strips_file_scheme_and_decodes_escapes() {
        assert_eq!(
            normalize_file_uri("file:///home/u/My%20Song.mp3"),
            "/home/u/My Song.mp3"
        );
    }

    #[test]
    fn strips_localhost_host() {
        assert_eq!(
            normalize_file_uri("file://localhost/home/u/song.flac"),
            "/home/u/song.flac"
        );
    }

    #[test]
    fn strips_windows_drive_slash() {
        assert_eq!(normalize_file_uri("file:///C:/Music/song.mp3"), "C:/Music/song.mp3");
    }

    #[test]
    fn leaves_plain_paths_and_content_uris_alone() {
        assert_eq!(normalize_file_uri("/home/u/song.mp3"), "/home/u/song.mp3");
        assert_eq!(
            normalize_file_uri("content://media/external/1234"),
            "content://media/external/1234"
        );
    }

    #[test]
    fn literal_percent_without_hex_survives() {
        assert_eq!(percent_decode("100%.mp3"), "100%.mp3");
        assert_eq!(percent_decode("a%2"), "a%2");
    }
}
