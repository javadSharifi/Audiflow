use std::path::Path;
use tauri::State;

use crate::error::Result;
use crate::music_library::LibraryPermissionStatus;

fn file_name_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Result of pre-resolving one input path (e.g. Android Content URIs to
/// cached local files). `resolved` equals `input` when no staging happened
/// or when staging failed (the error field then explains why).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedMediaPath {
    pub input: String,
    pub resolved: String,
    pub error: Option<String>,
}

/// Pre-resolve media paths (e.g. Android Content URIs to cached files).
/// Never fails wholesale — each path carries its own optional error so one
/// bad URI cannot blank out the whole batch.
#[tauri::command]
#[specta::specta]
pub async fn resolve_media_paths(paths: Vec<String>) -> Vec<ResolvedMediaPath> {
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|input| {
                let resolved = crate::android_fs::ensure_local_path(&input);
                let error = (resolved == input && input.starts_with("content://"))
                    .then(|| "Could not copy the selected file into app storage".to_string());
                ResolvedMediaPath {
                    input,
                    resolved,
                    error,
                }
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

/// Explicitly delete a previously staged Android input file (user removed
/// the row / cleared the list). No-op on desktop and for any path outside
/// the app's staging directory.
#[tauri::command]
#[specta::specta]
pub fn delete_staged_input(path: String) {
    crate::android_fs::delete_staged_input(&path);
}

/// One entry of `stat_media_paths`: lightweight metadata for a picked URI —
/// NO file copying (staging happens lazily right before each conversion).
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct StatMediaPath {
    pub input: String,
    pub name: String,
    #[specta(type = u32)]
    pub size_bytes: u64,
    pub duration_secs: f64,
    pub error: Option<String>,
}

/// Lightweight metadata lookup (name / size / duration) for the picked
/// paths/URIs. Never fails wholesale — each path carries its own error.
#[tauri::command]
#[specta::specta]
pub async fn stat_media_paths(paths: Vec<String>) -> Vec<StatMediaPath> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(target_os = "android")]
        {
            let joined = paths.join("\n");
            let raw = crate::android_fs::call_static_string_quiet("statUri", &joined);
            crate::log_info!("stat_media_paths: inputs={:?}, raw={:?}", paths, raw);
            let mut lines = raw.split('\n').filter(|l| !l.is_empty());
            paths
                .into_iter()
                .map(|input| {
                    let line = lines.next().unwrap_or("");
                    // Protocol: name\tsize\tdurationMs\tok\tperm
                    let mut parts = line.splitn(5, '\t');
                    let name = parts.next().unwrap_or("");
                    let size = parts.next().and_then(|s| s.parse::<i64>().ok());
                    let dur_ms = parts.next().and_then(|s| s.parse::<i64>().ok());
                    let ok = parts.next().map(|s| s.trim() == "1").unwrap_or(false);
                    let perm = parts.next().map(|s| s.trim() == "1").unwrap_or(false);
                    if raw.is_empty() {
                        StatMediaPath {
                            name: file_name_of(&input),
                            size_bytes: 0,
                            duration_secs: 0.0,
                            input,
                            error: Some(
                                "File access bridge is not ready — please reopen the app".into(),
                            ),
                        }
                    } else if !ok {
                        StatMediaPath {
                            name: file_name_of(&input),
                            size_bytes: 0,
                            duration_secs: 0.0,
                            input,
                            error: Some(if perm {
                                "Permission denied — please grant media access in Settings".into()
                            } else {
                                "Could not read file info".into()
                            }),
                        }
                    } else {
                        StatMediaPath {
                            name: if name.is_empty() {
                                file_name_of(&input)
                            } else {
                                name.to_string()
                            },
                            size_bytes: size.unwrap_or(0).max(0) as u64,
                            duration_secs: dur_ms.unwrap_or(0).max(0) as f64 / 1000.0,
                            input,
                            error: None,
                        }
                    }
                })
                .collect()
        }
        #[cfg(not(target_os = "android"))]
        {
            paths
                .into_iter()
                .map(|input| match std::fs::metadata(&input) {
                    Ok(m) => StatMediaPath {
                        name: file_name_of(&input),
                        size_bytes: m.len(),
                        duration_secs: 0.0,
                        input,
                        error: None,
                    },
                    Err(_) => StatMediaPath {
                        name: file_name_of(&input),
                        size_bytes: 0,
                        duration_secs: 0.0,
                        input,
                        error: Some("Could not read file info".into()),
                    },
                })
                .collect()
        }
    })
    .await
    .unwrap_or_default()
}

