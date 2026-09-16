# Quickstart: Validate Boost Slider Debounce

**Feature**: `004-boost-slider-debounce` | **Date**: 2026-09-16

## Prerequisites

- Android dev build with 003 + 004 changes; one quiet and one loud track.
- `pnpm test src/stores/musicPlayer/__tests__/gainGlide.test.ts` runnable.

## 1. Unit validation (no device)

```bash
pnpm test src/stores/musicPlayer/__tests__/gainGlide.test.ts
pnpm test src/stores/musicPlayer/__tests__/audioEngine.test.ts
```

Expected: burst of 60 requests in 1 s → leading + ~6 throttled applies + 1 trailing apply of the final value; single request → synchronous apply; cancel drops pending; audioEngine call-count tests still green (engine function itself unchanged).

## 2. Drag smoothness (SC-001) — Android

Play a track, drag the slider slowly then quickly across 100→400% and back (≥20 drags). Expect: loudness glides with the finger, zero chop/stutter/crackle at any point, on quiet and loud tracks.

## 3. Settle accuracy (SC-002) — Android

Release at 200/300/400%. Expect: heard level matches the shown number within 1 s every time; rapid wiggles never leave audio stuck, silent, or at an intermediate level.

## 4. UI liveness (SC-003) — Android

Watch the dial number mid-drag. Expect: updates on every movement with no lag while audio stays smooth.

## 5. Gate regression

Drag past 200% without confirming. Expect: existing modal caps at 200% exactly as before; after confirm, gliding continues to the target.

## 6. Gates before merge

`pnpm test`, `pnpm build` (tsc), `cargo test` (untouched, sanity). No i18n changes expected.
