//! Gemini Files + Interactions API client (all network I/O in Rust).
//!
//! Flow: `upload_file` → `poll_file_active` (ACTIVE, exp. backoff, ~60s cap)
//! → `transcribe_audio` (`gemini-3.5-transcribe` via `POST /v1beta/interactions`).
//! `validate_api_key` hits cheap `GET /v1beta/models` for onboarding.
//!
//! Security notes: the key travels only in the `x-goog-api-key` header and is
//! never logged; user-supplied vocabulary is sanitized and sent strictly as
//! JSON body values via serde — raw strings are never interpolated into URLs
//! (URL paths below are fixed literals per call site).

use std::path::Path;
use std::time::{Duration, Instant};

use crate::error::{AppError, Result};
use crate::processing::transcribe::error_classify::classify_gemini_error;
use crate::processing::transcribe::types::{
    TranscriptionMode, TranscriptionRequestConfig, TranscriptionResult, WordInfo,
    MAX_CUSTOM_VOCAB_TERMS, SUPPORTED_MIMES,
};

pub const DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com";
pub const TRANSCRIBE_MODEL: &str = "gemini-3.5-transcribe";
const POLL_TIMEOUT: Duration = Duration::from_secs(60);
const POLL_INITIAL_BACKOFF: Duration = Duration::from_secs(1);
const POLL_MAX_BACKOFF: Duration = Duration::from_secs(8);

/// File resource as returned by the Files API.
#[derive(Debug, Clone, serde::Deserialize)]
struct FileResource {
    #[serde(default)]
    name: String,
    #[serde(default)]
    uri: String,
    #[serde(default, rename = "mimeType")]
    mime_type: String,
    #[serde(default)]
    state: Option<String>,
}

/// Handle the caller needs after upload: resource name (for polling) + URI.
#[derive(Debug, Clone)]
pub struct UploadedFile {
    pub resource_name: String,
    pub uri: String,
    pub mime_type: String,
    pub active: bool,
}

pub struct GeminiClient {
    base_url: String,
    key: String,
    http: reqwest::Client,
}

impl GeminiClient {
    pub fn new(key: impl Into<String>) -> Self {
        Self::with_base_url(key, DEFAULT_BASE_URL)
    }

