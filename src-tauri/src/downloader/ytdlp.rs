use std::path::{Path, PathBuf};
use std::process::Command;

use crate::error::AppError;
use crate::ffmpeg::create_hidden_command;
use crate::settings::app_data_dir;

use super::types::YtDlpInfo;

pub struct YtDlpManager;

fn find_candidate_in(dir: &Path, binary_name: &str) -> Option<PathBuf> {
    let candidate = dir.join(binary_name);
    if candidate.is_file() {
        return Some(candidate);
    }

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    let triple = "aarch64-apple-darwin";
    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    let triple = "x86_64-apple-darwin";
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    let triple = "x86_64-unknown-linux-gnu";
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    let triple = "x86_64-pc-windows-msvc";

    #[cfg(any(
        all(target_os = "macos", target_arch = "aarch64"),
        all(target_os = "macos", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "windows", target_arch = "x86_64")
    ))]
    {
        let triple_name = if cfg!(windows) {
            format!("yt-dlp-{triple}.exe")
        } else {
            format!("yt-dlp-{triple}")
        };
        let triple_candidate = dir.join(triple_name);
        if triple_candidate.is_file() {
            return Some(triple_candidate);
        }
    }

    None
}

impl YtDlpManager {
    /// Locate the yt-dlp binary with the following priority:
    /// 1. App data directory (installed self-updates: `<app_data>/bin/yt-dlp`)
    /// 2. `YTDLP_PATH` env var override
    /// 3. Beside current executable / macOS app bundle Resources
    /// 4. Current executable ancestor walk (e.g. `target/debug` -> `src-tauri/binaries`)
    /// 5. Compile-time manifest binaries dir (`env!("CARGO_MANIFEST_DIR")/binaries/`)
    /// 6. Current working directory binaries dir (`cwd/src-tauri/binaries/`)
    /// 7. Runtime `CARGO_MANIFEST_DIR` (cargo test environment)
    /// 8. System PATH fallback
    pub fn locate() -> Result<PathBuf, AppError> {
        #[cfg(target_os = "android")]
        {
            return Err(AppError::Unsupported(
                "Internet Music Downloader is currently supported on desktop only.".into(),
            ));
        }

        let binary_name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };

        // 1. App data dir updated binary (<app_data>/bin/yt-dlp)
        if let Some(data_dir) = app_data_dir() {
            if let Some(p) = find_candidate_in(&data_dir.join("bin"), binary_name) {
                return Ok(p);
            }
        }

        // 2. Environment variable override
        if let Ok(override_path) = std::env::var("YTDLP_PATH") {
            let path = PathBuf::from(&override_path);
            if path.is_file() {
                return Ok(path);
            }
            return Err(AppError::NotFound(format!(
                "yt-dlp override not found at {override_path}"
            )));
        }

        // 3. Beside current running executable or app bundle Resources
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                if let Some(p) = find_candidate_in(dir, binary_name) {
                    return Ok(p);
                }
                #[cfg(target_os = "macos")]
                if let Some(res) = dir.parent().map(|p| p.join("Resources")) {
                    if let Some(p) = find_candidate_in(&res, binary_name) {
                        return Ok(p);
                    }
                }

