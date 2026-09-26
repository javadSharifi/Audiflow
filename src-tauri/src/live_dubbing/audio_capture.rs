/// Cross-platform system audio capture abstractions and 16kHz PCM resampler.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

pub const TARGET_SAMPLE_RATE: u32 = 16_000;
pub const TARGET_CHANNELS: u16 = 1;

/// Common trait for native audio capture engines (WASAPI, Android, etc.).
pub trait SystemAudioCapturer: Send + Sync {
    fn start_capture(&mut self, on_chunk: Box<dyn Fn(Vec<u8>) + Send + Sync>) -> Result<(), String>;
    fn stop_capture(&mut self) -> Result<(), String>;
    fn is_capturing(&self) -> bool;
}

/// Utility for downmixing channels and resampling audio to 16kHz 16-bit LE mono PCM.
pub struct AudioResampler {
    source_sample_rate: u32,
    source_channels: u16,
}

impl AudioResampler {
    pub fn new(source_sample_rate: u32, source_channels: u16) -> Self {
        Self {
            source_sample_rate: source_sample_rate.max(1),
            source_channels: source_channels.max(1),
        }
    }

    /// Resamples stereo/multi-channel f32 interleaved PCM to 16kHz 16-bit mono little-endian bytes.
    pub fn resample_f32_to_16k_mono(&self, input: &[f32]) -> Vec<u8> {
        if input.is_empty() {
            return Vec::new();
        }

        // Step 1: Downmix interleaved channels to mono f32
        let channels = self.source_channels as usize;
        let num_frames = input.len() / channels;
        let mut mono_samples = Vec::with_capacity(num_frames);

        for frame_idx in 0..num_frames {
            let mut sum = 0.0f32;
            let offset = frame_idx * channels;
            for ch in 0..channels {
                sum += input[offset + ch];
            }
            mono_samples.push(sum / (channels as f32));
        }

        // Step 2: Resample from source_sample_rate to 16,000 Hz
        let resampled = Self::linear_resample(
            &mono_samples,
            self.source_sample_rate,
            TARGET_SAMPLE_RATE,
        );

        // Step 3: Convert f32 samples (-1.0..1.0) to 16-bit signed LE bytes
        let mut pcm_bytes = Vec::with_capacity(resampled.len() * 2);
        for &sample in &resampled {
            let clamped = sample.clamp(-1.0, 1.0);
            let s16 = (clamped * 32767.0).round() as i16;
            pcm_bytes.extend_from_slice(&s16.to_le_bytes());
        }

        pcm_bytes
    }

    /// Resamples stereo/multi-channel i16 interleaved PCM to 16kHz 16-bit mono little-endian bytes.
    pub fn resample_i16_to_16k_mono(&self, input: &[i16]) -> Vec<u8> {
        let f32_samples: Vec<f32> = input
            .iter()
            .map(|&s| (s as f32) / 32768.0)
            .collect();
        self.resample_f32_to_16k_mono(&f32_samples)
    }

    /// Linear interpolation resampling for single-channel f32 audio.
    fn linear_resample(input: &[f32], in_rate: u32, out_rate: u32) -> Vec<f32> {
        if in_rate == out_rate || input.is_empty() {
            return input.to_vec();
        }

        let ratio = in_rate as f64 / out_rate as f64;
        let output_len = ((input.len() as f64) / ratio).floor() as usize;
        let mut output = Vec::with_capacity(output_len);

        for i in 0..output_len {
            let src_pos = i as f64 * ratio;
            let idx = src_pos.floor() as usize;
            let frac = (src_pos - idx as f64) as f32;

            let s0 = input[idx.min(input.len() - 1)];
            let s1 = input[(idx + 1).min(input.len() - 1)];

            let sample = s0 + frac * (s1 - s0);
            output.push(sample);
        }

        output
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resampler_identity() {
        let resampler = AudioResampler::new(16000, 1);
        let input = vec![0.0f32, 0.5f32, -0.5f32, 1.0f32];
        let bytes = resampler.resample_f32_to_16k_mono(&input);
        assert_eq!(bytes.len(), 8); // 4 samples * 2 bytes each
    }

    #[test]
    fn test_downmixing_stereo_to_mono() {
        let resampler = AudioResampler::new(16000, 2);
        // Stereo frames: (L, R) -> (0.2, 0.4), (0.6, 0.8)
        let stereo = vec![0.2f32, 0.4f32, 0.6f32, 0.8f32];
        let bytes = resampler.resample_f32_to_16k_mono(&stereo);
        assert_eq!(bytes.len(), 4); // 2 mono frames * 2 bytes = 4 bytes
        let first_sample = i16::from_le_bytes([bytes[0], bytes[1]]);
        // Expected mono: (0.2 + 0.4) / 2 = 0.3 * 32767 ≈ 9830
        assert!((first_sample - 9830).abs() < 50);
    }

    #[test]
    fn test_resample_48k_to_16k() {
        let resampler = AudioResampler::new(48000, 1);
        let input = vec![0.5f32; 480]; // 480 samples at 48kHz = 10ms
        let bytes = resampler.resample_f32_to_16k_mono(&input);
        // At 16kHz, 10ms is 160 samples -> 320 bytes
        assert_eq!(bytes.len(), 320);
    }
}
