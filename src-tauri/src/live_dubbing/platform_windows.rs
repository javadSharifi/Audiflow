/// Windows WASAPI loopback capturer using cpal.
/// Captures digital internal system audio playing through default output device.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, Stream};

use super::audio_capture::{AudioResampler, SystemAudioCapturer};

pub struct WindowsLoopbackCapturer {
    is_running: Arc<AtomicBool>,
    _stream: Option<Stream>,
}

impl WindowsLoopbackCapturer {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
            _stream: None,
        }
    }
}

impl Default for WindowsLoopbackCapturer {
    fn default() -> Self {
        Self::new()
    }
}

impl SystemAudioCapturer for WindowsLoopbackCapturer {
    fn start_capture(&mut self, on_chunk: Box<dyn Fn(Vec<u8>) + Send + Sync>) -> Result<(), String> {
        if self.is_capturing() {
            return Ok(());
        }

        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| "Failed to find default output audio device for loopback".to_string())?;

        let default_config = device
            .default_output_config()
            .map_err(|e| format!("Failed to query default output config: {}", e))?;

        let sample_rate = default_config.sample_rate().0;
        let channels = default_config.channels();
        let sample_format = default_config.sample_format();

        let resampler = Arc::new(AudioResampler::new(sample_rate, channels));
        let on_chunk = Arc::new(on_chunk);
        let is_running = self.is_running.clone();
        is_running.store(true, Ordering::SeqCst);

        let err_fn = |err| eprintln!("WASAPI loopback stream error: {}", err);

        let stream = match sample_format {
            SampleFormat::F32 => {
                let resampler_clone = resampler.clone();
                let on_chunk_clone = on_chunk.clone();
                let is_running_clone = is_running.clone();

                device.build_input_stream(
                    &default_config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if !is_running_clone.load(Ordering::Relaxed) {
                            return;
                        }
                        let pcm_16k = resampler_clone.resample_f32_to_16k_mono(data);
                        if !pcm_16k.is_empty() {
                            on_chunk_clone(pcm_16k);
                        }
                    },
                    err_fn,
                    None,
                )
            }
            SampleFormat::I16 => {
                let resampler_clone = resampler.clone();
                let on_chunk_clone = on_chunk.clone();
                let is_running_clone = is_running.clone();

                device.build_input_stream(
                    &default_config.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if !is_running_clone.load(Ordering::Relaxed) {
                            return;
                        }
                        let pcm_16k = resampler_clone.resample_i16_to_16k_mono(data);
                        if !pcm_16k.is_empty() {
                            on_chunk_clone(pcm_16k);
                        }
                    },
                    err_fn,
                    None,
                )
            }
            _ => {
                return Err(format!(
                    "Unsupported sample format {:?} for WASAPI loopback",
                    sample_format
                ));
            }
        }
        .map_err(|e| format!("Failed to build WASAPI loopback stream: {}", e))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start WASAPI loopback playback: {}", e))?;

        self._stream = Some(stream);
        Ok(())
    }

    fn stop_capture(&mut self) -> Result<(), String> {
        self.is_running.store(false, Ordering::SeqCst);
        self._stream = None;
        Ok(())
    }

    fn is_capturing(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }
}
