/// Desktop floating pill overlay window manager.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

pub const OVERLAY_WINDOW_LABEL: &str = "dubbing-overlay";

pub struct DesktopOverlayManager;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
impl DesktopOverlayManager {
    /// Shows or creates the desktop floating pill overlay.
    pub fn show_overlay(app: &AppHandle) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
            window
                .show()
                .map_err(|e| format!("Failed to show overlay window: {}", e))?;
            window
                .set_always_on_top(true)
                .map_err(|e| format!("Failed to set overlay on top: {}", e))?;
            return Ok(());
        }

        // Create small, frameless, transparent, always-on-top window
        WebviewWindowBuilder::new(
            app,
            OVERLAY_WINDOW_LABEL,
            WebviewUrl::App("index.html#/overlay".into()),
        )
        .title("Audiflow Dubbing")
        .inner_size(240.0, 72.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .build()
        .map_err(|e| format!("Failed to create overlay window: {}", e))?;

        Ok(())
    }

    /// Hides the desktop floating overlay window.
    pub fn hide_overlay(app: &AppHandle) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
            let _ = window.hide();
        }
        Ok(())
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
impl DesktopOverlayManager {
    pub fn show_overlay(_app: &AppHandle) -> Result<(), String> {
        Ok(())
    }

    pub fn hide_overlay(_app: &AppHandle) -> Result<(), String> {
        Ok(())
    }
}
