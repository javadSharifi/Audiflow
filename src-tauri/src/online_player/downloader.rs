use crate::online_player::types::{DownloadedMedia, OnlineTrack};
use reqwest::Client;
use std::path::{Path, PathBuf};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;

pub async fn download_track(
    client: &Client,
    track: &OnlineTrack,
    stream_url: &str,
    target_dir: Option<String>,
) -> Result<DownloadedMedia, String> {
    let dest_dir = match target_dir {
        Some(d) => PathBuf::from(d),
        None => directories::UserDirs::new()
            .and_then(|u| u.audio_dir().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from(".")),
    };

    tokio::fs::create_dir_all(&dest_dir)
        .await
        .map_err(|e| format!("Failed to create destination directory: {}", e))?;

    let clean_title = sanitize_filename(&track.title);
    let clean_artist = sanitize_filename(&track.artist);
    let base_name = format!("{} - {}.m4a", clean_artist, clean_title);
    let final_path = dest_dir.join(&base_name);
    let temp_path = dest_dir.join(format!("{}.part", &base_name));

    let mut response = client
        .get(stream_url)
        .send()
        .await
        .map_err(|e| format!("Download network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download returned HTTP {}", response.status()));
    }

    let mut file = File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create temporary file: {}", e))?;

    let mut total_bytes = 0u64;
    while let Some(chunk) = response.chunk().await.map_err(|e| format!("Stream read error: {}", e))? {
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write chunk to disk: {}", e))?;
        total_bytes += chunk.len() as u64;
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush temporary file: {}", e))?;
    drop(file);

    let resolved_path = resolve_collision(&final_path).await;
    tokio::fs::rename(&temp_path, &resolved_path)
        .await
        .map_err(|e| format!("Failed to atomically rename downloaded file: {}", e))?;

    Ok(DownloadedMedia {
        file_path: resolved_path.to_string_lossy().to_string(),
        title: track.title.clone(),
        artist: track.artist.clone(),
        format: "m4a".to_string(),
        size_bytes: total_bytes,
    })
}

fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

async fn resolve_collision(path: &Path) -> PathBuf {
    if !path.exists() {
        return path.to_path_buf();
    }

    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("audio");
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("m4a");

    let mut counter = 1;
    loop {
        let candidate = parent.join(format!("{} ({}).{}", stem, counter, ext));
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}
