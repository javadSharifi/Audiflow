use tauri::State;

use crate::error::{AppError, Result};
use crate::processing::transcribe::{
    GeminiClient, TranscriptionJob, TranscriptionRequestConfig, UsageStats,
};
use crate::transcribe_queue::TranscribeQueueManager;

/// Persist the user's Gemini API key to the OS keychain.
#[tauri::command]
#[specta::specta]
pub fn save_gemini_api_key(key: String) -> Result<()> {
    crate::secrets::save_gemini_api_key(&key)
}

/// Cheap onboarding check against `GET /v1beta/models` using the *unsaved*
/// pasted key. Touches no audio. `Ok(true)` = key works; classified
/// `AppError::Gemini(..)` otherwise.
#[tauri::command]
#[specta::specta]
pub async fn validate_gemini_api_key(key: String) -> Result<bool> {
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("API key is empty".into()));
    }
    GeminiClient::new(trimmed).validate_api_key().await
}

#[tauri::command]
#[specta::specta]
pub fn has_gemini_api_key() -> bool {
    crate::secrets::has_gemini_api_key()
}

#[tauri::command]
#[specta::specta]
pub fn clear_gemini_api_key() -> Result<()> {
    crate::secrets::delete_gemini_api_key()
}

/// Enqueue one transcription; returns the job id. Progress and results arrive
/// via the `transcription-event` channel.
#[tauri::command]
#[specta::specta]
pub fn start_transcription(
    manager: State<'_, TranscribeQueueManager>,
    file_path: String,
    config: TranscriptionRequestConfig,
) -> Result<String> {
    if file_path.trim().is_empty() {
        return Err(AppError::InvalidInput("No input file selected".into()));
    }
    manager.start_transcription(file_path, config)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_transcription(manager: State<'_, TranscribeQueueManager>, job_id: String) {
    manager.cancel(&job_id);
}

#[tauri::command]
#[specta::specta]
pub fn get_transcription_queue(
    manager: State<'_, TranscribeQueueManager>,
) -> Vec<TranscriptionJob> {
    manager.snapshot()
}

#[tauri::command]
#[specta::specta]
pub fn clear_finished_transcriptions(manager: State<'_, TranscribeQueueManager>) {
    manager.clear_finished();
}

/// App-local usage log + last observed real quota (see `usage_tracker.rs`).
#[tauri::command]
#[specta::specta]
pub fn get_usage_stats() -> UsageStats {
    crate::processing::transcribe::usage_tracker::get_usage_stats()
}

/// Render a finished transcript to txt/srt/vtt (atomic write, no overwrite).
/// SRT/VTT require word timestamps from the original request.
#[tauri::command]
#[specta::specta]
pub fn export_transcript(
    manager: State<'_, TranscribeQueueManager>,
    job_id: String,
    format: String,
) -> Result<String> {
    manager.export_transcript(&job_id, &format)
}
