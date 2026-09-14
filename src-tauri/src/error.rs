use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    Io(String),
    FFmpeg(String),
    NoAudioTrack(String),
    CorruptedFile(String),
    InsufficientDiskSpace {
        #[specta(type = u32)]
        needed: u64,
        #[specta(type = u32)]
        available: u64,
    },
    InvalidInput(String),
    Cancelled,
    NotFound(String),
    Unsupported(String),
    Gemini(GeminiErrorKind),
    Other(String),
}

/// Classified Gemini API failure. Each variant maps to a distinct,
/// translated (en/fa) frontend message keyed by the serde `tag`.
/// `RegionNotSupported` is the ONLY variant whose UI copy may suggest
/// trying a VPN (with a neutral note that it may be subject to Google's
/// terms) — never show that suggestion for the other 403 sub-cases.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(tag = "kind", content = "detail")]
pub enum GeminiErrorKind {
    RegionNotSupported,
    AccountFlagged,
    InvalidKey,
    MissingKey,
    QuotaExceeded {
        #[specta(type = String)]
        metric: String,
        #[specta(type = String)]
        value: String,
    },
    ServerError,
    Unknown,
}

impl GeminiErrorKind {
    /// Stable i18n key consumed by `src/i18n/{en,fa}.ts`.
    pub fn i18n_key(&self) -> &'static str {
        match self {
            GeminiErrorKind::RegionNotSupported => "transcribeErrorRegion",
            GeminiErrorKind::AccountFlagged => "transcribeErrorFlagged",
            GeminiErrorKind::InvalidKey => "transcribeErrorInvalidKey",
            GeminiErrorKind::MissingKey => "transcribeErrorMissingKey",
            GeminiErrorKind::QuotaExceeded { .. } => "transcribeErrorQuota",
            GeminiErrorKind::ServerError => "transcribeErrorServer",
            GeminiErrorKind::Unknown => "transcribeErrorUnknown",
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Io(m) => write!(f, "File system error: {m}"),
            AppError::FFmpeg(m) => write!(f, "Processing failed: {m}"),
            AppError::NoAudioTrack(_) => write!(f, "This file has no audio track"),
            AppError::CorruptedFile(_) => {
                write!(f, "Unable to read input file (corrupted or unsupported)")
            }
            AppError::InsufficientDiskSpace { needed, available } => write!(
                f,
                "Not enough disk space. Need about {:.1} MB, only {:.1} MB available.",
                *needed as f64 / 1_048_576.0,
                *available as f64 / 1_048_576.0
            ),
            AppError::InvalidInput(m) => write!(f, "Invalid input: {m}"),
            AppError::Cancelled => write!(f, "Cancelled"),
            AppError::NotFound(m) => write!(f, "Not found: {m}"),
            AppError::Unsupported(m) => write!(f, "Unsupported: {m}"),
            AppError::Gemini(kind) => match kind {
                GeminiErrorKind::RegionNotSupported => write!(
                    f,
                    "Transcription is not available in your region (Google error)"
                ),
                GeminiErrorKind::AccountFlagged => {
                    write!(f, "Google denied access for this API key's account")
                }
                GeminiErrorKind::InvalidKey => write!(f, "Invalid Gemini API key"),
                GeminiErrorKind::MissingKey => write!(f, "No Gemini API key saved"),
                GeminiErrorKind::QuotaExceeded { metric, value } if !metric.is_empty() => {
                    write!(f, "Gemini quota exceeded ({metric}: {value})")
                }
                GeminiErrorKind::QuotaExceeded { .. } => {
                    write!(f, "Gemini quota exceeded (rate limit)")
                }
                GeminiErrorKind::ServerError => write!(f, "Gemini server error, try again later"),
                GeminiErrorKind::Unknown => write!(f, "Transcription failed"),
            },
            AppError::Other(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Other(format!("Serialization error: {e}"))
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