    /// Test seam: point at a mock server instead of Google.
    pub fn with_base_url(key: impl Into<String>, base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            key: key.into(),
            http: reqwest::Client::new(),
        }
    }

    /// Cheap onboarding check: 200 ⇒ key works. Classified failures surface
    /// as `AppError::Gemini(..)` so the UI can show the exact reason.
    pub async fn validate_api_key(&self) -> Result<bool> {
        let url = format!("{}/v1beta/models", self.base_url);
        let resp = self
            .http
            .get(&url)
            .header("x-goog-api-key", &self.key)
            .send()
            .await
            .map_err(|e| AppError::Other(format!("Key validation request failed: {e}")))?;
        let status = resp.status().as_u16();
        if status == 200 {
            return Ok(true);
        }
        let body = resp.text().await.unwrap_or_default();
        Err(map_http_error(status, &body))
    }

    /// Upload raw audio bytes. `mime` must be one of [`SUPPORTED_MIMES`].
    pub async fn upload_file(&self, path: &Path, mime: &str) -> Result<UploadedFile> {
        if !SUPPORTED_MIMES.contains(&mime) {
            return Err(AppError::InvalidInput(format!(
                "Unsupported audio type for transcription: {mime}"
            )));
        }
        let bytes =
            std::fs::read(path).map_err(|e| AppError::Io(format!("Cannot read {path:?}: {e}")))?;
        let display_name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "audio".to_string());
        let metadata = serde_json::json!({ "file": { "displayName": display_name } }).to_string();
        let file_part = reqwest::multipart::Part::bytes(bytes)
            .file_name("audio")
            .mime_str(mime)
            .map_err(|_| AppError::InvalidInput(format!("Bad MIME type: {mime}")))?;
        let form = reqwest::multipart::Form::new()
            .text("metadata", metadata)
            .part("file", file_part);
        let url = format!("{}/upload/v1beta/files", self.base_url);
        let resp = self
            .http
            .post(&url)
            .header("x-goog-api-key", &self.key)
            .multipart(form)
            .send()
            .await
            .map_err(|e| AppError::Other(format!("Upload request failed: {e}")))?;
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        if !(200..300).contains(&status) {
            return Err(map_http_error(status, &body));
        }
        let json: serde_json::Value = serde_json::from_str(&body)
            .map_err(|_| AppError::Other("Upload returned invalid JSON".to_string()))?;
        parse_file_resource(&json)
    }

    /// Block until the uploaded file reports `ACTIVE`.
    pub async fn poll_file_active(&self, resource_name: &str) -> Result<UploadedFile> {
        self.poll_file_active_with_timeout(resource_name, POLL_TIMEOUT)
            .await
    }

    pub async fn poll_file_active_with_timeout(
        &self,
        resource_name: &str,
        timeout: Duration,
    ) -> Result<UploadedFile> {
        // `resource_name` is server-issued (`files/<id>`), never raw user input.
        let url = format!("{}/v1beta/{resource_name}", self.base_url);
        let started = Instant::now();
        let mut backoff = POLL_INITIAL_BACKOFF;
        loop {
            let resp = self
                .http
                .get(&url)
                .header("x-goog-api-key", &self.key)
                .send()
                .await
                .map_err(|e| AppError::Other(format!("File status request failed: {e}")))?;
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            if !(200..300).contains(&status) {
                return Err(map_http_error(status, &body));
            }
            let json: serde_json::Value = serde_json::from_str(&body)
                .map_err(|_| AppError::Other("File status returned invalid JSON".to_string()))?;
            let file = parse_file_resource(&json)?;
            if file.active {
                return Ok(file);
            }
            if started.elapsed() >= timeout {
                return Err(AppError::Other(format!(
                    "Gemini is still processing the uploaded audio after {}s; try again later",
                    timeout.as_secs()
                )));
            }
            tokio::time::sleep(backoff).await;
            backoff = (backoff * 2).min(POLL_MAX_BACKOFF);
        }
    }

    /// Create one transcription interaction for an ACTIVE file URI.
    pub async fn transcribe_audio(
        &self,
        file_uri: &str,
        mime: &str,
        config: &TranscriptionRequestConfig,
    ) -> Result<TranscriptionResult> {
        config.validate()?;
        let mode_type = match config.mode {
            TranscriptionMode::Verbatim => "verbatim",
            TranscriptionMode::Smart => "smart",
        };
        let mut mode_obj = serde_json::json!({ "type": mode_type });
        if config.diarization_enabled {
            mode_obj["diarization_mode"] = serde_json::json!("speaker");
        }
        if config.timestamps_enabled {
            mode_obj["timestamp_granularities"] = serde_json::json!(["word"]);
        }
        let mut tx_config = serde_json::json!({ "mode": mode_obj });
        if !config.language_codes.is_empty() {
            tx_config["language_codes"] = serde_json::json!(config.language_codes);
        }
        let vocab = sanitize_vocabulary(&config.custom_vocabulary);
        if !vocab.is_empty() {
            tx_config["custom_vocabulary"] = serde_json::json!({ "terms": vocab });
        }
        let body = serde_json::json!({
            "model": TRANSCRIBE_MODEL,
            "input": [{ "type": "audio", "uri": file_uri, "mime_type": mime }],
            "generation_config": { "transcription_config": tx_config },
        });
        let url = format!("{}/v1beta/interactions", self.base_url);
        let resp = self
            .http
            .post(&url)
            .header("x-goog-api-key", &self.key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Other(format!("Transcription request failed: {e}")))?;
        let status = resp.status().as_u16();
        let text = resp.text().await.unwrap_or_default();
        if !(200..300).contains(&status) {
            return Err(map_http_error(status, &text));
        }
        let json: serde_json::Value = serde_json::from_str(&text)
            .map_err(|_| AppError::Other("Transcription returned invalid JSON".to_string()))?;
        parse_interaction_response(&json)
    }
}

