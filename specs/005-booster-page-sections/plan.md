# Implementation Plan: Booster Page Four Sections

**Branch**: `005-booster-page-sections` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-booster-page-sections/spec.md`

## Summary

Regroup the existing `FileBoosterPage` (currently one 218-line single column) into four visually distinct, numbered sections — (1) upload + capability explainer below the upload card, (2) configs (preset/gain, format, A/B preview, export trigger), (3) progress (idle hint → live percent/speed → plain-language error), (4) result (save location, size + size delta vs. original, open/play/share/copy-path actions, latest result only) — reusing the existing `useFileBooster` hook, Zustand store, and IPC commands with zero backend/DSP changes.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict: `strict`, `noUnusedLocals`, `noUnusedParameters`), React 19, Rust untouched

**Primary Dependencies**: Zustand ^5 (slice pattern), Tailwind CSS v4, Tauri 2; existing helpers `formatBytes`/`formatDuration` (`src/utils/format.ts`), `translate` (`src/i18n`), `openPath` (`@tauri-apps/plugin-opener`), `shareAudioTrack` (`src/utils/tauri.ts`)

**Storage**: N/A — no new persisted values; all section state already lives in `useFileBoosterStore` (ephemeral UI state)

**Testing**: Vitest + Testing Library (frontend); existing suites `PresetSelector.test.tsx`, `useFileBoosterStore.test.ts` remain green; new component tests for section components

**Target Platform**: Existing desktop + Android shells; Android keeps `openPath`-guard (`isAndroid()`) and native share path already used by the player

**Project Type**: Desktop-app (Tauri 2 + React SPA)

**Performance Goals**: No new targets — export pipeline and preview debounce unchanged; page regrouping must not add IPC calls on render (size lookup for result reuses `statMediaPaths`, one call per completed export)

**Constraints**: Offline-first (no network); Constitution VIII — no hardcoded strings (new keys in `en`+`fa`), no file >300 lines, single-responsibility section components; RTL correctness for Persian; single active audio stream preserved via existing `useFileBooster` audio element

**Scale/Scope**: One page (`FileBoosterPage.tsx` + ~4 new section components + tests + i18n keys); no backend, IPC, or store-shape changes

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] I. Local-first — no network calls added; share uses OS-native mechanisms only.
- [x] II. Single-pass DSP — untouched; presets, gain, pipeline, `alimiter` unchanged.
- [x] III. IPC contract — no command/signature changes; no `generate:types` needed; components keep reading the store/hook, never raw `invoke`.
- [x] IV. Atomic file ops — unchanged backend behavior; result section only *displays* outputs.
- [x] V. Test-first — new section components get Vitest coverage; existing suites must pass; CI matrix unchanged.
- [x] VI. Platform boundary — no permission changes; Android scoped-storage/share goes through existing `shareAudioTrack` bridge; `RECORD_AUDIO` untouched.
- [x] VII. Secrets — none involved.
- [x] VIII. i18n/SRP/file-size — new user-facing strings get `en`+`fa` keys via `translate()`; page split into ≤300-line section components along responsibility boundaries.

Post-design re-check: no violations introduced (see research.md R-5 for file-split decision). No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/005-booster-page-sections/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── sections-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── features/sound-booster/file-booster/
│   ├── FileBoosterPage.tsx            # thin 4-section composition shell
│   ├── sections/
│   │   ├── UploadSection.tsx          # NEW: upload card + explainer + file summary
│   │   ├── ConfigsSection.tsx         # NEW: preset/gain + format + ABPreview + export btn
│   │   ├── ProgressSection.tsx        # NEW: idle / live progress / error states
│   │   └── ResultSection.tsx          # NEW: save location, size delta, open/play/share/copy
│   ├── __tests__/
│   │   └── BoosterSections.test.tsx   # NEW: section gating + ordering + empty states
│   ├── PresetSelector.tsx             # reused, unchanged
│   ├── GainSlider.tsx                 # reused, unchanged
│   └── ABPreview.tsx                  # reused, unchanged
├── i18n/
│   ├── en.ts                          # + section titles/explainers/hints/result strings
│   └── fa.ts                          # + matching Persian keys (RTL verified)
└── utils/format.ts                    # reused formatBytes/formatDuration
```

**Structure Decision**: Single-project layout; all changes under the existing `src/features/sound-booster/file-booster/` domain plus i18n dictionaries. No new top-level directories, no backend changes.

## Complexity Tracking

> No constitution violations — table not required.
