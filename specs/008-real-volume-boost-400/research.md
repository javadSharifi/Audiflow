# Research: Real 400% Volume Boost & Perceived Loudness

**Feature**: `008-real-volume-boost-400` | **Date**: 2026-09-19

## R1 — Android Live Playback: Mapping User Percentage to LoudnessEnhancer

### Context & Problem
In `003-volume-boost-accuracy`, `boosterDbForPercent` used a voltage formula: $20 \log_{10}(\text{percent} / 100)$. At 400%, this sent only +12.04 dB (1204 mB) to `LoudnessEnhancer`. Because `LoudnessEnhancer` is a dynamic compressor and human hearing perceives +10 dB as only a 2x loudness doubling, +12.04 dB resulted in barely a 2–3 dB audible lift on typical smartphone speakers. Competitor apps (e.g. `com.cool.volume.sound.booster`) use an aggressive range up to 8000 mB (+80 dB nominal), pushing the hardware DAC and internal DSP compressor to full speaker saturation.

### Decision
Switch Android live playback boost to the full aggressive scale:
- When `percent <= 100`: `androidPlayerSetBoosterGainMb(0)`, volume scales linearly `percent / 100`.
- When `percent > 100`: `androidPlayerSetVolume(1.0)`, and pass `gainMb` calculated via linear-fraction scaling up to `MAX_GAIN_MB` (8000 mB):
  $$\text{gainMb} = \text{round}\left(\frac{\text{percent} - 100}{300} \times 8000\right)$$
  - 100% → 0 mB (0.0 dB)
  - 200% → 2667 mB (+26.7 dB)
  - 300% → 5333 mB (+53.3 dB)
  - 400% → 8000 mB (+80.0 dB)
- Call existing IPC command `androidPlayerSetBoosterGainMb(gainMb)` directly.

### Rationale
- Matches user's explicit choice in Session 2026-09-19 (Q1 Option A: Full Aggressive 8000 mB).
- Utilizes the exact range already built into Kotlin's `BoostEngine.kt` (`MAX_GAIN_MB = 8000` and `setGainFromPercent`).
- Delivers maximum acoustic energy on mobile speakers, matching competitor volume booster apps.
- The existing confirmation modal above 200% satisfies user consent and warns of speaker distortion risk.

### Alternatives Considered
- Logarithmic voltage dB mapping (`boosterDbForPercent` with 1204 mB): Rejected — proven too weak by user feedback and auditory testing.
- Conservative curve capped at 4000 mB: Rejected — user explicitly chose full 8000 mB aggressive power to match competitors.

---

## R2 — Offline File Booster (FFmpeg Single-Pass DSP Pipeline)

### Context & Problem
In `src-tauri/src/processing/sound_booster/presets.rs`, Manual mode previously used `volume={multiplier:.3},{DEFAULT_LIMITER}` where `DEFAULT_LIMITER = "alimiter=limit=0.95:attack=5:release=50:asc=1"`. Multiplying an already mastered music track by 4 (+12 dB) causes the peak limiter to aggressively duck the gain by 12 dB across the entire track, causing audible pumping, breathing artifacts, and muffled dynamics instead of a perceived volume boost.

### Decision
For Manual boost mode in offline processing:
- When `pct <= 100.0`: Passthrough / linear volume attenuation: `volume={pct / 100.0:.3}`.
- When `pct > 100.0`: Combine dynamic audio normalization with makeup gain and the constitutional safety limiter:
  $$\text{boost\_ratio} = \frac{\text{pct} - 100.0}{300.0} \quad (\in [0.0, 1.0])$$
  $$\text{max\_gain} = 1.0 + \text{boost\_ratio} \times 9.0 \quad (\in [1.0, 10.0])$$
  Filter chain:
  `dynaudnorm=f=150:g=15:m={max_gain:.1}:r=0.9,{DEFAULT_LIMITER}`
  where `DEFAULT_LIMITER` remains `alimiter=limit=0.95:attack=5:release=50:asc=1`.

### Rationale
- Matches user's explicit choice in Session 2026-09-19 (Q2 Option A).
- `dynaudnorm` dynamically normalizes audio over sliding windows (f=150), boosting quiet and mid-level passages smoothly without brickwall peak collisions.
- As the user dials from 101% to 400%, maximum dynamic gain parameter `m` scales from 1.0x to 10.0x (+20 dB).
- Complies strictly with Constitution Principle II: single-pass `-filter_complex`, no intermediate lossy re-encodes, and mandatory terminal `alimiter` ceiling at −0.5 dBFS.

### Alternatives Considered
- Static linear volume multiplication (`volume=4.0`): Rejected — chokes the limiter and produces pumping.
- `acompressor` dual-stage compression: Rejected — more complex parameter tuning across genres, while `dynaudnorm` provides consistent dynamic loudness enhancement across speech, music, and podcasts.

---

## R3 — UI Slider & Badge Synchronization

### Context & Problem
`src/features/sound-booster/file-booster/GainSlider.tsx` currently has `min={0}`, `max={200}`. Meanwhile, the live player `BoosterView.tsx` supports up to 400%. Additionally, `BoosterView.tsx` displayed `+12.0 dB` next to 400%, which no longer reflects the true 8000 mB (+80.0 dB nominal) scale.

### Decision
1. Update `GainSlider.tsx`:
   - Extend range to `min={0}`, `max={400}`, step=5.
   - Update graduation markers: 0% (Mute), 100% (Original), 200%, 400% (Max).
   - Display `isHighBoost` badge and warning for values > 200%.
2. Update `BoosterView.tsx` & `audioEngine.ts`:
   - Update `boosterDbForPercent` or badge display to reflect the active nominal boost (e.g. `+26.7 dB` at 200%, `+80.0 dB` at 400%, or `round(gainMb / 100)`).
   - Maintain safety confirmation modal when dragging above 200%.

### Rationale
- Eliminates cognitive dissonance between the two booster sections.
- Both tools offer the exact same 0%–400% capabilities.

---

## R4 — Desktop Playback Compatibility (WebAudio)

### Context & Problem
Desktop live playback uses WebAudio (`GainNode`). Setting `node.gain.value = 4.0` on uncompressed audio can cause clipping in the browser AudioContext output.

### Decision
- Keep linear gain on WebAudio for desktop up to 4.0, but add an optional DynamicsCompressorNode on the global audio graph when gain > 1.0 to prevent harsh digital clipping on desktop speakers/headphones, maintaining click-free `setTargetAtTime` transitions.