fn map_http_error(status: u16, body: &str) -> AppError {
    let kind = classify_gemini_error(status, body);
    crate::log_error!(
        "gemini http {status} -> {}; body: {}",
        format!("{kind:?}"),
        truncate_for_log(body, 300)
    );
    AppError::Gemini(kind)
}

/// `body` preview for logs — safe for display, capped to avoid huge dumps.
fn truncate_for_log(s: &str, max: usize) -> String {
    let chars: Vec<char> = s.chars().collect();
    if chars.len() <= max {
        s.to_string()
    } else {
        format!("{}…", chars.into_iter().take(max).collect::<String>())
    }
}

#[cfg(test)]
mod log_tests {
    use super::truncate_for_log;

    #[test]
    fn truncation_caps_by_chars_and_never_splits_multibyte() {
        assert_eq!(truncate_for_log("abc", 5), "abc");
        assert_eq!(truncate_for_log("abcdef", 3), "abc…");
        assert_eq!(truncate_for_log("گوشی", 2), "گو…");
    }
}

/// Files API returns `{"file": {...}}` on upload but the bare object on GET;
/// accept both shapes.
fn parse_file_resource(body: &serde_json::Value) -> Result<UploadedFile> {
    let node = body.get("file").unwrap_or(body);
    let res: FileResource = serde_json::from_value(node.clone())
        .map_err(|_| AppError::Other("File resource had an unexpected shape".to_string()))?;
    if res.name.is_empty() || res.uri.is_empty() {
        return Err(AppError::Other(
            "File resource missing name/uri".to_string(),
        ));
    }
    let active = res.state.as_deref() == Some("ACTIVE");
    Ok(UploadedFile {
        resource_name: res.name,
        uri: res.uri,
        mime_type: res.mime_type,
        active,
    })
}

/// Trim/dedupe/cap user vocabulary. Empty and >100-char terms are dropped;
/// the list is capped at [`MAX_CUSTOM_VOCAB_TERMS`]. Values travel only as
/// JSON body fields (serde-escaped), never in URLs.
fn sanitize_vocabulary(terms: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for t in terms {
        let trimmed = t.trim();
        if trimmed.is_empty() || trimmed.len() > 100 {
            continue;
        }
        if !out.iter().any(|e| e == trimmed) {
            out.push(trimmed.to_string());
        }
        if out.len() >= MAX_CUSTOM_VOCAB_TERMS {
            break;
        }
    }
    out
}

/// `"0.100s"` → `0.1`. Unparseable offsets degrade to `0.0` (word order and
/// text are preserved; only alignment suffers).
fn parse_offset_seconds(raw: &str) -> f64 {
    raw.trim()
        .trim_end_matches('s')
        .trim()
        .parse::<f64>()
        .unwrap_or(0.0)
        .max(0.0)
}

