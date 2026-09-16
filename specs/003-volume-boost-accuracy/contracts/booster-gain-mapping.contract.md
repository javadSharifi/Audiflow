# Contract: Booster Gain Mapping (single path)

**Feature**: `003-volume-boost-accuracy` | **Date**: 2026-09-16

No new IPC. This contract freezes the single writer path and the mapping table so frontend, Android, and tests agree.

## Call order (Android, boost change to `p` percent)

1. If `p <= 100`: `androidPlayerSetBoosterGainMb(0)` then `androidPlayerSetVolume(p/100)` (existing low path, unchanged).
2. If `p > 100`: `androidPlayerSetVolume(1)` then **exactly one** of the gain calls — `androidPlayerSetBoosterGain(boosterDbForPercent(p))` — and the parallel `androidPlayerSetBoosterGainMb(boosterMbForPercent(p))` call is **deleted** (`boosterMbForPercent` becomes dead code to remove or leave unused-but-untested; prefer removal in the same edit).
3. Never re-assert gain during the seek-settle window (`SEEK_SETTLE_MS`); `BoostEngine.reAssert()` stays volume-key/resume-triggered only.

## Mapping table (source: `boosterDbForPercent`, `20·log10(p/100)`)

| UI label | gainDb (target) | gainMb (IPC payload) |
|----------|-----------------|----------------------|
| 100%     | 0.0 dB (off)    | 0                    |
| 150%     | +3.5 dB         | 352                  |
| 200%     | +6.0 dB         | 602                  |
| 250%     | +8.0 dB         | 796                  |
| 300%     | +9.5 dB         | 954                  |
| 350%     | +10.9 dB        | 1088                 |
| 400%     | +12.0 dB        | 1204                 |

(Millibel values are `round(db × 100)`; unit test asserts monotonic increase and the 200%/400% anchors.)

## Desktop (unchanged, no-regression)

`GainNode.gain.value = p/100` linear amplitude; changes via `setTargetAtTime(p/100, t, 0.02)` ramp (existing click-free behavior, FR-007).

## File output (Manual preset, unified)

`volume={p/100:.3}` with `p ∈ [0, 400]`, terminated by existing `DEFAULT_LIMITER`. 400% → `volume=4.000,alimiter=…`.
