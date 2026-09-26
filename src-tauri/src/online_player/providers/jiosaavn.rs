use crate::online_player::types::{OnlineTrack, StreamSource};
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;

const JIOSAAVN_API_URL: &str = "https://www.jiosaavn.com/api.php";

pub async fn search_jiosaavn(client: &Client, query: &str) -> Result<Vec<OnlineTrack>, String> {
    let res = client
        .get(JIOSAAVN_API_URL)
        .query(&[
            ("__call", "autocomplete.get"),
            ("_format", "json"),
            ("_marker", "0"),
            ("cc", "in"),
            ("includeMetaTags", "1"),
            ("query", query),
        ])
        .send()
        .await
        .map_err(|e| format!("JioSaavn network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("JioSaavn HTTP {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse JioSaavn JSON: {}", e))?;

    let songs_data = json
        .get("songs")
        .and_then(|s| s.get("data"))
        .and_then(|d| d.as_array())
        .ok_or_else(|| "No songs array in JioSaavn response".to_string())?;

    let tracks: Vec<OnlineTrack> = songs_data
        .iter()
        .filter_map(|item| {
            let id = item.get("id")?.as_str()?.to_string();
            let title = item.get("title")?.as_str()?.to_string();
            let album = item.get("album").and_then(|a| a.as_str()).map(|a| a.to_string());
            let more_info = item.get("more_info");
            let artist = more_info
                .and_then(|m| m.get("primary_artists").or_else(|| m.get("singers")))
                .and_then(|a| a.as_str())
                .unwrap_or("JioSaavn")
                .to_string();
            let thumbnail_url = item
                .get("image")
                .and_then(|i| i.as_str())
                .map(|img| img.replace("50x50", "350x350"));

            Some(OnlineTrack {
                id: format!("js:{}", id),
                title,
                artist,
                album,
                duration_secs: 180,
                thumbnail_url,
                provider: "JioSaavn".to_string(),
                stream_identifier: id,
            })
        })
        .collect();

    Ok(tracks)
}

pub async fn resolve_jiosaavn_stream(client: &Client, identifier: &str) -> Result<StreamSource, String> {
    let res = client
        .get(JIOSAAVN_API_URL)
        .query(&[
            ("__call", "song.getDetails"),
            ("pids", identifier),
            ("_format", "json"),
            ("_marker", "0"),
        ])
        .send()
        .await
        .map_err(|e| format!("JioSaavn song details network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("JioSaavn song details HTTP {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse JioSaavn song details: {}", e))?;

    let song_record = json
        .get(identifier)
        .or_else(|| json.as_array().and_then(|arr| arr.first()))
        .ok_or_else(|| "Song record not found in details payload".to_string())?;

    let media_url = song_record
        .get("more_info")
        .and_then(|m| m.get("media_preview_url").or_else(|| m.get("vlink")))
        .and_then(|v| v.as_str())
        .or_else(|| song_record.get("media_preview_url").and_then(|v| v.as_str()))
        .ok_or_else(|| "No media stream URL found in JioSaavn details".to_string())?;

    let mut headers = HashMap::new();
    headers.insert("User-Agent".to_string(), "Mozilla/5.0".to_string());
    headers.insert("Referer".to_string(), "https://www.jiosaavn.com/".to_string());

    Ok(StreamSource {
        stream_url: media_url.to_string(),
        mime_type: "audio/mp4".to_string(),
        format: "m4a".to_string(),
        bitrate_kbps: Some(160),
        is_proxied: false,
        headers,
    })
}
