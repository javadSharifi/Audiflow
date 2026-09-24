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
