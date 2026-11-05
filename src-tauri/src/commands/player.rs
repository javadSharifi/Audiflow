use crate::error::{AppError, Result};

// --- Jetpack Media3 Android Audio Player Commands ---

/// Play a track or playlist via native Jetpack Media3 (Android).
#[tauri::command]
#[specta::specta]
pub async fn android_player_play(
    track_json: String,
    playlist_json: Option<String>,
    start_index: Option<i32>,
) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let playlist = playlist_json.unwrap_or_else(|| "[]".to_string());
        let index = start_index.unwrap_or(0);
        crate::android_fs::call_player_play_jni(&track_json, &playlist, index)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Pause playback via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_pause() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerPause").map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Resume playback via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_resume() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerResume").map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Seek playback to timestamp in milliseconds via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_seek_to(position_ms: u32) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_seek_jni(position_ms as i64).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Skip to next media item via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_next() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerNext").map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Skip to previous media item via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_previous() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerPrevious")
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set repeat mode ('off', 'one', 'all') via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_repeat_mode(mode: String) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_static_string_1arg("nativePlayerSetRepeatMode", &mode)
            .map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set shuffle mode enabled/disabled via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_shuffle_mode(enabled: bool) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_shuffle_jni(enabled).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set playback speed (e.g. 1.0, 1.25) via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_speed(speed: f64) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_speed_jni(speed as f32).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set output volume fraction (0.0..1.0) via native Jetpack Media3.
/// Values above 1.0 are clamped natively; true >100% boost needs a DSP
/// AudioProcessor (Rhythm pattern) and is intentionally not faked.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_volume(volume: f64) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_volume_jni(volume as f32).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set real-time loudness boost in dB (0 is off) via the native Android
/// LoudnessEnhancer attached to the ExoPlayer audio session. Desktop needs
/// no loudness DSP path (the WebAudio GainNode covers it).
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_booster_gain(gain_db: f64) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_booster_gain_jni(gain_db as f32).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set real-time loudness boost in millibels (0..8000 mB) via BoostEngine.
#[tauri::command]
#[specta::specta]
pub async fn android_player_set_booster_gain_mb(gain_mb: i32) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_player_set_booster_gain_mb_jni(gain_mb).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query currently active booster gain in millibels.
#[tauri::command]
#[specta::specta]
pub async fn android_player_get_booster_gain_mb() -> Result<i32> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_player_get_booster_gain_mb_jni().map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query hardware media volume step from AudioManager.
#[tauri::command]
#[specta::specta]
pub async fn android_get_stream_volume() -> Result<i32> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_get_stream_volume_jni().map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query hardware media max volume step from AudioManager.
#[tauri::command]
#[specta::specta]
pub async fn android_get_stream_max_volume() -> Result<i32> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_get_stream_max_volume_jni().map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Set hardware media volume step directly on AudioManager.
#[tauri::command]
#[specta::specta]
pub async fn android_set_stream_volume(volume: i32, show_ui: bool) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::android_fs::call_set_stream_volume_jni(volume, show_ui).map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Apply reduce-hurt speaker protection to dampen volume and reset extreme gain.
#[tauri::command]
#[specta::specta]
pub async fn android_apply_reduce_hurt() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_apply_reduce_hurt_jni().map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Stop playback via native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub async fn android_player_stop() -> Result<String> {
    tauri::async_runtime::spawn_blocking(|| {
        crate::android_fs::call_static_string_no_arg("nativePlayerStop").map_err(AppError::Other)
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

/// Query live playback state from native Jetpack Media3.
#[tauri::command]
#[specta::specta]
pub fn android_player_get_state() -> String {
    crate::android_fs::call_static_string_no_arg("nativePlayerGetState")
        .unwrap_or_else(|_| "{}".to_string())
}

/// Lyrics for a track: a sidecar `<name>.lrc` next to the file, else the
/// embedded lyrics tag. `None` when neither exists (the UI may try online).
#[tauri::command]
#[specta::specta]
pub async fn track_lyrics(path: String) -> Result<Option<String>> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = crate::android_fs::ensure_local_path(&path);
        if let Ok(text) = std::fs::read_to_string(std::path::Path::new(&path).with_extension("lrc")) {
            if !text.trim().is_empty() {
                return Ok(Some(text));
            }
        }
        let Ok(ffprobe) = crate::ffmpeg::locate::locate("ffprobe") else {
            return Ok(None);
        };
        Ok(crate::ffmpeg::probe::probe_file(&ffprobe, &path)
            .ok()
            .as_ref()
            .and_then(embedded_lyrics))
    })
    .await
    .map_err(|e| AppError::Other(format!("Task failed: {e}")))?
}

fn embedded_lyrics(p: &crate::ffmpeg::probe::ProbeResult) -> Option<String> {
    // ID3 USLT surfaces as "lyrics-eng" etc.; Vorbis/MP4 as LYRICS / UNSYNCEDLYRICS.
    let is_lyrics = |k: &str| {
        let k = k.to_ascii_lowercase();
        k == "lyrics" || k == "unsyncedlyrics" || k.starts_with("lyrics-")
    };
    p.format
        .as_ref()
        .and_then(|f| f.tags.as_ref())
        .and_then(|t| {
            t.iter()
                .find(|(k, v)| is_lyrics(k) && !v.trim().is_empty())
                .map(|(_, v)| v.clone())
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn probe_with_tags(tags: &str) -> crate::ffmpeg::probe::ProbeResult {
        let json = format!(r#"{{"format":{{"tags":{tags}}}}}"#);
        crate::ffmpeg::probe::parse_probe_json(&json).unwrap()
    }

    #[test]
    fn embedded_lyrics_finds_id3_and_vorbis_keys() {
        let id3 = probe_with_tags(r#"{"lyrics-eng":"[00:01.00]hi"}"#);
        assert_eq!(embedded_lyrics(&id3).as_deref(), Some("[00:01.00]hi"));
        let ogg = probe_with_tags(r#"{"LYRICS":"la"}"#);
        assert_eq!(embedded_lyrics(&ogg).as_deref(), Some("la"));
        let none = probe_with_tags("{}");
        assert!(embedded_lyrics(&none).is_none());
    }
}
