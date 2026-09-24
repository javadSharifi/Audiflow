//! Transcription job manager: lifecycle, cancellation, `transcription-event`.
//!
//! Mirrors the [`crate::queue::QueueManager`] discipline (per-job
//! [`CancelToken`], state snapshots, event emission) but runs the async
//! transcribe orchestration on a detached worker thread via
//! `tauri::async_runtime::block_on`, since each job mixes blocking FFmpeg
//! phases with async network phases.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter as _};

use crate::error::{AppError, Result};
use crate::ffmpeg::run::CancelToken;
use crate::processing::transcribe::stitch::{render_transcript, TranscriptFormat};
use crate::processing::transcribe::{
    run_transcription, GeminiClient, TranscriptionEvent, TranscriptionJob,
    TranscriptionRequestConfig, TranscriptionResult, TranscriptionStatus,
};

struct Inner {
    app: AppHandle,
    jobs: Mutex<HashMap<String, TranscriptionJob>>,
    tokens: Mutex<HashMap<String, CancelToken>>,
}

impl Inner {
    fn emit(&self, ev: &TranscriptionEvent) {
        let _ = self.app.emit("transcription-event", ev);
    }

    fn emit_for_record(&self, rec: &TranscriptionJob) {
        if !matches!(rec.status, TranscriptionStatus::Transcribing) {
            crate::log_info!(
                "transcription emit: id={} status={:?} percent={:?}",
                rec.id,
                rec.status,
                rec.percent
            );
        }
        self.emit(&TranscriptionEvent {
            id: rec.id.clone(),
            source_path: rec.source_path.clone(),
            status: rec.status,
            percent: rec.percent,
            error: rec.error.clone(),
            technical: rec.technical.clone(),
            error_kind: rec.error_kind.clone(),
            result: rec.result.clone(),
        });
    }

    fn update(
        &self,
        id: &str,
        mutate: impl FnOnce(&mut TranscriptionJob),
    ) -> Option<TranscriptionJob> {
        let mut guard = self.jobs.lock().unwrap();
        let rec = guard.get_mut(id)?;
        mutate(rec);
        Some(rec.clone())
    }
}

pub struct TranscribeQueueManager {
    inner: Arc<Inner>,
}

