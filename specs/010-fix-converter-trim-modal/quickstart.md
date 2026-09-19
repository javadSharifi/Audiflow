# Quickstart & Verification Guide: Converter Modal & Trim Editor Fixes

This document details verification steps to ensure the modal z-index layering and 5-second trim preview playback behave as expected.

## Automated Verification

Run existing and new frontend tests:
```bash
pnpm test
```
Verify type contracts:
```bash
pnpm check:types
```

## Manual Verification Scenarios

### Scenario 1: Mobile Edit Modal Layering (Z-Index)
1. Launch the app in a desktop browser or mobile emulator (viewport width < 768px).
2. Navigate to Converter step 1.
3. Add any audio file.
4. Tap the **Trim icon** (Scissors) or **Sound Booster icon** (Speaker).
5. **Expected Result**: The bottom sheet modal opens smoothly with a dark backdrop over the entire screen. The bottom navigation bar is completely behind the backdrop and modal sheet (`z-[80]` vs `z-[55]`). No navigation icons bleed through or intercept touches.

### Scenario 2: Trim Editor 5s Snippet Playback
1. Open the Trim Editor for a file longer than 5 seconds.
2. Confirm the preview buttons say "۵ ثانیه اول" and "۵ ثانیه آخر" (or "First 5s" / "Last 5s").
3. Tap "۵ ثانیه آخر" ("Last 5s").
4. **Expected Result**: Audio begins playing from 5 seconds before the end of the track/selection and stops cleanly at the end.
5. Tap "۵ ثانیه آخر" immediately again.
6. **Expected Result**: Audio restarts from 5s before end without stalling or getting stuck.
7. Tap "۵ ثانیه اول" ("First 5s").
8. **Expected Result**: Audio plays from start to 5 seconds.

### Scenario 3: Waveform Guide Layout
1. In the Trim Editor, observe the top area above the buttons.
2. **Expected Result**: The old header guide text is gone.
3. Observe directly beneath the waveform canvas.
4. **Expected Result**: The compact text "برای شنیدن روی بخش نارنجی بزن" (or English counterpart) is displayed.
