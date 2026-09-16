# Contract: Gain Glide (leading + throttled + trailing)

**Feature**: `004-boost-slider-debounce` | **Date**: 2026-09-16

## Behavior (`createGainGlider(apply, intervalMs = 150)`)

- `request(p)` with no open window → `apply(p)` immediately (leading edge), open window.
- `request(p)` with an open window → stash as pending (overwrite), no apply.
- Window lapse with pending → `apply(pending)` exactly once, close window.
- Window lapse without pending → close silently.
- `cancel()` → drop pending, close window (used by toggle-off paths, which then apply their own target directly).
- Every engine-side `apply` is paired with `persistSavedBoosterGain` of the same value at the same call site ordering (apply-then-persist, matching current `setVolumeGainPercent` semantics).

## Guarantees

- Continuous 60 Hz drag → ≤ ~7 engine applies/sec, each carrying a recent value (smooth dB steps, no reconvergence churn).
- Final requested value is always eventually applied (no swallowed release value).
- Single isolated requests gain zero added latency.
- UI store `set()` is NOT routed through the helper — the number follows every tick.

## Non-goals

- No change to gain *values* (003 mapping), `BoosterView`, `BoostEngine`, seek debounce, or file presets.
- No new IPC, strings, or persisted keys.
