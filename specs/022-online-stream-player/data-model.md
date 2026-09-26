# Phase 1: Data Model & State Transitions

**Feature**: Online Multi-Source Music Streaming & Player (`022-online-stream-player`)  
**Date**: 2026-09-26  
**Status**: Completed  

---

## 1. Core Entities

### OnlineTrack
Represents a search result and streamable audio item from an online music provider.

| Field | Type | Description |
|---|---|---|
| `id` | `String` | Globally unique composite ID (e.g. `yt:dQw4w9WgXcQ`, `sc:1234567`, `js:98765`) |
| `title` | `String` | Normalized song or video title |
| `artist` | `String` | Artist, creator, or channel name |
| `album` | `Option<String>` | Album title if provided by the source catalog |
| `durationSecs` | `u32` | Total duration in seconds |
| `thumbnailUrl` | `Option<String>` | URL to album artwork or video thumbnail |
| `provider` | `OnlineProvider` | Provider enum: `YouTube`, `YouTubeMusic`, `SoundCloud`, `JioSaavn` |
| `streamIdentifier` | `String` | Provider-specific track key or video ID used to resolve audio streams |

---

### StreamSource
Encapsulates the resolved playable audio stream for a track.

| Field | Type | Description |
|---|---|---|
| `streamUrl` | `String` | Direct CDN URL or local Rust streaming proxy URL |
| `mimeType` | `String` | Audio MIME type (e.g. `audio/mp4`, `audio/mpeg`, `audio/webm`) |
| `format` | `String` | File container/codec format: `m4a`, `mp3`, `opus`, `aac` |
| `bitrateKbps` | `Option<u32>` | Approximate audio bitrate in kbps |
| `isProxied` | `bool` | True if streamed through the local Rust loopback proxy |
| `headers` | `HashMap<String, String>` | Required HTTP request headers (User-Agent, Referer, Range) |

---

### TimedLyricLine & TimedLyrics
Represents synchronized lyric lines matched to playback timestamps.

```rust
pub struct TimedLyricLine {
    pub time_ms: u32,
    pub text: String,
}

pub struct TimedLyrics {
    pub track_id: String,
    pub is_synced: bool,
    pub lines: Vec<TimedLyricLine>,
    pub plain_text: Option<String>,
}
```

---

### DownloadJob
Represents an active or completed background download task.

| Field | Type | Description |
|---|---|---|
| `jobId` | `String` | Unique task identifier |
| `track` | `OnlineTrack` | Metadata of the track being downloaded |
| `status` | `DownloadStatus` | `Queued` \| `Downloading` \| `Tagging` \| `Completed` \| `Failed` \| `Cancelled` |
| `progressPercent` | `u8` | Current download progress (0 - 100) |
| `downloadedBytes` | `u64` | Bytes received so far |
| `totalBytes` | `Option<u64>` | Total file size in bytes if known |
| `destPath` | `Option<String>` | Final saved file path on the local filesystem |
| `error` | `Option<String>` | Error message if failed |

---

## 2. State Transitions

### Playback State Machine

```text
[Idle] 
  │ User clicks track in Online Search
  ▼
[Resolving Stream]
  ├── Upstream Error / Rate-limit ──► [Try Next Fallback Instance] ──► [Error Notification]
  │                                                                           │
  ▼ Stream URL Acquired                                                        ▼
[Buffering Audio] ───────────────────────────────────────────────────► [Idle]
  │
  ▼ First Audio Chunks Received
[Playing Online Stream]
  ├── Pause ───────────────► [Paused] ──► Resume ──► [Playing Online Stream]
  ├── Seek ────────────────► [Buffering Audio]
  ├── Audio Conflict (*) ──► [Paused]
  └── Track Ends ──────────► [Resolve Next Track in Queue]
```

> *(*) Per Constitution Principle VI: If local library playback or converter audio preview is triggered, the online stream immediately transitions to `[Paused]` to maintain the strict single-audio-stream constraint.*

---

### Download Job State Machine

```text
[Queued]
  │
  ▼ Worker spawns
[Downloading .part file]
  ├── User Cancel / App Close ──► [Cancelled] ──► Purge .part file
  ├── Network Drop (max retries)► [Failed]    ──► Purge .part file
  │
  ▼ Download Complete (100%)
[Tagging Metadata via FFmpeg] (single-pass embed tags & artwork)
  │
  ▼ Atomic Rename
[Completed] ──► Index into Local Library Store & Notify User
```

---

## 3. Storage & Persistence Alignment

Per Constitution Principles I & VII:
- **Playlists & Liked Online Tracks**: Persisted locally in `localStorage` / JSON store under `audiflow_online_library` key.
- **Downloaded Audio Files**: Saved directly to the user's OS Music folder (or custom configured folder in Audiflow settings).
- **Zero External Telemetry**: No search queries, played tracks, or library items are ever sent to remote analytics or external databases.
