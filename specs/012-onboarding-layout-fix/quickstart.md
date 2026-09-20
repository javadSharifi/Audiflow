# Quickstart: Onboarding Layout Fix

**Feature**: `012-onboarding-layout-fix` | **Date**: 2026-09-20

Validation guide — no implementation code. Details: [spec.md](../spec.md), [data-model.md](../data-model.md), [contracts/onboarding-layout.md](contracts/onboarding-layout.md).

## Prerequisites

- Web or Android-emulator run of the app with a way to reset app data (fresh-install simulation: clear `ac:first-run-done` + settings, or wipe app data).
- Narrow-viewport device or emulator: 360×800 primary, 320-wide + largest system font secondary, notched-device emulation for safe-area checks.

## 1. Automated tests

```bash
pnpm test src/components/onboarding
```

Expected: all suites pass, including new assertions on x-clipping, clipped non-interactive decoration layer, safe-area-aware header/footer padding, and `radiogroup`/`radio` + `aria-checked` roles per [contracts/onboarding-layout.md](contracts/onboarding-layout.md).

Then the narrowest related gates:

```bash
pnpm build
```

Expected: TypeScript strict check passes (no `noUnusedLocals`/`noUnusedParameters` regressions from role/class edits).

## 2. Manual validation (maps to Success Criteria)

1. **SC-001 — no horizontal scroll**: fresh install, 360px viewport, Persian then English. Swipe left/right anywhere on the page → nothing moves, no horizontal scrollbar. Repeat over the decoration blobs and card grids.
2. **SC-002 — logo clears notch**: notched-device emulation, fresh launch → logo, title, subtitle fully below the camera/status area on first paint, light and dark appearance.
3. **SC-003/SC-004 — flow intact**: complete once via confirm, relaunch → main screen directly. Reset, skip globally → same. Deny/skip permission → still completes to a usable main screen.
4. **SC-005 — persistence**: pick non-default theme/language/performance, confirm, relaunch → all three applied, no reverts.
5. **SC-006 — small screen**: 320px + largest font → all text wraps without clipping; primary CTA reachable within ~3 vertical swipes; still zero horizontal movement.
6. **Reduced motion**: turn performance mode on → heavy glows/blur visibly reduce immediately; turn off → restored.

## 3. Regression guard

- Settings dialog still has no theme / auto-open-folder rows; top-bar theme toggle still the only later theme control (inherited from 011 — do not re-break).
- No new network requests on the start page (offline-first); no new console errors.
