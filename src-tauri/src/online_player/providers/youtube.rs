use crate::online_player::types::{OnlineTrack, StreamSource};
use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;

const INVIDIOUS_INSTANCES: &[&str] = &[
    "https://yt.omada.cafe",
    "https://invidious.nerdvpn.de",
    "https://invidious.protokolla.fi",
    "https://lekker.gay",
];

pub async fn search_youtube(client: &Client, query: &str) -> Result<Vec<OnlineTrack>, String> {
    let mut last_err = String::from("No working Invidious instance found");

    for instance in INVIDIOUS_INSTANCES {
        let endpoint = format!("{}/api/v1/search", instance);
        match client
            .get(&endpoint)
            .query(&[("q", query), ("type", "video")])
            .send()
            .await
        {
            Ok(res) if res.status().is_success() => {
                if let Ok(json) = res.json::<Value>().await {
                    if let Some(items) = json.as_array() {
                        let tracks: Vec<OnlineTrack> = items
                            .iter()
                            .filter_map(|item| {
                                let video_id = item.get("videoId")?.as_str()?.to_string();
                                let title = item.get("title")?.as_str()?.to_string();
                                let artist = item.get("author")?.as_str().unwrap_or("YouTube").to_string();
                                let duration_secs = item.get("lengthSeconds")?.as_u64().unwrap_or(0) as u32;
                                let thumbnail_url = item
                                    .get("videoThumbnails")
                                    .and_then(|t| t.as_array())
                                    .and_then(|arr| arr.first())
                                    .and_then(|t| t.get("url"))
                                    .and_then(|u| u.as_str())
                                    .map(|u| {
                                        if u.starts_with("http") {
                                            u.to_string()
                                        } else {
                                            format!("{}{}", instance, u)
                                        }
                                    });

                                Some(OnlineTrack {
                                    id: format!("yt:{}", video_id),
                                    title,
                                    artist,
                                    album: None,
                                    duration_secs,
                                    thumbnail_url,
                                    provider: "YouTube".to_string(),
                                    stream_identifier: video_id,
                                })
                            })
                            .collect();
                        return Ok(tracks);
                    }
                }
            }
            Ok(res) => {
                last_err = format!("{}: HTTP {}", instance, res.status());
            }
            Err(e) => {
                last_err = format!("{}: {}", instance, e);
            }
        }
    }

    Err(last_err)
}

pub async fn resolve_youtube_stream(client: &Client, video_id: &str) -> Result<StreamSource, String> {
    let mut last_err = String::from("Could not resolve stream from instances");

    for instance in INVIDIOUS_INSTANCES {
        let stream_url = format!("{}/latest_version?id={}&itag=140", instance, video_id);
        if let Ok(res) = client.head(&stream_url).send().await {
            if res.status().is_success() || res.status().is_redirection() {
                let mut headers = HashMap::new();
                headers.insert("User-Agent".to_string(), "Mozilla/5.0".to_string());
                headers.insert("Referer".to_string(), format!("{}/", instance));

                return Ok(StreamSource {
                    stream_url,
                    mime_type: "audio/mp4".to_string(),
                    format: "m4a".to_string(),
                    bitrate_kbps: Some(128),
                    is_proxied: false,
                    headers,
                });
            }
        }
        last_err = format!("Instance {} failed for {}", instance, video_id);
    }

    Err(last_err)
}
