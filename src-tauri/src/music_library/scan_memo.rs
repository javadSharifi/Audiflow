//! Durable per-file scan memo: the "database" behind incremental rescans.
//!
//! A full library scan walks every directory and hits `stat` on every file.
//! Profiling showed the walk itself is fast — the per-file parsing (cover
//! lookup, name normalization) is what makes rescans feel slow. This module
//! persists one small record per unchanged file so the NEXT scan reuses the
//! previous track record verbatim when `(path, size, mtime)` are identical,
//! and only parses new/changed files.
//!
//! Storage: a single JSON file (`scan_memo.v1.json`) in the OS cache dir
//! (same durable location as the artwork cache — never temp). JSON was
//! chosen over SQLite/bincode deliberately: it deserializes in a single
//! pass at scan start, survives upgrades without migrations, and the whole
//! memo for a 5000-file library is ~1 MB. specta-exportable for IPC.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use super::models::AudioTrackInfo;

/// Version marker inside the memo file: bump when the record schema changes.
const MEMO_SCHEMA_VERSION: u32 = 1;

fn memo_file_path() -> Option<PathBuf> {
    // Same durable base as the artwork cache.
    let base = directories::ProjectDirs::from("com", "AudioConverter", "audio-converter")
        .map(|p| p.cache_dir().to_path_buf())
        .unwrap_or_else(std::env::temp_dir);
    let dir = base.join("library");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("scan_memo.v1.json"))
}

/// One cached record: identity + the track it produced.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MemoRecord {
    pub size_bytes: u64,
    pub modified_timestamp_ms: u64,
    pub track: AudioTrackInfo,
}

#[derive(Default, Debug, serde::Serialize, serde::Deserialize)]
struct MemoFile {
    schema: u32,
    records: HashMap<String, MemoRecord>,
}

/// Diagnostics for the last native scan (IPC-exported).
///
/// All counters are u32 on the wire: specta forbids u64 (BigInt precision
/// loss in JS). A library would need 4 billion files to overflow — the scan
/// itself caps at 5000 records per root.
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanResultCacheStats {
    pub walked_files: u32,
    pub scanned_files: u32,
    pub reused_files: u32,
    pub bytes_read: u32,
    pub track_records: u32,
    pub scan_millis: u32,
}

/// In-memory memo: loaded once per scan, keyed by canonical file path.
pub struct ScanResultMemo {
    records: HashMap<String, MemoRecord>,
    dirty: bool,
    scanned_files: u64,
    reused_files: u64,
    walked_files: u64,
    bytes_read: u64,
}

impl ScanResultMemo {
    pub fn load() -> Self {
        let mut memo = ScanResultMemo {
            records: HashMap::new(),
            dirty: false,
            scanned_files: 0,
            reused_files: 0,
            walked_files: 0,
            bytes_read: 0,
        };
        if let Some(path) = memo_file_path() {
            if let Ok(raw) = std::fs::read(&path) {
                if let Ok(parsed) = serde_json::from_slice::<MemoFile>(&raw) {
                    if parsed.schema == MEMO_SCHEMA_VERSION {
                        memo.records = parsed.records;
                    }
                }
            }
        }
        memo
    }

    /// Look up an unchanged file by (path, size, mtime). A hit returns the
    /// previous track record directly — no parsing needed.
    pub fn reuse_if_unchanged(
        &mut self,
        path_key: &str,
        size_bytes: u64,
        modified_timestamp_ms: u64,
    ) -> Option<AudioTrackInfo> {
        self.walked_files += 1;
        match self.records.get(path_key) {
            Some(rec)
                if rec.size_bytes == size_bytes
                    && rec.modified_timestamp_ms == modified_timestamp_ms =>
            {
                self.reused_files += 1;
                Some(rec.track.clone())
            }
            _ => {
                self.scanned_files += 1;
                None
            }
        }
    }

    /// Store the freshly parsed record for the next scan.
    pub fn remember(&mut self, path_key: String, track: &AudioTrackInfo) {
        self.records.insert(
            path_key,
            MemoRecord {
                size_bytes: track.size_bytes,
                modified_timestamp_ms: track.modified_timestamp_ms,
                track: track.clone(),
            },
        );
        self.dirty = true;
    }

    /// Drop records whose files no longer exist (called once per scan).
    pub fn prune_missing(&mut self, existing: &std::collections::HashSet<String>) {
        let before = self.records.len();
        self.records.retain(|k, _| existing.contains(k));
        if self.records.len() != before {
            self.dirty = true;
        }
    }

    pub fn note_bytes(&mut self, bytes: u64) {
        self.bytes_read += bytes;
    }

