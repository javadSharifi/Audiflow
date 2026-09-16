# Research: Volume Boost Accuracy & Seek Clarity

**Feature**: `003-volume-boost-accuracy` | **Date**: 2026-09-16

## R1 — Why do 200%/400% feel dishonest on Android?

- Finding: `applyGainPercent()` (`src/stores/musicPlayer/audioEngine.ts:142-157`) fires **two** IPC calls for every boost change above 100%: `androidPlayerSetBoosterGainMb(boosterMbForPercent(p))` then `androidPlayerSetBoosterGain(boosterDbForPercent(p))`. Both land in the same place — `BoostEngine.setGainMb()` (`PlaybackService.kt:998-1017` → `BoostEngine.setGainDb/setGainMb`) — so the second call silently overwrites the first on every slider tick. At 200% the linear-mB path asks 2667 mB but the dB path overwrites with 602 mB; at 400% 8000 mB is overwritten with 1204 mB. The UI promises a linear percent scale while the device ends up wherever the last-writer mapping says, with a transient double-apply on each tick.
- Second contributor: `BoostEngine` applies gain twice in the signal path — global session-0 mix enhancer **plus** per-session enhancers (`BoostEngine.kt:160-188`, `applyGlobalGain`). `LoudnessEnhancer` is a perceptual compressor, not a linear amplifier, so stacked instances + OEM-dependent honoring of `setTargetGain` make the heard curve deviate further from the shown percent.
- Decision: single IPC path per boost change — keep the dB-honest mapping (`boosterDbForPercent`: 200%→+6.0 dB, 400%→+12.0 dB, monotonic and truthful to the existing dB hint) converted once to mB, and delete the parallel linear-mB call. No new command, no contract change.
- Rationale: one writer removes the overwrite race; the dB mapping is the only one consistent with the on-screen dB badge (`BoosterView.tsx:48-50`), so heard steps finally match shown labels.
- Alternatives considered: keep linear-mB mapping (rejected — contradicts the dB badge and compresses the top end: 300%→5333 mB vs 400%→8000 mB while perception is logarithmic, which is exactly the "400% feels like 200%" complaint); add a calibration curve per device (rejected — unmeasurable without lab gear; monotonic honesty is testable by ear per SC-001).

## R2 — Where does the seek crackle come from?

- Finding: `unifiedSeekTo()` on Android (`audioEngine.ts:679-703`) calls `player.seekTo()` immediately per event; `MiniPlayer` drag and seekbar scrubbing emit a seek per movement, so a fast scrub fires a burst of overlapping ExoPlayer seeks. Each seek produces a decoder discontinuity; with the enhancer at high target gain the transient is amplified ("خش‌خش تقویت‌شده"), and the next seek interrupts recovery — sustained crackle that clears only when scrubbing stops. Nothing re-sets enhancer gain during seek (good), so the fix is purely about seek rate, not gain staging.
- Decision: trailing soft-debounce in `useMusicPlayerStore.seekTo` (~1000 ms, per user request "۱ ثانیه یا بیشتر"): first seek applies immediately for responsiveness, further seeks within the window replace the pending target, and only the final position is sent when the window lapses. Optimistic `currentTime` UI update stays (seekbar tracks the finger); the existing `SEEK_SETTLE_MS` guard already ignores stale native snapshots.
- Rationale: matches the user's own suggested fix; preserves "keep playing throughout, no mute/fade" (clarification C); turns N overlapping seeks into 1–2 clean seeks per scrub.
- Alternatives considered: brief mute/fade around seek (rejected by user, clarification C); `setSeekParameters(EXACT)` tuning (rejected — doesn't address overlapping seeks and risks slower seek); disabling enhancer during seek (rejected — re-enabling causes a bigger transient than the seek itself).

## R3 — Desktop honesty

- Finding: desktop applies `GainNode.gain = percent/100` (linear amplitude: 200% = 2.0× = +6.02 dB, 400% = 4.0× = +12.04 dB). This is already honest; the complaint was Android-only (clarification A).
- Decision: desktop mapping unchanged; only the shared `boosterDbForPercent` hint is kept as truth. Desktop is a no-regression verification target (FR-008).
- Alternatives considered: unify desktop onto dB-domain gains (rejected — linear amplitude IS the honest meaning of "percent"; no change needed).

## R4 — Unifying file output with live (FR-004b)

- Finding: the offline Manual preset (`presets.rs:68-74`) clamps to 0–200% linear amplitude + terminal `alimiter`, while the live scale runs to 400%. A user converting at "max" gets half the live progression.
- Decision: extend Manual to 0–400% (`clamp(0.0, 400.0)`), same linear multiplier, same `DEFAULT_LIMITER` terminator. Single-pass graph unchanged; preset/smart/voice/bass/extreme chains untouched.
- Rationale: one percentage scale everywhere (clarification B); limiter stays as full-scale-only ceiling per constitution Principle II, satisfying the Complexity Tracking entry.
- Alternatives considered: separate file-only scale (rejected — reintroduces the exact "two meanings of %" distrust this feature removes).

## R5 — Limiter vs "no capping" (FR-006 × Principle II)

- Finding: direct conflict — user chose always-honest scaling; constitution mandates terminal `alimiter` (non-negotiable).
- Decision: keep the limiter; document and test it as a full-scale ceiling (engages only at/above 0 dBFS on already-clipping material), never as a loudness target. The gain mapping below full scale stays bit-honest, which is what SC-003 verifies ("same step on loud and quiet tracks" below the ceiling).
- Rationale: constitution outranks preference (AGENTS.md conflict priority); safety duty for hearing/speakers; the limiter does not change the mapping, only catches over-full-scale peaks.

## Open unknowns — all resolved

No NEEDS CLARIFICATION remains. Debounce interval (1000 ms) comes from the user's explicit request; mapping choice from the dB badge already in the UI; scope from the 5 clarification answers.
