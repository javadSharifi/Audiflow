use crate::error::AppError;
use super::types::{MusicSearchResult, MusicSource};
use super::ytdlp::YtDlpManager;

pub struct DownloaderService;

impl DownloaderService {
    /// Return the list of supported search providers.
    pub fn get_sources() -> Vec<MusicSource> {
        vec![MusicSource {
            id: "youtube".into(),
            name: "YouTube".into(),
        }]
    }

    /// Search for music tracks using yt-dlp's built-in search engine.
    pub fn search(
        query: &str,
        _source_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<MusicSearchResult>, AppError> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(vec![]);
        }

        let clamped_limit = limit.clamp(1, 50);
        let search_target = format!("ytsearch{clamped_limit}:{trimmed}");

        let mut cmd = YtDlpManager::build_command()?;
        cmd.args([
            "--dump-json",
            "--flat-playlist",
            "--no-warnings",
            "--ignore-errors",
            "--",
            &search_target,
        ]);

        let output = cmd
            .output()
            .map_err(|e| AppError::Other(format!("Failed to execute search: {e}")))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut results = Vec::new();

        for line in stdout.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(result) = Self::normalize_search_item(&value, "youtube") {
                    results.push(result);
                }
            }
        }

        Ok(results)
    }

    /// Extract a temporary, direct streamable media URL for preview.
    pub fn get_direct_stream_url(webpage_url: &str) -> Result<String, AppError> {
        let trimmed = webpage_url.trim();
        if trimmed.is_empty() {
            return Err(AppError::InvalidInput("Empty media URL provided".into()));
        }
        if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            return Err(AppError::InvalidInput("Invalid media URL: must begin with http:// or https://".into()));
        }

        let mut cmd = YtDlpManager::build_command()?;
        cmd.args([
            "-g",
            "-f",
            "ba/ba*/bestaudio/b",
            "--extractor-args",
            "youtube:player_client=android,ios,web",
            "--no-warnings",
            "--",
            trimmed,
        ]);

        let output = cmd.output().map_err(|e| {
            AppError::Other(format!("Failed to extract preview stream URL: {e}"))
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            crate::log_warn!("yt-dlp stream extraction warning/error: {stderr}");
            return Err(AppError::Other(format!(
                "Failed to extract playable audio stream: {}",
                stderr
                    .lines()
                    .last()
                    .unwrap_or("Extractor failed to return stream URL")
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stream_url = stdout
            .lines()
            .find(|line| line.starts_with("http://") || line.starts_with("https://"))
            .map(|s| s.trim().to_string())
            .ok_or_else(|| {
                AppError::NotFound("No direct audio stream URL was found in extractor output".into())
            })?;

        Ok(stream_url)
    }

    /// Normalize raw yt-dlp metadata JSON into the unified MusicSearchResult model.
    pub fn normalize_search_item(
        v: &serde_json::Value,
        default_source: &str,
    ) -> Option<MusicSearchResult> {
        let id = v.get("id").and_then(|x| x.as_str())?.to_string();
        let title = v
            .get("title")
            .and_then(|x| x.as_str())
            .unwrap_or("Untitled")
            .to_string();

        let uploader = v
            .get("uploader")
            .or_else(|| v.get("channel"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());

        let artist = v
            .get("artist")
            .or_else(|| v.get("creator"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .or_else(|| uploader.clone());

        let album = v
            .get("album")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());

        let duration_secs = v
            .get("duration")
            .and_then(|x| x.as_f64())
            .filter(|&d| d > 0.0);

        // Pick highest resolution or preferred thumbnail URL
        let thumbnail_url = v
            .get("thumbnails")
            .and_then(|arr| arr.as_array())
            .and_then(|arr| arr.last())
            .and_then(|item| item.get("url"))
            .and_then(|u| u.as_str())
            .or_else(|| v.get("thumbnail").and_then(|t| t.as_str()))
            .map(|s| s.to_string());

        let webpage_url = v
            .get("webpage_url")
            .or_else(|| v.get("url"))
            .and_then(|u| u.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("https://www.youtube.com/watch?v={id}"));

        let source = v
            .get("extractor_key")
            .or_else(|| v.get("extractor"))
            .and_then(|s| s.as_str())
            .map(|s| s.to_ascii_lowercase())
            .unwrap_or_else(|| default_source.to_string());

        Some(MusicSearchResult {
            id,
            title,
            artist,
            uploader,
            album,
            duration_secs,
            thumbnail_url,
            webpage_url,
            source,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_yt_dlp_json_item() {
        let raw = serde_json::json!({
            "id": "abc12345",
            "title": "Artist - Great Song",
            "uploader": "ArtistVEVO",
            "artist": "Artist",
            "duration": 215.5,
            "webpage_url": "https://www.youtube.com/watch?v=abc12345",
            "thumbnails": [
                { "url": "https://img.example/small.jpg", "width": 120 },
                { "url": "https://img.example/large.jpg", "width": 720 }
            ],
            "extractor": "youtube"
        });

        let item = DownloaderService::normalize_search_item(&raw, "youtube").unwrap();
        assert_eq!(item.id, "abc12345");
        assert_eq!(item.title, "Artist - Great Song");
        assert_eq!(item.artist.as_deref(), Some("Artist"));
        assert_eq!(item.uploader.as_deref(), Some("ArtistVEVO"));
        assert_eq!(item.duration_secs, Some(215.5));
        assert_eq!(
            item.thumbnail_url.as_deref(),
            Some("https://img.example/large.jpg")
        );
        assert_eq!(item.webpage_url, "https://www.youtube.com/watch?v=abc12345");
        assert_eq!(item.source, "youtube");
    }

    #[test]
    fn handles_missing_optional_fields_cleanly() {
        let raw = serde_json::json!({
            "id": "minimal_id",
            "title": "Minimal Track"
        });

        let item = DownloaderService::normalize_search_item(&raw, "youtube").unwrap();
        assert_eq!(item.id, "minimal_id");
        assert_eq!(item.title, "Minimal Track");
        assert_eq!(item.artist, None);
        assert_eq!(item.duration_secs, None);
        assert_eq!(item.thumbnail_url, None);
        assert_eq!(
            item.webpage_url,
            "https://www.youtube.com/watch?v=minimal_id"
        );
    }
}
