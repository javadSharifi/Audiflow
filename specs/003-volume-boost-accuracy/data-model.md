# Data Model: Volume Boost Accuracy & Seek Clarity

**Feature**: `003-volume-boost-accuracy` | **Date**: 2026-09-16

No new stored data. All three spec entities are behavioral (runtime state that already exists); this model pins their fields, transitions, and validation so plan/tasks/tests share one vocabulary.

## Boost Level

- Fields: `volumeGainPercent` (integer, 100–400, step 5 — existing store field, unchanged); derived `gainDb = boosterDbForPercent(p)` (display + Android target); derived `gainMb = round(gainDb × 100)` (single IPC payload).
- Source of truth: `useMusicPlayerStore.volumeGainPercent`; Android mirror: `BoostEngine.targetGainMb` (SharedPreferences-backed, existing).
- Validation: setting above 200% requires the existing high-boost confirmation (unchanged); values clamp to [100, 400] in UI, [0, 400] at `applyGainPercent` entry; monotonicity — `p1 > p2 ⟹ appliedGain(p1) > appliedGain(p2)` (new unit test).
- Transitions: 100 (off/limiter-neutral) ↔ 101–400 (boosted). Preserved across seek / track change / pause-resume (FR-003, existing behavior + regression test).

## Playback Session

- Fields: `currentTrack`, `currentTime`, `duration`, `isPlaying`, `volumeGainPercent` (existing store shape, unchanged).
- Invariant: a seek never mutates `volumeGainPercent`; a boost change never mutates `currentTime`/`currentTrack`.

## Seek Operation (debounced)

- Fields: `requestedAt` (ms), `targetSecs`, `appliedTargetSecs`, `settleUntil = appliedAt + 1500 ms` (existing `SEEK_SETTLE_MS`, unchanged).
- Lifecycle: `request(target)` → if no pending window: apply immediately + open 1000 ms window; else: replace pending target → on window lapse: apply final pending target once → native settle guard runs → store adopts settled position.
- Validation: at most 1 native `seekTo` per 1000 ms window during continuous scrub; final applied target equals the last requested target (unit test with fake timers); single isolated seek applies synchronously with zero added latency.
- Edge rules: seek past duration clamps to duration (existing); short tracks (< 5 s) bypass debounce (single seek, nothing to coalesce); toggle-boost-mid-seek keeps the pending seek target and applies current boost after landing (FR-003 preserved).