                // 4. Ancestor search from executable (target/debug -> src-tauri/binaries)
                let mut ancestor = dir;
                for _ in 0..5 {
                    if let Some(p) = ancestor.parent() {
                        ancestor = p;
                        for sub in ["src-tauri/binaries", "binaries"] {
                            if let Some(c) = find_candidate_in(&ancestor.join(sub), binary_name) {
                                return Ok(c);
                            }
                        }
                    } else {
                        break;
                    }
                }
            }
        }

        // 5. Compile-time manifest binaries dir (baked into binary at build time)
        let compile_manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("binaries");
        if let Some(c) = find_candidate_in(&compile_manifest, binary_name) {
            return Ok(c);
        }

        // 6. Current working directory binaries dir
        if let Ok(cwd) = std::env::current_dir() {
            for sub in ["src-tauri/binaries", "binaries"] {
                if let Some(c) = find_candidate_in(&cwd.join(sub), binary_name) {
                    return Ok(c);
                }
            }
        }

        // 7. Runtime CARGO_MANIFEST_DIR (cargo test)
        if let Ok(cargo_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            let runtime_manifest = PathBuf::from(cargo_dir).join("binaries");
            if let Some(c) = find_candidate_in(&runtime_manifest, binary_name) {
                return Ok(c);
            }
        }

        // 8. System PATH fallback
        if let Ok(system_path) = which(binary_name) {
            crate::log_warn!("Using yt-dlp from system PATH fallback: {}", system_path.display());
            return Ok(system_path);
        }

        Err(AppError::NotFound(
            "yt-dlp binary is not bundled with the application and was not found in app assets".into(),
        ))
    }

    /// Build a preconfigured `Command` for yt-dlp without exposing shell invocation.
    pub fn build_command() -> Result<Command, AppError> {
        let path = Self::locate()?;
        let mut cmd = create_hidden_command(&path);
        cmd.env("LC_ALL", "C.UTF-8");
        cmd.env("LANG", "C.UTF-8");
        Ok(cmd)
    }

    /// Query the yt-dlp version.
    pub fn get_version() -> Result<String, AppError> {
        let mut cmd = Self::build_command()?;
        cmd.arg("--version");
        let output = cmd
            .output()
            .map_err(|e| AppError::Other(format!("Failed to execute yt-dlp --version: {e}")))?;

        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(version)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(AppError::Other(format!(
                "yt-dlp --version failed with exit code {:?}: {stderr}",
                output.status.code()
            )))
        }
    }

    /// Retrieve full info on the located yt-dlp binary.
    pub fn get_info() -> Result<YtDlpInfo, AppError> {
        let path = Self::locate()?;
        let version = Self::get_version().unwrap_or_else(|_| "unknown".into());
        let path_str = path.to_string_lossy().into_owned();
        let is_bundled = !path_str.starts_with("/usr") && !path_str.starts_with("/opt/homebrew");

        Ok(YtDlpInfo {
            version,
            binary_path: path_str,
            is_bundled,
        })
    }
}

/// Lightweight PATH lookup without external dependency.
fn which(name: &str) -> Result<PathBuf, ()> {
    if let Ok(paths) = std::env::var("PATH") {
        for dir in std::env::split_paths(&paths) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }
    Err(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn locate_or_fallback_finds_binary() {
        let _guard = ENV_LOCK.lock().unwrap();
        let result = YtDlpManager::locate();
        assert!(result.is_ok(), "Expected to locate bundled or test yt-dlp");
    }

    #[test]
    fn version_is_non_empty() {
        let _guard = ENV_LOCK.lock().unwrap();
        let version = YtDlpManager::get_version();
        assert!(version.is_ok(), "Expected valid version output");
        let ver = version.unwrap();
        assert!(!ver.is_empty());
    }

    #[test]
    fn locate_without_system_path_uses_bundled() {
        let _guard = ENV_LOCK.lock().unwrap();
        let old_path = std::env::var("PATH").ok();
        std::env::set_var("PATH", "");
        let res = YtDlpManager::locate();
        if let Some(p) = old_path {
            std::env::set_var("PATH", p);
        }
        assert!(res.is_ok(), "Expected bundled yt-dlp to be located even with empty PATH");
    }

    #[test]
    fn locate_without_runtime_env_uses_bundled() {
        let _guard = ENV_LOCK.lock().unwrap();
        let old_path = std::env::var("PATH").ok();
        let old_manifest = std::env::var("CARGO_MANIFEST_DIR").ok();
        std::env::set_var("PATH", "");
        std::env::remove_var("CARGO_MANIFEST_DIR");
        let res = YtDlpManager::locate();
        if let Some(p) = old_path {
            std::env::set_var("PATH", p);
        }
        if let Some(m) = old_manifest {
            std::env::set_var("CARGO_MANIFEST_DIR", m);
        }
        assert!(res.is_ok(), "Expected compile-time baked path or ancestor search to find yt-dlp");
    }
}
