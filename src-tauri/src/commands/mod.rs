use std::path::Path;

use serde::Serialize;
use tauri::State;

use crate::error::{AppError, Result};
use crate::ffmpeg::probe;
use crate::queue::{JobRecord, QueueManager};
use crate::settings::Settings;
use crate::types::{ConversionOptions, FileMeta, TrimSpec, BoosterStatus, BoosterEngine};

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

        parallel_map(&paths, |path| match probe_file_meta(&ffprobe, path) {
            Ok(meta) => meta,
            Err(e) => FileMeta {
                name: file_name_of(path),
                path: path.to_string(),
                size_bytes: 0,
                duration_secs: 0.0,
                format_name: String::new(),
                has_audio: false,
                error: Some(e.to_string()),
            },
        })
    })
    .await
    .unwrap_or_default()
}

/// Map `f` over `items` with a bounded worker pool, preserving order.
/// One thread + one ffprobe process per file would thrash on large inputs
/// (300 files = 300 spawns), so cap at 8 workers.
fn parallel_map<T: Send>(items: &[String], f: impl Fn(&str) -> T + Sync) -> Vec<T> {
    if items.len() <= 1 {
        return items.iter().map(|p| f(p)).collect();
    }
    let workers = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .clamp(1, 8)
        .min(items.len());
    let next = std::sync::atomic::AtomicUsize::new(0);
    let results: std::sync::Mutex<Vec<Option<T>>> =
        std::sync::Mutex::new((0..items.len()).map(|_| None).collect());
    std::thread::scope(|s| {
        for _ in 0..workers {
            s.spawn(|| loop {
                let i = next.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                if i >= items.len() {
                    break;
                }
                let r = f(&items[i]);
                results.lock().unwrap()[i] = Some(r);
            });
        }
    });
    results
        .into_inner()
        .unwrap()
        .into_iter()
        .map(|m| m.expect("every slot filled"))
        .collect()
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

/// Tags + technical details for the music player ("stats for nerds").
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TrackInfo {
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub codec: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
    pub bit_depth: Option<u32>,
    pub bitrate_kbps: Option<u32>,
}

fn track_info_from(p: &probe::ProbeResult) -> TrackInfo {
    let audio = p.audio_stream();
    // Containers disagree on tag location (ogg/opus: stream, mp3/m4a: format) and key case.
    let tag = |key: &str| -> Option<String> {
        [p.format.as_ref().and_then(|f| f.tags.as_ref()), audio.and_then(|a| a.tags.as_ref())]
            .into_iter()
            .flatten()
            .find_map(|t| t.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v.trim().to_string()))
            .filter(|v| !v.is_empty())
    };
    let num = |s: Option<&String>| s.and_then(|v| v.parse::<u64>().ok());
    let codec = audio.and_then(|a| a.codec_name.clone());
    let bit_depth = audio.and_then(|a| {
        num(a.bits_per_raw_sample.as_ref()).filter(|b| *b > 0).or_else(|| {
            // PCM reports depth only through sample_fmt (s16, s24, s32...).
            codec.as_deref().filter(|c| c.starts_with("pcm_"))?;
            a.sample_fmt.as_deref()?.trim_start_matches(|c: char| c.is_alphabetic()).trim_end_matches('p').parse().ok()
        })
    });
    let bitrate = audio
        .and_then(|a| num(a.bit_rate.as_ref()))
        .or_else(|| p.format.as_ref().and_then(|f| num(f.bit_rate.as_ref())));
    TrackInfo {
        title: tag("title"),
        artist: tag("artist").or_else(|| tag("album_artist")),
        album: tag("album"),
        sample_rate: audio.and_then(|a| num(a.sample_rate.as_ref())).map(|v| v as u32),
        channels: audio.and_then(|a| a.channels),
        bit_depth: bit_depth.map(|v| v as u32),
        bitrate_kbps: bitrate.map(|b| (b / 1000) as u32),
        codec,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn track_info(path: String) -> Result<TrackInfo> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = crate::android_fs::ensure_local_path(&path);
        let ffprobe = crate::ffmpeg::locate::locate("ffprobe")
            .map_err(|_| AppError::Other("Bundled ffprobe binary is missing".into()))?;
        Ok(track_info_from(&probe::probe_file(&ffprobe, &path)?))
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

/// Local lyrics: a sidecar `<name>.lrc` next to the file, else embedded
/// lyrics tags. `None` when neither exists (the UI may then try online).
#[tauri::command]
#[specta::specta]
pub async fn track_lyrics(path: String) -> Result<Option<String>> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = crate::android_fs::ensure_local_path(&path);
        if let Ok(text) = std::fs::read_to_string(Path::new(&path).with_extension("lrc")) {
            if !text.trim().is_empty() {
                return Ok(Some(text));
            }
        }
        let ffprobe = crate::ffmpeg::locate::locate("ffprobe")
            .map_err(|_| AppError::Other("Bundled ffprobe binary is missing".into()))?;
        Ok(embedded_lyrics(&probe::probe_file(&ffprobe, &path)?))
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

fn embedded_lyrics(p: &probe::ProbeResult) -> Option<String> {
    // ID3 USLT surfaces as "lyrics-eng" etc.; Vorbis/MP4 as LYRICS / UNSYNCEDLYRICS.
    let is_lyrics = |k: &str| {
        let k = k.to_ascii_lowercase();
        k == "lyrics" || k == "unsyncedlyrics" || k.starts_with("lyrics-")
    };
    [p.format.as_ref().and_then(|f| f.tags.as_ref()), p.audio_stream().and_then(|a| a.tags.as_ref())]
        .into_iter()
        .flatten()
        .find_map(|t| t.iter().find(|(k, v)| is_lyrics(k) && !v.trim().is_empty()).map(|(_, v)| v.clone()))
}

/// Extracted cover art (cached JPEG) and its average color for theming.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct CoverArt {
    pub path: String,
    pub rgb: [u8; 3],
}

#[tauri::command]
#[specta::specta]
pub async fn track_cover(path: String) -> Result<Option<CoverArt>> {
    tauri::async_runtime::spawn_blocking(move || {
        use std::hash::{Hash, Hasher};
        let path = crate::android_fs::ensure_local_path(&path);
        let ffmpeg = crate::ffmpeg::locate::ffmpeg_path()
            .map_err(|_| AppError::Other("Bundled ffmpeg binary is missing".into()))?;
        let dir = crate::settings::app_data_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join("covers");
        std::fs::create_dir_all(&dir).map_err(|e| AppError::Io(e.to_string()))?;

        // Cache key includes size + mtime so an edited file gets a fresh cover.
        let meta = std::fs::metadata(&path).ok();
        let mut h = std::collections::hash_map::DefaultHasher::new();
        path.hash(&mut h);
        meta.as_ref().map(|m| m.len()).hash(&mut h);
        meta.and_then(|m| m.modified().ok()).hash(&mut h);
        let out = dir.join(format!("{:016x}.jpg", h.finish()));

        if !out.exists() {
            // No cover stream → ffmpeg fails ("matches no streams"): that's a normal None.
            let ok = crate::ffmpeg::create_hidden_command(&ffmpeg)
                .args(["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-i"])
                .arg(&path)
                .args(["-an", "-map", "0:v:0", "-frames:v", "1", "-vf", "scale='min(512,iw)':-2"])
                .arg(&out)
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false);
            if !ok {
                let _ = std::fs::remove_file(&out);
                return Ok(None);
            }
        }

        // Area-average down to one pixel = mean color of the artwork.
        let px = crate::ffmpeg::create_hidden_command(&ffmpeg)
            .args(["-hide_banner", "-nostdin", "-loglevel", "error", "-i"])
            .arg(&out)
            .args(["-vf", "scale=1:1:flags=area", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"])
            .output()
            .ok()
            .map(|o| o.stdout)
            .unwrap_or_default();
        let rgb = if px.len() >= 3 { [px[0], px[1], px[2]] } else { [139, 92, 246] };
        Ok(Some(CoverArt { path: out.to_string_lossy().into_owned(), rgb }))
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

/// One song in the local music library.
#[derive(Debug, Clone, Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LibraryTrack {
    pub path: String,
    pub name: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_secs: f64,
    #[specta(type = u32)]
    pub size_bytes: u64,
}

const LIBRARY_AUDIO_EXTS: &[&str] = &[
    "mp3", "aac", "m4a", "wav", "flac", "opus", "ogg", "oga", "wma", "aiff", "aif", "amr", "ac3",
];
/// Guard against pointing the scanner at `/` or a huge drive.
const LIBRARY_MAX_FILES: usize = 20_000;

#[cfg_attr(target_os = "android", allow(dead_code))]
/// Recursively collect audio files under `dir` (hidden entries skipped,
/// symlinked dirs not followed to avoid cycles).
fn collect_audio_files(dir: &Path, out: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        if out.len() >= LIBRARY_MAX_FILES {
            return;
        }
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let Ok(ft) = entry.file_type() else { continue };
        let path = entry.path();
        if ft.is_dir() {
            collect_audio_files(&path, out);
        } else if ft.is_file()
            && path
                .extension()
                .map(|e| LIBRARY_AUDIO_EXTS.contains(&e.to_string_lossy().to_ascii_lowercase().as_str()))
                .unwrap_or(false)
        {
            out.push(path.to_string_lossy().into_owned());
        }
    }
}

#[cfg_attr(not(target_os = "android"), allow(dead_code))]
/// Parse MainActivity.queryAudioLibrary output:
/// `path\ttitle\tartist\talbum\tdurationMs\tsize` per line.
fn parse_media_store_lines(raw: &str) -> Vec<LibraryTrack> {
    let opt = |s: Option<&str>| {
        s.map(str::trim)
            .filter(|v| !v.is_empty() && *v != "<unknown>")
            .map(String::from)
    };
    raw.lines()
        .filter_map(|line| {
            let mut p = line.split('\t');
            let path = p.next().filter(|v| !v.is_empty())?.to_string();
            let (title, artist, album) = (opt(p.next()), opt(p.next()), opt(p.next()));
            let duration_secs = p.next().and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) / 1000.0;
            let size_bytes = p.next().and_then(|v| v.parse().ok()).unwrap_or(0);
            Some(LibraryTrack { name: file_name_of(&path), path, title, artist, album, duration_secs, size_bytes })
        })
        .collect()
}

/// Local music library. Android: the system MediaStore index (`dir` is
/// ignored). Desktop: recursive scan of `dir` with tags read by ffprobe.
#[tauri::command]
#[specta::specta]
pub async fn scan_music_library(dir: Option<String>) -> Result<Vec<LibraryTrack>> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "android")]
        {
            let _ = dir;
            let raw = crate::android_fs::call_static_string_quiet("queryAudioLibrary", "");
            return Ok(parse_media_store_lines(&raw));
        }
        #[cfg(not(target_os = "android"))]
        {
            let dir = dir.ok_or_else(|| AppError::Other("No music folder selected".into()))?;
            let mut files = Vec::new();
            collect_audio_files(Path::new(&dir), &mut files);
            let ffprobe = crate::ffmpeg::locate::locate("ffprobe")
                .map_err(|_| AppError::Other("Bundled ffprobe binary is missing".into()))?;
            let tracks = parallel_map(&files, |path| {
                let probed = probe::probe_file(&ffprobe, path).ok()?;
                let info = track_info_from(&probed);
                Some(LibraryTrack {
                    path: path.to_string(),
                    name: file_name_of(path),
                    title: info.title,
                    artist: info.artist,
                    album: info.album,
                    duration_secs: probed.duration_secs().unwrap_or(0.0),
                    size_bytes: std::fs::metadata(path).map(|m| m.len()).unwrap_or(0),
                })
            });
            Ok(tracks.into_iter().flatten().collect())
        }
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

