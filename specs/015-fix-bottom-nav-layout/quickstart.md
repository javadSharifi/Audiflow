# Quickstart & Verification Guide: Bottom Navigation Layout & Mini Player Spacing

**Feature**: `015-fix-bottom-nav-layout`  
**Date**: 2026-09-22

---

## 1. Automated Verification

Run automated test suites to verify layout mathematics, responsive bounds, and component rendering:

```bash
# Run music player navigation & mini player tests
pnpm test src/components/music-player/__tests__/MusicPlayerNav.test.tsx

# Run full project test suite
pnpm test

# Run TypeScript typecheck & code generation verification
pnpm check:types

# Run production build
pnpm build
```

---

## 2. Visual & Responsive QA Scenarios

### Scenario A: Vertical Gap & Safe Area Consistency
1. Launch the application in developer mode: `pnpm tauri dev` or `pnpm dev`.
2. Start playing any audio track so the `MiniPlayer` is rendered.
3. In browser devtools or mobile emulator, inspect the computed styles of `<nav>` (`MusicPlayerNav`) and `<div role="region">` (`MiniPlayer`).
4. **Zero-Inset Verification**: When `--safe-area-inset-bottom` is 0px:
   - `MusicPlayerNav` computed bottom: ~`12px` (`0.75rem`).
   - `MiniPlayer` computed bottom: ~`84px` (`5.25rem`).
   - Visual distance between Nav top and MiniPlayer bottom: exactly `8px`.
5. **Positive-Inset Verification**: Simulate an Android 3-button navigation bar by setting `env(safe-area-inset-bottom, 48px)`:
   - `MusicPlayerNav` shifts up by 48px to `60px`.
   - `MiniPlayer` shifts up by 48px to `132px`.
   - Visual distance between them remains strictly `8px` without any gap expansion or background song list leakage.

### Scenario B: 360px Mobile Viewport Overflow Check
1. Set device emulator or browser responsive viewport to **360px x 800px** (common standard Android viewport).
2. Set language to Persian (`fa`).
3. Click through each tab in succession:
   - **آهنگ‌ها** (Songs)
   - **علاقه‌مندی‌ها** (Liked - longest label: 13 characters)
   - **افزایش صدا** (Booster)
   - **آلبوم‌ها** (Albums)
   - **مبدل صدا** (Converter)
4. **Pass Criteria**:
   - The navigation dock is 100% visible with at least 12px margin on both sides.
   - Zero horizontal scrollbars appear on `window` or `document`.
   - All 5 icons remain fully visible and clickable without being clipped or forced off the screen.

### Scenario C: Ultra-Compact 320px Viewport Check
1. Set viewport width to **320px**.
2. Click on "علاقه‌مندی‌ها".
3. **Pass Criteria**:
   - The active tab label cleanly truncates with ellipsis if required.
   - Outer buttons remain visible and interactive.
   - Total dock width stays `<= 296px`.
