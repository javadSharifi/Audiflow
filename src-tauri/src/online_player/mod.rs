pub mod client;
pub mod downloader;
pub mod lyrics;
pub mod providers;
pub mod types;

use crate::online_player::client::create_http_client;
use crate::online_player::types::{DownloadedMedia, OnlineTrack, StreamSource, TimedLyrics};
use tauri::command;

#[command]
#[specta::specta]
pub async fn search_online_tracks(
    query: String,
    provider: Option<String>,
) -> Result<Vec<OnlineTrack>, String> {
    let client = create_http_client()?;
    let query_trimmed = query.trim();
    if query_trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    let p_filter = provider.as_deref().unwrap_or("all").to_lowercase();

    let yt_fut = async {
        if p_filter == "all" || p_filter == "youtube" {
            providers::youtube::search_youtube(&client, query_trimmed).await.unwrap_or_default()
        } else {
            Vec::new()
        }
    };

    let sc_fut = async {
        if p_filter == "all" || p_filter == "soundcloud" {
            providers::soundcloud::search_soundcloud(&client, query_trimmed).await.unwrap_or_default()
        } else {
            Vec::new()
        }
    };

    let js_fut = async {
        if p_filter == "all" || p_filter == "jiosaavn" {
            providers::jiosaavn::search_jiosaavn(&client, query_trimmed).await.unwrap_or_default()
        } else {
            Vec::new()
        }
    };

    let (yt_res, sc_res, js_res) = tokio::join!(yt_fut, sc_fut, js_fut);
    results.extend(yt_res);
    results.extend(sc_res);
    results.extend(js_res);

    Ok(results)
}

#[command]
#[specta::specta]
pub async fn resolve_online_stream(
    track_id: String,
    stream_identifier: String,
    provider: String,
) -> Result<StreamSource, String> {
    let client = create_http_client()?;
    match provider.to_lowercase().as_str() {
        "youtube" => providers::youtube::resolve_youtube_stream(&client, &stream_identifier).await,
        "soundcloud" => providers::soundcloud::resolve_soundcloud_stream(&client, &stream_identifier).await,
        "jiosaavn" => providers::jiosaavn::resolve_jiosaavn_stream(&client, &stream_identifier).await,
        other => Err(format!("Unsupported provider: {}", other)),
    }
}

#[command]
#[specta::specta]
pub async fn fetch_online_lyrics(
    title: String,
    artist: String,
    duration_secs: Option<u32>,
) -> Result<Option<TimedLyrics>, String> {
    let client = create_http_client()?;
    lyrics::fetch_lyrics(&client, &title, &artist, duration_secs).await
}

#[command]
#[specta::specta]
pub async fn download_online_track(
    track: OnlineTrack,
    target_dir: Option<String>,
) -> Result<DownloadedMedia, String> {
    let client = create_http_client()?;
    let stream_source = resolve_online_stream(
        track.id.clone(),
        track.stream_identifier.clone(),
        track.provider.clone(),
    )
    .await?;

    downloader::download_track(&client, &track, &stream_source.stream_url, target_dir).await
}
