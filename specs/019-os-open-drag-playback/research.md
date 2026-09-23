# Research & Technical Decisions: OS "Open With" & Drag-and-Drop Audio Playback

**Feature**: `specs/019-os-open-drag-playback`  
**Date**: 2026-09-23  

## 1. Unified Audio Path Resolution (Files & Directories)

### Decision
Implement a unified backend command `resolve_audio_paths(paths: Vec<String>) -> Vec<AudioTrackInfo>` in `src-tauri/src/music_library/` exposed via typed Specta IPC.

### Rationale
- A dropped batch or OS command-line invocation can contain a single audio file, multiple selected files, a folder, multiple folders, or a mixed list containing non-audio files (e.g. `.jpg`, `.txt`, `.nfo`).
- The frontend webview cannot perform recursive native directory traversal without native filesystem plugins. Rust native `std::fs` / `walkdir` executes orders of magnitude faster.
- Audiflow already possesses a high-performance directory scanner in `src-tauri/src/music_library/scanner.rs` with `ScanResultMemo` caching, audio extension filtering, and embedded tag/duration extraction.
- Exposing a single batched command `resolve_audio_paths` avoids N separate IPC calls across the webview boundary and completes in < 50ms for typical folder drops.
- Preserves natural track ordering (alphanumeric sorting by directory + track/filename) rather than library chronological sorting (date modified descending).

### Alternatives Considered
- *Individual `resolve_audio_track` calls in a frontend loop*: Fails completely for folders (returns error "not a file" or non-audio extension) and causes N+1 IPC roundtrips when 100 tracks are dropped.
- *Reusing `scanAudioFiles`*: `scanAudioFiles` is designed for persistent library root scans, updates library-wide scan statistics and caches, and sorts strictly by `modified_timestamp` descending (newest first), which scrambled album track sequences.

---

## 2. Context-Aware Drag-and-Drop Architecture

### Decision
Extract drag-and-drop routing from `App.tsx` into a dedicated custom hook (`useAppDragDrop.ts`) and introduce a visual overlay component (`PlayerDropOverlay.tsx`).

### Rationale
- **Single Responsibility & 300-Line Ceiling (Constitution Principle VIII)**: `src/App.tsx` is currently at 284 lines. Inlining drag hover states, drop validation, and tool routing directly into `App.tsx` would push it over 300 lines.
- **Context Routing**:
  - If `activeTool === "player"`: Dropped paths are sent to `resolveAudioPaths`. Discovered tracks are queued in `useMusicPlayerStore`, and playback starts immediately from track 1.
  - If `activeTool === "converter"`: Dropped paths continue to be routed to `useAppStore.addPaths` (preserving all existing converter wizard workflows without regression).
- **Tauri v2 Drag-Drop Events**: `@tauri-apps/api/webview` emits `DragDropEvent` with payloads:
  - `{ type: "enter", paths: string[] }`
  - `{ type: "over", position: PhysicalPosition }`
  - `{ type: "drop", paths: string[] }`
  - `{ type: "leave" }`
  By tracking `isDraggingOver` in `useAppDragDrop`, the UI conditionally displays `PlayerDropOverlay` when hovering over the window in Player mode.

### Alternatives Considered
- *Global player drop regardless of active tab*: Would break converter drag-and-drop, frustrating users who dragged files to convert audio/video.
- *HTML5 DnD API (`onDragOver`/`onDrop`)*: In Tauri v2 desktop apps, HTML5 `DataTransfer` does not provide real filesystem paths due to browser security sandbox constraints. Tauri's native `onDragDropEvent` is required to obtain real OS filesystem paths.

---

## 3. Playback Queue Ingestion Strategy

### Decision
When audio files or folders are dropped into the Music Player or opened from the OS context menu, the newly resolved tracks replace the active queue, track 0 begins playing immediately, and subsequent tracks play automatically via the auto-advance engine.

### Rationale
- Direct response to the user's prompt: "حالا اون برنامه باید بیاد دونه دونه اون اهنگ ها رو پلی کنه" ("now that app must play those songs one by one").
- Standard media player paradigm across desktop operating systems (VLC, Windows Media Player, QuickTime, Spotify local files).
- Auto-advance engine (`src/stores/musicPlayer/audioEngine.ts` and `useMusicPlayerStore`) already tracks `queue` and automatically plays `queue[currentIndex + 1]` upon `track-ended` events.
- A toast notification provides clear user feedback (e.g. "Playing 12 songs" / "در حال پخش ۱۲ آهنگ").

### Alternatives Considered
- *Append to queue without playing*: Frustrating when the user expects immediate playback upon double-clicking or dragging an album.
- *Interactive prompt ("Play Now or Add to Queue?")*: Adds modal friction to a lightweight desktop interaction.

---

## 4. Cross-Platform OS Context Menu & File Association Integration

### Decision
Unify OS file association handling through Tauri v2 configuration and packaging manifests:
- **macOS**: `fileAssociations` in `tauri.conf.json` maps audio extensions to `Viewer`/`Editor` roles, generating `CFBundleDocumentTypes` in the app bundle `Info.plist`. In-flight opens arrive via `RunEvent::Opened { urls }`.
- **Windows**: NSIS installer registers registry keys under `HKCR` for audio file extensions. Single-instance plugin (`tauri_plugin_single_instance`) catches second-instance CLI arguments (`argv`) and emits `open-files`.
- **Linux**: Update desktop entry in `packaging/arch/PKGBUILD` and Debian package templates to include `Exec=/usr/bin/audiflow %U` and comprehensive audio `MimeType` lists so desktop environments (GNOME, KDE Plasma, XFCE) associate audio files and directories with Audiflow.
- **Handling Ingestion in Frontend**: In `src/utils/openWith.ts`, update `handleIncomingFiles` to delegate all received paths (files and directories) to `resolve_audio_paths`, switch to the Music Player tab, and initiate playback.

### Alternatives Considered
- *Relying solely on CLI arguments*: Misses macOS `RunEvent::Opened` events which use Apple Events / URL schemes instead of `argv`.
