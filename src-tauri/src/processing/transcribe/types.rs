//! Shared Transcribe Studio data contracts (Rust <-> TypeScript via Specta).
//!
//! Limits mirror the task spec: 3600s normal / 1800s with diarization or
//! word timestamps, with safety-margin auto-chunk thresholds at 3300s /
//! 1620s measured on the REAL ffprobe duration AFTER speed-up preprocessing.

use crate::error::{AppError, GeminiErrorKind, Result};

/// Hard per-request audio cap (seconds). 1 hour normally…
pub const MAX_DURATION_SECS: f64 = 3600.0;
/// …30 min when diarization or word timestamps are requested.
pub const MAX_DURATION_DETAILED_SECS: f64 = 1800.0;
/// Auto-chunk only above these (post-preprocess, ffprobe-measured) durations.
pub const CHUNK_THRESHOLD_SECS: f64 = 3300.0;
pub const CHUNK_THRESHOLD_DETAILED_SECS: f64 = 1620.0;
/// API-side cap on custom vocabulary terms; UI caps input at 100.
pub const MAX_CUSTOM_VOCAB_TERMS: usize = 1000;
pub const UI_CUSTOM_VOCAB_CAP: usize = 100;
/// `atempo=1.5` speed-up factor for fast mode.
pub const FAST_MODE_FACTOR: f64 = 1.5;

/// MIME types the Gemini Files API accepts for audio input.
pub const SUPPORTED_MIMES: &[&str] = &[
    "audio/wav",
    "audio/mp3",
    "audio/aiff",
    "audio/aac",
    "audio/ogg",
    "audio/flac",
    "audio/mpeg",
    "audio/m4a",
    "audio/opus",
    "audio/webm",
    "audio/l16",
    "audio/alaw",
    "audio/mulaw",
];

/// Cleanup mode for the transcript text.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Default, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum TranscriptionMode {
    /// Exact words as spoken.
    #[default]
    Verbatim,
    /// Cleaned-up output (filler removal, light grammar fix).
    Smart,
}

/// Frontend-facing request configuration (camelCase over IPC).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionRequestConfig {
    /// BCP-47 codes, e.g. `["fa-IR"]`. Empty = auto-detect.
    #[serde(default)]
    pub language_codes: Vec<String>,
    #[serde(default)]
    pub mode: TranscriptionMode,
    /// Up to 8 speakers (`diarization_mode: "speaker"`).
    #[serde(default)]
    pub diarization_enabled: bool,
    /// Word-level `timestamp_granularities: ["word"]`.
    #[serde(default)]
    pub timestamps_enabled: bool,
    /// Custom vocabulary hints. INCOMPATIBLE with diarization/timestamps.
    #[serde(default)]
    pub custom_vocabulary: Vec<String>,
    /// Optional `atempo=1.5` speed-up before upload. Default OFF.
    #[serde(default)]
    pub fast_mode: bool,
}

impl TranscriptionRequestConfig {
    pub fn validate(&self) -> Result<()> {
        let detailed = self.diarization_enabled || self.timestamps_enabled;
        if !self.custom_vocabulary.is_empty() && detailed {
            return Err(AppError::InvalidInput(
                "Custom vocabulary cannot be combined with speaker diarization or word timestamps"
                    .into(),
            ));
        }
        if self.custom_vocabulary.len() > MAX_CUSTOM_VOCAB_TERMS {
            return Err(AppError::InvalidInput(format!(
                "Custom vocabulary is limited to {MAX_CUSTOM_VOCAB_TERMS} terms"
            )));
        }
        for term in &self.custom_vocabulary {
            let t = term.trim();
            if t.is_empty() || t.len() > 100 {
                return Err(AppError::InvalidInput(
                    "Custom vocabulary terms must be 1–100 characters".into(),
                ));
            }
        }
        for code in &self.language_codes {
            let c = code.trim();
            if c.is_empty()
                || c.len() > 20
                || !c
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
            {
                return Err(AppError::InvalidInput(format!(
                    "Invalid language code: {code}"
                )));
            }
        }
        Ok(())
    }

    /// Per-request duration cap for this config (before chunking).
    pub fn max_duration_secs(&self) -> f64 {
        if self.diarization_enabled || self.timestamps_enabled {
            MAX_DURATION_DETAILED_SECS
        } else {
            MAX_DURATION_SECS
        }
    }

    /// Safety-margin threshold above which auto-chunking kicks in.
    pub fn chunk_threshold_secs(&self) -> f64 {
        if self.diarization_enabled || self.timestamps_enabled {
            CHUNK_THRESHOLD_DETAILED_SECS
        } else {
            CHUNK_THRESHOLD_SECS
        }
    }
}

