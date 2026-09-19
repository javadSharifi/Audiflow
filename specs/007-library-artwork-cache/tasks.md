# Tasks: Library Perceived Performance — Cache + Render Optimization

**Input**: Design documents from `/specs/007-library-artwork-cache/`

**Prerequisites**: plan.md (post-hoc, implementation preceded it), spec.md (root-cause audit + FRs)

**Tests**: Included per constitution Principle V — new `perfCaching.test.ts` + Rust regression test; full suites must stay green.

**Status**: ALL COMPLETE — implemented and verified in the same session (see spec.md → Verification).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependencies)
- **[Story]**: US1–US3 from spec.md (US1 instant tab switching, US2 instant cold start, US3 freshness-on-demand)

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `directories = "5"` (runtime) + `tempfile = "3"` (dev) to `src-tauri/Cargo.toml`
- [X] T002 [P] Add `playbackIdentityKey()` helper to `src/stores/musicPlayer/trackUtils.ts` and re-export from `src/stores/useMusicPlayerStore.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The derived `playingKey` store field every selector-based story depends on

- [X] T003 Add `playingKey: string` to `MusicPlayerState` in `src/stores/useMusicPlayerStore.ts` (init `""`)
- [X] T004 [US-ALL] Maintain `playingKey` at every `currentTrack` mutation: `playTrack`, `closePlayer`, `deleteTrack`, `deleteMultipleTracks` (store) + native track adoption in `src/stores/musicPlayer/audioEngine.ts` (`applyNativeStateToStore`)

**Checkpoint**: Foundation ready — user stories can proceed

---
## Phase 3: US1 — Instant switching between Songs / Albums / Liked (P1) 🎯 MVP

**Goal**: Tab switches render lists + covers instantly; no re-extraction, no re-render floods.

**Independent Test**: Load library, scroll so covers resolve, switch Songs→Albums→Liked→Songs — instant lists/covers, zero native artwork IPC repeats.

### Tests for US1 (per constitution V)

- [X] T005 [P] [US1] Create `src/stores/musicPlayer/__tests__/perfCaching.test.ts`: cached cover served across "tab switches" without repeat IPC; negative (null) result cached + persisted; `playbackIdentityKey` stable across rescan-equivalent objects

### Implementation for US1

- [X] T006 [P] [US1] `src/utils/artwork.ts`: LRU 100→500; bounded localStorage manifest `player-artwork-manifest-v1` (1500) with hydrate-on-init, write-on-resolve (incl. null), evict-sync
- [X] T007 [P] [US1] `src/components/music-player/TrackRow.tsx`: replace whole-`likedPaths`/`selectedTrackKeys`/`currentTrack` subscriptions with per-row boolean selectors + `playingKey` comparison
- [X] T008 [P] [US1] `src/components/music-player/AlbumCard.tsx`: `playingKey` + `isPlaying` selectors instead of `currentTrack` object
- [X] T009 [US1] `src/stores/musicPlayer/trackUtils.ts`: `computeAllAlbums` O(n) Map key-index replacing per-key linear `.find()`
- [X] T010 [US1] `src/components/music-player/AlbumDetailView.tsx`: virtualize track list via `useTrackVirtualizer` (was: render all rows)

**Checkpoint**: US1 functional — tab switching serves lists+covers from cache with per-row-granularity re-renders

---

## Phase 4: US2 — Instant cold start with background refresh (P1)

**Goal**: Cached covers survive restarts; store writes don't re-render seekbar subscribers multiple times per second.

**Independent Test**: Quit + relaunch → covers render without native extraction; during playback, `currentTime` subscribers update at most 1×/s.

### Tests for US2

- [X] T011 [P] [US2] `perfCaching.test.ts`: manifest persisted to localStorage after resolve; evicted on `evictArtworkCache`
- [X] T012 [P] [US2] `src-tauri/src/music_library/artwork.rs`: regression test `desktop_cache_dir_is_durable_and_not_os_temp`

### Implementation for US2

- [X] T013 [P] [US2] `src-tauri/src/music_library/artwork.rs`: desktop cache dir → OS cache dir via `directories::ProjectDirs`; lazy legacy temp-dir migration (rename→copy fallback)
- [X] T014 [US2] `src/stores/musicPlayer/audioEngine.ts`: whole-second `currentTime` quantization in all three writers (`timeupdate`, smooth ticker, native poll adoption)
- [X] T015 [US2] Align `src/stores/musicPlayer/__tests__/audioEngine.test.ts` seek-settle assertion to whole-second contract (`toBe(31)`)

**Checkpoint**: US2 functional — durable artwork across restarts; store-clock at display rate

---

## Phase 5: US3 — Cache freshness only when actually needed (P2)

**Goal**: Deleted tracks/changed covers never serve stale art; manifest eviction in sync.

**Independent Test**: Delete a track → its cover evicted from memory AND manifest; rescan replaces snapshot; unchanged files keep covers.

### Tests for US3

- [X] T016 [P] [US3] `perfCaching.test.ts`: eviction removes manifest entry so covers never resurrect after restart; `filterAndSortTracks` regression sanity

### Implementation for US3

- [X] T017 [US3] `src/utils/artwork.ts` `evictArtworkCache`: prune matching manifest entries (incl. alias prefixes) on track delete; full-clear removes the manifest key
## Phase 6: Polish & Cross-Cutting

- [X] T019 [P] `npx tsc --noEmit` clean; `pnpm check:types` → no `generated.ts` drift
- [X] T020 Full `pnpm test` → 283/283 (44 files); `cargo test --lib` → 113/113; `pnpm build` green
- [X] T021 Update shared memory: `PROJECT_GRAPH.md` (specs pointer), `.agents/references/frontend-infra.md` + `frontend-player.md` (artwork LRU-500/manifest, virtualized AlbumDetail, selector-convention TrackRow, perfCaching test), `BUGFIXES.md`, `DECISIONS.md` (playingKey + whole-second clock + durable artwork dir)
- [X] T022 [US2] `src-tauri/src/music_library/artwork.rs`: extract covers as 256×256 thumbnails (`-vf scale=...:crop=256:256`); >512KB legacy cache files treated as misses → lazily re-extracted downscaled; test `thumbnail_filter_produces_square_256`
- [X] T023 [US1] `src/utils/artwork.ts`: `scheduleArtworkPrefetch(tracks, count=50)` — idle-time cover warm-up (`requestIdleCallback`/timeout fallback), deduped per track ref, skips cached; wired into `scanLibrary` success path
- [X] T024 [US1] `perfCaching.test.ts`: prefetch tests (caps at N, prefetches only uncached remainder on rescan, no-op when everything cached)
- [X] T025 [US2] `src/utils/bootPerf.ts` (NEW) + marks wired through `App.tsx` boot flow (settings → permission → scan → splash-removed); `logBootSummary()` logs the phase breakdown at splash removal; `bootPerf.test.ts` (2 tests)
- [X] T026 [US1] Code splitting in `MusicPlayerView.tsx` (NowPlayingView, BoosterView) and `App.tsx` (PermissionGate, FirstRunFoldersGate) via `React.lazy` + `Suspense`; `MusicPlayerNav.test.tsx` assertions aligned to async chunk load (`findBy*`); initial chunk 594.8 → 555.8 kB
- [X] T027 [US2] `src-tauri/src/music_library/scan_memo.rs` (NEW): durable `scan_memo.v1.json` in OS cache dir; `reuse_if_unchanged(path,size,mtime)` / `remember` / `prune_missing` / atomic persist-on-dirty; stats recorded per scan; wired into `scan_music_library` + `scan_local_directory` + `delete_audio_track`; 2 unit tests
- [X] T028 [US2] NEW `scan_result_cache_stats` IPC command (Rust + registered + `generated.ts` regenerated, `check:types` includes it) + `scanResultCacheStats()` typed facade in `src/utils/tauri.ts`
- [X] T029 [US1] `src/utils/artwork.ts`: in-memory `manifestCache` mirror replacing debounced batching — synchronous, reliable writes & eviction without JSON.parse lag or test races; all 287 tests green
- [X] T030 [US1] `warmLibraryArtwork` in `src/stores/useMusicPlayerStore.ts`: idle prefetch covers for top Songs (40), top Album covers (20), and top Liked tracks (20) on cold boot & scan settle; single-pass O(N) `computeAllAlbums` without array cloning/sorting; `FirstRunFoldersGate` split cleanly via `bootPrefs.ts` (bundle: 551.1 kB)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phases 3–5 (US1→US2→US3 in priority order; T006–T009/T011–T013 parallelizable after Phase 2 — different files)
- Phase 6 after all stories
- Tests written alongside implementation (constitution V); all executed and green before task close
- Note: implementation was executed before this tasks.md was written (user-driven "بساز دیگه"); checkboxes reflect completed-and-verified work, not projection

## Validation Results (executed)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `pnpm test` | ✅ 287/287 (45 files) |
| `cargo test --lib` | ✅ 116/116 |
| `pnpm build` | ✅ built — initial chunk 551.1 kB (−43.6 kB) + 4 lazy chunks |
| `pnpm check:types` | ✅ commands & types generated and verified |

- [X] T018 [US3] Verify existing invalidation triggers remain wired: manual rescan replaces snapshot (`scanLibrary`), mutations persist (`persistCachedTracks`/`persistLikedPaths`/`persistCustomAlbums`) — no change needed, confirmed in review

**Checkpoint**: All stories independently functional

---

