/// Windows WASAPI loopback capturer using cpal on a dedicated thread.
/// Captures digital internal system audio playing through default output device.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::SampleFormat;

use super::audio_capture::{AudioResampler, SystemAudioCapturer};

pub struct WindowsLoopbackCapturer {
    is_running: Arc<AtomicBool>,
}

impl WindowsLoopbackCapturer {
    pub fn new() -> Self {
        Self {
            is_running: Arc::new(AtomicBool::new(false)),
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

        let is_running = self.is_running.clone();
        is_running.store(true, Ordering::SeqCst);
        let on_chunk = Arc::new(on_chunk);

        let thread_running = is_running.clone();
        thread::spawn(move || {
            let host = cpal::default_host();
            let Some(device) = host.default_output_device() else {
                eprintln!("WASAPI: No default output audio device found for loopback");
                thread_running.store(false, Ordering::SeqCst);
                return;
            };

            let Ok(default_config) = device.default_output_config() else {
                eprintln!("WASAPI: Failed to query default output config");
                thread_running.store(false, Ordering::SeqCst);
                return;
            };

            let sample_rate = default_config.sample_rate().0;
            let channels = default_config.channels();
            let sample_format = default_config.sample_format();

            let resampler = Arc::new(AudioResampler::new(sample_rate, channels));
            let err_fn = |err| eprintln!("WASAPI loopback stream error: {}", err);

            let resampler_clone = resampler.clone();
            let on_chunk_clone = on_chunk.clone();
            let stream_running = thread_running.clone();

            let stream_result = match sample_format {
                SampleFormat::F32 => device.build_input_stream(
                    &default_config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        if !stream_running.load(Ordering::Relaxed) {
                            return;
                        }
                        let pcm_16k = resampler_clone.resample_f32_to_16k_mono(data);
                        if !pcm_16k.is_empty() {
                            on_chunk_clone(pcm_16k);
                        }
                    },
                    err_fn,
                    None,
                ),
                SampleFormat::I16 => device.build_input_stream(
                    &default_config.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        if !stream_running.load(Ordering::Relaxed) {
                            return;
                        }
                        let pcm_16k = resampler_clone.resample_i16_to_16k_mono(data);
                        if !pcm_16k.is_empty() {
                            on_chunk_clone(pcm_16k);
                        }
                    },
                    err_fn,
                    None,
                ),
                _ => {
                    eprintln!("WASAPI: Unsupported sample format {:?}", sample_format);
                    thread_running.store(false, Ordering::SeqCst);
                    return;
                }
            };

            if let Ok(stream) = stream_result {
                if stream.play().is_ok() {
                    while thread_running.load(Ordering::SeqCst) {
                        thread::sleep(std::time::Duration::from_millis(50));
                    }
                }
            }
        });

        Ok(())
    }

    fn stop_capture(&mut self) -> Result<(), String> {
        self.is_running.store(false, Ordering::SeqCst);
        Ok(())
    }

    fn is_capturing(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }
}