impl TranscribeQueueManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            inner: Arc::new(Inner {
                app,
                jobs: Mutex::new(HashMap::new()),
                tokens: Mutex::new(HashMap::new()),
            }),
        }
    }

    /// Enqueue one transcription. Fails fast on bad config / missing key /
    /// missing binaries / missing file; the heavy work runs detached.
    pub fn start_transcription(
        &self,
        source: String,
        config: TranscriptionRequestConfig,
    ) -> Result<String> {
        config.validate()?;
        let key = crate::secrets::require_gemini_api_key()?;
        let (ffmpeg, ffprobe) = crate::queue::resolve_binaries()?;
        if !source.starts_with("content://")
            && !source.starts_with("file://")
            && !std::path::Path::new(&source).exists()
        {
            return Err(AppError::NotFound(source));
        }

        let id = new_transcribe_job_id();
        let rec = TranscriptionJob {
            id: id.clone(),
            source_path: source.clone(),
            status: TranscriptionStatus::Waiting,
            percent: None,
            error: None,
            technical: None,
            error_kind: None,
            result: None,
        };
        {
            let mut jobs = self.inner.jobs.lock().unwrap();
            let mut tokens = self.inner.tokens.lock().unwrap();
            jobs.insert(id.clone(), rec.clone());
            tokens.insert(id.clone(), CancelToken::new());
        }
        self.inner.emit_for_record(&rec);

        let inner = Arc::clone(&self.inner);
        let token = inner
            .tokens
            .lock()
            .unwrap()
            .get(&id)
            .cloned()
            .unwrap_or_default();
        std::thread::spawn(move || {
            run_transcribe_job(
                inner,
                id,
                PathBuf::from(source),
                config,
                key,
                ffmpeg,
                ffprobe,
                token,
            );
        });
        Ok(rec.id)
    }

    pub fn cancel(&self, job_id: &str) {
        if let Some(tok) = self.inner.tokens.lock().unwrap().get(job_id) {
            tok.cancel();
        }
        if let Some(rec) = self.inner.update(job_id, |r| {
            if matches!(r.status, TranscriptionStatus::Waiting) {
                r.status = TranscriptionStatus::Cancelled;
            }
        }) {
            self.inner.emit_for_record(&rec);
        }
    }

    pub fn cancel_all(&self) {
        let tokens: Vec<CancelToken> = self
            .inner
            .tokens
            .lock()
            .unwrap()
            .values()
            .cloned()
            .collect();
        for t in tokens {
            t.cancel();
        }
        let updated: Vec<TranscriptionJob> = {
            let mut jobs = self.inner.jobs.lock().unwrap();
            let mut recs = Vec::new();
            for rec in jobs.values_mut() {
                if matches!(
                    rec.status,
                    TranscriptionStatus::Waiting
                        | TranscriptionStatus::Preprocessing
                        | TranscriptionStatus::Uploading
                        | TranscriptionStatus::Transcribing
                ) {
                    rec.status = TranscriptionStatus::Cancelled;
                    rec.percent = None;
                    recs.push(rec.clone());
                }
            }
            recs
        };
        for rec in updated {
            self.inner.emit_for_record(&rec);
        }
    }

    pub fn clear_finished(&self) {
        let mut jobs = self.inner.jobs.lock().unwrap();
        jobs.retain(|_, r| {
            matches!(
                r.status,
                TranscriptionStatus::Waiting
                    | TranscriptionStatus::Preprocessing
                    | TranscriptionStatus::Uploading
                    | TranscriptionStatus::Transcribing
            )
        });
    }

    pub fn snapshot(&self) -> Vec<TranscriptionJob> {
        let guard = self.inner.jobs.lock().unwrap();
        let mut all: Vec<TranscriptionJob> = guard.values().cloned().collect();
        all.sort_by(|a, b| a.id.cmp(&b.id));
        all
    }

    fn result_of(&self, job_id: &str) -> Result<(TranscriptionJob, TranscriptionResult)> {
        let guard = self.inner.jobs.lock().unwrap();
        let rec = guard
            .get(job_id)
            .ok_or_else(|| AppError::NotFound(job_id.to_string()))?;
        let result = rec
            .result
            .clone()
            .ok_or_else(|| AppError::InvalidInput("Transcript is not ready yet".to_string()))?;
        Ok((rec.clone(), result))
    }

    /// Render a finished transcript to txt/srt/vtt with atomic write +
    /// collision-safe naming. Returns the final file path.
    pub fn export_transcript(&self, job_id: &str, format: &str) -> Result<String> {
        let (rec, result) = self.result_of(job_id)?;
        let fmt = TranscriptFormat::parse(format)?;
        let text = render_transcript(&result, fmt)?;
        let source = PathBuf::from(&rec.source_path);

        #[cfg(target_os = "android")]
        let dir: PathBuf = crate::android_fs::output_root().unwrap_or_else(|| {
            source
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."))
        });
        #[cfg(not(target_os = "android"))]
        let dir: PathBuf = source
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));
        std::fs::create_dir_all(&dir)?;

        let stem = crate::processing::naming::sanitize_component(
            &source
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "transcript".into()),
        );
        let ext = fmt.extension();
        let target = dir.join(format!("{stem}_transcript.{ext}"));
        let target = crate::processing::naming::unique_path(&target);
        // Temp sibling keeps the real extension visible, then atomic rename.
        let tmp = target.with_extension(format!("{ext}.part"));
        std::fs::write(&tmp, text)?;
        std::fs::rename(&tmp, &target).map_err(|e| {
            let _ = std::fs::remove_file(&tmp);
            AppError::Io(format!("Failed to finalize {}: {e}", target.display()))
        })?;
        crate::log_info!("transcript exported: {}", target.display());
        Ok(target.to_string_lossy().into_owned())
    }
}

