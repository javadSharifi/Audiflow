use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;

use crate::error::AppError;
use crate::processing::pipeline::{self, Emitter};
use crate::types::{JobEvent, JobStatus};

use super::job::{JobKind, QueuedJob};
use super::QueueInner;

pub(crate) fn worker_loop(inner: Arc<QueueInner>) {
    inner.active_workers.fetch_add(1, Ordering::SeqCst);

    loop {
        let next = inner.order.lock().unwrap().pop_front();
        let Some(job) = next else { break };
        let QueuedJob {
            id: job_id,
            source,
            trim,
            multiple_sources,
            options,
            kind,
        } = job;

        // Per-job token: cancel(job_id) kills only this file.
        let Some(token) = inner.tokens.lock().unwrap().get(&job_id).cloned() else {
            crate::log_warn!("missing token for job {job_id}, skipping");
            continue;
        };
        if token.is_cancelled() {
            if let Some(rec) = inner.update(&job_id, |r| r.status = JobStatus::Cancelled) {
                inner.emit_event_for(&rec);
            }
            continue;
        }

        // Resolve ffmpeg paths per job (honors settings override). A missing
        // bundled binary is surfaced as a job failure — never a silent
        // fallback to whatever `ffmpeg` happens to be on PATH.
        let (ffmpeg, ffprobe) = match resolve_binaries() {
            Ok(pair) => pair,
            Err(e) => {
                crate::log_error!("binaries missing: {e}");
                if let Some(rec) = inner.update(&job_id, |r| {
                    r.status = JobStatus::Failed;
                    r.error = Some(e.to_string());
                    r.technical = Some(
                        "Bundled ffmpeg/ffprobe binaries could not be located next to the executable. Reinstall the application."
                            .into(),
                    );
                    r.percent = None;
                    r.speed = None;
                }) {
                    inner.emit_event_for(&rec);
                }
                continue;
            }
        };

        // LAZY STAGING (Android): resolve the input URI to a local file NOW,
        // right before this job runs — never at pick time. Only `concurrency`
        // files are copied at any moment; desktop paths pass through as-is.
        let staged_source = crate::android_fs::ensure_local_path(&source.to_string_lossy());
        let job_source = std::path::PathBuf::from(&staged_source);
        if staged_source.as_str() != source.to_string_lossy().as_ref() {
            crate::log_info!(
                "job {job_id}: staged '{}' -> '{}'",
                source.display(),
                staged_source
            );
        }
        // A content URI that still resolves to itself = staging failed.
        // Fail the job here with the REAL reason instead of letting ffprobe
        // report a misleading "corrupted or unsupported" error.
        if source.to_string_lossy().starts_with("content://")
            && staged_source.starts_with("content://")
        {
            let reason =
                "Could not copy the selected file into app storage. Check storage space and media access, then retry.";
            crate::log_error!("job {job_id}: staging failed for {}", source.display());
            if let Some(rec) = inner.update(&job_id, |r| {
                r.status = JobStatus::Failed;
                r.error = Some(reason.into());
                r.percent = None;
                r.speed = None;
            }) {
                inner.emit_event_for(&rec);
            }
            continue;
        }

        if let Some(rec) = inner.update(&job_id, |r| {
            r.status = JobStatus::Processing;
            r.percent = Some(0.0);
        }) {
            inner.emit_event_for(&rec);
        }
        crate::log_info!("processing started: {}", source.display());

        let emitter: Emitter = {
            let inner2 = Arc::clone(&inner);
            Arc::new(move |ev: JobEvent| {
                let captured = ev.clone();
                inner2.emit(&captured);
                inner2.update(&ev.id, |r| {
                    r.percent = ev.percent;
                    r.speed = ev.speed.clone();
                    if let Some(w) = &ev.warning {
                        r.warning = Some(w.clone());
                    }
                });
            })
        };

        let result = match kind {
            JobKind::Convert => pipeline::run_job(
                &job_id,
                &job_source,
                &options,
                trim.as_ref(),
                multiple_sources,
                &ffmpeg,
                &ffprobe,
                token.clone(),
                &emitter,
            ),
            JobKind::Boost {
                preset,
                manual_gain_percent,
            } => crate::processing::sound_booster::run_boost_job(
                &job_id,
                &job_source,
                preset,
                manual_gain_percent,
                &options,
                trim.as_ref(),
                multiple_sources,
                &ffmpeg,
                &ffprobe,
                token.clone(),
                &emitter,
            ),
        };

        match result {
            Ok(outcome) => {
                // Android: publish finished outputs into the shared
                // Music/AudioConverter collection (desktop no-op).
                let outputs = crate::android_fs::publish_outputs(
                    &outcome
                        .outputs
                        .iter()
                        .map(|p| p.to_string_lossy().into_owned())
                        .collect::<Vec<String>>(),
                );
                if let Some(rec) = inner.update(&job_id, |r| {
                    r.status = JobStatus::Completed;
                    r.percent = Some(100.0);
                    r.speed = None;
                    r.warning = outcome.warning.clone();
                    r.outputs = outputs;
                }) {
                    inner.emit_event_for(&rec);
                }
                crate::log_info!("processing completed: {}", source.display());
            }
            Err(AppError::Cancelled) => {
                if let Some(rec) = inner.update(&job_id, |r| r.status = JobStatus::Cancelled) {
                    inner.emit_event_for(&rec);
                }
                crate::log_warn!("processing cancelled: {}", source.display());
            }
            Err(e) => {
                let technical = match &e {
                    AppError::FFmpeg(_) => Some(e.to_string()),
                    AppError::CorruptedFile(t) => Some(t.clone()),
                    AppError::NoAudioTrack(t) => Some(t.clone()),
                    _ => None,
                };
                if let Some(rec) = inner.update(&job_id, |r| {
                    r.status = JobStatus::Failed;
                    r.error = Some(e.to_string());
                    r.technical = technical.clone();
                    r.percent = None;
                    r.speed = None;
                }) {
                    inner.emit_event_for(&rec);
                }
                crate::log_error!("processing failed: {} — {e}", source.display());
            }
        }
    }

    if inner.active_workers.fetch_sub(1, Ordering::SeqCst) == 1 {
        // Last worker out: make sure frontend knows the queue settled.
        inner.notify_idle_if_needed();
    }
}

