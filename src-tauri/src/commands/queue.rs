use std::collections::HashSet;
use std::path::Path;

use tauri::State;

use crate::error::{AppError, Result};
use crate::queue::{JobRecord, QueueManager};
use crate::settings::Settings;
use crate::types::{BoosterJobSpec, ConversionOptions, TrimSpec};

/// Normalize a `file://` URI into a plain local path.
///
/// Linux "Open With" passes `%U` file:// URIs into argv, and pickers/drop
/// handlers may leak them too. The converter worker hands paths to ffmpeg
/// verbatim, so an un-normalized URI fails deep inside the job instead of at
/// ingest. Handles `file://`, `file://localhost/`, Windows drive form
/// (`file:///C:/...`), and `%XX` escapes. Non-file inputs (plain paths,
/// Android `content://`) pass through untouched.
pub(crate) fn normalize_file_uri(path: &str) -> String {
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
pub(crate) fn percent_decode(s: &str) -> String {
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
    let mut seen = HashSet::new();
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
    let mut seen = HashSet::new();
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
        assert_eq!(
            normalize_file_uri("file:///C:/Music/song.mp3"),
            "C:/Music/song.mp3"
        );
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
