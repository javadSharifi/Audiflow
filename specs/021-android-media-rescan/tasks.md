# Tasks: Android Media Rescan & Indexing Sync

**Feature**: Android Media Rescan & Indexing Sync
**Branch**: `021-android-media-rescan`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Organization & Execution Rules

- **Format**: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- **[P]**: Marks tasks that can be performed in parallel (different files, no blocking dependencies)
- **[Story]**: Maps tasks directly to User Stories ([US1] = P1 core detection MVP, [US2] = P2 progress feedback, [US3] = P3 metadata tolerance)
- **Constitution Compliance**: All files strictly <= 300 lines ceiling, zero untyped IPC, zero network dependencies.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify repository health and Android synchronization prerequisites.

- [X] T001 Verify baseline check passes: `pnpm check:types && pnpm test`
- [X] T002 Verify Android synchronization script `scripts/patch-android-project.sh` is executable and ready

**Checkpoint**: Clean workspace ready for feature implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core native file discovery and `MediaScannerConnection` sync infrastructure that all user stories rely on.

**⚠️ CRITICAL**: Must be completed before integrating into `MediaStoreManager`.

- [X] T003 Create `src-tauri/android/MediaScanSynchronizer.kt` with candidate audio file discovery across `Music`, `Download`, and mounted OTG storage paths (`.mp3`, `.m4a`, `.aac`, `.flac`, `.wav`, `.ogg`, `.opus`)
- [X] T004 Implement `syncStorageDirectories` in `src-tauri/android/MediaScanSynchronizer.kt` using `MediaScannerConnection.scanFile` with a `CountDownLatch` (timeout 2500ms) returning `MediaScanSyncResult`
- [X] T005 [P] Copy `MediaScanSynchronizer.kt` to `src-tauri/gen/android/app/src/main/java/com/audiflow/app/MediaScanSynchronizer.kt` via `scripts/patch-android-project.sh`

**Checkpoint**: Foundation ready — native file crawler and media scanner batch synchronizer compiled and ready.

---

## Phase 3: User Story 1 - Detect Newly Transferred Songs on Manual Rescan (Priority: P1) 🎯 MVP

**Goal**: When a user copies audio files (e.g., 100 songs from a USB flash drive or PC) and taps the reload button in the library, Audiflow actively scans device storage and triggers `MediaScannerConnection`, immediately reflecting all new tracks in the song list without requiring third-party apps or device reboots.

**Independent Test**: Copy audio files to the test device storage, invoke `queryMediaStoreMusic`, and verify that all copied files are scanned, indexed, and returned in the JSON payload.

### Implementation for User Story 1

- [X] T006 [US1] Integrate `MediaScanSynchronizer.syncStorageDirectories(context)` into `queryMediaStoreMusic` in `src-tauri/android/MediaStoreManager.kt` so media scan runs prior to querying `MediaStore`
- [X] T007 [US1] Sync updated `MediaStoreManager.kt` to `src-tauri/gen/android/app/src/main/java/com/audiflow/app/MediaStoreManager.kt`
- [X] T008 [P] [US1] Add unit test in `src-tauri/gen/android/app/src/test/java/com/audiflow/app/MediaScanSynchronizerTest.kt` verifying candidate file discovery and audio extension matching

**Checkpoint**: User Story 1 complete — newly added files on storage are indexed and displayed after reload.

---

## Phase 4: User Story 2 - Rescan Progress & Feedback (Priority: P2)

**Goal**: Tapping the reload button provides continuous visual feedback (spinning icon) during the background scan, preserves UI responsiveness, and never interrupts ongoing audio playback.

**Independent Test**: Start playback of an audio track, trigger reload in the music player, and verify that playback continues without interruption while the loading state spins and then clears.

### Implementation for User Story 2

- [X] T009 [US2] Verify `scanLibrary` in `src/stores/musicPlayer/slices/librarySlice.ts` maintains `loading: true` state while `api.scanAudioFiles` awaits the native media sync and query
- [X] T010 [US2] Verify `TrackListView.tsx` in `src/components/music-player/TrackListView.tsx` animates the `RotateCw` icon during the scan and updates the track count header immediately upon completion
- [X] T011 [P] [US2] Add test in `src/stores/musicPlayer/__tests__/slices.test.ts` verifying `scanLibrary` state transitions (`loading` true -> false, `hasScanned` true) and track replacement without cache flicker

**Checkpoint**: User Story 2 complete — smooth UX with clear progress feedback and zero audio playback interruption.

---

## Phase 5: User Story 3 - Tolerant Recognition of Audio Files (Priority: P3)

**Goal**: Audio files copied from diverse platforms that lack full ID3 tags, or where OEM ROMs leave `IS_MUSIC == 0`, are reliably recognized and included in the library list by display name.

**Independent Test**: Place an audio file with empty ID3 tags or `IS_MUSIC = 0` in `Download/` or external storage and verify it appears in the song list with its file name.

### Implementation for User Story 3

- [X] T012 [US3] Update query selection in `src-tauri/android/MediaStoreManager.kt` to `(${MediaStore.Audio.Media.IS_MUSIC} != 0 OR ${MediaStore.Audio.Media.MIME_TYPE} LIKE 'audio/%') AND ${MediaStore.Audio.Media.SIZE} > 0`
- [X] T013 [US3] Sync updated query selection to `src-tauri/gen/android/app/src/main/java/com/audiflow/app/MediaStoreManager.kt`
- [X] T014 [US3] Verify fallback naming in `src-tauri/android/MediaStoreManager.kt` cleanly uses `DISPLAY_NAME` when `TITLE` is blank or untagged

**Checkpoint**: User Story 3 complete — resilient recognition of untagged and OEM-unclassified audio files.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verification, documentation sync, and final quality checks.

- [X] T015 Run quickstart verification scenarios per `specs/021-android-media-rescan/quickstart.md`
- [X] T016 Run full repository verification suite: `pnpm check:types && pnpm test && cargo test --manifest-path src-tauri/Cargo.toml`
- [X] T017 Update `PROJECT_GRAPH.md` with new `MediaScanSynchronizer.kt` component and sync commit status

---

## Dependencies & Execution Order

### Phase Dependencies
1. **Phase 1 (Setup)**: Can start immediately.
2. **Phase 2 (Foundational)**: Depends on Phase 1; blocks User Stories.
3. **Phase 3 (User Story 1 - MVP)**: Depends on Phase 2; enables independent testing of core file detection.
4. **Phase 4 (User Story 2)**: Depends on Phase 3 completion.
5. **Phase 5 (User Story 3)**: Can proceed alongside Phase 4 or sequentially.
6. **Phase 6 (Polish)**: Depends on all user stories being implemented.

### Parallel Opportunities
- T003 & T008: Unit test scaffolding can be written alongside `MediaScanSynchronizer.kt`.
- T011: Frontend store test can be executed in parallel with backend changes.
- T012 & T014: Selection and fallback naming updates occur in the same query block.

---

## Implementation Strategy: MVP First

1. **Step 1**: Complete Foundational Phase (`MediaScanSynchronizer.kt`).
2. **Step 2**: Integrate into `MediaStoreManager.kt` (User Story 1).
3. **Step 3**: Validate MVP: Transferred audio files appear immediately upon tapping reload.
4. **Step 4**: Apply UI progress and query tolerance refinements (User Stories 2 & 3).
5. **Step 5**: Run full CI verification gate.
