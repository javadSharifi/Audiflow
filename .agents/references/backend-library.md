# Reference — backend-library

Domain: Music library scanner + artwork (per-platform). Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src-tauri/src/music_library/artwork.rs` | Lazy per-track cover cache (FNV-1a); `get_track_artwork`. |
| `src-tauri/src/music_library/mod.rs` | Library scan dispatcher; `scan_music_library`, permission status. |
| `src-tauri/src/music_library/models.rs` | Library contracts; `AudioTrackInfo`, `LibraryPermissionStatus`. |
| `src-tauri/src/music_library/platform/android.rs` | MediaStore via JNI scan/delete; `scan_media_store`. |
| `src-tauri/src/music_library/platform/linux.rs` | XDG Music dirs resolver. |
| `src-tauri/src/music_library/platform/macos.rs` | Single ~/Music resolver (avoids TCC prompts). |
| `src-tauri/src/music_library/platform/mod.rs` | Platform module index. |
| `src-tauri/src/music_library/platform/windows.rs` | USERPROFILE Music/Downloads/Desktop/Documents resolver. |
| `src-tauri/src/music_library/scanner.rs` | Desktop recursive audio scanner; `scan_local_directory`, cover lookup. |

