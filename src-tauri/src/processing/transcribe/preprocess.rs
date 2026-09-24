//! Pre-upload audio compression for Transcribe Studio.
//!
//! Google downsamples every input to ~16 Kbps equivalent internally
//! regardless of source quality, so uploading the original high-bitrate file
//! buys zero accuracy and only wastes bandwidth. Therefore EVERY input is
//! mandatorily transcoded to **mono, 16 kHz, Opus ~32 kbps** before upload —
//! the same sample-rate/channel layout already used in
//! [`crate::ffmpeg::waveform`] — via the shared [`crate::ffmpeg::run`]
//! `RunSpec` runner (structured argv, no shell, cancellable).
//!
//! Optional **fast mode** additionally applies `atempo=1.5`:
//! - EXPERIMENTAL, unvalidated-by-Google technique: pitch-preserving tempo
//!   change cuts upload bytes and billed audio-minutes by ~33%, at some
//!   unquantified accuracy risk. Default OFF.
//! - NEVER `asetrate` (resampling-as-speedup shifts pitch and badly hurts
//!   recognition); `atempo` preserves pitch.
//! - The UI disables fast mode whenever diarization or word timestamps are
//!   on; any timestamps that do come back must be divided by [`FAST_FACTOR`]
//!   before use (see `stitch.rs`).

use std::path::{Path, PathBuf};

use crate::error::{AppError, Result};
use crate::ffmpeg::probe;
use crate::ffmpeg::run::{CancelToken, RunSpec};
use crate::processing::transcribe::types::FAST_MODE_FACTOR;

/// Speed multiplier applied by fast mode (`atempo=1.5`).
pub const FAST_FACTOR: f64 = FAST_MODE_FACTOR;
/// Target layout: identical to the waveform decoder.
const TARGET_RATE_HZ: u32 = 16_000;
const TARGET_CHANNELS: u16 = 1;
/// ~32 kbps Opus: far above Gemini's internal ~16 Kbps floor, far below source.
const TARGET_BITRATE_KBPS: u32 = 32;
pub const PREPROCESSED_MIME: &str = "audio/opus";

/// Output of one preprocess run. `is_temp` files live in the OS temp dir and
/// MUST be deleted via [`cleanup_preprocessed`] after upload.
#[derive(Debug, Clone)]
pub struct PreprocessedAudio {
    pub path: PathBuf,
    pub is_temp: bool,
    /// Real duration AFTER preprocessing (post-`atempo`), from ffprobe.
    pub duration_secs: f64,
    pub mime_type: String,
    /// 1.0 normally, [`FAST_FACTOR`] in fast mode.
    pub speed_factor: f64,
}

/// Pure argv builder (unit-testable without an FFmpeg binary).
pub fn build_preprocess_args(source: &Path, out: &Path, fast_mode: bool) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostdin".into(),
        "-y".into(),
        "-loglevel".into(),
        "error".into(),
        "-progress".into(),
        "pipe:1".into(),
        "-nostats".into(),
        "-i".into(),
        source.to_string_lossy().into_owned(),
        "-map".into(),
        "0:a:0".into(),
        "-vn".into(),
        "-ac".into(),
        TARGET_CHANNELS.to_string(),
        "-ar".into(),
        TARGET_RATE_HZ.to_string(),
    ];
    if fast_mode {
        args.extend(["-filter:a".to_string(), "atempo=1.5".to_string()]);
    }
    args.extend([
        "-c:a".to_string(),
        "libopus".to_string(),
        "-b:a".to_string(),
        format!("{TARGET_BITRATE_KBPS}k"),
        "--".to_string(),
        out.to_string_lossy().into_owned(),
    ]);
    args
}

fn temp_output_path() -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("ac-tx-{}-{nanos}.opus", std::process::id()))
}

/// Transcode `source` to the mandatory upload format. Always re-encodes
/// (never symlinks/passes through the original).
pub fn preprocess_for_transcribe(
    ffmpeg: &Path,
    ffprobe: &Path,
    source: &Path,
    fast_mode: bool,
    cancel: &CancelToken,
) -> Result<PreprocessedAudio> {
    if cancel.is_cancelled() {
        return Err(AppError::Cancelled);
    }
    if !source.exists() {
        return Err(AppError::NotFound(source.to_string_lossy().into_owned()));
    }
    let out = temp_output_path();
    let args = build_preprocess_args(source, &out, fast_mode);
    let outcome = RunSpec::new(ffmpeg.to_path_buf(), args)
        .cancellable(cancel.clone())
        .run()?;
    if !outcome.success {
        let _ = std::fs::remove_file(&out);
        let tail = outcome.stderr_tail.join("\n");
        let msg = if tail.trim().is_empty() {
            "Audio preprocessing failed with no diagnostic output".to_string()
        } else {
            format!("Audio preprocessing failed: {tail}")
        };
        return Err(AppError::FFmpeg(msg));
    }
    let probed = probe::probe_file(ffprobe, &out.to_string_lossy())?;
    let duration_secs = probed.duration_secs().filter(|d| *d > 0.0).ok_or_else(|| {
        let _ = std::fs::remove_file(&out);
        AppError::CorruptedFile(format!(
            "Preprocessed audio has no measurable duration: {}",
            out.display()
        ))
    })?;
    Ok(PreprocessedAudio {
        path: out,
        is_temp: true,
        duration_secs,
        mime_type: PREPROCESSED_MIME.to_string(),
        speed_factor: if fast_mode { FAST_FACTOR } else { 1.0 },
    })
}

/// Delete the temp file produced by [`preprocess_for_transcribe`]. No-op for
/// non-temp outputs; failures are swallowed (best-effort cleanup).
pub fn cleanup_preprocessed(p: &PreprocessedAudio) {
    if p.is_temp {
        let _ = std::fs::remove_file(&p.path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mandatory_layout_args_present() {
        let args = build_preprocess_args(Path::new("/in.mp4"), Path::new("/out.opus"), false);
        let s = args.join(" ");
        assert!(s.contains("-map 0:a:0"));
        assert!(s.contains("-ac 1"));
        assert!(s.contains("-ar 16000"));
        assert!(s.contains("libopus"));
        assert!(s.contains("-b:a 32k"));
        assert!(s.contains("-vn"));
        assert!(
            !s.contains("atempo"),
            "fast filter must be absent by default"
        );
        // Injection guard precedes the output, mirroring the main pipeline.
        let dashdash = args.iter().position(|a| a == "--").unwrap();
        assert_eq!(args[dashdash + 1], "/out.opus");
    }

    #[test]
    fn fast_mode_adds_pitch_preserving_atempo_only() {
        let args = build_preprocess_args(Path::new("/in.mp4"), Path::new("/out.opus"), true);
        let s = args.join(" ");
        assert!(s.contains("atempo=1.5"));
        assert!(
            !s.contains("asetrate"),
            "asetrate shifts pitch and is forbidden"
        );
    }

    #[test]
    fn missing_source_is_not_found() {
        let cancel = CancelToken::new();
        let err = preprocess_for_transcribe(
            Path::new("/nonexistent-ffmpeg"),
            Path::new("/nonexistent-ffprobe"),
            Path::new("/definitely/not/here.mp4"),
            false,
            &cancel,
        )
        .unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[test]
    fn cancelled_before_start() {
        let cancel = CancelToken::new();
        cancel.cancel();
        let err = preprocess_for_transcribe(
            Path::new("/bin"),
            Path::new("/bin"),
            Path::new("/tmp/x.mp4"),
            false,
            &cancel,
        )
        .unwrap_err();
        assert!(matches!(err, AppError::Cancelled));
    }
}
