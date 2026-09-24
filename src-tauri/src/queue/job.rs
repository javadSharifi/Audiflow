use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::types::{BoosterPreset, ConversionOptions, JobStatus, TrimSpec};

/// Snapshot of one job, serialized to the frontend.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
    pub id: String,
    pub source_path: String,
    pub status: JobStatus,
    pub percent: Option<f64>,
    pub speed: Option<String>,
    pub error: Option<String>,
    pub technical: Option<String>,
    pub warning: Option<String>,
    pub outputs: Vec<String>,
}

#[derive(Debug, Clone)]
pub(crate) enum JobKind {
    Convert,
    Boost {
        preset: BoosterPreset,
        manual_gain_percent: Option<f64>,
    },
}

/// One unit of pending work. Carries its OWN options snapshot so that a
/// worker spawned for a previous batch can never process a newer item with
/// stale settings (the old-worker race).
pub(crate) struct QueuedJob {
    pub id: String,
    pub source: PathBuf,
    pub trim: Option<TrimSpec>,
    pub multiple_sources: bool,
    pub options: ConversionOptions,
    pub kind: JobKind,
}

/// Internal item structure used during batch enqueue deduplication.
pub(crate) struct BatchJobItem {
    pub path: PathBuf,
    pub trim: Option<TrimSpec>,
    pub kind: JobKind,
}

pub(crate) fn new_job_id() -> String {
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let n = SEQ.fetch_add(1, Ordering::SeqCst);
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("job-{ts}-{n}")
}

impl JobRecord {
    pub(crate) fn new_waiting(id: String, source_path: String) -> Self {
        Self {
            id,
            source_path,
            status: JobStatus::Waiting,
            percent: None,
            speed: None,
            error: None,
            technical: None,
            warning: None,
            outputs: vec![],
        }
    }
}
