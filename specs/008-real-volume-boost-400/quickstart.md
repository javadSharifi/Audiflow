# Quickstart: Real 400% Volume Boost & Perceived Loudness

**Feature**: `008-real-volume-boost-400` | **Date**: 2026-09-19

## Prerequisites

- Local repo with all dependencies installed (`pnpm install`).
- Physical Android device or Android emulator with audio playback support.
- One quiet audio track and one modern mastered track.

---

## 1. Automated Test Validation

Run the targeted test suites for audio engine mapping and Rust filter presets:

```bash
# Frontend audio engine unit tests
pnpm test src/stores/musicPlayer/__tests__/audioEngine.test.ts

# Rust booster filter preset tests
cargo test --manifest-path src-tauri/Cargo.toml test_manual
```

Expected outcomes:
- `boosterMbForPercent` monotonically increases: 100% → 0 mB, 200% → 2667 mB, 400% → 8000 mB.
- Rust unit test verifies `dynaudnorm` with dynamic `m` parameter + terminal `alimiter` for Manual preset > 100%.

---

## 2. Auditory Validation on Android (SC-001 / SC-002)

1. Launch application on Android.
2. Play a quiet/moderate volume track.
3. Open the Sound Booster dial.
4. Advance the dial from 100% to 200% → verify a clear, substantial increase in loudness.
5. Advance beyond 200% → verify high-boost warning confirmation dialog appears.
6. Confirm dialog and set to 400% → verify speaker output matches or exceeds competitor volume booster apps without silent drops.

---

## 3. Offline File Booster Validation (SC-003 / SC-004)

1. Navigate to the File Booster section.
2. Import an audio file.
3. Verify the manual gain slider can be dragged up to 400%.
4. Process and export the file.
5. Play the exported file alongside the original → verify distinctly louder audio without rhythmically ducking or choking.

---

## 4. Full Quality Gates Before Merge

```bash
pnpm check:types
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
```
