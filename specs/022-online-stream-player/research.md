# Phase 0: Research & Architecture Decisions

**Feature**: Online Multi-Source Music Streaming & Player (`022-online-stream-player`)  
**Date**: 2026-09-26  
**Status**: Completed  

---

## 1. Multi-Provider Search Aggregation Architecture

### Decision
Implement the search aggregation and provider normalization layer inside the Rust backend (`src-tauri/src/online_player/`), exposing typed IPC commands to the React frontend.

### Rationale
- **CORS Immunity**: Browsers and WebViews impose CORS restrictions on external third-party endpoints. Rust has no CORS restrictions.
- **System Proxy & VPN Compliance**: Rust's `reqwest` client automatically reads and respects operating system proxy settings (Windows WinINet, Unix `HTTP_PROXY`/`HTTPS_PROXY`) and system VPN adapters.
- **Concurrent Fan-Out & Cancellation**: Rust handles concurrent asynchronous fan-out to multiple providers (YouTube via Piped/Invidious, JioSaavn, SoundCloud, Deezer/iTunes) with Tokio tasks and timeouts. If the user cancels or submits a new query, previous inflight HTTP requests are instantly aborted.
- **Memory & CPU Efficiency**: Parsing and normalizing large JSON payloads from multiple providers in Rust avoids garbage collection pauses in the React UI thread.

### Alternatives Considered
- *Frontend-only `fetch` with CORS proxies*: Fragile, requires maintaining third-party CORS proxy services, and fails if CORS proxies go down.
- *Bundled Node.js / Express sidecar*: Rejected because it increases memory footprint by 80MB+ and violates Audiflow's minimal-footprint desktop philosophy.

---

## 2. Audio Streaming & Proxy Mechanism

### Decision
Use a dual-path playback strategy:
1. **Direct Stream URLs where supported**: Providers with direct CDN MP3/M4A URLs that send permissive CORS headers (e.g. JioSaavn `saavncdn.com`, SoundCloud progressive MP3 streams) can be handed directly to the HTML5 `<audio>` element or Tauri asset loader.
2. **Rust Local Streaming Proxy for Protected / Header-Sensitive Streams**: For YouTube/GoogleVideo streams that require custom `User-Agent`, `Referer`, or strict HTTP `Range` headers, Rust provides a lightweight local proxy endpoint (or custom URI protocol `stream://`) that forwards range requests (`bytes=start-end`) and pipes bytes into the player without downloading the full track upfront.

### Rationale
- GoogleVideo URLs expire quickly and strictly validate request headers. Passing them through Rust ensures consistent headers and uninterrupted seeking.
- Supports smooth scrubbing and seeking via HTTP 206 Partial Content range forwarding.
- Zero local disk space required for pure streaming mode (streamed chunks exist purely in ephemeral buffers).

### Alternatives Considered
- *Full track pre-buffering before playback*: Rejected because waiting for 5-10MB to download before playback starts creates an unacceptable 5-10 second delay.
- *Bundling Chromium Widevine DRM*: Rejected due to legal constraints, proprietary licensing, and massive binary bloat.

---

## 3. One-Click Track Download Pipeline & Converter Integration

### Decision
Implement track downloading in Rust utilizing the existing FFmpeg sidecar pipeline:
1. Rust streams the audio file to a temporary file (`.part`) in the user's configured download/music directory.
2. Once the stream download finishes, Rust invokes the bundled `ffmpeg` sidecar in a single pass to mux standard metadata tags (ID3v2 for MP3, Vorbis for FLAC, iTunes metadata for M4A/AAC) and embed cover artwork.
3. The temporary file is atomically renamed to the final clean filename (e.g. `Artist - Title.m4a`), applying collision handling (`(1)`, `(2)`) per Constitution Principle IV.
4. The downloaded file is immediately indexed into the local Music Library store (`useMusicPlayerStore`) and an "Open in Converter" action is provided to populate `useAppStore.addFiles`.

### Rationale
- Reuses the existing robust FFmpeg sidecar already bundled in Audiflow (`src-tauri/src/ffmpeg/`).
- Guarantees lossless or optimal stream copy (`-c copy`) whenever possible, avoiding re-encoding degradation per Constitution Principle II.
- Atomically prevents corrupted or partial files on network abort.

### Alternatives Considered
- *Browser `Blob` download*: Browser blobs cannot write directly to arbitrary filesystem folders or invoke FFmpeg for metadata tagging.
- *Custom ID3 tagger crate*: Unnecessary dependency bloat when FFmpeg is already bundled and capable of lossless tagging.

---

## 4. Timed Lyrics Synchronization (LRCLIB)

### Decision
Fetch synchronized lyrics via the public, free, and open LRCLIB API (`https://lrclib.net/api/get`), with fallback to plain lyrics search.

### Rationale
- LRCLIB is the gold standard for open-source synchronized lyrics, widely used by open-source players.
- Provides line-by-line timestamps (`[mm:ss.xx]`) that can be parsed into an array of `{ timeMs: number, text: string }`.
- In the React frontend, an `activeLyricIndex` is tracked against `currentTime` from the audio engine, updating the smooth scrolling container and highlighting the active line.
- Clicking any lyric line seeks the player to that timestamp (`audioEngine.seek(timeMs / 1000)`).

### Alternatives Considered
- *Scraping proprietary lyric sites*: Fragile, violates Terms of Service, and frequently breaks due to CAPTCHAs.
- *Embedded AI Whisper transcription*: Too heavy for simple music playback; LRCLIB provides instant crowd-sourced lyrics with zero CPU/GPU overhead.

---

## 5. UI Integration & Ergonomics

### Decision
In `src/components/music-player/TrackListView.tsx`:
- Add a discrete `OnlineSearchToggle` button with a globe/cloud icon directly next to the search input in the search toolbar.
- When toggled ON, the search input placeholder changes to "Search online music...", and submitting a query switches the track list below to the `OnlineSearchResultsView` component.
- Each online track row displays:
  - Cover thumbnail, title, artist, duration, provider badge (YouTube, SoundCloud, JioSaavn).
  - Quick action buttons: Play / Pause, Add to Queue, Add to Playlist, and Download / Save.
- All components stay strictly under the 300-line ceiling and have zero hardcoded text (English and Persian translations in `src/i18n/`).

### Rationale
- Directly matches the user's explicit preference: "ی دکمه اضافه کنی بغل جوست جو که این باش جستجو در اینترنت".
- Requires zero intrusive top-level navigation changes.
- Seamlessly reuses existing player infrastructure (bottom mini-player, full-screen player, volume, and queue).
