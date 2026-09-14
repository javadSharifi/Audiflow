use std::path::PathBuf;

pub fn get_music_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    #[cfg(target_os = "macos")]
    {
        // One protected root on purpose: every extra folder (Desktop,
        // Documents, Downloads, ...) costs its own macOS TCC permission
        // prompt on first launch. Everything else is covered by user-picked
        // custom folders, which arrive with a system-picker grant and
        // trigger no prompt.
        if let Ok(home) = std::env::var("HOME") {
            let candidate = PathBuf::from(home).join("Music");
            if candidate.is_dir() {
                dirs.push(candidate);
            }
        }
    }

    dirs
}
