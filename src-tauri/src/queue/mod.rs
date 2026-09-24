use std::collections::{HashMap, VecDeque};
use std::path::PathBuf;
use std::sync::atomic::AtomicUsize;
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter as _};

use crate::ffmpeg::run::CancelToken;
use crate::processing::naming;
use crate::types::{BoosterJobSpec, ConversionOptions, JobEvent, JobStatus, TrimSpec};

pub mod job;
pub(crate) mod worker;

pub use job::JobRecord;
use job::{new_job_id, BatchJobItem, JobKind, QueuedJob};
pub(crate) use worker::resolve_binaries;
use worker::worker_loop;

pub(crate) struct QueueInner {
    pub(crate) app: AppHandle,
    pub(crate) jobs: Mutex<HashMap<String, JobRecord>>,
    pub(crate) order: Mutex<VecDeque<QueuedJob>>,
    pub(crate) tokens: Mutex<HashMap<String, CancelToken>>,
    pub(crate) active_workers: AtomicUsize,
}

impl QueueInner {
    pub(crate) fn emit(&self, ev: &JobEvent) {
        let _ = self.app.emit("job-event", ev);
    }

    pub(crate) fn update(
        &self,
        id: &str,
        mutate: impl FnOnce(&mut JobRecord),
    ) -> Option<JobRecord> {
        let mut guard = self.jobs.lock().unwrap();
        let rec = guard.get_mut(id)?;
        mutate(rec);
        Some(rec.clone())
    }

    pub(crate) fn emit_event_for(&self, rec: &JobRecord) {
        if !matches!(rec.status, JobStatus::Processing) {
            crate::log_info!(
                "emit_event: id={} status={:?} percent={:?}",
                rec.id,
                rec.status,
                rec.percent
            );
        }
        self.emit(&JobEvent {
            id: rec.id.clone(),
            source_path: rec.source_path.clone(),
            status: rec.status.clone(),
            percent: rec.percent,
            speed: rec.speed.clone(),
            error: rec.error.clone(),
            technical: rec.technical.clone(),
            warning: rec.warning.clone(),
            outputs: rec.outputs.clone(),
        });
        self.notify_idle_if_needed();
    }

    pub(crate) fn notify_idle_if_needed(&self) {
        let busy = {
            let jobs = self.jobs.lock().unwrap();
            jobs.values()
                .any(|r| matches!(r.status, JobStatus::Waiting | JobStatus::Processing))
        };
        if !busy {
            let _ = self.app.emit("queue-idle", true);
        }
    }
}

pub struct QueueManager {
    pub(crate) inner: Arc<QueueInner>,
}

