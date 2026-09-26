use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub enum DubbingSessionState {
    Idle,
    Starting,
    Capturing,
    Translating,
    Speaking,
    Paused,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AudioDuckingConfig {
    pub enabled: bool,
    pub ducking_percent: u32,
    pub attack_ramp_ms: u32,
    pub release_ramp_ms: u32,
}

impl Default for AudioDuckingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            ducking_percent: 70,
            attack_ramp_ms: 100,
            release_ramp_ms: 400,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct FloatingOverlayConfig {
    pub enabled: bool,
    pub snap_to_edge: bool,
    pub haptic_feedback: bool,
    pub show_halo: bool,
}

impl Default for FloatingOverlayConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            snap_to_edge: true,
            haptic_feedback: true,
            show_halo: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct LiveDubbingStatus {
    pub state: DubbingSessionState,
    pub target_language: String,
    pub voice_persona: String,
    pub ducking_percent: u32,
    pub is_overlay_active: bool,
    pub latency_ms: u32,
    pub bytes_streamed: u64,
    pub error_message: Option<String>,
}

impl Default for LiveDubbingStatus {
    fn default() -> Self {
        Self {
            state: DubbingSessionState::Idle,
            target_language: "fa".to_string(),
            voice_persona: "Aoede".to_string(),
            ducking_percent: 70,
            is_overlay_active: false,
            latency_ms: 0,
            bytes_streamed: 0,
            error_message: None,
        }
    }
}
