# Contract: Seek Debounce (trailing, ~1 s)

**Feature**: `003-volume-boost-accuracy` | **Date**: 2026-09-16

## Behavior

- `seekTo(t)` with no open window → applies `unifiedSeekTo(t)` immediately, opens a 1000 ms coalescing window.
- `seekTo(t)` with an open window → does NOT call native; replaces the pending target with `t`; restarts the trailing edge (final apply 1000 ms after the last request).
- Window lapse with a pending target → applies `unifiedSeekTo(pending)` exactly once.
- Optimistic UI: every `seekTo(t)` call still sets `currentTime = t` in the store immediately (seekbar tracks the finger); native snapshot adoption stays governed by the existing `SEEK_SETTLE_MS` (1500 ms) guard.
- No mute, no fade, no gain change during seek (clarification C).

## Guarantees

- Continuous scrub at any event rate produces ≤ 1 native seek per 1000 ms window plus the leading seek.
- The last requested position is always eventually applied (no swallowed final seek).
- Single isolated seeks gain zero added latency (leading-edge immediate).
- Boost level is untouched by seek logic (FR-003); boost toggle mid-seek is independent and preserved.

## Non-goals

- No change to `PlaybackService.seekTo` (single native call per request, unchanged).
- No change to the settle/smoothing machinery (`noteUserSeek`, `anchorSmoothTime`, `applyNativeStateToStore`).