/// Now-playing snapshot for the Android background-playback notification.
#[derive(Debug, Clone, Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundPlayback {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub playing: bool,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub rate: f64,
}

/// Android: start/update (Some) or stop (None) the playback foreground
/// service + MediaSession. No-op elsewhere (desktop uses navigator.mediaSession).
#[tauri::command]
#[specta::specta]
pub fn set_background_playback(state: Option<BackgroundPlayback>) -> Result<()> {
    let json = match state {
        Some(s) => serde_json::to_string(&s).map_err(|e| AppError::Other(e.to_string()))?,
        None => String::new(),
    };
    crate::android_playback::update_playback_via_jni(&json).map_err(AppError::Other)
}

/// Silent spans (start, end seconds) for the player's "skip silence" toggle.
/// Full decode at 16 kHz mono — a few seconds for a typical song.
#[tauri::command]
#[specta::specta]
pub async fn track_silences(path: String) -> Result<Vec<[f32; 2]>> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = crate::android_fs::ensure_local_path(&path);
        let ffmpeg = crate::ffmpeg::locate::ffmpeg_path()
            .map_err(|_| AppError::Other("Bundled ffmpeg binary is missing".into()))?;
        let out = crate::ffmpeg::create_hidden_command(&ffmpeg)
            .args(["-hide_banner", "-nostdin", "-loglevel", "info", "-i"])
            .arg(&path)
            .args([
                "-vn",
                "-af",
                "aformat=sample_rates=16000:channel_layouts=mono,silencedetect=noise=-45dB:d=1.5",
                "-f",
                "null",
                "-",
            ])
            .output()
            .map_err(|e| AppError::Io(format!("Failed to launch ffmpeg: {e}")))?;
        if !out.status.success() {
            return Err(AppError::FFmpeg("Silence analysis failed".into()));
        }
        let stderr = String::from_utf8_lossy(&out.stderr);
        Ok(crate::processing::silence::parse_silencedetect(&stderr)
            .into_iter()
            .map(|(s, e)| [s as f32, e as f32])
            .collect())
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
    let items = items;
    // NOTE: no staging here — Android content URIs are resolved lazily by the
    // worker right before each conversion runs, so picking 20 files never
    // copies 20 files upfront.
    options.validate()?;
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

