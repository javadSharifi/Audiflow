# Quickstart & Verification Guide: Mobile Performance & Smoothness Optimization

**Feature**: `001-mobile-performance-optimization`
**Date**: 2026-09-15

---

## 1. Prerequisites & Dependencies

Before running validation, ensure `@tanstack/react-virtual` is installed:

```bash
pnpm add @tanstack/react-virtual
```

Verify build and types:
```bash
pnpm build
```

---

## 2. Automated Test Scenarios

Run unit and integration tests:

```bash
pnpm test
```

### Key Test Cases:
1. **Virtual List Rendering**:
   - Verify that when a list of 1,000 tracks is provided to `TrackListView`, the total number of mounted `TrackRow` components in the DOM does not exceed 30 items.
2. **Keep-Alive Tab Preservation**:
   - Verify that toggling tabs from `songs` to `boost` and back to `songs` preserves the mounted state and does not re-trigger `checkPermission` or library scans.
3. **Performance Mode Toggle**:
   - Verify that toggling `reducedBlur` persists to `localStorage` and applies the appropriate CSS modifier class (`no-blur` / `perf-mode`).

---

## 3. Manual Mobile / Emulator Verification Scenarios

### Scenario A: Rapid Fling Scrolling in Large Library (60+ FPS)
1. Launch app on Android emulator or real device (`pnpm dev:android` or APK build).
2. Ensure music library contains 500+ tracks.
3. Rapidly swipe up and down through the list.
4. **Expected Outcome**:
   - Scrolling is completely smooth and continuous without any frame freeze.
   - Total memory usage remains stable under 120MB.

### Scenario B: Instant Tab Switching with Scroll Memory (Two-Level)
1. In the `Songs` tab, scroll down to track #50.
2. Tap the `Booster` tab in the bottom navigation.
3. **Expected Outcome**: Booster tab appears instantly in under 50ms.
4. Tap the `Songs` tab again.
5. **Expected Outcome**: The song list appears instantly at track #50 without jumping to the top or showing a blank loading state.
6. Tap `Converter` tab (top-level), then back to `Player` (`Songs`).
7. **Expected Outcome**: Player appears instantly <50ms at previous scroll position (top-level KeepAlive `App.tsx:370` with `lazy={false}` — regression test for reported lag).

### Scenario C: Performance Mode in Settings
1. Open the Settings panel.
2. Locate the "حالت عملکرد بالا / Performance Mode" toggle.
3. Verify that on Android, it defaults to ON (blur disabled).
4. Toggle the switch and observe the backdrop blur effect applying/removing cleanly in real time.
