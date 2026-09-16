# Quickstart: Validate Volume Boost Accuracy & Seek Clarity

**Feature**: `003-volume-boost-accuracy` | **Date**: 2026-09-16

## Prerequisites

- Android dev build installed (primary target) + one desktop build (no-regression).
- One quiet track and one loud/mastered track in the library.
- `pnpm test` (Vitest) and `cargo test --manifest-path src-tauri/Cargo.toml` runnable.

## 1. Unit validation (no device needed)

```bash
pnpm test src/stores/musicPlayer/__tests__/audioEngine.test.ts
cargo test --manifest-path src-tauri/Cargo.toml sound_booster
```

Expected: mapping monotonicity (100 < 150 < … < 400, anchors 200%→+6.0 dB / 400%→+12.0 dB), single-path IPC order (exactly one gain call per boost change), debounce (burst of 10 seeks in 500 ms → ≤ 2 native calls, final target applied), Manual preset `volume=4.000` + `alimiter` at 400%.

## 2. Listening check (SC-001 / SC-004) — Android, same speakers

Play the quiet track at 100% → 200% → 400%. Each step must be clearly louder than the previous, 200% a true middle step. The dB badge (+6.0 / +12.0) must match the heard jump. Confirm with the reporting user.

## 3. Seek check (SC-002) — Android, boost at 200% and 400%

Drag the progress bar to start / middle / end (≥ 20 seeks total across both levels). Expect: playback continues through the drag (no mute dip), lands within 2 s, no sustained crackle, no burst above music level, boost setting unchanged after landing. Then 3 rapid consecutive scrubs: expect coalesced landing on the final position.

## 4. File-output check (FR-004b)

Convert a track with Manual 400% and play the file: loudness step must match the live 400% progression (same honest scale). Verify the FFmpeg log shows a single-pass graph ending in `alimiter`.

## 5. Desktop no-regression (FR-008)

Repeat checks 2–3 on desktop: linear-amplitude progression unchanged, seeks clean, slider changes click-free.

## 6. Full gates before merge

`pnpm generate:types && pnpm check:types` (only if IPC touched — expected: untouched), `pnpm test`, `pnpm build`, `cargo test`. i18n: no new strings expected; if any added, both locales required.
