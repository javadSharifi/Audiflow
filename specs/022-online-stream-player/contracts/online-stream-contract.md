# Contract: Online Stream IPC & TypeScript Interfaces

## 1. IPC Commands (Rust Backend ↔ React Frontend)

All IPC commands are annotated with `#[tauri::command]` and `#[specta::specta]` to generate type-safe bindings into `src/types/generated.ts` via `pnpm generate:types`.

### Command 1: `search_online_tracks`
Performs concurrent multi-source search across YouTube, SoundCloud, and JioSaavn.

```rust
#[tauri::command]
#[specta::specta]
pub async fn search_online_tracks(
    query: String,
    provider: Option<String>,
) -> Result<Vec<OnlineTrack>, String>;
```

- **Frontend Invocation**: `api.searchOnlineTracks(query: string, provider?: string): Promise<OnlineTrack[]>`
- **Output**: Array of normalized `OnlineTrack` items.

---

### Command 2: `resolve_online_stream`
Resolves playable audio stream URL (with range support) for a selected track.

```rust
#[tauri::command]
#[specta::specta]
pub async fn resolve_online_stream(
    track_id: String,
    stream_identifier: String,
    provider: String,
) -> Result<StreamSource, String>;
```

- **Frontend Invocation**: `api.resolveOnlineStream(trackId: string, streamIdentifier: string, provider: string): Promise<StreamSource>`
- **Output**: `StreamSource` containing audio URL (direct or local proxy), MIME type, and headers.

---

### Command 3: `fetch_online_lyrics`
Retrieves timestamped lyrics from open lyric provider (LRCLIB).

```rust
#[tauri::command]
#[specta::specta]
pub async fn fetch_online_lyrics(
    title: String,
    artist: String,
    duration_secs: Option<u32>,
) -> Result<Option<TimedLyrics>, String>;
```

- **Frontend Invocation**: `api.fetchOnlineLyrics(title: string, artist: string, durationSecs?: number): Promise<TimedLyrics | null>`
- **Output**: `TimedLyrics` object containing line-by-line timestamps and text, or `null` if not found.

---

### Command 4: `download_online_track`
Streams, tags, and saves an online audio track into the local Music Library.

```rust
#[tauri::command]
#[specta::specta]
pub async fn download_online_track(
    track: OnlineTrack,
    target_dir: Option<String>,
) -> Result<DownloadedMedia, String>;
```

- **Frontend Invocation**: `api.downloadOnlineTrack(track: OnlineTrack, targetDir?: string): Promise<DownloadedMedia>`
- **Output**: `DownloadedMedia` with saved local filesystem path and format.

---

## 2. TypeScript Store Integration

A dedicated slice `onlineSlice.ts` is integrated into the Music Player store under `src/stores/musicPlayer/slices/onlineSlice.ts`:

```typescript
export interface OnlineSlice {
  isOnlineMode: boolean;
  onlineQuery: string;
  onlineResults: OnlineTrack[];
  isSearchingOnline: boolean;
  onlineError: string | null;
  lyrics: TimedLyrics | null;
  isLoadingLyrics: boolean;
  downloadingTrackIds: Set<string>;
  
  toggleOnlineMode: (force?: boolean) => void;
  setOnlineQuery: (q: string) => void;
  searchOnline: (q: string) => Promise<void>;
  playOnlineTrack: (track: OnlineTrack) => Promise<void>;
  downloadTrack: (track: OnlineTrack) => Promise<void>;
  fetchLyricsForTrack: (track: OnlineTrack) => Promise<void>;
}
```

Per Constitution Principle VIII:
- File size must remain strictly under 300 lines.
- All UI actions and presentation are decoupled from direct IPC calls.
