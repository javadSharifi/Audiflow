# Quickstart & Verification Guide: Track Booster Sheet & Speaker Protection

**Feature**: `009-nowplaying-booster-ux`
**Date**: 2026-09-19

## Validation Overview

This guide verifies that:
1. Triggering "Speaker Protection" (`محافظت از اسپیکر`) resets boost to 100% without altering Android or desktop device hardware media volume.
2. The extracted `TrackBoosterSheet` renders with fluid design, dynamic theme stages, and real-time auditioning without unwanted sheet dismissals.
3. High boost safety gating (> 200%) warns the user appropriately.

---

## Automated Test Verification

Run component tests for `TrackBoosterSheet` and the updated `NowPlayingView`:

```bash
# 1. Run dedicated TrackBoosterSheet unit tests
pnpm test src/components/music-player/__tests__/TrackBoosterSheet.test.tsx

# 2. Run NowPlayingView unit tests
pnpm test src/components/music-player/__tests__/NowPlayingView.test.tsx

# 3. Run entire frontend test suite
pnpm test

# 4. Verify TypeScript and Vite build pass
pnpm build
```

---

## Manual Verification Steps

### Scenario 1: Safe Speaker Protection (Zero Hardware Volume Drop)
1. Launch app on Android or Desktop.
2. Start playing any music track.
3. Open NowPlayingView and tap the booster flame button.
4. Set boost level to 200% (or 300%). Note phone's current media volume (e.g. 70%).
5. Tap the "محافظت از اسپیکر" (Protect Speaker) button in the header.
6. **Expected outcome**:
   - Boost level instantly returns to `100%`.
   - The phone's hardware volume remains at 70% (no drop to 30%, no muting).
   - Audio continues playing at standard unboosted volume clearly.

### Scenario 2: Fluid In-Sheet Auditioning
1. In NowPlayingView, tap the flame booster button to open the bottom sheet.
2. Tap the `150%` chip.
   - **Expected**: Music gets audibly louder immediately, chip highlights amber, sheet stays open.
3. Tap the `200%` chip.
   - **Expected**: Music gets louder, chip highlights orange, sheet stays open.
4. Drag slider between 100% and 200%.
   - **Expected**: Smooth real-time gain glide with graduation markers.
5. Tap close button (or backdrop).
   - **Expected**: Sheet dismisses smoothly, boost level stays at selected value.

### Scenario 3: High-Boost Safety Gate (> 200%)
1. In the sheet with boost at 100%, tap `300%`.
2. **Expected**: Confirmation dialog appears warning of potential speaker stress.
3. Tap "Cancel" -> boost remains at 200%.
4. Tap `300%` again and tap "Confirm" -> boost unlocks and jumps to 300% with warning badge.
