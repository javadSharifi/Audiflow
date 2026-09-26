use crate::online_player::types::{OnlineTrack, StreamSource};
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;

const SC_SEARCH_URL: &str = "https://proxy.searchsoundcloud.com/search";

pub async fn search_soundcloud(client: &Client, query: &str) -> Result<Vec<OnlineTrack>, String> {
    let res = client
        .get(SC_SEARCH_URL)
        .query(&[("q", query), ("limit", "20")])
        .header("Referer", "https://soundcloud.com/")
        .send()
        .await
        .map_err(|e| format!("SoundCloud search network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("SoundCloud search returned HTTP {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse SoundCloud JSON: {}", e))?;

    let collection = json
        .get("collection")
        .and_then(|c| c.as_array())
        .ok_or_else(|| "SoundCloud response missing collection array".to_string())?;

    let tracks = collection
        .iter()
        .filter_map(|item| {
            let id_val = item.get("id")?.as_u64()?;
            let title = item.get("title")?.as_str()?.to_string();
            let user = item.get("user");
            let artist = user
                .and_then(|u| u.get("username"))
                .and_then(|u| u.as_str())
                .unwrap_or("SoundCloud")
                .to_string();
            let duration_ms = item.get("duration")?.as_u64().unwrap_or(0);
            let thumbnail_url = item
                .get("artwork_url")
                .and_then(|a| a.as_str())
                .map(|a| a.replace("-large.", "-t300x300."));

            Some(OnlineTrack {
                id: format!("sc:{}", id_val),
                title,
                artist,
                album: None,
                duration_secs: (duration_ms / 1000) as u32,
                thumbnail_url,
                provider: "SoundCloud".to_string(),
                stream_identifier: id_val.to_string(),
            })
        })
        .collect();

    Ok(tracks)
}

pub async fn resolve_soundcloud_stream(client: &Client, identifier: &str) -> Result<StreamSource, String> {
    let widget_url = format!(
        "https://api-widget.soundcloud.com/tracks/{}?client_id=LvWZrSCVw40LsCQ9Yw89jJk2mJmIe7Gv",
        identifier
    );
    let res = client
        .get(&widget_url)
        .send()
        .await
        .map_err(|e| format!("SoundCloud widget request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("SoundCloud widget HTTP {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse SoundCloud widget JSON: {}", e))?;

    let transcodings = json
        .get("media")
        .and_then(|m| m.get("transcodings"))
        .and_then(|t| t.as_array())
        .ok_or_else(|| "No transcodings found for SoundCloud track".to_string())?;

    let target = transcodings
        .iter()
        .find(|t| {
            t.get("format")
                .and_then(|f| f.get("protocol"))
                .and_then(|p| p.as_str())
                == Some("progressive")
        })
        .or_else(|| transcodings.first())
        .ok_or_else(|| "No playable stream found".to_string())?;

    let stream_endpoint = target
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| "Missing stream URL in transcoding".to_string())?;

    let stream_auth_url = format!("{}?client_id=LvWZrSCVw40LsCQ9Yw89jJk2mJmIe7Gv", stream_endpoint);
    let stream_res = client
        .get(&stream_auth_url)
        .send()
        .await
        .map_err(|e| format!("Failed to get stream redirect: {}", e))?;

    let stream_json: Value = stream_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse stream URL payload: {}", e))?;

    let direct_url = stream_json
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| "Direct stream URL not in payload".to_string())?
        .to_string();

    let mut headers = HashMap::new();
    headers.insert("User-Agent".to_string(), "Mozilla/5.0".to_string());
    headers.insert("Referer".to_string(), "https://soundcloud.com/".to_string());

    Ok(StreamSource {
        stream_url: direct_url,
        mime_type: "audio/mpeg".to_string(),
        format: "mp3".to_string(),
        bitrate_kbps: Some(128),
        is_proxied: false,
        headers,
    })
}
