use crate::online_player::types::{DownloadedMedia, OnlineTrack, StreamSource, TimedLyrics};

#[tauri::command]
#[specta::specta]
pub async fn search_online_tracks(
    query: String,
    provider: Option<String>,
) -> Result<Vec<OnlineTrack>, String> {
    crate::online_player::search_online_tracks(query, provider).await
}

#[tauri::command]
#[specta::specta]
pub async fn resolve_online_stream(
    track_id: String,
    stream_identifier: String,
    provider: String,
) -> Result<StreamSource, String> {
    crate::online_player::resolve_online_stream(track_id, stream_identifier, provider).await
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_online_lyrics(
    title: String,
    artist: String,
    duration_secs: Option<u32>,
) -> Result<Option<TimedLyrics>, String> {
    crate::online_player::fetch_online_lyrics(title, artist, duration_secs).await
}

#[tauri::command]
#[specta::specta]
pub async fn download_online_track(
    track: OnlineTrack,
    target_dir: Option<String>,
) -> Result<DownloadedMedia, String> {
    crate::online_player::download_online_track(track, target_dir).await
}