use crate::types::{AbPreviewResult, BoosterJobSpec, BoosterPreset, LiveBoostStatus, VolumeAnalysis};

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
    items: Vec<BoosterJobSpec>,
    options: ConversionOptions,
    concurrency: Option<u32>,
) -> Result<Vec<String>> {
    if items.is_empty() {
        return Err(AppError::InvalidInput("No input files selected".into()));
    }
    options.validate()?;
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

/// Start Live System Boost (Android API 29+ only, no-op on desktop).
#[tauri::command]
#[specta::specta]
pub fn start_live_boost(gain: f64) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        crate::android_fs::call_static_void_float("startLiveBoost", gain as f32)
            .map_err(AppError::Other)?;
        return Ok(());
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = gain;
        Err(AppError::Other("Live system boost is only supported on Android".into()))
    }
}

/// Stop Live System Boost.
#[tauri::command]
#[specta::specta]
pub fn stop_live_boost() -> Result<()> {
    #[cfg(target_os = "android")]
    {
        crate::android_fs::call_static_void("stopLiveBoost").map_err(AppError::Other)?;
        return Ok(());
    }
    #[cfg(not(target_os = "android"))]
    {
        Ok(())
    }
}

/// Dynamically update gain of Live System Boost.
#[tauri::command]
#[specta::specta]
pub fn set_live_boost_gain(gain: f64) -> Result<()> {
    #[cfg(target_os = "android")]
    {
        crate::android_fs::call_static_void_float("setLiveBoostGain", gain as f32)
            .map_err(AppError::Other)?;
        return Ok(());
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = gain;
        Ok(())
    }
}