/// Full text from `interaction.output_text`; per-word annotations from
/// `interaction.steps[].content[].annotations[]` (`type == "word_info"`).
pub fn parse_interaction_response(body: &serde_json::Value) -> Result<TranscriptionResult> {
    let ix = body.get("interaction").unwrap_or(body);
    let full_text = ix
        .get("output_text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if full_text.trim().is_empty() {
        return Err(AppError::Other(
            "Transcription returned empty text".to_string(),
        ));
    }
    let mut words: Vec<WordInfo> = Vec::new();
    if let Some(steps) = ix.get("steps").and_then(|s| s.as_array()) {
        for step in steps {
            let contents = step.get("content").and_then(|c| c.as_array());
            for content in contents.into_iter().flatten() {
                let annotations = content.get("annotations").and_then(|a| a.as_array());
                for ann in annotations.into_iter().flatten() {
                    if ann.get("type").and_then(|t| t.as_str()) != Some("word_info") {
                        continue;
                    }
                    let text = ann.get("text").and_then(|t| t.as_str()).unwrap_or("");
                    if text.is_empty() {
                        continue;
                    }
                    words.push(WordInfo {
                        text: text.to_string(),
                        speaker: ann
                            .get("speaker")
                            .and_then(|s| s.as_str())
                            .map(|s| s.to_string()),
                        start_offset: ann
                            .get("start_offset")
                            .and_then(|v| v.as_str())
                            .map(parse_offset_seconds)
                            .unwrap_or(0.0),
                        end_offset: ann
                            .get("end_offset")
                            .and_then(|v| v.as_str())
                            .map(parse_offset_seconds)
                            .unwrap_or(0.0),
                    });
                }
            }
        }
    }
    let language_detected = [
        "language_code",
        "detected_language",
        "detected_language_code",
        "language",
    ]
    .iter()
    .filter_map(|k| ix.get(k).and_then(|v| v.as_str()))
    .next()
    .map(|s| s.to_string());
    Ok(TranscriptionResult {
        full_text,
        words,
        language_detected,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn test_config() -> TranscriptionRequestConfig {
        TranscriptionRequestConfig {
            language_codes: vec!["fa-IR".to_string()],
            mode: TranscriptionMode::Verbatim,
            diarization_enabled: false,
            timestamps_enabled: false,
            custom_vocabulary: vec![],
            fast_mode: false,
        }
    }

    fn write_temp_audio() -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!(
            "ac-tx-test-{}-{}.opus",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::write(&p, b"fake-opus-bytes").unwrap();
        p
    }

    #[tokio::test]
    async fn validate_ok_on_200() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1beta/models"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({"models": []})),
            )
            .mount(&server)
            .await;
        let client = GeminiClient::with_base_url("k", server.uri());
        assert!(client.validate_api_key().await.unwrap());
    }

    #[tokio::test]
    async fn validate_403_invalid_key() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1beta/models"))
            .respond_with(
                ResponseTemplate::new(403)
                    .set_body_string(r#"{"error":{"code":403,"message":"API key not valid"}}"#),
            )
            .mount(&server)
            .await;
        let client = GeminiClient::with_base_url("bad", server.uri());
        assert!(matches!(
            client.validate_api_key().await.unwrap_err(),
            AppError::Gemini(crate::error::GeminiErrorKind::InvalidKey)
        ));
    }

    #[tokio::test]
    async fn upload_then_transcribe_success() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/upload/v1beta/files"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "file": {"name": "files/abc123", "uri": "https://example/files/abc123",
                         "mimeType": "audio/opus", "state": "ACTIVE"}
            })))
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/v1beta/interactions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "interaction": {
                    "output_text": "سلام دنیا",
                    "steps": [{"content": [{"annotations": [
                        {"type": "word_info", "text": "سلام", "speaker": "spk_1",
                         "start_offset": "0.100s", "end_offset": "0.500s"},
                        {"type": "word_info", "text": "دنیا", "speaker": "spk_1",
                         "start_offset": "0.600s", "end_offset": "1.000s"},
                        {"type": "other", "text": "ignored"}
                    ]}]}]
                }
            })))
            .mount(&server)
            .await;
        let client = GeminiClient::with_base_url("k", server.uri());
        let tmp = write_temp_audio();
        let up = client.upload_file(&tmp, "audio/opus").await.unwrap();
        assert!(up.active);
        assert_eq!(up.resource_name, "files/abc123");
        let res = client
            .transcribe_audio(&up.uri, "audio/opus", &test_config())
            .await
            .unwrap();
        assert_eq!(res.full_text, "سلام دنیا");
        assert_eq!(res.words.len(), 2);
        assert_eq!(res.words[0].speaker.as_deref(), Some("spk_1"));
        assert!((res.words[0].start_offset - 0.1).abs() < 1e-9);
        assert!((res.words[1].end_offset - 1.0).abs() < 1e-9);
        let _ = std::fs::remove_file(&tmp);
    }

    #[tokio::test]
    async fn poll_times_out_when_never_active() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v1beta/files/abc123"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "name": "files/abc123", "uri": "https://example/f",
                "mimeType": "audio/opus", "state": "PROCESSING"
            })))
            .mount(&server)
            .await;
        let client = GeminiClient::with_base_url("k", server.uri());
        let err = client
            .poll_file_active_with_timeout("files/abc123", Duration::from_secs(3))
            .await
            .unwrap_err();
        assert!(err.to_string().contains("still processing"), "{err}");
    }

    #[tokio::test]
    async fn status_mapping_matrix() {
        async fn call_status(server: &MockServer, status: u16, body: &str) -> AppError {
            Mock::given(method("GET"))
                .and(path("/v1beta/models"))
                .respond_with(ResponseTemplate::new(status).set_body_string(body))
                .mount(server)
                .await;
            let client = GeminiClient::with_base_url("k", server.uri());
            client.validate_api_key().await.unwrap_err()
        }
        let server = MockServer::start().await;
        assert!(matches!(
            call_status(&server, 401, "u").await,
            AppError::Gemini(crate::error::GeminiErrorKind::InvalidKey)
        ));
        let server = MockServer::start().await;
        assert!(matches!(
            call_status(&server, 403, "not supported in your region").await,
            AppError::Gemini(crate::error::GeminiErrorKind::RegionNotSupported)
        ));
        let server = MockServer::start().await;
        assert!(matches!(
            call_status(&server, 500, "boom").await,
            AppError::Gemini(crate::error::GeminiErrorKind::ServerError)
        ));
    }

    #[tokio::test]
    async fn quota_failure_parsed_through_client() {
        let server = MockServer::start().await;
        let body = r#"{"error":{"code":429,"details":[
            {"@type":"type.googleapis.com/google.rpc.QuotaFailure",
             "violations":[{"quotaMetric":"m","quotaValue":"v"}]}]}}"#;
        Mock::given(method("POST"))
            .and(path("/v1beta/interactions"))
            .respond_with(ResponseTemplate::new(429).set_body_string(body))
            .mount(&server)
            .await;
        let client = GeminiClient::with_base_url("k", server.uri());
        let err = client
            .transcribe_audio("https://example/f", "audio/opus", &test_config())
            .await
            .unwrap_err();
        assert!(matches!(
            err,
            AppError::Gemini(crate::error::GeminiErrorKind::QuotaExceeded { .. })
        ));
        if let AppError::Gemini(crate::error::GeminiErrorKind::QuotaExceeded { metric, value }) =
            err
        {
            assert_eq!(metric, "m");
            assert_eq!(value, "v");
        }
    }

    #[tokio::test]
    async fn incompatible_config_rejected_before_http() {
        // No mocks mounted: any network attempt would fail with Other, so
        // InvalidInput proves client-side rejection happened first.
        let client = GeminiClient::with_base_url("k", "http://127.0.0.1:1");
        let cfg = TranscriptionRequestConfig {
            diarization_enabled: true,
            custom_vocabulary: vec!["x".to_string()],
            ..test_config()
        };
        assert!(matches!(
            client
                .transcribe_audio("u", "audio/opus", &cfg)
                .await
                .unwrap_err(),
            AppError::InvalidInput(_)
        ));
    }

    #[test]
    fn empty_transcript_is_error() {
        let err = parse_interaction_response(&serde_json::json!({
            "interaction": {"output_text": "  "}
        }))
        .unwrap_err();
        assert!(matches!(err, AppError::Other(_)));
    }

    #[test]
    fn offset_parsing() {
        assert!((parse_offset_seconds("0.100s") - 0.1).abs() < 1e-9);
        assert_eq!(parse_offset_seconds("2s"), 2.0);
        assert_eq!(parse_offset_seconds("garbage"), 0.0);
    }
}
