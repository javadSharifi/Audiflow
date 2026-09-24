pub mod artwork;
pub mod models;
pub mod platform;
pub mod resolver;
pub mod scan_memo;
pub mod scanner;

pub use models::{AudioTrackInfo, LibraryPermissionStatus};
pub use resolver::{percent_encoding_decode, resolve_paths, resolve_single_track};
pub use scan_memo::{last_scan_stats, record_deleted_path, ScanResultCacheStats, ScanResultMemo};

use std::collections::HashSet;
use std::path::PathBuf;

pub fn get_music_permission_status() -> LibraryPermissionStatus {
    platform::android::get_permission_status()
}

pub fn scan_music_library(custom_dirs: Option<Vec<String>>) -> Vec<AudioTrackInfo> {
    // 1. Android MediaStore path
    #[cfg(target_os = "android")]
    {
        if custom_dirs.is_none() || custom_dirs.as_ref().map(|d| d.is_empty()).unwrap_or(true) {
            let media_store_tracks = platform::android::scan_media_store();
            if !media_store_tracks.is_empty() {
                return media_store_tracks;
            }
        }
    }

    // 2. Resolve roots for desktop scanning or custom directory picks
    let mut scan_roots: Vec<PathBuf> = Vec::new();

    if let Some(dirs) = custom_dirs {
        for d in dirs {
            let p = PathBuf::from(d);
            if p.exists() && p.is_dir() {
                scan_roots.push(p);
            }
        }
    }

    if scan_roots.is_empty() {
        #[cfg(target_os = "windows")]
        {
            scan_roots.extend(platform::windows::get_music_directories());
        }

        #[cfg(target_os = "macos")]
        {
            scan_roots.extend(platform::macos::get_music_directories());
        }

        #[cfg(target_os = "linux")]
        {
            scan_roots.extend(platform::linux::get_music_directories());
        }

        #[cfg(target_os = "android")]
        {
            for p in &[
                "/storage/emulated/0/Music",
                "/storage/emulated/0/Download",
                "/sdcard/Music",
                "/sdcard/Download",
            ] {
                let path = PathBuf::from(p);
                if path.exists() {
                    scan_roots.push(path);
                }
            }
        }
    }

    let mut results = Vec::new();
    let mut seen_uris = HashSet::new();

    // Incremental memo: unchanged files skip parsing entirely.
    let started = std::time::Instant::now();
    let mut memo = ScanResultMemo::load();
    for root in scan_roots {
        let mut batch = Vec::new();
        scanner::scan_local_directory(&root, 5, &mut batch, 5000, &mut memo);
        for track in batch {
            if seen_uris.insert(track.uri.clone()) {
                results.push(track);
            }
        }
    }

    // Default sort: newest added / modified first
    results.sort_by(|a, b| {
        let time_a = a.created_timestamp_ms.max(a.modified_timestamp_ms);
        let time_b = b.created_timestamp_ms.max(b.modified_timestamp_ms);
        time_b.cmp(&time_a)
    });

    // Retire memo records for files gone from disk (aligned with the
    // frontend rule that background scans must reflect deletions).
    memo.prune_missing(&seen_paths(&results));
    memo.finish(results.len(), started.elapsed().as_millis() as u64);

    results
}

/// Canonical path keys of the current scan, for memo pruning.
fn seen_paths(results: &[AudioTrackInfo]) -> HashSet<String> {
    results.iter().filter_map(|t| t.path.clone()).collect()
}

pub fn delete_audio_track(path_or_uri: &str) -> Result<(), String> {
    if path_or_uri.starts_with("content://") {
        #[cfg(target_os = "android")]
        {
            return platform::android::delete_track(path_or_uri);
        }
        #[cfg(not(target_os = "android"))]
        {
            return Err("Content URIs are only supported on Android.".to_string());
        }
    }

    let local_path = if let Some(stripped) = path_or_uri.strip_prefix("file://") {
        percent_encoding_decode(stripped)
    } else {
        path_or_uri.to_string()
    };

    // Defensive validation: only audio files may be deleted via this command.
    // This does NOT restrict which directory audio may live in — external drives,
    // Downloads, custom folders, and arbitrary user paths are all fine, as long as
    // the file has a recognised audio extension.
    let p = std::path::Path::new(&local_path);
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if !scanner::is_audio_ext(&ext) {
        return Err(format!(
            "Deletion rejected: '{}' is not a recognised audio file extension. \
             Only audio library tracks may be deleted via this command.",
            if ext.is_empty() {
                "(no extension)"
            } else {
                &ext
            }
        ));
    }

    if p.exists() {
        std::fs::remove_file(p).map_err(|e| format!("Failed to delete file: {e}"))?;
        // Keep the scan memo honest: a deleted file must never resurrect
        // from the incremental cache.
        record_deleted_path(&local_path);
        Ok(())
    } else {
        Err(format!("File does not exist: {local_path}"))
    }
}

