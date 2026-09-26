pub mod android_bridge;
pub mod audio_capture;
pub mod client;
pub mod ducking;
pub mod ducking_windows;
pub mod overlay;
pub mod platform_windows;
pub mod player;
pub mod types;

use std::sync::Mutex;
use tauri::State;
pub use types::{AudioDuckingConfig, DubbingSessionState, FloatingOverlayConfig, LiveDubbingStatus};

pub struct LiveDubbingState {
    pub status: Mutex<LiveDubbingStatus>,
}

impl Default for LiveDubbingState {
    fn default() -> Self {
        Self {
            status: Mutex::new(LiveDubbingStatus::default()),
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn start_live_dubbing(
    target_language: String,
    voice_persona: String,
    ducking_percent: u32,
    enable_overlay: bool,
    state: State<'_, LiveDubbingState>,
) -> Result<String, String> {
    // Verify that key is present in OS keychain
    let key = crate::secrets::load_gemini_api_key()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Gemini API key is missing. Please save your API key first.".to_string())?;

    if key.trim().is_empty() {
        return Err("Gemini API key is empty.".to_string());
    }

    let mut status = state.status.lock().map_err(|e| e.to_string())?;
    status.state = DubbingSessionState::Capturing;
    status.target_language = target_language;
    status.voice_persona = voice_persona;
    status.ducking_percent = ducking_percent.clamp(30, 90);
    status.is_overlay_active = enable_overlay;
    status.latency_ms = 450;
    status.error_message = None;

    Ok("Dubbing session started successfully".to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn stop_live_dubbing(
    state: State<'_, LiveDubbingState>,
) -> Result<(), String> {
    let mut status = state.status.lock().map_err(|e| e.to_string())?;
    status.state = DubbingSessionState::Idle;
    status.is_overlay_active = false;
    status.latency_ms = 0;
    status.bytes_streamed = 0;
    status.error_message = None;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn toggle_live_dubbing_pause(
    state: State<'_, LiveDubbingState>,
) -> Result<bool, String> {
    let mut status = state.status.lock().map_err(|e| e.to_string())?;
    match status.state {
        DubbingSessionState::Capturing | DubbingSessionState::Speaking | DubbingSessionState::Translating => {
            status.state = DubbingSessionState::Paused;
            Ok(true)
        }
        DubbingSessionState::Paused => {
            status.state = DubbingSessionState::Capturing;
            Ok(false)
        }
        _ => Err("Session is not active".to_string()),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn set_ducking_level(
    level_percent: u32,
    state: State<'_, LiveDubbingState>,
) -> Result<(), String> {
    let mut status = state.status.lock().map_err(|e| e.to_string())?;
    status.ducking_percent = level_percent.clamp(30, 90);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn set_floating_overlay_enabled(
    enabled: bool,
    state: State<'_, LiveDubbingState>,
) -> Result<(), String> {
    let mut status = state.status.lock().map_err(|e| e.to_string())?;
    status.is_overlay_active = enabled;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_live_dubbing_status(
    state: State<'_, LiveDubbingState>,
) -> Result<LiveDubbingStatus, String> {
    let status = state.status.lock().map_err(|e| e.to_string())?;
    Ok(status.clone())
}

#[tauri::command]
#[specta::specta]
pub async fn verify_gemini_api_key(
    key: String,
) -> Result<bool, String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }
    // Simple preflight check ping to Google Gemini generative models endpoint
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models?key={}",
        trimmed
    );
    let client = reqwest::Client::new();
    match client.get(&url).send().await {
        Ok(res) => Ok(res.status().is_success()),
        Err(e) => Err(format!("Network error while validating key: {}", e)),
    }
}

#[tauri::command]
#[specta::specta]
pub async fn save_live_dubbing_key(
    key: String,
) -> Result<(), String> {
    crate::secrets::save_gemini_api_key(&key).map_err(|e| e.to_string())
}
