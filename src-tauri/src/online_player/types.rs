use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct OnlineTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub duration_secs: u32,
    pub thumbnail_url: Option<String>,
    pub provider: String,
    pub stream_identifier: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StreamSource {
    pub stream_url: String,
    pub mime_type: String,
    pub format: String,
    pub bitrate_kbps: Option<u32>,
    pub is_proxied: bool,
    pub headers: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TimedLyricLine {
    pub time_ms: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TimedLyrics {
    pub track_id: String,
    pub is_synced: bool,
    pub lines: Vec<TimedLyricLine>,
    pub plain_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedMedia {
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub format: String,
    pub size_bytes: u64,
}
