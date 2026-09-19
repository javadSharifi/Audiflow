# Implementation Plan: Converter Modal Z-Index and Trim Editor Playback Fixes

**Branch**: `010-fix-converter-trim-modal` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-fix-converter-trim-modal/spec.md`

## Summary

Resolve UI layering and media playback defects in the Audio Converter:
1. Elevate `MobileEditModal` stacking context from `z-50` to `z-[80]` so edit sheets open completely above the floating bottom navigation dock (`z-[55]`).
2. Fix asynchronous seek boundary race condition in `TrimEditor.tsx` where tapping snippet preview at the end of a track immediately paused playback due to premature termination checks during active seeking.
3. Migrate quick preview duration from 10s to 5s ("First 5s" / "Last 5s") with minimum duration threshold lowered to 5.05s.
4. Remove the top heading text in `TrimEditor.tsx` and situate a compact guide label ("برای شنیدن روی بخش نارنجی بزن" / "Tap the orange section to listen") directly beneath the waveform canvas.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`), React 19.

**Primary Dependencies**: Tailwind CSS v4, Lucide React, HTML5 Audio API via Tauri asset protocol (`convertFileSrc`).

**Storage**: In-memory React state (`useState`, `useRef`) and Zustand (`useAppStore`). No persistent disk schema changes.

**Testing**: Vitest + @testing-library/react for component and unit testing (`pnpm test`).

**Target Platform**: Desktop (macOS, Windows, Linux) and Android (Tauri v2).

**Project Type**: Desktop/Mobile Client (Tauri 2 + React 19 SPA).

**Performance Goals**: Instant modal opening (< 16ms render frame), immediate preview audio response (< 200ms seek latency).

**Constraints**: Local-first (offline), zero hardcoded text strings (strict i18n via `translate(lang, key)`), file size ceiling compliance.

**Scale/Scope**: Scope is isolated to `FileList.tsx` (or extracted `MobileEditModal.tsx`), `TrimEditor.tsx`, and localization dictionaries (`en.ts`, `fa.ts`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| **I. Privacy & Local-First** | 100% offline, zero network requests | **PASS** | Converter and trim preview operate purely offline. |
| **II. Single-Pass DSP** | Unified `-filter_complex`, no multi-pass | **PASS** | No backend DSP changes; trim times passed to existing pipeline. |
| **III. Type-Safe IPC** | Specta-generated types, no untyped IPC | **PASS** | No IPC commands added or changed. |
| **IV. Atomic Operations** | Temp files, collision avoidance | **PASS** | File processing contracts untouched. |
| **V. Test-First & CI Gates** | Unit/component tests pass | **PASS** | Vitest coverage for modal z-index, preview calculation, and guide text. |
| **VI. Platform Boundaries** | No RECORD_AUDIO, single audio stream | **PASS** | Audio preview uses standard HTMLAudioElement without recording. |
| **VII. Secrets Management** | Keychain only, no plaintext | **PASS** | No secrets touched. |
| **VIII. Code Hygiene & i18n** | No hardcoded text; files < 300 LOC | **PASS** | All copy defined in `en.ts` / `fa.ts`. `MobileEditModal` extracted to modular file to reduce `FileList.tsx`. |

## Project Structure

### Documentation (this feature)

```text
specs/010-fix-converter-trim-modal/
├── spec.md              # Feature specification
├── plan.md              # This implementation plan (/speckit-plan)
├── research.md          # Phase 0 research findings
├── data-model.md        # Phase 1 data entities and state machine
├── contracts/           # Phase 1 interface contracts
│   └── modal-and-playback.contract.md
├── quickstart.md        # Phase 1 verification and test guide
└── checklists/
    └── requirements.md  # Requirements quality checklist
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── FileList.tsx                    # Updated to import MobileEditModal
│   ├── MobileEditModal.tsx             # Extracted modal with z-[80] stacking context
│   ├── TrimEditor.tsx                  # 5s preview, seek race condition fix, layout cleanup
│   └── __tests__/
│       ├── FileList.test.tsx           # Test mobile edit modal z-index
│       └── TrimEditor.test.tsx         # Test 5s snippet controls and waveform guide
├── i18n/
│   ├── en.ts                           # trimCutFirst5, trimCutLast5, trimWaveformHint
│   └── fa.ts                           # trimCutFirst5, trimCutLast5, trimWaveformHint
```

**Structure Decision**:
Extract `MobileEditModal` into `src/components/MobileEditModal.tsx`. This avoids bloating `FileList.tsx` (which is already over 400 lines) and satisfies Principle VIII (Single Responsibility and reducing oversized files).

## Complexity Tracking

> No constitution violations. No additional complexity required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