fn new_transcribe_job_id() -> String {
    use std::sync::atomic::AtomicU64;
    use std::time::{SystemTime, UNIX_EPOCH};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let n = SEQ.fetch_add(1, Ordering::SeqCst);
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("tx-{ts}-{n}")
}

#[allow(clippy::too_many_arguments)]
fn run_transcribe_job(
    inner: Arc<Inner>,
    job_id: String,
    source: PathBuf,
    config: TranscriptionRequestConfig,
    key: String,
    ffmpeg: PathBuf,
    ffprobe: PathBuf,
    token: CancelToken,
) {
    if token.is_cancelled() {
        if let Some(rec) = inner.update(&job_id, |r| r.status = TranscriptionStatus::Cancelled) {
            inner.emit_for_record(&rec);
        }
        return;
    }

    // Lazy Android staging inside the worker (never at pick time).
    let staged = crate::android_fs::ensure_local_path(&source.to_string_lossy());
    if source.to_string_lossy().starts_with("content://") && staged.starts_with("content://") {
        let reason =
            "Could not copy the selected file into app storage. Check storage space and media access, then retry.";
        if let Some(rec) = inner.update(&job_id, |r| {
            r.status = TranscriptionStatus::Failed;
            r.error = Some(reason.into());
        }) {
            inner.emit_for_record(&rec);
        }
        return;
    }
    let job_source = PathBuf::from(&staged);
    let display_source = source.to_string_lossy().into_owned();

    if let Some(rec) = inner.update(&job_id, |r| {
        r.status = TranscriptionStatus::Preprocessing;
        r.percent = Some(0.0);
    }) {
        inner.emit_for_record(&rec);
    }

    let client = GeminiClient::new(key);
    let progress = {
        let inner2 = Arc::clone(&inner);
        let job_id2 = job_id.clone();
        let display2 = display_source.clone();
        move |status: TranscriptionStatus, percent: f64| {
            let ev = TranscriptionEvent {
                id: job_id2.clone(),
                source_path: display2.clone(),
                status,
                percent: Some(percent),
                error: None,
                technical: None,
                error_kind: None,
                result: None,
            };
            inner2.emit(&ev);
            inner2.update(&job_id2, |r| {
                // Don't clobber a terminal state set by cancellation.
                if !matches!(
                    r.status,
                    TranscriptionStatus::Completed
                        | TranscriptionStatus::Failed
                        | TranscriptionStatus::Cancelled
                ) {
                    r.status = status;
                    r.percent = Some(percent);
                }
            });
        }
    };

    let outcome = tauri::async_runtime::block_on(run_transcription(
        &ffmpeg,
        &ffprobe,
        &client,
        &job_source,
        &config,
        &token,
        &progress,
    ));

    match outcome {
        Ok(result) => {
            if let Some(rec) = inner.update(&job_id, |r| {
                r.status = TranscriptionStatus::Completed;
                r.percent = Some(100.0);
                r.result = Some(result);
            }) {
                inner.emit_for_record(&rec);
            }
            crate::log_info!("transcription completed: {display_source}");
        }
        Err(AppError::Cancelled) | Err(_) if token.is_cancelled() => {
            if let Some(rec) = inner.update(&job_id, |r| {
                r.status = TranscriptionStatus::Cancelled;
                r.percent = None;
            }) {
                inner.emit_for_record(&rec);
            }
            crate::log_warn!("transcription cancelled: {display_source}");
        }
        Err(e) => {
            let technical = match &e {
                AppError::FFmpeg(_) | AppError::CorruptedFile(_) | AppError::NoAudioTrack(_) => {
                    Some(e.to_string())
                }
                _ => None,
            };
            let error_kind = match &e {
                AppError::Gemini(kind) => Some(kind.clone()),
                _ => None,
            };
            if let Some(rec) = inner.update(&job_id, |r| {
                r.status = TranscriptionStatus::Failed;
                r.error = Some(e.to_string());
                r.technical = technical;
                r.error_kind = error_kind;
                r.percent = None;
            }) {
                inner.emit_for_record(&rec);
            }
            crate::log_error!("transcription failed: {display_source} — {e}");
        }
    }
}
