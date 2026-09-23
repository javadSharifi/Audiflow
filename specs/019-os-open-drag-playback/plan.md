# Implementation Plan: OS "Open With" Context Menu & Drag-and-Drop Audio Playback

**Branch**: `019-os-open-drag-playback` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/019-os-open-drag-playback/spec.md`

## Summary

Enable seamless desktop audio playback via native drag-and-drop and OS "Open with" context menus across macOS, Windows, and Linux.
1. Add a backend path resolution command (`resolve_audio_paths`) that recursively extracts supported audio files from single files, multiple files, and directories in natural alphanumeric order.
2. Introduce a context-aware drag-and-drop hook (`useAppDragDrop`) and drop visual overlay (`PlayerDropOverlay`): dropping onto the Music Player populates the playback queue and immediately plays track 1 with auto-advance, while dropping onto the Converter preserves existing file conversion ingestion.
3. Update `src/utils/openWith.ts` to route opened files/folders to `resolve_audio_paths` and initiate immediate Music Player playback.
4. Ensure OS file associations and desktop entry specifications (`%U` and audio MIME types) are aligned for macOS, Windows, and Linux.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) on React 19; Rust edition 2021 (MSRV 1.77)

**Primary Dependencies**: Tauri v2 (`@tauri-apps/api/webview`, `@tauri-apps/plugin-single-instance`), Zustand ^5 (slice pattern), Tailwind CSS v4, Lucide React (icons), Specta / tauri-specta (typed IPC)

**Storage**: In-memory playback queue (`useMusicPlayerStore`), `ScanResultMemo` on disk (`scan_memo.v1.json`) for fast path metadata parsing

**Testing**: Vitest + Testing Library for frontend hooks and components; `cargo test` for Rust audio path resolution logic

**Target Platform**: macOS, Windows, and Linux desktop environments (Android unaffected)

**Project Type**: Desktop application (Tauri v2 shell + React frontend)

**Performance Goals**:
- SC-001: Drop-to-play start latency under 1 second for 1–50 audio files
- SC-002: Folder drop traversal and queue load under 2 seconds for ≤ 200 songs
- SC-003: 100% sequential auto-advance through queued tracks

**Constraints**:
- Context separation: Dropping on Converter must NOT trigger player playback; dropping on Player must NOT trigger converter (FR-009)
- Single active audio stream (Constitution Principle VI)
- Zero hardcoded strings (Constitution Principle VIII — i18n English and Persian)
- Strict 300-line file size ceiling: `App.tsx` (284 lines) must delegate drag-drop logic to `useAppDragDrop.ts` to stay below 300 lines

**Scale/Scope**:
- 1 new Rust command (`resolve_audio_paths`) in `src-tauri/src/music_library/` + `commands/mod.rs`
- 1 new hook (`src/hooks/useAppDragDrop.ts`)
- 1 new component (`src/components/music-player/PlayerDropOverlay.tsx`)
- Updates to `src/utils/openWith.ts`, `src/utils/tauri.ts`, `src/App.tsx`, and `packaging/arch/PKGBUILD`
- i18n keys for English and Persian

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First Privacy | ✅ PASS | 100% local filesystem traversal and playback. Zero network requests, zero telemetry. |
| II. Single-Pass DSP Integrity | ✅ N/A | No DSP filtergraph modifications; playback and path resolution only. |
| III. Type-Safe Rust↔TypeScript IPC | ✅ PASS | `resolve_audio_paths` registered in `specta_builder()`; typed facade in `src/utils/tauri.ts`; `pnpm generate:types && pnpm check:types` enforced. Direct untyped `invoke()` prohibited. |
| IV. Atomic File Operations | ✅ N/A | Read-only file resolution and playback. |
| V. Test-First & CI Gate | ✅ PLANNED | Unit tests for `resolve_audio_paths` in Rust; Vitest tests for `useAppDragDrop` and `openWith` handling. Full CI matrix compliance. |
| VI. Platform Boundary & Perms | ✅ PASS | Only one audio stream plays at a time; Android native layer unaffected. |
| VII. Secrets | ✅ N/A | No credentials or sensitive data involved. |
| VIII. i18n / SRP / 300-line ceiling | ✅ PASS | All strings localized in `en.ts` and `fa.ts`. SRP maintained by isolating drop routing to `useAppDragDrop` and overlay UI to `PlayerDropOverlay`. `App.tsx` refactored to replace 10 lines with 4 lines, keeping it well below 290 lines. |

**GATE RESULT: PASS** — All constitutional principles satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/019-os-open-drag-playback/
├── plan.md              # This file
├── research.md          # Phase 0 output — architectural decisions & alternatives
├── data-model.md        # Phase 1 output — entities & state machine transitions
├── quickstart.md        # Phase 1 output — end-to-end verification scenarios
├── contracts/
│   └── ipc-commands.md  # Phase 1 output — resolve_audio_paths IPC contract
├── checklists/
│   └── requirements.md  # 16/16 pass (from /speckit.specify)
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code Layout

```text
src-tauri/
├── src/
│   ├── commands/mod.rs          # MODIFIED: + resolve_audio_paths command handler
│   ├── lib.rs                   # MODIFIED: register resolve_audio_paths in specta_builder
│   └── music_library/
│       ├── mod.rs               # MODIFIED: + resolve_paths(paths) logic (files + recursive dirs)
│       └── scanner.rs           # UNCHANGED (scan_local_directory & mime helpers reused)

src/
├── hooks/
│   ├── useAppDragDrop.ts        # NEW: context-aware drag-and-drop hook (Tauri v2 DragDropEvent)
│   └── useNativeDragDrop.ts     # UNCHANGED or enhanced for hover states
├── components/music-player/
│   └── PlayerDropOverlay.tsx    # NEW: elegant drop overlay visual indicator with backdrop blur
├── utils/
│   ├── openWith.ts              # MODIFIED: use resolveAudioPaths to support folders & multi-files
│   └── tauri.ts                 # MODIFIED: + typed resolveAudioPaths helper
├── App.tsx                      # MODIFIED: adopt useAppDragDrop and render PlayerDropOverlay (replaces ~10 lines with ~5 lines, keeps file < 290 lines)
├── i18n/
│   ├── en.ts                    # MODIFIED: + dropToPlay, playingQueuedTracks, noAudioFound keys
│   └── fa.ts                    # MODIFIED: + Persian translations with RTL fidelity
└── types/generated.ts           # GENERATED: via pnpm generate:types

packaging/
└── arch/
    └── PKGBUILD                 # MODIFIED: include %U in Exec and audio MimeTypes in desktop entry
```

**Structure Decision**: Preserves clean separation between backend DSP/library scanning and frontend React presentation. Drag-and-drop logic is decoupled into a dedicated hook and component, avoiding bloat in `App.tsx` and honoring the 300-line ceiling.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | All new and modified files remain strictly under the 300-line ceiling and follow existing architectural patterns. | N/A |
