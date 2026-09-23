# Implementation Plan: macOS Add-Folder Button

**Branch**: `018-folder-btn` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/018-folder-btn/spec.md`

## Summary

Add a platform-conditional "add folder" button to the library track-list search/sort/rescan row, visible only on macOS. Activating it opens the native directory picker (`pickDirectories`), adds the picked folders to the existing persisted custom-folders list, triggers one library scan, and reports the per-pick outcome (songs added / no music found / already tracked / cancelled = silent) through the existing toast system. No Rust or IPC changes — the entire feature reuses the existing frontend folder-picking, persistence, and scanning mechanisms.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) on React 19; Rust edition 2021 backend is NOT touched by this feature

**Primary Dependencies**: Tauri v2 (`@tauri-apps/plugin-dialog` for the native picker), Zustand ^5 (slice pattern), Tailwind CSS v4, lucide-react (icons)

**Storage**: `localStorage` via existing `persistCustomFolders` / `persistCachedTracks` (`src/stores/musicPlayer/persistence.ts`) — no new persisted value

**Testing**: Vitest + Testing Library (component/unit); `cargo test` unaffected (no Rust change)

**Target Platform**: macOS desktop (Tauri); Android/Windows/Linux builds must render unchanged (button absent)

**Project Type**: Desktop-app (Tauri shell + React frontend)

**Performance Goals**: SC-001 — pick-to-tracks-visible under 1 minute for ≤200 songs (satisfied by existing single-pass scan; the pick flow adds one batched scan, not per-folder scans)

**Constraints**:macOS protected-folder discipline — access grants come only from the user's own picker action (FR-009); scan-in-progress guard (`loading`) disables the button; fail-soft on picker errors (existing behavior)

**Scale/Scope**: 2 new frontend files, 1 small store action, ~5 i18n keys × 2 locales, component tests. No backend/IPC/schema/Rust changes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First Privacy | ✅ PASS | Native picker + local scan; zero network, zero accounts. |
| II. Single-Pass DSP Integrity | ✅ N/A | No DSP/ffmpeg touch. |
| III. Type-Safe Rust↔TypeScript IPC | ✅ PASS | No new `invoke()`; reuses typed `scanAudioFiles` helper in `src/utils/tauri.ts`; `generated.ts` unchanged so `generate:types`/`check:types` unaffected. |
| IV. Atomic File Operations | ✅ N/A | No file writes. |
| V. Test-First & CI Gate | ✅ PLANNED | New Vitest component tests (platform visibility, pick outcomes, cancel no-op) required before merge; CI matrix unaffected. |
| VI. Platform Boundary & Perms | ✅ PASS | Android untouched — button rendered only when `isMacOS()`; no new Android permissions; per-picker-action grant only (FR-009, SC-002). |
| VII. Secrets | ✅ N/A | No credentials. |
| VIII. i18n / SRP / 300-line ceiling | ⚠️ MANAGED | All new strings via `translate()` + keys in `en.ts` AND `fa.ts` (RTL preserved). SRP: pick flow isolated in a dedicated hook; button isolated in its own component. **File ceiling**: `TrackListView.tsx` is at 294/300 — the button + flow are extracted to new files so it grows by ~3 lines (297). `useMusicPlayerStore.ts` is already 966 lines (pre-existing violation) — this feature adds one small batched action there; full store split is out of scope (Minimal Change Principle, tracked in Complexity Tracking). |

**GATE RESULT: PASS** — no blocking violations.

## Project Structure

### Documentation (this feature)

```text
specs/018-folder-btn/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions & alternatives
├── data-model.md        # Phase 1 output — Pick Outcome & state entities
├── quickstart.md        # Phase 1 output — manual macOS verification
├── checklists/
│   └── requirements.md  # 16/16 pass (from /speckit.specify)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

No `contracts/` directory: this feature introduces no new IPC contracts (Frontend-only; Rust command surface unchanged).

### Source Code (repository root)

```text
src/
├── components/music-player/
│   ├── TrackListView.tsx            # MODIFIED: +3 lines — render <AddFolderButton /> in the search/sort/rescan row (lines 159–193)
│   ├── AddFolderButton.tsx          # NEW: platform-conditional button (null on non-macOS), disabled while scanning
│   ├── useAddFolderPick.ts          # NEW: pick → dedupe → batch-persist → single scan → outcome classification → toast
│   ├── FirstRunFoldersGate.tsx      # UNCHANGED (onboarding picking; reuse pattern reference)
│   └── __tests__/
│       └── AddFolderButton.test.tsx # NEW: visibility, disable, outcomes, cancel no-op
├── stores/
│   ├── useMusicPlayerStore.ts       # MODIFIED: + addCustomFolders(paths) batched action (no N+1 scans)
│   └── musicPlayer/persistence.ts   # UNCHANGED (persistCustomFolders reused)
├── utils/
│   ├── dialog.ts                    # UNCHANGED (pickDirectories reused)
│   └── platform.ts                  # UNCHANGED (isMacOS reused)
└── i18n/
    ├── en.ts                        # MODIFIED: + addFolder* keys
    └── fa.ts                        # MODIFIED: + addFolder* keys (Persian, RTL)
```

**Structure Decision**: Frontend-only change inside the existing `src/components/music-player/` + `src/stores/` layout. The feature adds no new directories and no backend modules, matching the existing component/hook/store-slice seams.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `useMusicPlayerStore.ts` grows (966 → ~975 lines) against the 300-line ceiling | One batched `addCustomFolders(paths)` action must live beside the existing `addCustomFolder`/`removeCustomFolder` actions it mirrors | Refactoring the store into slices now would touch unrelated playback/album/like logic (Minimal Change Principle); the split is a separate pre-existing concern, noted for a future task. Sticking with per-call `addCustomFolder` was rejected because it persists+scans per folder (N+1 disk walks) and breaks SC-001 on multi-pick. |
| `TrackListView.ts` already near ceiling (294/300) | Feature's UI entry point is the existing search/sort/rescan row | Inlining button + flow would push it over 300 lines immediately; extraction into `AddFolderButton.tsx` + `useAddFolderPick.ts` keeps it at ~297 and improves SRP. |
