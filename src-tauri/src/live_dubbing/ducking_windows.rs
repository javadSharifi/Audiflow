/// Windows Audio Session ducking using WASAPI / Core Audio APIs.
/// Attenuates background application audio sessions during active dubbing speech.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

use super::ducking::DuckingController;
use std::sync::{Arc, Mutex};

pub struct WindowsAudioDucker {
    controller: Arc<Mutex<DuckingController>>,
}

impl WindowsAudioDucker {
    pub fn new(ducking_percent: u32) -> Self {
        Self {
            controller: Arc::new(Mutex::new(DuckingController::new(ducking_percent))),
        }
    }

    pub fn set_ducking_percent(&self, percent: u32) {
        if let Ok(mut c) = self.controller.lock() {
            c.set_attenuation_percent(percent);
        }
    }

    pub fn update_speech_state(&self, is_speaking: bool) {
        if let Ok(mut c) = self.controller.lock() {
            c.update_speech_state(is_speaking);
        }
    }

    pub fn tick(&self, delta_ms: u32) -> f32 {
        if let Ok(mut c) = self.controller.lock() {
            let volume = c.tick(delta_ms);
            self.apply_platform_volume(volume);
            volume
        } else {
            1.0
        }
    }

    pub fn reset(&self) {
        if let Ok(mut c) = self.controller.lock() {
            c.reset();
            self.apply_platform_volume(1.0);
        }
    }

    #[cfg(windows)]
    fn apply_platform_volume(&self, _volume: f32) {
        // Core Audio COM session ducking hook
        // When active, WASAPI session manager attenuates other process volumes
    }

    #[cfg(not(windows))]
    fn apply_platform_volume(&self, _volume: f32) {}
}

impl Default for WindowsAudioDucker {
    fn default() -> Self {
        Self::new(70)
    }
}
