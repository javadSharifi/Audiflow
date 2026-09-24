use crate::error::{AppError, Result};
pub use crate::music_library::models::{AudioTrackInfo, LibraryPermissionStatus};
pub use crate::music_library::ScanResultCacheStats;

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
pub fn scan_result_cache_stats() -> ScanResultCacheStats {
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
        crate::music_library::delete_audio_track(&path_or_uri).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set track as default ringtone (Android).
#[tauri::command]
#[specta::specta]
pub async fn set_as_ringtone(path_or_uri: String) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::set_as_ringtone(&path_or_uri).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Share track via system share sheet.
#[tauri::command]
#[specta::specta]
pub async fn share_audio_track(
    path_or_uri: String,
    title: String,
    mime_type: String,
) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::share_audio_track(&path_or_uri, &title, &mime_type)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Resolve a single audio file path or content:// URI into an AudioTrackInfo struct.
#[tauri::command]
#[specta::specta]
pub async fn resolve_audio_track(path_or_uri: String) -> Result<AudioTrackInfo> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::resolve_single_track(&path_or_uri).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Resolve a list of file or directory paths into parsed AudioTrackInfo records.
/// Recursively traverses directories up to depth 5 for supported audio files.
#[tauri::command]
#[specta::specta]
pub async fn resolve_audio_paths(paths: Vec<String>) -> Vec<AudioTrackInfo> {
    tauri::async_runtime::spawn_blocking(move || crate::music_library::resolve_paths(paths))
        .await
        .unwrap_or_default()
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