/// Check status of Live System Boost.
#[tauri::command]
#[specta::specta]
pub fn get_live_boost_status() -> LiveBoostStatus {
    #[cfg(target_os = "android")]
    {
        let is_running = crate::android_fs::call_static_bool("isLiveBoostRunning");
        let is_supported = crate::android_fs::call_static_bool("isLiveBoostSupported");
        return LiveBoostStatus {
            is_running,
            current_gain: 1.5,
            is_supported,
        };
    }
    #[cfg(not(target_os = "android"))]
    {
        LiveBoostStatus {
            is_running: false,
            current_gain: 1.0,
            is_supported: false,
        }
    }
}

/// Whether Live System Boost is supported on this platform.
#[tauri::command]
#[specta::specta]
pub fn is_live_boost_supported() -> bool {
    #[cfg(target_os = "android")]
    return crate::android_fs::call_static_bool("isLiveBoostSupported");
    #[cfg(not(target_os = "android"))]
    false
}

/// Start Volume Booster (AudioEffect-based, Android only).
#[tauri::command]
#[specta::specta]
pub fn start_volume_booster(level: u8) -> Result<BoosterStatus> {
    #[cfg(target_os = "android")]
    {
        let status = crate::android_booster::start_booster_via_jni(level as i32)
            .map_err(AppError::Other)?;
        return Ok(status);
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = level;
        Err(AppError::Other("Volume Booster is only available on Android".into()))
    }
}

/// Stop Volume Booster.
#[tauri::command]
#[specta::specta]
pub fn stop_volume_booster() -> Result<()> {
    #[cfg(target_os = "android")]
    {
        crate::android_booster::stop_booster_via_jni().map_err(AppError::Other)?;
        return Ok(());
    }
    #[cfg(not(target_os = "android"))]
    {
        Ok(())
    }
}

