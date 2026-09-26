---
description: "Task list for Online Multi-Source Music Streaming & Player implementation"
---

# Tasks: Online Multi-Source Music Streaming & Player

**Input**: Design documents from `specs/022-online-stream-player/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/online-stream-contract.md`, `quickstart.md`  
**Organization**: Tasks are grouped by phase and user story to enable independent implementation, testing, and MVP delivery.

---

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Parallelizable task (different files, no blocking dependencies)
- **[Story]**: Target user story tag (`[US1]` to `[US6]`)
- All task descriptions include exact file paths

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish backend Rust module structure, shared HTTP client, and provider traits.

- [X] T001 Create backend module directory structure in src-tauri/src/online_player/ and src-tauri/src/online_player/providers/
- [X] T002 Define OnlineProvider async trait, provider enums, and normalization interfaces in src-tauri/src/online_player/providers/mod.rs
- [X] T003 [P] Configure reqwest::Client with system proxy auto-detection, custom User-Agent, and timeouts in src-tauri/src/online_player/client.rs

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data structures, Specta IPC bindings, and store slices required by all user stories.

**⚠️ CRITICAL**: Must complete before user story implementation begins.

- [X] T004 Define OnlineTrack, StreamSource, TimedLyrics, and DownloadedMedia structs with Specta/Serde derives in src-tauri/src/online_player/types.rs
- [X] T005 Implement Specta IPC command handlers and register online_player commands in src-tauri/src/online_player/mod.rs and src-tauri/src/lib.rs
- [X] T006 Run pnpm generate:types and create typed IPC wrapper helpers in src/utils/tauri.ts
- [X] T007 [P] Add English and Persian localization keys for online streaming, search, errors, and downloads in src/i18n/en.ts and src/i18n/fa.ts
- [X] T008 Create onlineSlice.ts Zustand slice under 300 lines in src/stores/musicPlayer/slices/onlineSlice.ts and mount it into src/stores/useMusicPlayerStore.ts

**Checkpoint**: Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 - Multi-Provider Online Search & Discovery (Priority: P1) 🎯 MVP

**Goal**: Enable searching across YouTube, SoundCloud, and JioSaavn via the search button next to the search input in the Music Player.  
**Independent Test**: Click the "Internet Search" button in the Music Player, type a query, and verify aggregated results with artwork, title, artist, and provider tags display within 3 seconds.

- [X] T009 [P] [US1] Implement JioSaavn search parser and API caller in src-tauri/src/online_player/providers/jiosaavn.rs
- [X] T010 [P] [US1] Implement SoundCloud search parser and public API caller in src-tauri/src/online_player/providers/soundcloud.rs
- [X] T011 [P] [US1] Implement YouTube search via Piped and Invidious instances with instance failover in src-tauri/src/online_player/providers/youtube.rs
- [X] T012 [US1] Implement unified concurrent search fan-out across all providers with timeout in src-tauri/src/online_player/mod.rs
- [X] T013 [P] [US1] Create OnlineSearchButton.tsx component in src/components/music-player/OnlineSearchButton.tsx and mount it in search row in src/components/music-player/TrackListView.tsx
- [X] T014 [US1] Create OnlineSearchResultsView.tsx with virtualized track list rendering in src/components/music-player/OnlineSearchResultsView.tsx
- [X] T015 [US1] Create OnlineTrackRow.tsx displaying thumbnail, title, artist, duration, and provider tag in src/components/music-player/OnlineTrackRow.tsx
- [X] T016 [US1] Add unit tests for onlineSlice.ts search actions in src/stores/musicPlayer/__tests__/onlineSlice.test.ts

**Checkpoint**: User Story 1 complete — MVP search is testable and functional.

---

## Phase 4: User Story 2 - Direct Local Audio Streaming & Playback Controls (Priority: P1)