pub(crate) fn resolve_binaries() -> Result<(PathBuf, PathBuf), AppError> {
    let override_path = crate::settings::Settings::load().ffmpeg_path_override;
    if let Some(p) = override_path {
        let pb = PathBuf::from(&p);
        if pb.exists() {
            // The override points at ffmpeg; derive ffprobe from its sibling
            // instead of reusing the same binary for both roles.
            let ffprobe = probe_sibling(&pb).unwrap_or_else(|| pb.clone());
            return Ok((pb, ffprobe));
        }
        crate::log_warn!("settings ffmpeg_path_override does not exist: {p}");
    }
    let ffmpeg = crate::ffmpeg::locate::ffmpeg_path()?;
    let ffprobe = crate::ffmpeg::locate::locate("ffprobe")?;
    Ok((ffmpeg, ffprobe))
}

/// Given `…/ffmpeg[.exe]`, return `…/ffprobe[.exe]` when it exists.
fn probe_sibling(ffmpeg: &Path) -> Option<PathBuf> {
    let dir = ffmpeg.parent()?;
    let file_name = ffmpeg.file_name()?.to_string_lossy().into_owned();
    let probe_name = if file_name.eq_ignore_ascii_case("ffmpeg.exe") {
        "ffprobe.exe"
    } else if file_name.eq_ignore_ascii_case("ffmpeg") {
        "ffprobe"
    } else {
        return None;
    };
    let candidate = dir.join(probe_name);
    candidate.exists().then_some(candidate)
}
