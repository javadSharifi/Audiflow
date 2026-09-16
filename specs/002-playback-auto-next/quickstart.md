# Quickstart: Playback Auto-Next Reliability

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Validation guide proving the feature works end-to-end. Run automated checks first, then the manual pass.

## Prerequisites

- Dependencies installed; `pnpm test` green on `main` before starting.
- A test playlist: 3+ short valid audio files, 1 intentionally unplayable file (e.g., renamed text file with an audio extension), 1 single-song playlist.

## Automated validation

```bash
pnpm test      # new + existing Vitest suites (advance, skip, stop, single-fire)
pnpm build     # TypeScript strict check
```

Expected: all suites pass, including the new transition tests for FR-001–FR-007.

## Manual scenarios (map to Success Criteria)

### S1 — Full playlist, no touch (SC-001)

1. Start the multi-song playlist; do not touch controls.
2. Expect: every song starts after the previous ends; now-playing display always matches audible song.

### S2 — Bad file in the middle (SC-002)

1. Place the unplayable file between two valid songs; play through.
2. Expect: playback continues to the next valid song with no action; at most a brief non-modal notice.

### S3 — Natural end, repeat off (SC-003)

1. Play the last song of a playlist with repeat off and shuffle off.
2. Expect: player shows stopped state — no "playing" indicator, no silence-as-playing.

### S4 — Repeat/shuffle boundaries

1. Repeat-all + last song → first song starts. Repeat-one → same song restarts. Shuffle + song end → a different song starts.
2. Single-song playlist, repeat off → stops cleanly with stopped state.

### S5 — Race: manual next at track end (FR-007)

1. Press next at the moment a song ends (repeat several times).
2. Expect: exactly one advance each time — no skipped songs, no double-play.

## Sign-off

Feature is done when S1–S5 all pass and `pnpm test` + `pnpm build` are green.
