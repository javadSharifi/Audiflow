//! Gemini API key storage via the OS keychain.
//!
//! The key is NEVER written to `settings.json` (plaintext) and NEVER logged.
//! All Gemini HTTP calls happen in Rust; the frontend only touches Tauri IPC.

use crate::error::{AppError, Result};

const SERVICE: &str = "com.audioconverter.app";
const ACCOUNT: &str = "gemini-api-key";

fn entry() -> Result<keyring::Entry> {
    keyring::Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| AppError::Other(format!("Keychain unavailable: {e}")))
}

/// Mask a key for debug output: `AIza...` -> `AIza…••••`.
pub fn mask_key(key: &str) -> String {
    const VISIBLE: usize = 4;
    if key.len() <= VISIBLE {
        return "••••".into();
    }
    format!("{}…••••", &key[..VISIBLE.min(key.len())])
}

/// Persist (create or overwrite) the Gemini API key in the OS keychain.
pub fn save_gemini_api_key(key: &str) -> Result<()> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("API key is empty".into()));
    }
    entry()?
        .set_password(trimmed)
        .map_err(|e| AppError::Other(format!("Failed to save API key to keychain: {e}")))?;
    crate::log_info!("gemini api key saved (prefix={})", mask_key(trimmed));
    Ok(())
}

/// Load the key, or `None` when the user has not saved one yet.
pub fn load_gemini_api_key() -> Result<Option<String>> {
    match entry()?.get_password() {
        Ok(pw) if !pw.trim().is_empty() => Ok(Some(pw)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Other(format!("Failed to read API key: {e}"))),
    }
}

/// Convenience for onboarding UI: does a key exist?
pub fn has_gemini_api_key() -> bool {
    load_gemini_api_key().map(|k| k.is_some()).unwrap_or(false)
}

/// Delete the stored key. Missing entry is a successful no-op.
pub fn delete_gemini_api_key() -> Result<()> {
    match entry()?.delete_credential() {
        Ok(()) => {
            crate::log_info!("gemini api key deleted");
            Ok(())
        }
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Other(format!("Failed to delete API key: {e}"))),
    }
}

/// Load the key or fail with the `MissingKey` user-facing error.
pub fn require_gemini_api_key() -> Result<String> {
    match load_gemini_api_key()? {
        Some(k) => Ok(k),
        None => Err(AppError::Gemini(crate::error::GeminiErrorKind::MissingKey)),
    }
}
