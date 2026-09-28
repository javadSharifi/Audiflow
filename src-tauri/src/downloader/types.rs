use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MusicSearchResult {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub uploader: Option<String>,
    pub album: Option<String>,
    pub duration_secs: Option<f64>,
    pub thumbnail_url: Option<String>,
    pub webpage_url: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct MusicSource {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Queued,
    Preparing,
    Downloading,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressPayload {
    pub id: String,
    pub percent: f64,
    #[specta(type = u32)]
    pub downloaded_bytes: Option<u64>,
    #[specta(type = u32)]
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_sec: Option<f64>,
    #[specta(type = u32)]
    pub eta_secs: Option<u64>,
    pub status: DownloadStatus,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub id: String,
    pub webpage_url: String,
    pub title: String,
    pub artist: Option<String>,
    pub thumbnail_url: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct DownloadItem {
    pub id: String,
    pub webpage_url: String,
    pub title: String,
    pub artist: Option<String>,
    pub thumbnail_url: Option<String>,
    pub status: DownloadStatus,
    pub percent: f64,
    #[specta(type = u32)]
    pub downloaded_bytes: Option<u64>,
    #[specta(type = u32)]
    pub total_bytes: Option<u64>,
    pub speed_bytes_per_sec: Option<f64>,
    #[specta(type = u32)]
    pub eta_secs: Option<u64>,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct YtDlpInfo {
    pub version: String,
    pub binary_path: String,
    pub is_bundled: bool,
}
