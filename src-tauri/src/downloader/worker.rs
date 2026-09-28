use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::Emitter as _;

use crate::ffmpeg::run::CancelToken;
use super::queue::QueueInner;
use super::types::{DownloadItem, DownloadProgressPayload, DownloadStatus};
use super::ytdlp::YtDlpManager;

pub(crate) fn run_worker_loop(inner: Arc<QueueInner>) {
    inner.active_count.fetch_add(1, Ordering::SeqCst);

    loop {
        let next_id = inner.order.lock().unwrap().pop_front();
        let Some(id) = next_id else { break };

        let token = inner.tokens.lock().unwrap().get(&id).cloned();
        let item = inner.items.lock().unwrap().get(&id).cloned();

        let (Some(token), Some(item)) = (token, item) else { continue };
        if token.is_cancelled() {
            continue;
        }

        execute_single_download(&inner, &id, &item, &token);
    }

    inner.active_count.fetch_sub(1, Ordering::SeqCst);
}

fn execute_single_download(
    inner: &Arc<QueueInner>,
    id: &str,
    item: &DownloadItem,
    cancel_token: &CancelToken,
) {
    if cancel_token.is_cancelled() {
        update_and_emit(inner, id, DownloadStatus::Cancelled, 0.0, None, None, None, None, None, None);
        return;
    }

    update_and_emit(inner, id, DownloadStatus::Preparing, 0.0, None, None, None, None, None, None);

    let output_dir = resolve_download_dir();
    if let Err(e) = std::fs::create_dir_all(&output_dir) {
        let err_msg = format!("Failed to create download directory: {e}");
        update_and_emit(inner, id, DownloadStatus::Failed, 0.0, None, None, None, None, None, Some(err_msg));
        return;
    }

    // Atomic non-destructive naming per Constitution Principle IV
    let clean_stem = crate::processing::naming::sanitize_component(&item.title);
    let candidate = output_dir.join(format!("{clean_stem}.mp3"));
    let final_path = crate::processing::naming::unique_path(&candidate);

    let temp_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_stem = format!("{clean_stem}.job-{temp_ts}-{}.part", std::process::id());
    let temp_template = format!("{}/{temp_stem}.%(ext)s", output_dir.to_string_lossy());
    let temp_mp3 = output_dir.join(format!("{temp_stem}.mp3"));

    let ffmpeg_path = match crate::ffmpeg::locate::ffmpeg_path() {
        Ok(p) => p,
        Err(e) => {
            let err_msg = format!("FFmpeg binary missing: {e}");
            update_and_emit(inner, id, DownloadStatus::Failed, 0.0, None, None, None, None, None, Some(err_msg));
            return;
        }
    };

    let mut cmd = match YtDlpManager::build_command() {
        Ok(c) => c,
        Err(e) => {
            let err_msg = format!("yt-dlp binary missing: {e}");
            update_and_emit(inner, id, DownloadStatus::Failed, 0.0, None, None, None, None, None, Some(err_msg));
            return;
        }
    };

    let ffmpeg_loc = ffmpeg_path.parent().unwrap_or(&ffmpeg_path).to_string_lossy().to_string();

    cmd.args([
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--ffmpeg-location", &ffmpeg_loc,
        "--newline",
        "--progress",
        "--progress-template", "download:%(progress.downloaded_bytes)s|%(progress.total_bytes_estimate)s|%(progress._percent_str)s|%(progress.speed)s|%(progress.eta)s",
        "--progress-template", "postprocess:%(progress.status)s",
        "-o", &temp_template,
        "--no-playlist",
        "--extractor-args", "youtube:player_client=android,ios,web",
        "--",
        &item.webpage_url,
    ])
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            let err_msg = format!("Failed to start download process: {e}");
            update_and_emit(inner, id, DownloadStatus::Failed, 0.0, None, None, None, None, None, Some(err_msg));
            return;
        }
    };

    let stdout = child.stdout.take();
    cancel_token.attach(child);

    let reader = stdout.map(BufReader::new);
    if let Some(reader) = reader {
        for line in reader.lines().map_while(Result::ok) {
            if cancel_token.is_cancelled() {
                cleanup_temp_files(&output_dir, &temp_stem);
                update_and_emit(inner, id, DownloadStatus::Cancelled, 0.0, None, None, None, None, None, None);
                return;
            }

            parse_progress_line(inner, id, &line);
        }
    }

    let mut child = match cancel_token.detach() {
        Some(c) => c,
        None => {
            cleanup_temp_files(&output_dir, &temp_stem);
            update_and_emit(inner, id, DownloadStatus::Cancelled, 0.0, None, None, None, None, None, None);
            return;
        }
    };

    let status = child.wait();
    if cancel_token.is_cancelled() {
        cleanup_temp_files(&output_dir, &temp_stem);
        update_and_emit(inner, id, DownloadStatus::Cancelled, 0.0, None, None, None, None, None, None);
        return;
    }

    match status {
        Ok(s) if s.success() => {
            if temp_mp3.exists() {
                if let Err(e) = std::fs::rename(&temp_mp3, &final_path) {
                    cleanup_temp_files(&output_dir, &temp_stem);
                    let err_msg = format!("Failed to move finished file to library: {e}");
                    update_and_emit(inner, id, DownloadStatus::Failed, 0.0, None, None, None, None, None, Some(err_msg));
                    return;
                }
            }
            cleanup_temp_files(&output_dir, &temp_stem);
            let final_str = final_path.to_string_lossy().into_owned();
            update_and_emit(inner, id, DownloadStatus::Completed, 100.0, None, None, None, None, Some(final_str), None);
        }
        Ok(s) => {
            cleanup_temp_files(&output_dir, &temp_stem);
            let err = format!("Download process exited with code {:?}", s.code());
            update_and_emit(inner, id, DownloadStatus::Failed, 0.0, None, None, None, None, None, Some(err));
        }
        Err(e) => {
            cleanup_temp_files(&output_dir, &temp_stem);
            let err = format!("Download process wait failed: {e}");
            update_and_emit(inner, id, DownloadStatus::Failed, 0.0, None, None, None, None, None, Some(err));
        }
    }
}