pub fn set_as_ringtone(path_or_uri: &str) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        platform::android::set_ringtone(path_or_uri)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = path_or_uri;
        Err("Ringtone setting is only available on mobile Android devices.".to_string())
    }
}

pub fn share_audio_track(path_or_uri: &str, title: &str, mime_type: &str) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        platform::android::share_track(path_or_uri, title, mime_type)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (path_or_uri, title, mime_type);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Helper: create a real temporary audio file so delete_audio_track reaches
    // the filesystem remove step (past the extension guard).
    // -------------------------------------------------------------------------
    fn tmp_audio(ext: &str) -> std::path::PathBuf {
        let name = format!(
            "audiflow_del_test_{}.{ext}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos()
        );
        let p = std::env::temp_dir().join(name);
        std::fs::write(&p, b"fake audio data").expect("write temp audio");
        p
    }

    // -------------------------------------------------------------------------
    // 1. Valid audio deletion — recognised extension + existing file → Ok(())
    // -------------------------------------------------------------------------

    #[test]
    fn delete_valid_mp3_succeeds() {
        let p = tmp_audio("mp3");
        let result = delete_audio_track(&p.to_string_lossy());
        assert!(result.is_ok(), "expected Ok, got: {result:?}");
        assert!(!p.exists(), "file must be gone after deletion");
    }

    #[test]
    fn delete_valid_flac_succeeds() {
        let p = tmp_audio("flac");
        assert!(delete_audio_track(&p.to_string_lossy()).is_ok());
        assert!(!p.exists());
    }

    #[test]
    fn delete_valid_wav_succeeds() {
        let p = tmp_audio("wav");
        assert!(delete_audio_track(&p.to_string_lossy()).is_ok());
        assert!(!p.exists());
    }

    #[test]
    fn delete_valid_m4a_succeeds() {
        let p = tmp_audio("m4a");
        assert!(delete_audio_track(&p.to_string_lossy()).is_ok());
        assert!(!p.exists());
    }

    #[test]
    fn delete_valid_ogg_succeeds() {
        let p = tmp_audio("ogg");
        assert!(delete_audio_track(&p.to_string_lossy()).is_ok());
        assert!(!p.exists());
    }

    // -------------------------------------------------------------------------
    // 2. Invalid / non-audio extension — rejected BEFORE touching disk.
    // -------------------------------------------------------------------------

    #[test]
    fn delete_txt_is_rejected() {
        let p = tmp_audio("txt");
        let result = delete_audio_track(&p.to_string_lossy());
        assert!(result.is_err(), "txt must be rejected");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("Deletion rejected"),
            "error must say 'Deletion rejected', got: {msg}"
        );
        // Guard fires before fs::remove_file — the file must still exist.
        assert!(p.exists(), "file must NOT be deleted when guard fires");
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn delete_exe_is_rejected() {
        let p = tmp_audio("exe");
        assert!(delete_audio_track(&p.to_string_lossy()).is_err());
        assert!(p.exists());
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn delete_sh_is_rejected() {
        let p = tmp_audio("sh");
        assert!(delete_audio_track(&p.to_string_lossy()).is_err());
        assert!(p.exists());
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn delete_pdf_is_rejected() {
        let p = tmp_audio("pdf");
        assert!(delete_audio_track(&p.to_string_lossy()).is_err());
        assert!(p.exists());
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn delete_json_is_rejected() {
        let p = tmp_audio("json");
        assert!(delete_audio_track(&p.to_string_lossy()).is_err());
        assert!(p.exists());
        let _ = std::fs::remove_file(&p);
    }

    // -------------------------------------------------------------------------
    // 3. No extension — rejected (no audio extension recognised).
    // -------------------------------------------------------------------------

    #[test]
    fn delete_no_extension_is_rejected() {
        let name = format!(
            "audiflow_noext_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos()
        );
        let p = std::env::temp_dir().join(name);
        std::fs::write(&p, b"no extension").unwrap();
        let result = delete_audio_track(&p.to_string_lossy());
        assert!(result.is_err(), "no-extension path must be rejected");
        let msg = result.unwrap_err();
        assert!(
            msg.contains("Deletion rejected"),
            "must cite rejection reason, got: {msg}"
        );
        assert!(p.exists());
        let _ = std::fs::remove_file(&p);
    }

    // -------------------------------------------------------------------------
    // 4. file:// URI prefix is stripped correctly before extension check.
    // -------------------------------------------------------------------------

    #[test]
    fn delete_file_uri_audio_succeeds() {
        let p = tmp_audio("opus");
        let uri = format!("file://{}", p.to_string_lossy());
        let result = delete_audio_track(&uri);
        assert!(result.is_ok(), "file:// audio URI must succeed: {result:?}");
        assert!(!p.exists());
    }

    #[test]
    fn delete_file_uri_non_audio_is_rejected() {
        let p = tmp_audio("cfg");
        let uri = format!("file://{}", p.to_string_lossy());
        let result = delete_audio_track(&uri);
        assert!(result.is_err(), "file:// non-audio URI must be rejected");
        assert!(p.exists());
        let _ = std::fs::remove_file(&p);
    }

    // -------------------------------------------------------------------------
    // 5. Percent-encoded file:// URI is decoded before extension check.
    // -------------------------------------------------------------------------

    #[test]
    fn delete_percent_encoded_audio_uri_succeeds() {
        let dir = std::env::temp_dir();
        let name = format!("audiflow del test {}.mp3", std::process::id());
        let p = dir.join(&name);
        std::fs::write(&p, b"fake").unwrap();
        let encoded_name = name.replace(' ', "%20");
        let uri = format!("file://{}/{}", dir.to_string_lossy(), encoded_name);
        let result = delete_audio_track(&uri);
        assert!(
            result.is_ok(),
            "percent-encoded audio URI must succeed: {result:?}"
        );
        assert!(!p.exists());
    }

    // -------------------------------------------------------------------------
    // 6. Non-existent audio path — clear error, not a panic.
    // -------------------------------------------------------------------------

    #[test]
    fn delete_nonexistent_audio_path_returns_err() {
        let result = delete_audio_track("/tmp/audiflow_nonexistent_99999.mp3");
        assert!(result.is_err());
        let msg = result.unwrap_err();
        // Passes the extension guard but fails at the existence check.
        assert!(
            msg.contains("does not exist"),
            "error must mention 'does not exist', got: {msg}"
        );
    }

    // -------------------------------------------------------------------------
    // 7. Path traversal: "../../etc/passwd" has no audio extension → rejected.
    //    The extension guard catches non-audio traversal targets.
    // -------------------------------------------------------------------------

    #[test]
    fn delete_path_traversal_non_audio_is_rejected() {
        let result = delete_audio_track("../../etc/passwd");
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.contains("Deletion rejected") || msg.contains("does not exist"),
            "traversal must be rejected, got: {msg}"
        );
    }

    #[test]
    fn delete_file_uri_path_traversal_non_audio_is_rejected() {
        let result = delete_audio_track("file://../../etc/passwd");
        assert!(result.is_err());
    }

    // -------------------------------------------------------------------------
    // 8. Case-insensitive extension matching (MP3 / FLAC uppercase accepted).
    // -------------------------------------------------------------------------

    #[test]
    fn delete_uppercase_extension_audio_succeeds() {
        // is_audio_ext normalises to ascii_lowercase, so uppercase must work.
        let p = tmp_audio("MP3");
        let result = delete_audio_track(&p.to_string_lossy());
        assert!(
            result.is_ok(),
            "uppercase extension must be accepted: {result:?}"
        );
        assert!(!p.exists());
    }
}
