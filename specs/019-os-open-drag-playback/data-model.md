# Data Model & State Transitions: OS Open With & Drag-and-Drop Playback

**Feature**: `specs/019-os-open-drag-playback`  
**Date**: 2026-09-23  

## 1. Entities

### `AudioTrackInfo` (Existing Backend & Frontend Entity)
Represents a resolved playable audio track.
- `id: string` — Unique track identifier (e.g. `local_/path/to/song.mp3` or `uri_content://...`).
- `uri: string` — Playable audio URI (`file:///path/...` on desktop or `content://` on Android).
- `path: string | null` — Host filesystem path if available.
- `name: string` — Display name / filename.
- `title: string | null` — Extracted metadata title.
- `artist: string | null` — Extracted metadata artist.
- `album: string | null` — Extracted metadata album.
- `durationSecs: number` — Duration in seconds (parsed from metadata or header probe).
- `sizeBytes: number` — File size on disk.
- `modifiedTimestampMs: number` — File modification timestamp in milliseconds.
- `createdTimestampMs: number` — File creation timestamp in milliseconds.
- `format: string` — Lowercase extension (e.g. `mp3`, `flac`, `m4a`).
- `mimeType: string` — MIME type (e.g. `audio/mpeg`, `audio/flac`).
- `coverUrl: string | null` — Cached artwork URI if available.

### `DroppedIngestionBatch` (Frontend Ingestion Entity)
Result of resolving a collection of filesystem paths (files and directories) supplied by drag-and-drop or OS "Open with".
- `rawPaths: string[]` — Raw strings received from Tauri drop event or CLI / single-instance event.
- `resolvedTracks: AudioTrackInfo[]` — Successfully parsed audio tracks, ordered naturally.
- `audioCount: number` — Total count of playable tracks discovered.
- `skippedCount: number` — Non-audio or unreadable files skipped during traversal.

### `DragDropUIState` (Frontend Transient View State)
Represents the drag-over state for rendering visual feedback.
- `isDraggingOver: boolean` — Whether native drag is currently hovered over the application window.
- `activeTool: "player" | "converter" | "booster"` — Current tool determining which drop behavior triggers.

---

## 2. State Transitions & Lifecycle

### Flow A: Drag-and-Drop Ingestion (Player Active)
```
[User drags files from Finder/Explorer over window]
     │
     ▼
[Native webview onDragDropEvent: enter] ──► Sets isDraggingOver = true
     │
     ▼
[UI displays PlayerDropOverlay] (Visual cue: "Drop to play songs")
     │
     ▼
[User drops files: drop event received with paths[]]
     │
     ▼
[isDraggingOver reset to false; Overlay unmounts]
     │
     ▼
[api.resolveAudioPaths(paths)] ──► Recursively scans directories, filters audio files
     │
     ▼
[Tracks returned: AudioTrackInfo[]]
     ├── If empty: Shows toast ("No playable audio found")
     └── If tracks.length > 0:
              │
              ▼
         [playerStore.playTrack(tracks[0], tracks)]
              │
              ├── queue = tracks
              ├── currentTrack = tracks[0]
              ├── currentTime = 0
              └── isPlaying = true
              │
              ▼
         [Audio playback begins; Toast: "Playing X songs"]
              │
              ▼
         [Track 0 ends] ──► autoAdvanceEngine triggers playTrack(tracks[1], tracks)
              │
              ▼
         [Continues sequentially until queue completes]
```

### Flow B: OS Context Menu / "Open With" Ingestion
```
[User right-clicks audio file/folder in OS -> "Open with Audiflow"]
     │
     ▼
[Cold start: get_pending_open_files() / Running: "open-files" event]
     │
     ▼
[handleIncomingFiles(rawPaths)]
     │
     ▼
[setActiveTool("player")] (Switches view to Music Player)
     │
     ▼
[api.resolveAudioPaths(paths)]
     │
     ▼
[playerStore.playTrack(tracks[0], tracks)]
     │
     ▼
[playerStore.setFullscreenOpen(true)] (Opens Now Playing view)
```

### Flow C: Drag-and-Drop Ingestion (Converter Active)
```
[User drags audio/video files over window while activeTool === "converter"]
     │
     ▼
[useAppDragDrop checks activeTool === "converter"]
     │
     ▼
[useAppStore.addPaths(paths)] (Ingests into conversion wizard, player untouched)
```
