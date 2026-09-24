# Contract: Android Media Scan & JNI Interface

## 1. IPC Contract (Frontend ↔ Tauri Rust)
The existing Tauri command signature is preserved unchanged:

```rust
#[tauri::command]
#[specta::specta]
pub async fn scan_audio_files(custom_dirs: Option<Vec<String>>) -> Vec<AudioTrackInfo>;
```

- **Frontend Invocation**: `api.scanAudioFiles(customDirs?: string[])`
- **Output**: Array of `AudioTrackInfo` objects.
- **Contract Stability**: Unbroken. No changes to `src/types/generated.ts` or TypeScript IPC callers.

## 2. JNI Contract (Rust ↔ Android Kotlin)

### JNI Static Method: `queryMediaStoreMusic`
- **Caller**: `src-tauri/src/music_library/platform/android.rs` via `crate::android_fs::call_static_string_no_arg("queryMediaStoreMusic")`
- **Kotlin Class**: `com.audiflow.app.MainActivity` / `com.audiflow.app.MediaStoreManager`
- **Signature**: `fun queryMediaStoreMusic(context: Context): String`
- **Return Value**: JSON serialized array of track objects:
  ```json
  [
    {
      "id": "android_12345",
      "uri": "content://media/external/audio/media/12345",
      "path": "/storage/emulated/0/Music/song.mp3",
      "name": "song.mp3",
      "title": "Song Title",
      "artist": "Artist Name",
      "album": "Album Name",
      "durationSecs": 210.5,
      "sizeBytes": 5242880,
      "mimeType": "audio/mpeg",
      "format": "mp3",
      "createdTimestampMs": 1727160000000,
      "modifiedTimestampMs": 1727160000000,
      "coverUrl": "content://media/external/audio/albumart/67"
    }
  ]
  ```

### New Internal Kotlin Service: `MediaScanSynchronizer`
- **Class**: `com.audiflow.app.MediaScanSynchronizer`
- **Method**:
  ```kotlin
  object MediaScanSynchronizer {
    fun syncStorageDirectories(context: Context, maxTimeoutMs: Long = 2500L): MediaScanSyncResult
  }
  ```
- **Lifecycle**: Called during `queryMediaStoreMusic` when a rescan is invoked, scanning candidate audio files in `Music`, `Download`, and mounted external OTG volumes and submitting them to `MediaScannerConnection.scanFile(...)`.
