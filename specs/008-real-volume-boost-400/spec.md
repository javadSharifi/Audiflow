# Feature Specification: Real 400% Volume Boost & Perceived Loudness

**Feature Branch**: `008-real-volume-boost-400`

**Created**: 2026-09-19

**Status**: Ready for Planning

**Input**: User description: "ما انگار در قسمت افزایش صدا ی باگ دارم این که واقعا وقتی میام این میزاریم روی ۴۰۰ درصد واقعا نمیاد صدا رو ۴۰۰ دصد بهتر کنه ولی در برنامه های رقیب اونا واقعا ۴۰۰ درصد واقعی هستن میخوام ببنم دلیل این موضوع چی ؟"

## Clarifications & Decisions

### Session 2026-09-19
- **Q1: Android Gain Target at 400%**: Selected **Option A — Full Aggressive 8000 mB**. Android live playback booster will map the 100%–400% range up to `8000 mB` (+80 dB nominal) using `BoostEngine`'s full reverse-engineered range matching reference competitor apps (`com.cool.volume.sound.booster`). The user explicitly accepts distortion risks at maximum volume on weak speakers, relying on the existing >200% high-boost warning modal for user consent.
- **Q2: Offline File Booster DSP Model**: Selected **Option A — Dynamic Normalizer + Limiter (`dynaudnorm + alimiter`)**. For offline manual file boosting, the FFmpeg filter chain will combine dynamic normalization with a safety limiter ceiling, preventing the limiter from ducking/choking the signal and allowing genuine 400% perceived loudness in exported files.