**Goal**: Click an online track to stream audio immediately with play, pause, seek, volume, and single-stream mutual pause.  
**Independent Test**: Click any online search result, verify audio plays within 2s, seeking works, and playing a local track immediately pauses the online stream.

- [X] T017 [P] [US2] Implement stream URL resolution for YouTube audio streams with fallback in src-tauri/src/online_player/providers/youtube.rs
- [X] T018 [P] [US2] Implement stream URL resolution for SoundCloud audio streams in src-tauri/src/online_player/providers/soundcloud.rs
- [X] T019 [P] [US2] Implement stream URL resolution for JioSaavn direct CDN audio links in src-tauri/src/online_player/providers/jiosaavn.rs
- [X] T020 [US2] Implement local HTTP range forwarding proxy in src-tauri/src/online_player/proxy.rs for streams requiring custom headers and seeking
- [X] T021 [US2] Integrate online track playback into src/stores/musicPlayer/audioEngine.ts and src/stores/musicPlayer/slices/playbackSlice.ts
- [X] T022 [US2] Implement mutual audio pause (Constitution Principle VI) ensuring local playback pauses online stream in src/stores/musicPlayer/slices/playbackSlice.ts
- [X] T023 [US2] Add unit tests for playback state transitions and mutual pause in src/stores/musicPlayer/__tests__/onlinePlayback.test.ts

**Checkpoint**: User Story 2 complete — direct streaming playback and controls operational.

---

## Phase 5: User Story 3 - Download & Save Online Tracks into Local Library and Converter (Priority: P1)

**Goal**: One-click download button on online tracks that saves the audio file locally, tags metadata via FFmpeg, and enables "Open in Converter".  
**Independent Test**: Click the Download button on a track, observe download completion, verify file appears in local Music Library and opens in Converter.

- [X] T024 [US3] Implement streaming downloader with atomic .part file writes and cancellation cleanup in src-tauri/src/online_player/downloader.rs
- [X] T025 [US3] Implement single-pass FFmpeg metadata and artwork embedding tagger in src-tauri/src/online_player/downloader.rs
- [X] T026 [P] [US3] Add "Download / Save" button and progress indicator to src/components/music-player/OnlineTrackRow.tsx
- [X] T027 [US3] Add "Open in Converter" action on downloaded tracks bridging into src/stores/slices/fileListSlice.ts
- [X] T028 [US3] Add integration test for download pipeline and atomic renaming in src-tauri/tests/online_downloader_test.rs

**Checkpoint**: User Story 3 complete — downloading and converter integration operational.

---

## Phase 6: User Story 4 - Synchronized Timed Lyrics Display (Priority: P2)

**Goal**: Display real-time synchronized scrolling lyrics from LRCLIB with line-click seeking.  
**Independent Test**: Play a track with lyrics, open lyrics view, verify active line highlights and clicking a line seeks to that timestamp.

- [X] T029 [US4] Implement LRCLIB API client and [mm:ss.xx] timestamped parser in src-tauri/src/online_player/lyrics.rs
- [X] T030 [P] [US4] Add fetchOnlineLyrics command handler and IPC bridge in src-tauri/src/online_player/mod.rs and src/utils/tauri.ts
- [X] T031 [US4] Create TimedLyricsSheet.tsx with smooth auto-scrolling and line seeking in src/components/music-player/TimedLyricsSheet.tsx
- [X] T032 [US4] Integrate lyrics toggle button into the now-playing bar in src/components/music-player/PlayerMiniBar.tsx

**Checkpoint**: User Story 4 complete — synchronized timed lyrics operational.

---

## Phase 7: User Story 5 - System VPN & Proxy Passthrough (Priority: P2)

**Goal**: Ensure all requests honor OS-level VPN and system proxy settings and failover across provider instances.  
**Independent Test**: Enable system proxy/VPN, verify search and stream requests route through the tunnel and blocked instances automatically fail over.

