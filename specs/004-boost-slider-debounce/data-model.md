# Data Model: Boost Slider Debounce

**Feature**: `004-boost-slider-debounce` | **Date**: 2026-09-16

No new stored data. `volumeGainPercent` (store + existing persistence key) is unchanged; only application timing changes.

## Boost Drag

- Fields: `requestedPercent` (per tick, 100–400 step 5 — written to store state immediately, drives UI number/arc/badge); `appliedPercent` (last value sent to the engine); `pendingPercent` (latest throttled-away value awaiting flush).
- Lifecycle: `request(p)` → store `set({ volumeGainPercent: p })` immediately → if outside glide window: engine apply + persist immediately, open ~150 ms window; else: stash as `pendingPercent` → on window lapse: apply + persist `pendingPercent` once, close window.
- Validation: engine applies are a subsequence of requests ending in the final request; at most 1 engine apply per 150 ms window plus leading; UI state equals the latest request at all times.

## Settled Gain

- Definition: `appliedPercent` after all windows lapse — always equals the last requested (shown) value.
- Guarantees: settle ≤1 s after release (design delivers ~150 ms); never stuck intermediate; never silent; single isolated requests (taps, toggles, restores) apply synchronously with zero added latency.
- Edge rules: toggle-off mid-drag cancels pending and applies the toggle target immediately; >200%-gate rejections never reach the helper (gated upstream in `BoosterView`); concurrent seek settling is independent (position vs gain axes).