/// Update Volume Booster level without restarting.
#[tauri::command]
#[specta::specta]
pub fn set_booster_level(level: u8) -> Result<BoosterStatus> {
    #[cfg(target_os = "android")]
    {
        let status = crate::android_booster::set_booster_level_via_jni(level as i32)
            .map_err(AppError::Other)?;
        return Ok(status);
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = level;
        Err(AppError::Other("Volume Booster is only available on Android".into()))
    }
}

/// Get Volume Booster status.
#[tauri::command]
#[specta::specta]
pub fn get_booster_status() -> BoosterStatus {
    #[cfg(target_os = "android")]
    {
        return crate::android_booster::get_booster_status_via_jni()
            .unwrap_or(BoosterStatus { enabled: false, level: 0, engine: BoosterEngine::None });
    }
    #[cfg(not(target_os = "android"))]
    {
        BoosterStatus { enabled: false, level: 0, engine: BoosterEngine::None }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn track_info_reads_tags_and_depth() {
        let flac = probe::parse_probe_json(r#"{
            "streams": [{"codec_type": "audio", "codec_name": "flac", "sample_rate": "96000",
                         "channels": 2, "bits_per_raw_sample": "24", "sample_fmt": "s32"}],
            "format": {"bit_rate": "2900000", "tags": {"TITLE": "Song", "ARTIST": "Band"}}
        }"#).unwrap();
        let i = track_info_from(&flac);
        assert_eq!(i.title.as_deref(), Some("Song"));
        assert_eq!(i.artist.as_deref(), Some("Band"));
        assert_eq!((i.sample_rate, i.bit_depth, i.bitrate_kbps), (Some(96000), Some(24), Some(2900)));

        let opus = probe::parse_probe_json(r#"{
            "streams": [{"codec_type": "audio", "codec_name": "pcm_s16le", "sample_fmt": "s16",
                         "tags": {"title": "Stream tag"}}],
            "format": {}
        }"#).unwrap();
        let i = track_info_from(&opus);
        assert_eq!(i.title.as_deref(), Some("Stream tag"));
        assert_eq!(i.bit_depth, Some(16));
    }

    #[test]
    fn embedded_lyrics_finds_id3_and_vorbis_keys() {
        let mp3 = probe::parse_probe_json(r#"{"streams":[{"codec_type":"audio"}],
            "format":{"tags":{"title":"x","lyrics-eng":"[00:01.00]hi"}}}"#).unwrap();
        assert_eq!(embedded_lyrics(&mp3).as_deref(), Some("[00:01.00]hi"));
        let ogg = probe::parse_probe_json(r#"{"streams":[{"codec_type":"audio","tags":{"LYRICS":"la"}}],
            "format":{}}"#).unwrap();
        assert_eq!(embedded_lyrics(&ogg).as_deref(), Some("la"));
        let none = probe::parse_probe_json(r#"{"streams":[{"codec_type":"audio"}],"format":{}}"#).unwrap();
        assert!(embedded_lyrics(&none).is_none());
    }

    #[test]
    fn media_store_lines_parse_and_drop_unknown() {
        let t = parse_media_store_lines(
            "/sdcard/Music/a.mp3\tSong\t<unknown>\tAlb\t185000\t4000\n\n/sdcard/b.flac\t\t\t\t\t\n",
        );
        assert_eq!(t.len(), 2);
        assert_eq!((t[0].title.as_deref(), t[0].artist.as_deref()), (Some("Song"), None));
        assert_eq!((t[0].duration_secs, t[0].size_bytes, t[0].name.as_str()), (185.0, 4000, "a.mp3"));
        assert!(t[1].title.is_none());
    }

    #[test]
    fn collects_audio_recursively_skipping_hidden() {
        let root = std::env::temp_dir().join(format!("ac-lib-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join("Album/.hidden")).unwrap();
        for f in ["Album/1.MP3", "Album/cover.jpg", "Album/.hidden/x.mp3", "2.flac"] {
            std::fs::write(root.join(f), b"").unwrap();
        }
        let mut out = Vec::new();
        collect_audio_files(&root, &mut out);
        out.sort();
        assert_eq!(out.len(), 2);
        assert!(out[0].ends_with("2.flac") && out[1].ends_with("1.MP3"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn parallel_map_keeps_order() {
        let items: Vec<String> = (0..50).map(|i| i.to_string()).collect();
        let out = parallel_map(&items, |s| s.parse::<u32>().unwrap() * 2);
        assert_eq!(out, (0..50).map(|i| i * 2).collect::<Vec<_>>());
    }
}