/// Whether the required media permissions are granted (Android). Always true
/// on desktop.
#[tauri::command]
#[specta::specta]
pub fn has_media_permissions() -> bool {
    #[cfg(target_os = "android")]
    return crate::android_fs::call_static_bool("hasMediaPermissions");
    #[cfg(not(target_os = "android"))]
    true
}

/// Trigger the Android runtime permission dialog (no-op on desktop).
#[tauri::command]
#[specta::specta]
pub fn request_media_permissions() {
    #[cfg(target_os = "android")]
    let _ = crate::android_fs::call_static_void("requestMediaPermissions");
}

/// Trigger the Android runtime video/photos permission dialog (no-op on desktop).
#[tauri::command]
#[specta::specta]
pub fn request_video_permissions() {
    #[cfg(target_os = "android")]
    let _ = crate::android_fs::call_static_void("requestVideoPermissions");
}

/// Check Android video permission status across platforms.
#[tauri::command]
#[specta::specta]
pub fn get_video_permission_status() -> LibraryPermissionStatus {
    #[cfg(target_os = "android")]
    {
        let mut res = String::new();
        for _ in 0..4 {
            match crate::android_fs::call_static_string_no_arg("checkVideoPermission") {
                Ok(s) if !s.is_empty() => {
                    res = s;
                    break;
                }
                _ => {}
            }
            std::thread::sleep(std::time::Duration::from_millis(150));
        }
        match res.as_str() {
            "granted" => LibraryPermissionStatus::Granted,
            "permanently_denied" => LibraryPermissionStatus::PermanentlyDenied,
            _ => LibraryPermissionStatus::Denied,
        }
    }
    #[cfg(not(target_os = "android"))]
    LibraryPermissionStatus::NotRequired
}

/// Open the system app-settings page so the user can grant permissions.
#[tauri::command]
#[specta::specta]
pub fn open_app_settings() {
    #[cfg(target_os = "android")]
    let _ = crate::android_fs::call_static_void("openAppSettings");
}

/// Query and drain any files/URIs opened by the OS (e.g. cold-start or before frontend event listeners registered).
#[tauri::command]
#[specta::specta]
pub async fn get_pending_open_files(
    state: State<'_, crate::AppOpenFileQueue>,
) -> Result<Vec<String>> {
    let mut files = {
        let mut lock = state.0.lock().unwrap();
        std::mem::take(&mut *lock)
    };
    let android_files = crate::android_fs::drain_pending_opened_uris();
    files.extend(android_files);
    Ok(files)
}

/// Whether system notifications are allowed for this app.
/// Always true on desktop. The media notification and lock-screen player
/// disappear when this is denied, so the UI shows a guidance banner.
#[tauri::command]
#[specta::specta]
pub fn get_notification_permission_status() -> bool {
    #[cfg(target_os = "android")]
    return crate::android_fs::call_static_bool("areNotificationsEnabled");
    #[cfg(not(target_os = "android"))]
    true
}

/// Exit the app (used for Android double-back-to-exit).
/// On desktop this terminates via Tauri; on Android the Kotlin
/// `exitApp` bridge finishes the activity.
#[tauri::command]
#[specta::specta]
pub fn exit_app(app: tauri::AppHandle) {
    #[cfg(target_os = "android")]
    {
        // Ask Kotlin to finish the activity on the main thread.
        let _ = crate::android_fs::call_static_void("exitApp");
        // Fallback: also ask the runtime to exit in case the bridge is dead.
        app.exit(0);
    }
    #[cfg(not(target_os = "android"))]
    {
        app.exit(0);
    }
}
