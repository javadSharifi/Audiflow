# Research: Boost Slider Debounce

**Feature**: `004-boost-slider-debounce` | **Date**: 2026-09-16

## R1 — Why does dragging the boost slider chop?

- Finding: `setVolumeGainPercent` (`useMusicPlayerStore.ts:584-599`) runs `applyGainPercent(clamped)` **synchronously on every slider/dial tick**. On Android each tick means `androidPlayerSetVolume` + `androidPlayerSetBoosterGain` IPCs plus `BoostEngine.setGainMb` fanning out across session-0 and every tracked session with `LoudnessEnhancer.setTargetGain` — each re-target forces the compressor to reconverge, so a 60 Hz tick stream keeps the enhancer in permanent transient: the heard stutter. On desktop each tick re-arms `setTargetAtTime`, which is smoother but still churns. The 003 fix made the *value* honest; the *rate* is the remaining bug.
- Decision: throttle-with-trailing-flush at the single choke point (`setVolumeGainPercent`), per clarification A (glide, not hold-and-jump).
- Rationale: one choke point already funnels slider + dial + toggle + restore paths, so no UI changes are needed.
- Alternatives considered: pure trailing debounce like seeks (rejected — clarification A explicitly chose glide; holding audio steady while the number moves feels dead); fixing in `BoostEngine` natively (rejected — bigger blast radius, Kotlin threading, same UX result achievable from the TS side).

## R2 — Glide interval and settle budget

- Finding: spec SC-002 demands settle ≤1 s after release; human finger tick rates during a drag are 30–60 Hz; `LoudnessEnhancer` reconverges inaudibly when re-targeted at modest rates.
- Decision: leading immediate apply + at most one intermediate apply per ~150 ms carrying the latest requested value + guaranteed trailing flush of the final value (~150 ms worst case after release, far inside the 1 s budget).
- Rationale: ~6 applies/sec is smooth to the ear (each step is small in dB) while cutting engine churn ~10× vs per-tick.
- Alternatives considered: 500 ms–1 s interval (rejected — audible stepping between glide points); relying on the desktop `setTargetAtTime` ramp alone (rejected — does nothing for the Android IPC fan-out).

## R3 — What stays immediate vs what is throttled

- Finding: `setVolumeGainPercent` does three things per tick: engine apply, `persistSavedBoosterGain`, `set({ volumeGainPercent })`. Spec FR-003 demands the displayed number follow every movement.
- Decision: `set()` (UI) stays per-tick; engine apply goes through the glide helper; `persistSavedBoosterGain` moves to the settled value (persist on leading apply + trailing flush, not on every throttled-away tick).
- Rationale: persistence then always matches what was (or will within ~150 ms be) heard; crash mid-drag restores a value the user actually heard.
- Alternatives considered: persist per tick (rejected — wasteful writes at 60 Hz, and a persisted value never applied to the engine); persist only on release trailing flush (rejected — a kill between leading apply and release would restore a stale value).

## R4 — Interaction with the >200% gate and the seek debounce

- Finding: the gate lives in `BoosterView.requestVolumeChange` (caps at 200 + modal) *before* `setVolumeGainPercent` is called, so throttling below it cannot bypass the modal. Seek debounce (`seekDebounce.ts`) coalesces position, this helper coalesces gain — orthogonal axes, no shared state.
- Decision: no changes to `BoosterView`, `seekDebounce.ts`, `BoostEngine`, or file presets.
- Alternatives considered: merging both coalescers into one (rejected — different timing shapes: trailing-only for seeks vs leading+throttle+trailing for gain; merging would tangle two independent guarantees).

## Open unknowns — all resolved

No NEEDS CLARIFICATION remains. Glide shape from clarification A; 150 ms interval fits inside the specified 1 s budget; single-tap zero-latency follows from the leading edge.
