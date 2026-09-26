use tauri::State;
use crate::live_dubbing::{LiveDubbingState, LiveDubbingStatus};

#[tauri::command]
#[specta::specta]
pub async fn start_live_dubbing(
    target_language: String,
    voice_persona: String,
    ducking_percent: u32,
    enable_overlay: bool,
    state: State<'_, LiveDubbingState>,
) -> Result<String, String> {
    crate::live_dubbing::start_live_dubbing(
        target_language,
        voice_persona,
        ducking_percent,
        enable_overlay,
        state,
    )
    .await
}

#[tauri::command]
#[specta::specta]
pub async fn stop_live_dubbing(
    state: State<'_, LiveDubbingState>,
) -> Result<(), String> {
    crate::live_dubbing::stop_live_dubbing(state).await
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_live_dubbing_pause(
    state: State<'_, LiveDubbingState>,
) -> Result<bool, String> {
    crate::live_dubbing::toggle_live_dubbing_pause(state).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_ducking_level(
    level_percent: u32,
    state: State<'_, LiveDubbingState>,
) -> Result<(), String> {
    crate::live_dubbing::set_ducking_level(level_percent, state).await
}

#[tauri::command]
#[specta::specta]
pub async fn set_floating_overlay_enabled(
    enabled: bool,
    state: State<'_, LiveDubbingState>,
) -> Result<(), String> {
    crate::live_dubbing::set_floating_overlay_enabled(enabled, state).await
}

#[tauri::command]
#[specta::specta]
pub async fn get_live_dubbing_status(
    state: State<'_, LiveDubbingState>,
) -> Result<LiveDubbingStatus, String> {
    crate::live_dubbing::get_live_dubbing_status(state).await
}

#[tauri::command]
#[specta::specta]
pub async fn verify_gemini_api_key(
    key: String,
) -> Result<bool, String> {
    crate::live_dubbing::verify_gemini_api_key(key).await
}

#[tauri::command]
#[specta::specta]
pub async fn save_live_dubbing_key(
    key: String,
) -> Result<(), String> {
    crate::live_dubbing::save_live_dubbing_key(key).await
}
