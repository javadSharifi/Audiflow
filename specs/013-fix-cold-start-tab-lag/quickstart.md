# Quickstart: Eliminate Cold-Start Tab Lag

**Feature**: `013-fix-cold-start-tab-lag` | **Date**: 2026-09-20

Validation guide — no implementation code. Details: [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/tab-keepalive-contract.md](contracts/tab-keepalive-contract.md).

## Prerequisites

- Local build and test environment (Node 22, pnpm 9).
- Browser or Android device/emulator for cold-start timing tests.

## 1. Automated Tests

Run the targeted test suites for music player components and keep-alive container:

```bash
pnpm test src/components/music-player/
```

Expected outcomes:
- `KeepAlivePane` tests pass: verifies synchronous mount when `active=true`, verifies background mounting when `prewarm=true`, and confirms `display: none` preservation.
- `AlbumGridVirtualized` tests pass: confirms immediate column determination matching viewport width on first render pass.
- `MusicPlayerView` tests pass: verifies tab switching and keep-alive behavior.

Run the TypeScript build check:

```bash
pnpm build
```

Expected outcome:
- TypeScript compilation passes with zero errors under strict mode.

## 2. Manual Validation Scenarios (maps to Success Criteria)

1. **SC-001 & SC-002: Cold-Start First Visit to Albums Tab**:
   - Close the app completely (kill process).
   - Launch the app from cold start.
   - Wait 1 second (to allow idle callback to pre-warm), then tap "Albums" in the bottom dock.
   - **Verification**: The transition to Albums must happen instantaneously (<50ms, visually instantaneous) without any white screen flash, stutter, or frozen dock animation.

2. **SC-001 & SC-003: Cold-Start First Visit to Liked Tab**:
   - Close the app completely and launch again.
   - Immediately tap "Liked" (Heart icon) in the bottom dock.
   - **Verification**: The Liked songs list appears instantly without blank delay.

3. **Immediate Tap Race Condition**:
   - Close the app and launch.
   - Tap "Albums" immediately within the first 100ms of the app becoming interactive (before idle callback fires).
   - **Verification**: The tab renders on that very frame without returning `null` or requiring an extra effect frame.

4. **SC-004: Cold Boot Speed Integrity**:
   - Measure time from app launch to `#boot-splash` removal.
   - **Verification**: Time to interactive on the initial Songs tab is unaffected.

5. **SC-005: Subsequent Switch Performance**:
   - Switch rapidly between Songs, Albums, Liked, and Booster tabs.
   - **Verification**: All switches take <10ms and preserve exact scroll offsets.