- [X] T033 [US5] Implement dynamic instance pool rotation with latency/health ranking in src-tauri/src/online_player/providers/youtube.rs
- [X] T034 [US5] Verify and configure reqwest client builder for OS proxy auto-detection (Windows WinINet / Unix env) in src-tauri/src/online_player/client.rs
- [X] T035 [US5] Add network error diagnostics banner with retry prompt in src/components/music-player/OnlineSearchResultsView.tsx

**Checkpoint**: User Story 5 complete — network resilience and proxy routing validated.

---

## Phase 8: User Story 6 - Online Queue, Local Bookmarks & Playlist Integration (Priority: P2)

**Goal**: Queue management, repeat/shuffle, and saving online tracks into local playlists/favorites.  
**Independent Test**: Add online tracks to queue, verify auto-advance on track end, and save an online track to a local playlist.

- [X] T036 [US6] Extend queue slice to support OnlineTrack items alongside local files in src/stores/musicPlayer/slices/queueSlice.ts
- [X] T037 [US6] Implement auto-next resolution for online queue tracks on song completion in src/stores/musicPlayer/audioEngine.ts
- [X] T038 [P] [US6] Add "Add to Playlist" and "Favorite" actions for online tracks in src/components/music-player/OnlineTrackRow.tsx
- [X] T039 [US6] Persist online favorites and playlists to localStorage under audiflow_online_library in src/stores/musicPlayer/slices/onlineSlice.ts

**Checkpoint**: User Story 6 complete — online queue and playlist management operational.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T040 [P] Verify 300-line ceiling on all new and modified TypeScript and Rust files per Constitution Principle VIII
- [X] T041 [P] Audit and ensure 100% of user-facing strings are mapped to translate(lang, key) in src/i18n/en.ts and src/i18n/fa.ts with RTL layout support
- [X] T042 Run full project CI gates: pnpm check:types, pnpm test, pnpm build, and cargo test --manifest-path src-tauri/Cargo.toml
- [X] T043 Execute end-to-end verification scenarios from specs/022-online-stream-player/quickstart.md

---

## Dependencies & Execution Order

```text
Phase 1: Setup (T001-T003)
  └── Phase 2: Foundational (T004-T008)
        ├── Phase 3: User Story 1 (T009-T016) 🎯 MVP
        │     └── Phase 4: User Story 2 (T017-T023)
        │           ├── Phase 5: User Story 3 (T024-T028)
        │           ├── Phase 6: User Story 4 (T029-T032)
        │           └── Phase 8: User Story 6 (T036-T039)
        └── Phase 7: User Story 5 (T033-T035) [Network & Failover]
              └── Phase 9: Polish & Cross-Cutting (T040-T043)
```

---

## Parallel Execution Opportunities

- **Phase 1 & 2**: `T003` (reqwest client) and `T007` (i18n dictionaries) can run in parallel with type definitions (`T004`).
- **Phase 3 (US1)**: `T009` (JioSaavn), `T010` (SoundCloud), and `T011` (YouTube) parsers can be developed concurrently. On the frontend, `T013` (`OnlineSearchButton.tsx`) can be created in parallel with backend parsers.
- **Phase 4 (US2)**: Stream URL resolvers `T017`, `T018`, `T019` can be developed concurrently across providers.
- **Phase 5 & 6**: Download pipeline (`T024-T028`) and Lyrics sheet (`T029-T032`) touch disjoint files and can run in parallel once US2 streaming is complete.

---

## Implementation Strategy

1. **MVP First (Phase 1, 2, 3)**: Deliver working multi-source search triggered by the "Internet Search" button next to the search bar. Users can discover songs across providers.
2. **Streaming Increment (Phase 4)**: Enable instant audio playback and player controls with range seeking.
3. **Power Features (Phase 5, 6, 8)**: Add one-click downloading into Converter/Library, timed lyrics, and queue/playlist curation.
4. **Hardening & Quality (Phase 7, 9)**: Verify system proxy routing, instance failover, line-count ceilings, and full test matrix compliance.
