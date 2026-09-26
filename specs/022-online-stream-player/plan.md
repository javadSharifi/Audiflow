# Implementation Plan: Online Multi-Source Music Streaming & Player

**Branch**: `022-online-stream-player` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/022-online-stream-player/spec.md`

---

## Summary

Integrate multi-source online music discovery, streaming playback, timed lyrics, and one-click downloading into Audiflow's Music Player interface. The implementation runs entirely locally on the user's operating system via Tauri 2 and Rust without requiring an external hosted server, subscription, or database. Requests automatically pass through the user's active system VPN or proxy to maintain access in restricted network environments. Downloaded tracks seamlessly integrate into the local Music Library and the FFmpeg-powered Converter/Booster pipeline.

---

## Technical Context

**Language/Version**: Rust 1.77+ (edition 2021), TypeScript 5.9+ (strict mode), React 19  
**Primary Dependencies**:
- Backend: `reqwest` 0.12 (with `rustls-tls` and system proxy inheritance), `tokio` 1, `tauri` 2, `specta` 2.0.0-rc.25, statically bundled `ffmpeg` 8.1.2 sidecar
- Frontend: Zustand 5 (slice architecture), Tailwind CSS 4, `lucide-react`  
**Storage**: Local filesystem (`Music/` directory for downloads), `localStorage` for online playlists/favorites  
**Testing**: Vitest + React Testing Library (frontend components/store), `cargo test` (backend providers/parsers)  
**Target Platform**: Windows, macOS, Linux, Android  
**Project Type**: Native desktop and mobile application (Tauri 2 shell)  
**Performance Goals**: <3s search response time, <2s streaming playback startup, 60fps scrolling on results  
**Constraints**: Zero telemetry, zero mandatory cloud accounts, offline-first integrity, single-pass DSP integrity, 300-line file ceiling, full English + Persian RTL i18n  
**Scale/Scope**: Unified search across YouTube, SoundCloud, JioSaavn; LRCLIB timed lyrics; atomic downloads with FFmpeg tagging  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Plan Status | Notes |
|---|---|---|---|
| **I. Local-First Privacy** | Offline capability must remain 100% operational with zero internet. No analytics. | **PASS** | Online feature is strictly opt-in; core conversion and local playback function with zero network. |
| **II. Single-Pass DSP** | Single FFmpeg execution graph; no cascading lossy re-encoding; alimiter terminal stage. | **PASS** | Downloaded tracks are stream-copied (`-c copy`) and tagged in a single pass; no intermediate re-encodes. |
| **III. Type-Safe IPC** | Commands in Specta builder; typed helpers in `src/utils/tauri.ts`; CI check:types gate. | **PASS** | All new commands registered with `#[specta::specta]` and exported to `generated.ts`. |
| **IV. Atomic Operations** | `.part` files + atomic rename; incremental `(1)`, `(2)` suffix on collision; cleanup on cancel. | **PASS** | Downloader writes to `.part` file, muxes metadata, and renames atomically upon completion. |
| **V. Test-First CI** | Unit tests for store and backend modules before merge. | **PASS** | Vitest tests for `onlineSlice.ts` and cargo tests for provider response parsers. |
| **VI. Platform Boundaries** | Only ONE active audio stream playing at any time across the entire application. | **PASS** | Online stream immediately pauses when local playback or converter preview starts, and vice versa. |
| **VII. Secrets Protection** | No secrets in plaintext files or localStorage. | **PASS** | No API keys needed; public endpoints are utilized without secret credentials. |
| **VIII. Code Hygiene** | No hardcoded text (en/fa i18n); SOLID; max 300 lines per file ceiling. | **PASS** | All components split into sub-units <= 300 lines; 100% localized with RTL support. |

---

## Project Structure

### Documentation (this feature)

```text
specs/022-online-stream-player/
├── spec.md                  # Feature specification with resolved clarifications
├── checklists/
│   └── requirements.md      # Completed quality checklist
├── research.md              # Phase 0 architecture research and decisions
├── data-model.md            # Phase 1 data models and state machines
├── contracts/
│   └── online-stream-contract.md  # Phase 1 IPC and TypeScript contracts
├── quickstart.md            # Phase 1 runnable end-to-end verification scenarios
└── plan.md                  # This implementation plan
```

### Source Code Layout

```text
src-tauri/src/
├── online_player/
│   ├── mod.rs               # IPC command handlers: search, resolve, lyrics, download
│   ├── providers/
│   │   ├── mod.rs           # OnlineProvider trait and normalization types
│   │   ├── youtube.rs       # Invidious & Piped search and stream resolver with fallback
│   │   ├── soundcloud.rs    # SoundCloud search & progressive MP3/HLS stream resolver
│   │   └── jiosaavn.rs      # JioSaavn API search & CDN resolver
│   ├── lyrics.rs            # LRCLIB API client and synced timestamp parser
│   └── downloader.rs        # Stream downloader with FFmpeg metadata tagging
├── lib.rs                   # Register online_player commands with Specta builder

src/
├── stores/musicPlayer/
│   └── slices/
│       └── onlineSlice.ts   # Zustand slice for online mode, search query, results, lyrics
├── components/music-player/
│   ├── OnlineSearchButton.tsx      # Internet search button inserted in search toolbar
│   ├── OnlineSearchResultsView.tsx # Virtualized online track results list
│   ├── OnlineTrackRow.tsx          # Result row with artwork, title, provider badge, actions
│   └── TimedLyricsSheet.tsx        # Synced lyrics sheet with active line highlight and seeking
├── utils/
│   └── tauri.ts             # Typed IPC facade callers for online_player commands
└── i18n/
    ├── en.ts                # English localization keys for online streaming
    └── fa.ts                # Persian localization keys for online streaming
```

**Structure Decision**:
- Group all backend online streaming logic into a modular `src-tauri/src/online_player/` module.
- Keep frontend components decoupled and modular: `OnlineSearchButton.tsx` plugs right next to the search input in `TrackListView.tsx`, preserving the 300-line ceiling in existing files.

---

## Complexity Tracking

*No constitution violations or unjustified complexities. All architectural constraints are fully satisfied.*
