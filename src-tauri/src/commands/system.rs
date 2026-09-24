use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::{AppError, Result};
use crate::settings::Settings;

#[derive(Serialize, Deserialize, specta::Type)]
pub struct DiskFree {
    #[specta(type = u32)]
    pub free_bytes: u64,
}

/// Pre-flight disk space query for the chosen output location.
#[tauri::command]
#[specta::specta]
pub async fn disk_free(path: String) -> Result<DiskFree> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = Path::new(&path);
        let dir = if target.is_dir() {
            target
        } else {
            target.parent().unwrap_or(target)
        };
        crate::disk::free_bytes(dir)
            .map(|free_bytes| DiskFree { free_bytes })
            .ok_or_else(|| AppError::Io(format!("Cannot determine free space for {path}")))
    })
    .await
    .map_err(|e| AppError::Other(format!("Async task failed: {e}")))?
}

#[tauri::command(async)]
#[specta::specta]
pub fn get_settings() -> Settings {
    Settings::load()
}

#[tauri::command(async)]
#[specta::specta]
pub fn save_settings(settings: Settings) -> Result<()> {
    settings.save().map_err(AppError::Other)?;
    crate::log_info!("settings saved");
    Ok(())
}

#[tauri::command(async)]
#[specta::specta]
pub fn log_frontend(level: String, msg: String) {
    crate::logger::log(&level, &format!("[FRONTEND] {msg}"));
}