impl QueueManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            inner: Arc::new(QueueInner {
                app,
                jobs: Mutex::new(HashMap::new()),
                order: Mutex::new(VecDeque::new()),
                tokens: Mutex::new(HashMap::new()),
                active_workers: AtomicUsize::new(0),
            }),
        }
    }

    fn enqueue_batch(
        &self,
        batch: Vec<BatchJobItem>,
        options: ConversionOptions,
        concurrency: u32,
    ) -> Vec<String> {
        self.cancel_all();
        crate::processing::naming::clear_reserved_paths();

        let is_multi = batch.len() > 1;

        let mut sweep_dirs: Vec<PathBuf> = batch
            .iter()
            .map(|item| naming::output_directory(&item.path, &options, is_multi))
            .collect();
        sweep_dirs.sort();
        sweep_dirs.dedup();
        naming::sweep_orphan_temps(&sweep_dirs);

        let mut ids = Vec::with_capacity(batch.len());
        let mut fresh_records = Vec::with_capacity(batch.len());
        {
            let mut jobs = self.inner.jobs.lock().unwrap();
            let mut order = self.inner.order.lock().unwrap();
            let mut tokens = self.inner.tokens.lock().unwrap();

            jobs.clear();
            order.clear();
            tokens.clear();

            for item in batch {
                let id = new_job_id();
                let source_path = item.path.to_string_lossy().into_owned();
                let rec = JobRecord::new_waiting(id.clone(), source_path);
                jobs.insert(id.clone(), rec.clone());
                tokens.insert(id.clone(), CancelToken::new());
                fresh_records.push(rec);
                order.push_back(QueuedJob {
                    id: id.clone(),
                    source: item.path,
                    trim: item.trim,
                    multiple_sources: is_multi,
                    options: options.clone(),
                    kind: item.kind,
                });
                ids.push(id);
            }
        }

        for rec in &fresh_records {
            self.inner.emit_event_for(rec);
        }

        let worker_count = concurrency.clamp(1, 32).min((ids.len().max(1)) as u32) as usize;
        for _ in 0..worker_count {
            let inner = Arc::clone(&self.inner);
            std::thread::spawn(move || worker_loop(inner));
        }
        ids
    }

    pub fn enqueue(
        &self,
        items: Vec<TrimSpec>,
        options: ConversionOptions,
        concurrency: u32,
    ) -> Vec<String> {
        let batch = items
            .into_iter()
            .map(|item| {
                let path = PathBuf::from(&item.path);
                let trim = if item.start_time_secs.is_some() || item.end_time_secs.is_some() {
                    Some(item)
                } else {
                    None
                };
                BatchJobItem {
                    path,
                    trim,
                    kind: JobKind::Convert,
                }
            })
            .collect();
        self.enqueue_batch(batch, options, concurrency)
    }

    pub fn enqueue_boost(
        &self,
        items: Vec<BoosterJobSpec>,
        options: ConversionOptions,
        concurrency: u32,
    ) -> Vec<String> {
        let batch = items
            .into_iter()
            .map(|item| {
                let path = PathBuf::from(&item.trim.path);
                let trim =
                    if item.trim.start_time_secs.is_some() || item.trim.end_time_secs.is_some() {
                        Some(item.trim)
                    } else {
                        None
                    };
                BatchJobItem {
                    path,
                    trim,
                    kind: JobKind::Boost {
                        preset: item.preset,
                        manual_gain_percent: item.manual_gain_percent,
                    },
                }
            })
            .collect();
        self.enqueue_batch(batch, options, concurrency)
    }

    pub fn cancel(&self, job_id: &str) {
        if let Some(tok) = self.inner.tokens.lock().unwrap().get(job_id) {
            tok.cancel();
        }
        if let Some(rec) = self.inner.update(job_id, |r| {
            if matches!(r.status, JobStatus::Waiting) {
                r.status = JobStatus::Cancelled;
            }
        }) {
            self.inner.emit_event_for(&rec);
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
        self.inner.order.lock().unwrap().clear();

        let updated: Vec<JobRecord> = {
            let mut jobs = self.inner.jobs.lock().unwrap();
            let mut recs = Vec::new();
            for rec in jobs.values_mut() {
                if matches!(rec.status, JobStatus::Waiting | JobStatus::Processing) {
                    rec.status = JobStatus::Cancelled;
                    rec.speed = None;
                    recs.push(rec.clone());
                }
            }
            recs
        };
        for rec in updated {
            self.inner.emit_event_for(&rec);
        }
    }

    pub fn clear_finished(&self) {
        let mut jobs = self.inner.jobs.lock().unwrap();
        jobs.retain(|_, r| matches!(r.status, JobStatus::Waiting | JobStatus::Processing));
    }

    pub fn snapshot(&self) -> Vec<JobRecord> {
        let guard = self.inner.jobs.lock().unwrap();
        let mut all: Vec<JobRecord> = guard.values().cloned().collect();
        all.sort_by(|a, b| a.id.cmp(&b.id));
        all
    }

    pub fn is_idle(&self) -> bool {
        self.inner
            .jobs
            .lock()
            .unwrap()
            .values()
            .all(|r| !matches!(r.status, JobStatus::Waiting | JobStatus::Processing))
    }
}