fn cleanup_temp_files(dir: &Path, temp_stem: &str) {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(temp_stem) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
}

fn parse_progress_line(inner: &Arc<QueueInner>, id: &str, line: &str) {
    if let Some(rest) = line.strip_prefix("download:") {
        let parts: Vec<&str> = rest.split('|').collect();
        if parts.len() >= 5 {
            let downloaded: Option<u64> = parts[0].trim().parse().ok();
            let total: Option<u64> = parts[1].trim().parse().ok();
            let pct_raw = parts[2].trim().trim_end_matches('%');
            let pct: f64 = pct_raw.parse::<f64>().unwrap_or(0.0).clamp(0.0, 100.0);
            let speed: Option<f64> = parts[3].trim().parse().ok();
            let eta: Option<u64> = parts[4].trim().parse().ok();

            update_and_emit(inner, id, DownloadStatus::Downloading, pct, downloaded, total, speed, eta, None, None);
        }
    } else if line.contains("ExtractAudio") || line.contains("postprocess:") {
        update_and_emit(inner, id, DownloadStatus::Processing, 98.0, None, None, None, None, None, None);
    }
}

pub(crate) fn update_and_emit(
    inner: &Arc<QueueInner>,
    id: &str,
    status: DownloadStatus,
    percent: f64,
    downloaded: Option<u64>,
    total: Option<u64>,
    speed: Option<f64>,
    eta: Option<u64>,
    output_path: Option<String>,
    error: Option<String>,
) {
    let clamped_percent = percent.clamp(0.0, 100.0);
    {
        let mut items = inner.items.lock().unwrap();
        if let Some(item) = items.get_mut(id) {
            item.status = status;
            item.percent = clamped_percent;
            if downloaded.is_some() { item.downloaded_bytes = downloaded; }
            if total.is_some() { item.total_bytes = total; }
            if speed.is_some() { item.speed_bytes_per_sec = speed; }
            if eta.is_some() { item.eta_secs = eta; }
            if output_path.is_some() { item.output_path = output_path.clone(); }
            if error.is_some() { item.error = error.clone(); }
        }
    }

    let payload = DownloadProgressPayload {
        id: id.to_string(),
        percent: clamped_percent,
        downloaded_bytes: downloaded,
        total_bytes: total,
        speed_bytes_per_sec: speed,
        eta_secs: eta,
        status,
        error,
    };
    let _ = inner.app_handle.emit("download-progress", payload);
}

pub(crate) fn resolve_download_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join("Music").join("Audiflow");
    }

    #[cfg(target_os = "linux")]
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join("Music").join("Audiflow");
    }

    #[cfg(target_os = "windows")]
    if let Ok(prof) = std::env::var("USERPROFILE") {
        return PathBuf::from(prof).join("Music").join("Audiflow");
    }

    std::env::temp_dir().join("Audiflow")
}
