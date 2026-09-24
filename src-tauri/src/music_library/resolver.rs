use super::models::AudioTrackInfo;
use super::scan_memo::ScanResultMemo;
use super::scanner;
use std::collections::HashSet;
use std::path::Path;

pub fn percent_encoding_decode(input: &str) -> String {
    let mut bytes = Vec::with_capacity(input.len());
    let mut chars = input.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            if let (Some(h1), Some(h2)) = (chars.next(), chars.next()) {
                let hex_str = [h1, h2];
                if let Ok(s) = std::str::from_utf8(&hex_str) {
                    if let Ok(byte) = u8::from_str_radix(s, 16) {
                        bytes.push(byte);
                        continue;
                    }
                }
                bytes.push(b'%');
                bytes.push(h1);
                bytes.push(h2);
                continue;
            }
        }
        bytes.push(b);
    }
    String::from_utf8_lossy(&bytes).to_string()
}

pub fn resolve_single_track(path_or_uri: &str) -> Result<AudioTrackInfo, String> {
    if path_or_uri.starts_with("content://") {
        #[cfg(target_os = "android")]
        {
            let raw = crate::android_fs::call_static_string_quiet("statUri", path_or_uri);
            let mut parts = raw.splitn(5, '\t');
            let name = parts.next().unwrap_or("");
            let size_bytes = parts
                .next()
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0)
                .max(0) as u64;
            let duration_secs = parts
                .next()
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0)
                .max(0) as f64
                / 1000.0;
            let ok = parts.next().map(|s| s.trim() == "1").unwrap_or(false);
            let perm = parts.next().map(|s| s.trim() == "1").unwrap_or(false);
            if ok && !name.is_empty() {
                let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
                let (format, mime_type) = if ext.is_empty() {
                    ("audio".to_string(), "audio/*".to_string())
                } else {
                    (ext.clone(), scanner::mime_for_ext(&ext))
                };
                return Ok(AudioTrackInfo {
                    id: format!("uri_{path_or_uri}"),
                    uri: path_or_uri.to_string(),
                    path: None,
                    name: name.to_string(),
                    title: Some(name.to_string()),
                    artist: None,
                    album: None,
                    duration_secs,
                    size_bytes,
                    modified_timestamp_ms: 0,
                    created_timestamp_ms: 0,
                    format,
                    mime_type,
                    cover_url: None,
                });
            }
            if perm {
                return Err("Permission denied — please grant media access in Settings".to_string());
            }
            return Err("Could not read file info".to_string());
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

    let p = Path::new(&local_path);
    if !p.exists() {
        return Err(format!("File does not exist: {local_path}"));
    }

    let file_name = p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "track".to_string());

    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("mp3")
        .to_ascii_lowercase();

    let meta = p.metadata().ok();
    let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
    let modified_timestamp_ms = meta
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let created_timestamp_ms = meta
        .as_ref()
        .and_then(|m| m.created().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(modified_timestamp_ms);

    let stem = p
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| file_name.clone());

    let (mut artist, mut title) = if let Some((a, t)) = stem.split_once(" - ") {
        (Some(a.trim().to_string()), Some(t.trim().to_string()))
    } else {
        (None, Some(stem))
    };
    let mut album = None;
    let mut duration_secs = 0.0;

    if let Ok(ffprobe) = crate::ffmpeg::locate::locate("ffprobe") {
        if let Ok(probe) = crate::ffmpeg::probe::probe_file(&ffprobe, &local_path) {
            duration_secs = probe.duration_secs().unwrap_or(0.0);
            if let Some(tags) = probe.format.and_then(|f| f.tags) {
                for (k, v) in tags {
                    match k.to_ascii_lowercase().as_str() {
                        "title" if title.as_deref() != Some(&v) => title = Some(v),
                        "artist" => artist = Some(v),
                        "album" => album = Some(v),
                        _ => {}
                    }
                }
            }
        }
    }

    let cover_url = scanner::find_local_cover_image(p);

    Ok(AudioTrackInfo {
        id: format!("local_{local_path}"),
        uri: format!("file://{local_path}"),
        path: Some(local_path),
        name: file_name,
        title,
        artist,
        album,
        duration_secs,
        size_bytes,
        modified_timestamp_ms,
        created_timestamp_ms,
        format: ext.clone(),
        mime_type: scanner::mime_for_ext(&ext),
        cover_url,
    })
}

/// Resolve a list of file or directory paths into parsed AudioTrackInfo records.
/// Recursively traverses directories up to depth 5 for supported audio files.
/// Non-audio files are safely filtered out.
/// Preserves natural alphanumeric track ordering.
pub fn resolve_paths(paths: Vec<String>) -> Vec<AudioTrackInfo> {
    let mut results = Vec::new();
    let mut seen_uris = HashSet::new();
    let mut memo = ScanResultMemo::load();

    for raw in paths {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }

        let local_path = if let Some(stripped) = trimmed.strip_prefix("file://") {
            percent_encoding_decode(stripped)
        } else {
            trimmed.to_string()
        };

        let path = Path::new(&local_path);
        if !path.exists() {
            if trimmed.starts_with("content://") {
                if let Ok(track) = resolve_single_track(trimmed) {
                    if seen_uris.insert(track.uri.clone()) {
                        results.push(track);
                    }
                }
            }
            continue;
        }

        if path.is_dir() {
            let mut batch = Vec::new();
            scanner::scan_local_directory(path, 5, &mut batch, 2000, &mut memo);
            batch.sort_by_key(|a| a.name.to_lowercase());
            for track in batch {
                if seen_uris.insert(track.uri.clone()) {
                    results.push(track);
                }
            }
        } else if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if scanner::is_audio_ext(ext) {
                    if let Ok(track) = resolve_single_track(&local_path) {
                        if seen_uris.insert(track.uri.clone()) {
                            results.push(track);
                        }
                    }
                }
            }
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_paths_directory_and_files() {
        let temp_dir = std::env::temp_dir().join(format!(
            "audiflow_test_drop_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = std::fs::create_dir_all(&temp_dir);
        let sub_dir = temp_dir.join("sub");
        let _ = std::fs::create_dir_all(&sub_dir);

        let file_b = temp_dir.join("track_b.mp3");
        let file_a = temp_dir.join("track_a.flac");
        let file_txt = temp_dir.join("notes.txt");
        let file_c = sub_dir.join("track_c.wav");

        let _ = std::fs::write(&file_b, b"fake mp3 audio data");
        let _ = std::fs::write(&file_a, b"fake flac audio data");
        let _ = std::fs::write(&file_txt, b"non audio text");
        let _ = std::fs::write(&file_c, b"fake wav audio data");

        let resolved = resolve_paths(vec![temp_dir.to_string_lossy().to_string()]);

        // Clean up
        let _ = std::fs::remove_dir_all(&temp_dir);

        assert_eq!(resolved.len(), 3);
        assert_eq!(resolved[0].name, "track_a.flac");
        assert_eq!(resolved[1].name, "track_b.mp3");
        assert_eq!(resolved[2].name, "track_c.wav");
    }

    #[test]
    fn test_resolve_paths_empty_or_nonexistent() {
        let resolved = resolve_paths(vec![
            "/non/existent/path/here.mp3".to_string(),
            "   ".to_string(),
        ]);
        assert!(resolved.is_empty());
    }
}
