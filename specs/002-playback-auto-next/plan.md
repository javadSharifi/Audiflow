# Implementation Plan: Playback Auto-Next Reliability

**Branch**: `002-playback-auto-next` | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-playback-auto-next/spec.md`

## Summary

Playback must advance to the next song every time a song ends. Investigation showed desktop auto-advance depends on a single end-of-track signal with no fallback, failures leave stuck silent/"playing" states, and the end of a playlist leaves a stale indicator. Approach: add redundant end detection, skip-to-next-playable on any start failure, explicit stopped state at queue end, and a single-fire guard — all covered by new Vitest tests. No IPC, persistence, or Android-permission changes.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) + React 19 on desktop; Kotlin/Android native layer (Media3) verified only

**Primary Dependencies**: HTMLAudio element, Zustand ^5 (slice pattern), Vitest + Testing Library

**Storage**: N/A (queue and playback mode are in-memory only; no new persisted values)

**Testing**: Vitest (`pnpm test`); TypeScript build (`pnpm build`); existing suites `audioEngine.test.ts`, `AudioPlayback.test.tsx` extended

**Target Platform**: Tauri v2 desktop (fix); Android native queue (verify single-track edge only, no redesign)

**Project Type**: desktop-app + mobile-app (Tauri + Android)

**Performance Goals**: Track transition with no perceptible stall; failure skip resolves without user wait

**Constraints**: Offline/local-first (no network); single audio stream invariant; no new permissions; no file over 300 lines; no hardcoded UI strings

**Scale/Scope**: Single-user local music library; queue sizes from 1 to thousands of tracks

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **I. Local-first**: No network calls added; all logic is local event/state handling.
- [x] **II. Single-pass DSP**: Untouched (no conversion/filtergraph changes).
- [x] **III. Typed IPC**: No Rust command/struct changes → no `generate:types` run required.
- [x] **IV. Atomic file ops**: Untouched (no file output).
- [x] **V. Test-first (NON-NEGOTIABLE)**: New advance/skip/stop logic ships with Vitest unit coverage; `pnpm test` + `pnpm build` must pass.
- [x] **VI. Platform boundary**: No permission changes; player/converter single-stream mutual pause preserved; Android change is verification-only.
- [x] **VII. Secrets**: Untouched.
- [x] **VIII. Hygiene (NON-NEGOTIABLE)**: Any new user-facing string via `translate()` + keys in all locales; new logic in a focused new module (no growth of already-large files past 300 lines); store/component/IPC separation kept.
- [x] **State isolation**: Player-store-only change; `useAppStore` untouched.

Post-design re-check: no data-model or contract artifacts needed (in-memory-only behavior change, no external interfaces) — no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-playback-auto-next/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

(No `data-model.md`: no entities created or persisted — queue/position/mode stay in-memory. No `contracts/`: no external interfaces change.)

### Source Code (repository root)

```text
src/
├── services/audio/        # desktop playback engine (end detection, skip logic)
├── stores/                # music player queue/mode state (advance, stop, single-fire guard)
└── components/            # now-playing indicator (accurate stopped state)

tests/
├── unit/                  # engine + store transition tests (extend audioEngine.test.ts etc.)
└── component/             # AudioPlayback state tests (extend AudioPlayback.test.tsx)

android/                   # native queue single-track edge verification only
```

**Structure Decision**: Single-project layout with `src/` + `android/`; fix lives in the existing audio service and player store, verified by unit/component tests.

## Complexity Tracking

> No constitution violations — table not required.