### Root-Cause Summary
1. **Android Live Player**:
   - `audioEngine.ts` previously calculated gain using the voltage formula `20 * log10(fraction)`, which only produced **+12.04 dB (1204 mB)** at 400%.
   - In psychoacoustics, +10 dB is perceived as only ~2× loudness doubling (Stevens' power law); +12 dB sounds only ~2.3× louder.
   - Android's native `LoudnessEnhancer` is a dynamic compressor/limiter. When fed only 1204 mB on modern music, the internal compressor suppressed peaks, yielding only 2–3 dB effective increase on phone speakers.
   - Competitor booster apps pass up to `8000 mB` into `LoudnessEnhancer`, forcing the DSP to maximize physical acoustic output.
2. **Offline File Booster**:
   - In `presets.rs`, manual mode previously applied `volume=4.000,alimiter=...`. Multiplying by 4 pushed audio into extreme overdrive, causing the `alimiter` to duck the entire signal by 12 dB, creating heavy pumping and muffled audio instead of perceived volume.
3. **UI Inconsistency**:
   - `GainSlider.tsx` was capped at 200%, while `BoosterView.tsx` scaled up to 400%.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Truly Powerful 400% Loudness on Android Playback (Priority: P1)

A listener on an Android mobile device plays a track in the Music Player, opens Sound Booster, and sets the boost level to 400%. The resulting output is dramatically louder, matching the high acoustic intensity of dedicated competitor volume booster apps.

**Why this priority**: Directly restores trust and delivers the core promise of the booster feature on mobile hardware.

**Independent Test**: Play a standard track on an Android device at 100%, 200%, and 400%. 400% produces maximum acoustic output matching the reference competitor booster app without silent drops or engine crashes.

**Acceptance Scenarios**:
1. **Given** a track playing at normal volume (100%), **When** the user drags the boost dial to 400% and confirms the high-boost warning dialog, **Then** output loudness increases aggressively up to 8000 mB target gain, matching competitor app output.
2. **Given** boost adjusted from 100% to 200% to 400%, **When** listening through phone speakers, **Then** each progression step is distinctly and significantly louder to human ears (perceptually ordered).
3. **Given** 400% boost active, **When** high-intensity passages play, **Then** playback remains continuous with no dropouts or audio server disconnects.

---

### User Story 2 - Effective Offline File Booster Amplification (Priority: P2)

A user converts an audio file using the File Booster at 400% boost. The exported file plays back significantly louder on any player without suffering from harsh limiter pumping or muffled dynamics.

**Why this priority**: Ensures offline converted files match the perceived loudness expectations set by the live player.

**Independent Test**: Boost a track to 400% in File Booster, export it, and compare integrated loudness (LUFS) against the original file.

**Acceptance Scenarios**:
1. **Given** an audio file processed with 400% manual boost, **When** played on any standard player, **Then** its perceived loudness is noticeably higher than the original file without rhythmic ducking/pumping.
2. **Given** a high boost setting (above 200%), **When** the file is rendered, **Then** dynamic normalization (`dynaudnorm`) smoothly amplifies quiet sections while the terminal `alimiter` prevents digital clipping beyond −0.5 dBFS.

---

### User Story 3 - Unified 400% Booster Experience Across Desktop & Mobile (Priority: P3)

A user navigating between the live Music Player and the File Booster encounters consistent ranges (0%–400%) and clear feedback on both screens.

**Why this priority**: Eliminates confusing discrepancies between 200% on one screen and 400% on another.

**Independent Test**: Verify both File Booster slider and Music Player rotary dial support 400% with high-boost warning styling when exceeding 200%.

**Acceptance Scenarios**:
1. **Given** the File Booster manual gain slider, **When** adjusting gain, **Then** the slider permits values up to 400% with high-boost warning styling matching the Music Player.

---

## Edge Cases

- What happens when a track with 0 dBFS normalized peaks is boosted to 400%? In live playback, `LoudnessEnhancer` dynamic compressor saturates to maximum speaker power. In offline conversion, `dynaudnorm` combined with `alimiter` caps true peaks at −0.5 dBFS to prevent DAC clipping.
- What happens when the user seeks while at 400% boost? Playback continues cleanly with soft-debouncing without loud transient pops or bursts.
- What happens when the user rapidly slides from 100% to 400%? The gain smoothly updates without clicks or native audio driver crashes.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide an aggressive, full-range boost mapping for Android live playback such that 400% drives Android's `BoostEngine` to its full reference capacity of 8000 mB (+80 dB nominal target gain).
- **FR-002**: System MUST preserve the existing confirmation modal and warning notices whenever the user selects a boost level above 200%.
- **FR-003**: System MUST update the offline File Booster DSP chain for high manual boost (100%–400%) to integrate dynamic normalization (`dynaudnorm`) before the terminal `alimiter` ceiling, avoiding limiter choking while maximizing perceived loudness.
- **FR-004**: System MUST update `file-booster/GainSlider.tsx` to support a 0%–400% range, matching the live Music Player scale.
- **FR-005**: System MUST maintain the constitutional requirement of a hard safety peak ceiling (`alimiter=limit=0.95:...`) on all offline booster outputs to prevent hardware DAC overflow.
- **FR-006**: System MUST ensure smooth transitions and debounce rapid adjustments to prevent native audio engine pops.

---

### Key Entities

- **Boost Calibration Range**: The mapping between user percentage (100%–400%) and native `BoostEngine` target gain (0 to 8000 mB on Android).
- **Dynamic Normalization Stage**: The FFmpeg `dynaudnorm` DSP filter applied upstream of `alimiter` for offline file boosting.
- **High-Boost Safety Gate**: The UI confirmation and warning banner triggered above 200% boost.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On physical Android hardware, 400% boost matches or exceeds the audible acoustic output of reference competitor booster apps (`com.cool.volume.sound.booster`) on identical test tracks.
- **SC-002**: 100% of tested users perceive 200% and 400% boost steps as distinctly and progressively louder.
- **SC-003**: Offline converted files at 400% boost achieve at least a +6 LUFS increase in integrated loudness without audible pumping artifacts.
- **SC-004**: All exported files maintain peak amplitude at or below −0.5 dBFS, guaranteeing zero DAC overflow.

---

## Assumptions

- Android users explicitly accept the risk of speaker distortion at 400% on loud tracks via the high-boost confirmation modal.
- `BoostEngine.setGainFromPercent` on Android provides the exact 0–8000 mB linear-fraction mapping reverse-engineered from the reference competitor app.
- Desktop WebAudio applies appropriate scaling with limiter/compression where supported.
