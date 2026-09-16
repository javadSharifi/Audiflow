# Implementation Plan: Boost Slider Debounce

**Branch**: `004-boost-slider-debounce` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-boost-slider-debounce/spec.md`

## Summary

Dragging the boost slider/dial currently calls `applyGainPercent` synchronously on every tick (`useMusicPlayerStore.setVolumeGainPercent`, `useMusicPlayerStore.ts:584`), so each movement fires a full engine apply — on Android 2 IPCs plus a `BoostEngine` fan-out across all tracked sessions — producing the reported stutter/chop. The fix splits the write path: store state (UI number, arc, badge) and persistence stay immediate, while engine application goes through a new throttled glide helper (leading immediate apply, at most one intermediate apply per ~150 ms window carrying the latest value, guaranteed trailing flush of the final value on release). The honest single-path mapping from `003-volume-boost-accuracy` is untouched; only *when* values reach the engine changes.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) + React 19; existing Kotlin (`BoostEngine`) and Rust paths untouched

**Primary Dependencies**: Zustand 5 (`useMusicPlayerStore`), existing `applyGainPercent` (`audioEngine.ts:130`), existing `persistSavedBoosterGain` — no new dependencies

**Storage**: No new persisted values — `volumeGainPercent` persistence already exists; only the *timing* of persist calls changes (persist the settled value, not every tick)

**Testing**: Vitest (new `gainGlide.test.ts` with fake timers + extension of `audioEngine.test.ts` call-count tests); no Rust change, `cargo test` untouched; device listening checks per `quickstart.md`

**Target Platform**: Android first (reported device); desktop keeps identical behavior through the same helper (uniform glide, `setTargetAtTime` ramp preserved)

**Project Type**: Tauri 2 desktop + Android app (frontend-only change)

**Performance Goals**: Zero chop/stutter across full-range drags; heard level settles on the shown number ≤1 s after release (spec SC-002); intermediate glide applies at most ~1 per 150 ms; single taps apply with zero added latency

**Constraints**: No new IPC commands; no new user-facing strings (en/fa untouched); >200% modal gate and warning banner behavior unchanged; no source file over 300 lines (new small module `gainGlide.ts`, do NOT grow `audioEngine.ts` at 858 lines or `useMusicPlayerStore.ts`); offline-first; single active stream

**Scale/Scope**: 2 files changed + 1 new module + tests. `BoosterView.tsx` (slider/dial event sources) unchanged — all callers already funnel through `setVolumeGainPercent`. Seek-debounce (`seekDebounce.ts`) untouched; the two coalescers are independent (gain vs position).

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] I. Local-first — no network/account/telemetry. PASS.
- [x] II. Single-pass DSP + `alimiter` — file chains untouched. PASS.
- [x] III. Type-safe IPC — no new commands; call volume *decreases*. `check:types` unaffected. PASS.
- [x] IV. Atomic writes — file output untouched. PASS.
- [x] V. Test-first & CI — Vitest coverage for glide/settling required before merge; full matrix unchanged. PASS.
- [x] VI. Platform boundary — no permission/session change. PASS.
- [x] VII. Secrets — untouched. PASS.
- [x] VIII. i18n / SRP / 300-line ceiling — no new strings; glide logic in its own `gainGlide.ts` module, not appended to the 858-line `audioEngine.ts` or the store. PASS.

Post-Phase-1 re-check: confirmed — design adds no IPC, no strings, no persisted keys; persist timing change reuses the existing `persistSavedBoosterGain` key.

## Project Structure

### Documentation (this feature)

```text
specs/004-boost-slider-debounce/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── gain-glide.contract.md
└── tasks.md             # Phase 2 (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── stores/
│   ├── useMusicPlayerStore.ts        # setVolumeGainPercent: immediate set()+persist settled; engine via helper
│   └── musicPlayer/
│       ├── gainGlide.ts             # NEW: leading + throttled + trailing gain applier
│       └── __tests__/gainGlide.test.ts  # NEW: fake-timer glide/settle tests
```

**Structure Decision**: Same layered pattern as the 003 seek fix (`seekDebounce.ts` precedent): behavior helper in `musicPlayer/`, wiring in the store action, UI components untouched.

## Complexity Tracking

No constitution violations. No new abstractions beyond the single-purpose glide helper (mirrors the approved `seekDebounce.ts` pattern).

## Phase 0 — Research summary

See [research.md](research.md). Decisions: (D1) throttle-with-trailing-flush (not pure trailing debounce) per clarification A — glide needs intermediate applies; (D2) split immediate state/persist-settled vs throttled engine apply at the `setVolumeGainPercent` choke point; (D3) ~150 ms glide interval inside the 1 s settle budget; (D4) single taps unaffected (leading edge, zero latency); (D5) no change to `BoosterView`, `BoostEngine`, seek path, or file presets.

## Phase 1 — Design outputs

- [data-model.md](data-model.md) — Boost Drag / Settled Gain runtime contract
- [contracts/gain-glide.contract.md](contracts/gain-glide.contract.md) — timing + guarantee table
- [quickstart.md](quickstart.md) — drag validation guide for SC-001…SC-003
