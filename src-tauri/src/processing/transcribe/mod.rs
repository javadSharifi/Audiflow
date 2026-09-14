//! Transcribe Studio: cloud transcription via Gemini `gemini-3.5-transcribe`.
//!
//! Orchestration ([`run_transcription`]): config validation → mandatory
//! compression preprocess → duration check on the REAL post-preprocess
//! duration → conditional chunking (only above the safety-margin thresholds)
//! → per-chunk upload + poll + transcribe → usage bookkeeping → stitch.
//!
//! Cancellation is cooperative between phases (network futures are awaited,
//! the token is checked before each new phase/chunk).

pub mod error_classify;
pub mod gemini_client;
pub mod preprocess;
pub mod stitch;
pub mod types;
pub mod usage_tracker;

pub use gemini_client::GeminiClient;
pub use stitch::{render_transcript, stitch_chunks, ChunkTranscript, TranscriptFormat};
pub use types::{
    TranscriptionEvent, TranscriptionJob, TranscriptionRequestConfig, TranscriptionResult,
    TranscriptionStatus, UsageStats, WordInfo,
};

use std::path::{Path, PathBuf};

use crate::error::{AppError, GeminiErrorKind, Result};
use crate::ffmpeg::run::{CancelToken, RunSpec};

/// Progress sink owned by the IPC layer (maps to `transcription-event`).
pub type TranscribeProgress = dyn Fn(TranscriptionStatus, f64) + Send + Sync;

/// Cut one chunk from the preprocessed file with stream copy (`-c:a copy`,
/// output seeking for sample-accurate boundaries).
fn extract_audio_chunk(
    ffmpeg: &Path,
    src: &Path,
    start_secs: f64,
    len_secs: f64,
    out: &Path,
    cancel: &CancelToken,
) -> Result<()> {
    let args: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostdin".into(),
        "-y".into(),
        "-loglevel".into(),
        "error".into(),
        "-progress".into(),
        "pipe:1".into(),
        "-nostats".into(),
        "-i".into(),
        src.to_string_lossy().into_owned(),
        "-ss".into(),
        format!("{start_secs:.3}"),
        "-t".into(),
        format!("{len_secs:.3}"),
        "-map".into(),
        "0:a:0".into(),
        "-vn".into(),
        "-c:a".into(),
        "copy".into(),
        "--".into(),
        out.to_string_lossy().into_owned(),
    ];
    let outcome = RunSpec::new(ffmpeg.to_path_buf(), args).cancellable(cancel.clone()).run()?;
    if !outcome.success {
        let _ = std::fs::remove_file(out);
        return Err(AppError::FFmpeg(format!(
            "Chunk extraction failed: {}",
            outcome.stderr_tail.join("\n")
        )));
    }
    Ok(())
}

fn chunk_temp_path(index: usize) -> PathBuf {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("ac-tx-chunk-{index}-{}-{nanos}.opus", std::process::id()))
}

fn check_cancel(cancel: &CancelToken) -> Result<()> {
    if cancel.is_cancelled() {
        return Err(AppError::Cancelled);
    }
    Ok(())
}

/// Cache an actually-observed quota failure, then propagate the error.
fn note_quota(err: AppError) -> AppError {
    if let AppError::Gemini(GeminiErrorKind::QuotaExceeded { metric, value }) = &err {
        let _ = usage_tracker::note_quota_failure(metric, value);
    }
    err
}

/// End-to-end transcription of one source file.
pub async fn run_transcription(
    ffmpeg: &Path,
    ffprobe: &Path,
    client: &GeminiClient,
    source: &Path,
    config: &TranscriptionRequestConfig,
    cancel: &CancelToken,
    progress: &TranscribeProgress,
) -> Result<TranscriptionResult> {
    config.validate()?;
    check_cancel(cancel)?;
    progress(TranscriptionStatus::Preprocessing, 2.0);

    // ---- Phase 1: mandatory compression (+ optional fast mode) ------------
    let pre = preprocess::preprocess_for_transcribe(ffmpeg, ffprobe, source, config.fast_mode, cancel)?;
    let total = pre.duration_secs;
    let speed = pre.speed_factor;

    // ---- Phase 2: conditional chunking ------------------------------------
    // Only files above the safety-margin threshold pay request overhead.
    let threshold = config.chunk_threshold_secs();
    let max_single = config.max_duration_secs();
    let mut windows: Vec<(f64, f64)> = Vec::new();
    if total <= threshold {
        windows.push((0.0, total));
    } else {
        let n = (total / threshold).ceil().max(2.0) as usize;
        let len = total / n as f64;
        for i in 0..n {
            let start = i as f64 * len;
            let end = if i + 1 == n { total } else { (i + 1) as f64 * len };
            // Defensive: no chunk may exceed the model's hard per-request cap.
            if end - start > max_single {
                preprocess::cleanup_preprocessed(&pre);
                return Err(AppError::InvalidInput(format!(
                    "Audio too long even after chunking ({total:.0}s)"
                )));
            }
            windows.push((start, end));
        }
    }
    let n = windows.len();
    progress(TranscriptionStatus::Preprocessing, 8.0);

    // ---- Phase 3: per-chunk upload + transcribe -----------------------------
    let mut chunks: Vec<ChunkTranscript> = Vec::with_capacity(n);
    let outcome: Result<()> = async {
        for (i, (start, end)) in windows.iter().enumerate() {
            check_cancel(cancel)?;
            let base = 8.0 + 84.0 * i as f64 / n as f64;

            // Materialize the chunk (single-file case reuses `pre` directly).
            let (chunk_path, is_temp, chunk_len) = if n == 1 {
                (pre.path.clone(), false, total)
            } else {
                let out = chunk_temp_path(i);
                extract_audio_chunk(ffmpeg, &pre.path, *start, end - start, &out, cancel)?;
                (out, true, end - start)
            };

            progress(TranscriptionStatus::Uploading, base + 84.0 * 0.15 / n as f64);
            let uploaded = client
                .upload_file(&chunk_path, &pre.mime_type)
                .await
                .map_err(note_quota)?;
            // Book the minutes actually sent, right after each upload.
            let _ = usage_tracker::record_sent_minutes(chunk_len / 60.0);

            progress(TranscriptionStatus::Transcribing, base + 84.0 * 0.35 / n as f64);
            let file = client
                .poll_file_active(&uploaded.resource_name)
                .await
                .map_err(note_quota)?;
            check_cancel(cancel)?;
            let result = client
                .transcribe_audio(&file.uri, &pre.mime_type, config)
                .await
                .map_err(note_quota)?;

            if is_temp {
                let _ = std::fs::remove_file(&chunk_path);
            }
            chunks.push(ChunkTranscript { result, start_secs: *start });
            progress(TranscriptionStatus::Transcribing, 8.0 + 84.0 * (i + 1) as f64 / n as f64);
        }
        Ok(())
    }
    .await;
    preprocess::cleanup_preprocessed(&pre);
    outcome?;

    // ---- Phase 4: stitch (with fast-mode rescale) ---------------------------
    check_cancel(cancel)?;
    progress(TranscriptionStatus::Completed, 100.0);
    Ok(stitch::stitch_chunks(&chunks, speed))
}