/// One annotated word of the transcript.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct WordInfo {
    pub text: String,
    /// e.g. `"spk_1"`. `None` unless diarization was requested.
    #[serde(default)]
    pub speaker: Option<String>,
    /// Seconds from the start of the (rescaled) audio.
    pub start_offset: f64,
    pub end_offset: f64,
}

/// Full result of one transcription job (possibly stitched from chunks).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub full_text: String,
    #[serde(default)]
    pub words: Vec<WordInfo>,
    /// BCP-47 code detected by the model, if reported.
    #[serde(default)]
    pub language_detected: Option<String>,
}

/// Lifecycle of a transcription job (mirrors `JobStatus` + network phases).
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "lowercase")]
pub enum TranscriptionStatus {
    Waiting,
    Preprocessing,
    Uploading,
    Transcribing,
    Completed,
    Failed,
    Cancelled,
}

/// Snapshot of one transcription job for the UI queue.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionJob {
    pub id: String,
    pub source_path: String,
    pub status: TranscriptionStatus,
    pub percent: Option<f64>,
    pub error: Option<String>,
    pub technical: Option<String>,
    /// Structured failure kind for exact translated UI copy (None when ok).
    #[serde(default)]
    pub error_kind: Option<GeminiErrorKind>,
    pub result: Option<TranscriptionResult>,
}

/// Event emitted on every transcription state change
/// (mirrors the existing `job-event` channel as `transcription-event`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionEvent {
    pub id: String,
    pub source_path: String,
    pub status: TranscriptionStatus,
    pub percent: Option<f64>,
    pub error: Option<String>,
    pub technical: Option<String>,
    #[serde(default)]
    pub error_kind: Option<GeminiErrorKind>,
    pub result: Option<TranscriptionResult>,
}

/// Last quota failure actually observed from Google (may be stale).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ObservedQuota {
    pub metric: String,
    pub value: String,
    /// Unix seconds when Google returned it.
    #[specta(type = u32)]
    pub discovered_at: u64,
}

/// App-local bookkeeping + last observed real limit. The local counter is
/// explicitly NOT an official quota — only AI Studio is authoritative.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UsageStats {
    /// Audio-minutes sent through this app on the current Pacific-Time day.
    pub sent_minutes_today: f64,
    #[serde(default)]
    pub last_observed_quota: Option<ObservedQuota>,
}

use serde::{Deserialize, Serialize};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_vocab_with_diarization() {
        let cfg = TranscriptionRequestConfig {
            language_codes: vec!["fa-IR".into()],
            mode: TranscriptionMode::Verbatim,
            diarization_enabled: true,
            timestamps_enabled: false,
            custom_vocabulary: vec!["سلام".into()],
            fast_mode: false,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn rejects_vocab_with_timestamps() {
        let cfg = TranscriptionRequestConfig {
            language_codes: vec![],
            mode: TranscriptionMode::Smart,
            diarization_enabled: false,
            timestamps_enabled: true,
            custom_vocabulary: vec!["test".into()],
            fast_mode: false,
        };
        assert!(cfg.validate().is_err());
    }

    #[test]
    fn accepts_plain_config() {
        let cfg = TranscriptionRequestConfig {
            language_codes: vec!["fa-IR".into()],
            mode: TranscriptionMode::Verbatim,
            diarization_enabled: false,
            timestamps_enabled: false,
            custom_vocabulary: vec![],
            fast_mode: true,
        };
        assert!(cfg.validate().is_ok());
        assert_eq!(cfg.max_duration_secs(), MAX_DURATION_SECS);
        assert_eq!(cfg.chunk_threshold_secs(), CHUNK_THRESHOLD_SECS);
    }

    #[test]
    fn detailed_caps_apply() {
        let cfg = TranscriptionRequestConfig {
            language_codes: vec![],
            mode: TranscriptionMode::Verbatim,
            diarization_enabled: true,
            timestamps_enabled: false,
            custom_vocabulary: vec![],
            fast_mode: false,
        };
        assert!(cfg.validate().is_ok());
        assert_eq!(cfg.max_duration_secs(), MAX_DURATION_DETAILED_SECS);
        assert_eq!(cfg.chunk_threshold_secs(), CHUNK_THRESHOLD_DETAILED_SECS);
    }

    #[test]
    fn rejects_oversized_vocab() {
        let cfg = TranscriptionRequestConfig {
            language_codes: vec![],
            mode: TranscriptionMode::Verbatim,
            diarization_enabled: false,
            timestamps_enabled: false,
            custom_vocabulary: vec!["x".to_string(); MAX_CUSTOM_VOCAB_TERMS + 1],
            fast_mode: false,
        };
        assert!(cfg.validate().is_err());
    }
}
