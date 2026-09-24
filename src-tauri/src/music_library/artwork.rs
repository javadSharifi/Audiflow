//! Lazy per-track artwork extraction (Namida-style artwork cache).
//!
//! Scanning never extracts pictures (that would slow every library scan to a
//! crawl). Instead the UI resolves a cover on demand via the
//! `get_track_artwork` command and caches one JPEG per track:
//!
//! - Android: `MediaMetadataRetriever.embeddedPicture` through
//!   `MainActivity.getEmbeddedArtwork` (no staging/copy of the audio needed).
//! - Desktop: the already-bundled ffmpeg extracts the attached picture
//!   (`-map 0:v`, the same fallback Namida uses when taglib finds nothing).
//!
//! Cache file names are stable across runs (FNV-1a of the track uri), so a
//! cover resolved once is reused by the list UI *and* by the media
//! notification (PlaybackService checks the same `artworks/` dir).

use std::path::{Path, PathBuf};

/// Stable 64-bit FNV-1a hash (unlike `DefaultHasher`, deterministic across
/// processes — required so cache files are found again after a restart).
/// Desktop-only: on Android the Kotlin side owns cache file naming.
#[cfg(not(target_os = "android"))]
fn stable_hash(input: &str) -> u64 {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    let mut hash = FNV_OFFSET;
    for b in input.bytes() {
        hash ^= b as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

/// Album tiles render at ≤64dp; a 256px square JPEG is visually lossless
/// for them yet ~10–40× smaller and faster to decode than the full-res
/// embedded picture (Namida's full-size artwork cache famously grew to
/// 2 GB on large libraries — never cache at source resolution).
const THUMBNAIL_SIZE: u32 = 256;

/// Legacy full-res extractions above this size are treated as cache
/// misses so they are lazily re-extracted at thumbnail size on display.
/// A 256px JPEG lands well under 100 KB; 512 KB is a generous ceiling.
const MAX_CACHE_FILE_BYTES: u64 = 512 * 1024;

#[cfg(not(target_os = "android"))]
fn thumbnail_filter() -> String {
    format!(
        "scale={s}:{s}:force_original_aspect_ratio=increase,crop={s}:{s}",
        s = THUMBNAIL_SIZE
    )
}

#[cfg(not(target_os = "android"))]
fn cache_file_name(cache_key: &str) -> String {
    format!("art_{:016x}.jpg", stable_hash(cache_key))
}

/// Directory holding one cached JPEG per track. Created on demand.
///
/// Desktop uses the OS *cache* dir (not temp): temp dirs are subject to
/// automatic cleanup between sessions, which silently discarded every
/// extracted cover and forced a full re-extraction on the next cold start.
/// A legacy temp-dir copy (if present) is still accepted as a cache hit and
/// migrated lazily, so nothing is re-extracted on upgrade.
pub fn artwork_cache_dir() -> Option<PathBuf> {
    #[cfg(target_os = "android")]
    {
        let base = std::env::var("TAURI_ANDROID_CACHE_DIR").ok()?;
        let dir = PathBuf::from(base).join("artworks");
        std::fs::create_dir_all(&dir).ok()?;
        Some(dir)
    }
    #[cfg(not(target_os = "android"))]
    {
        let base = directories::ProjectDirs::from("com", "Audiflow", "audiflow")
            .map(|p| p.cache_dir().to_path_buf())
            .unwrap_or_else(std::env::temp_dir);
        let dir = base.join("artworks");
        std::fs::create_dir_all(&dir).ok()?;
        Some(dir)
    }
}

/// Pre-migration cache location (temp dir). Reads accepted; new writes go
/// to the durable cache dir.
#[cfg(not(target_os = "android"))]
fn legacy_artwork_cache_dir() -> Option<PathBuf> {
    let dir = std::env::temp_dir().join("audiflow-artworks");
    if dir.is_dir() {
        Some(dir)
    } else {
        let old = std::env::temp_dir().join("audio-converter-artworks");
        if old.is_dir() {
            Some(old)
        } else {
            None
        }
    }
}

#[cfg(not(target_os = "android"))]
fn cached_hit(dir: &Path, name: &str) -> Option<String> {
    let path = dir.join(name);
    match std::fs::metadata(&path) {
        // Oversized files are legacy full-res extractions: serve nothing so
        // the caller re-extracts at thumbnail size (converges in one pass).
        Ok(m) if m.is_file() && m.len() > 0 && m.len() <= MAX_CACHE_FILE_BYTES => {
            Some(path.to_string_lossy().into_owned())
        }
        _ => None,
    }
}

/// Resolve the readable cached artwork path for one audio file.
///
/// `path_or_uri` is the *audio* reference (track uri / path) — never an
/// artwork URI. Returns `None` when the file carries no embedded picture.
/// Never fails hard: every error maps to `None` so the UI falls back to its
/// gradient placeholder.
pub fn get_track_artwork(path_or_uri: &str) -> Option<String> {
    if path_or_uri.is_blank() {
        return None;
    }

    #[cfg(target_os = "android")]
    {
        // MediaMetadataRetriever reads content:// + file paths directly —
        // no staging of (potentially large) audio files into app storage.
        let cached = crate::android_fs::call_static_string_quiet("getEmbeddedArtwork", path_or_uri);
        if cached.is_empty() {
            return None;
        }
        return match std::fs::metadata(&cached) {
            Ok(m) if m.is_file() && m.len() > 0 => Some(cached),
            _ => None,
        };
    }

    #[cfg(not(target_os = "android"))]
    {
        let dir = artwork_cache_dir()?;
        let name = cache_file_name(path_or_uri);
        if let Some(hit) = cached_hit(&dir, &name) {
            return Some(hit);
        }
        // Lazy migration: a hit in the legacy temp cache is moved into the
        // durable cache dir so it survives OS temp cleanup going forward.
        if let Some(legacy_dir) = legacy_artwork_cache_dir() {
            if let Some(legacy_hit) = cached_hit(&legacy_dir, &name) {
                let target = dir.join(&name);
                if std::fs::rename(&legacy_hit, &target).is_ok()
                    || std::fs::copy(&legacy_hit, &target).is_ok()
                {
                    if let Some(hit) = cached_hit(&dir, &name) {
                        return Some(hit);
                    }
                }
                return Some(legacy_hit);
            }
        }

        let local_path = if let Some(stripped) = path_or_uri.strip_prefix("file://") {
            crate::music_library::percent_encoding_decode(stripped)
        } else {
            path_or_uri.to_string()
        };
        if !std::path::Path::new(&local_path).is_file() {
            return None;
        }

        let ffmpeg = crate::ffmpeg::locate::ffmpeg_path().ok()?;
        let out_path = dir.join(&name);
        let out_str = out_path.to_string_lossy().into_owned();
        // Attached-picture-only extract: no audio decode, fails fast when
        // the file has no video/picture stream attached.
        let status = std::process::Command::new(&ffmpeg)
            .args([
                "-y",
                "-v",
                "error",
                "-i",
                &local_path,
                "-map",
                "0:v",
                "-frames:v",
                "1",
                "-q:v",
                "4",
                "-vf",
                &thumbnail_filter(),
                &out_str,
            ])
            .status()
            .ok()?;
        if !status.success() {
            let _ = std::fs::remove_file(&out_path);
            return None;
        }
        cached_hit(&dir, &name)
    }
}

trait IsBlank {
    fn is_blank(&self) -> bool;
}

impl IsBlank for str {
    fn is_blank(&self) -> bool {
        self.trim().is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_hash_is_deterministic() {
        assert_eq!(
            stable_hash("content://media/1"),
            stable_hash("content://media/1")
        );
        assert_ne!(
            stable_hash("content://media/1"),
            stable_hash("content://media/2")
        );
    }

    #[test]
    fn cache_file_name_has_jpg_extension() {
        let name = cache_file_name("some-uri");
        assert!(name.starts_with("art_"));
        assert!(name.ends_with(".jpg"));
    }

    #[test]
    fn blank_input_returns_none() {
        assert_eq!(get_track_artwork(""), None);
        assert_eq!(get_track_artwork("   "), None);
    }

    #[test]
    fn missing_file_returns_none_without_panic() {
        assert_eq!(get_track_artwork("/definitely/not/here/song.mp3"), None);
        assert_eq!(
            get_track_artwork("file:///definitely/not/here/song.mp3"),
            None
        );
    }

    #[test]
    fn thumbnail_filter_produces_square_256() {
        // The extraction must downscale: full-res embedded art made caches
        // grow enormous and slowed WebView decode for ≤64dp tiles.
        assert_eq!(
            thumbnail_filter(),
            "scale=256:256:force_original_aspect_ratio=increase,crop=256:256"
        );
    }

    #[test]
    fn desktop_cache_dir_is_durable_and_not_os_temp() {
        // The artwork cache must live in the OS cache dir, not the temp dir —
        // temp is auto-cleaned between sessions, which silently discarded
        // every extracted cover on the next cold start.
        let dir = artwork_cache_dir().expect("cache dir must resolve");
        let temp = std::env::temp_dir();
        assert!(
            !dir.starts_with(&temp),
            "artwork cache dir {:?} must not live under temp {:?}",
            dir,
            temp
        );
    }
}