    /// Persist (only when changed) and record last-scan stats.
    pub fn finish(self, track_records: usize, scan_millis: u64) {
        let ScanResultMemo {
            mut records,
            dirty,
            scanned_files,
            reused_files,
            walked_files,
            bytes_read,
        } = self;
        if dirty {
            if let Some(path) = memo_file_path() {
                let file = MemoFile {
                    schema: MEMO_SCHEMA_VERSION,
                    records: std::mem::take(&mut records),
                };
                // Atomic write: temp + rename, same discipline as DSP outputs.
                let tmp = path.with_extension("tmp");
                if serde_json::to_vec(&file)
                    .ok()
                    .and_then(|bytes| {
                        std::fs::write(&tmp, &bytes).ok()?;
                        std::fs::rename(&tmp, &path).ok()
                    })
                    .is_none()
                {
                    let _ = std::fs::remove_file(&tmp);
                }
            }
        }
        let stats = ScanResultCacheStats {
            walked_files: walked_files as u32,
            scanned_files: scanned_files as u32,
            reused_files: reused_files as u32,
            bytes_read: bytes_read as u32,
            track_records: track_records as u32,
            scan_millis: scan_millis as u32,
        };
        if let Ok(guard) = last_scan_stats_slot().lock() {
            let mut guard = guard;
            *guard = stats;
        }
    }
}

fn last_scan_stats_slot() -> &'static Mutex<ScanResultCacheStats> {
    static SLOT: OnceLock<Mutex<ScanResultCacheStats>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(ScanResultCacheStats::default()))
}

/// Statistics from the last native scan (IPC surface).
pub fn last_scan_stats() -> ScanResultCacheStats {
    last_scan_stats_slot()
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
}

/// Immediately evict a deleted file's record (called by track deletion).
pub fn record_deleted_path(path_key: &str) {
    if let Some(path) = memo_file_path() {
        if let Ok(raw) = std::fs::read(&path) {
            if let Ok(mut file) = serde_json::from_slice::<MemoFile>(&raw) {
                if file.records.remove(path_key).is_some() {
                    let tmp = path.with_extension("tmp");
                    if serde_json::to_vec(&file)
                        .ok()
                        .and_then(|bytes| {
                            std::fs::write(&tmp, &bytes).ok()?;
                            std::fs::rename(&tmp, &path).ok()
                        })
                        .is_none()
                    {
                        let _ = std::fs::remove_file(&tmp);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_track(path: &str, size: u64, mtime: u64) -> AudioTrackInfo {
        AudioTrackInfo {
            id: format!("local_{path}"),
            uri: format!("file://{path}"),
            path: Some(path.to_string()),
            name: "song.mp3".to_string(),
            title: Some("song".to_string()),
            artist: None,
            album: None,
            duration_secs: 180.0,
            size_bytes: size,
            modified_timestamp_ms: mtime,
            created_timestamp_ms: mtime,
            format: "mp3".to_string(),
            mime_type: "audio/mpeg".to_string(),
            cover_url: None,
        }
    }

    fn empty_memo() -> ScanResultMemo {
        ScanResultMemo {
            records: HashMap::new(),
            dirty: false,
            scanned_files: 0,
            reused_files: 0,
            walked_files: 0,
            bytes_read: 0,
        }
    }

    #[test]
    fn unchanged_file_reuses_record_and_changed_file_misses() {
        let mut memo = empty_memo();
        memo.remember("/music/a.mp3".to_string(), &sample_track("/music/a.mp3", 100, 1000));

        // Identical identity → hit, no re-parse.
        let hit = memo.reuse_if_unchanged("/music/a.mp3", 100, 1000);
        assert!(hit.is_some());
        assert_eq!(hit.unwrap().title.as_deref(), Some("song"));
        assert_eq!(memo.reused_files, 1);

        // Changed size → miss.
        assert!(memo.reuse_if_unchanged("/music/a.mp3", 200, 1000).is_none());
        // Changed mtime → miss.
        assert!(memo.reuse_if_unchanged("/music/a.mp3", 100, 2000).is_none());
        // Unknown path → miss.
        assert!(memo.reuse_if_unchanged("/music/b.mp3", 100, 1000).is_none());
        assert_eq!(memo.scanned_files, 3);
    }

    #[test]
    fn memo_roundtrips_through_json_with_schema_guard() {
        let mut memo = empty_memo();
        memo.remember("/music/a.mp3".to_string(), &sample_track("/music/a.mp3", 5, 9));
        let file = MemoFile {
            schema: MEMO_SCHEMA_VERSION,
            records: memo.records.clone(),
        };
        let bytes = serde_json::to_vec(&file).expect("memo must serialize");
        let back: MemoFile = serde_json::from_slice(&bytes).expect("memo must deserialize");
        assert_eq!(back.schema, MEMO_SCHEMA_VERSION);
        let rec = back.records.get("/music/a.mp3").expect("record survives");
        assert_eq!(rec.track.size_bytes, 5);
    }
}

