/// Dynamic audio ducking state machine and smooth ramp generator.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

#[derive(Debug, Clone)]
pub struct DuckingController {
    attenuation_percent: u32, // 30..=90
    current_volume: f32,       // 0.0..=1.0
    attack_ms: u32,            // Default 100ms
    release_ms: u32,           // Default 400ms
    hold_ms: u32,              // Silence hold before release: 250ms
    silence_ms: u32,
    is_speaking: bool,
}

impl DuckingController {
    pub fn new(attenuation_percent: u32) -> Self {
        Self {
            attenuation_percent: attenuation_percent.clamp(30, 90),
            current_volume: 1.0,
            attack_ms: 100,
            release_ms: 400,
            hold_ms: 250,
            silence_ms: 0,
            is_speaking: false,
        }
    }

    pub fn set_attenuation_percent(&mut self, percent: u32) {
        self.attenuation_percent = percent.clamp(30, 90);
    }

    pub fn get_attenuation_percent(&self) -> u32 {
        self.attenuation_percent
    }

    /// Target volume when ducking is active (e.g., 70% ducking -> 0.30 volume).
    pub fn target_ducked_volume(&self) -> f32 {
        1.0 - (self.attenuation_percent as f32 / 100.0)
    }

    pub fn current_volume(&self) -> f32 {
        self.current_volume
    }

    pub fn is_speaking(&self) -> bool {
        self.is_speaking
    }

    /// Updates speech activity state.
    pub fn update_speech_state(&mut self, is_speaking: bool) {
        if is_speaking {
            self.is_speaking = true;
            self.silence_ms = 0;
        } else if self.is_speaking {
            // Speech just stopped, start hold counter
            self.is_speaking = false;
            self.silence_ms = 0;
        }
    }

    /// Advances simulation by `delta_ms` and returns the new volume multiplier (0.0..=1.0).
    pub fn tick(&mut self, delta_ms: u32) -> f32 {
        let ducked_target = self.target_ducked_volume();

        if self.is_speaking {
            // Attack phase: smoothly ramp down to ducked_target in attack_ms
            let step = (1.0 - ducked_target) * (delta_ms as f32 / self.attack_ms as f32);
            self.current_volume = (self.current_volume - step).max(ducked_target);
        } else {
            // Check hold time before release
            self.silence_ms += delta_ms;
            if self.silence_ms >= self.hold_ms {
                // Release phase: smoothly ramp back to 1.0 in release_ms
                let step = (1.0 - ducked_target) * (delta_ms as f32 / self.release_ms as f32);
                self.current_volume = (self.current_volume + step).min(1.0);
            }
        }

        self.current_volume
    }

    /// Immediately resets volume to 1.0 (e.g. on session stop).
    pub fn reset(&mut self) {
        self.current_volume = 1.0;
        self.is_speaking = false;
        self.silence_ms = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ducking_initial_state() {
        let controller = DuckingController::new(70);
        assert_eq!(controller.current_volume(), 1.0);
        assert!((controller.target_ducked_volume() - 0.30).abs() < 0.001);
        assert!(!controller.is_speaking());
    }

    #[test]
    fn test_attack_ramp() {
        let mut controller = DuckingController::new(70);
        controller.update_speech_state(true);

        // Advance 50ms (half attack of 100ms)
        let vol = controller.tick(50);
        // Halfway between 1.0 and 0.3 is 0.65
        assert!((vol - 0.65).abs() < 0.02);

        // Advance another 50ms (100ms total -> should reach target 0.30)
        let vol = controller.tick(50);
        assert!((vol - 0.30).abs() < 0.01);

        // Further ticks stay at target
        let vol = controller.tick(100);
        assert!((vol - 0.30).abs() < 0.01);
    }

    #[test]
    fn test_hold_and_release_ramp() {
        let mut controller = DuckingController::new(70);
        controller.update_speech_state(true);
        controller.tick(100); // Now at 0.30
        assert!((controller.current_volume() - 0.30).abs() < 0.01);

        // Speech stops
        controller.update_speech_state(false);

        // Advance 200ms (less than hold_ms = 250ms) -> still at 0.30
        let vol = controller.tick(200);
        assert!((vol - 0.30).abs() < 0.01);

        // Advance another 100ms (300ms total silence, past 250ms hold -> release starts)
        let vol = controller.tick(100);
        assert!(vol > 0.30);

        // Advance 400ms more -> fully released to 1.0
        let vol = controller.tick(400);
        assert!((vol - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_clamping() {
        let c1 = DuckingController::new(10);
        assert_eq!(c1.get_attenuation_percent(), 30); // clamped to 30

        let c2 = DuckingController::new(99);
        assert_eq!(c2.get_attenuation_percent(), 90); // clamped to 90
    }
}
