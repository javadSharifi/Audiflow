# Feature Specification: Track Sound Booster UI/UX Redesign & Safe Protection

**Feature Branch**: `009-nowplaying-booster-ux`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description:
> "تو صفحه هر اهنگ ما ی دکمه بوست صدا داریم. این خیلی ui ux بوست صدا زشت این میخوام برام بهترش کنی. ۲.نگاه وقتی روی گزینه محافظت از اسپیکر میزنی صدای خود گوشی هم گم میشه تو ولی فقط باید درصد بوست بیار روی ۱۰۰ کاری به صدای گوشی نباید داشته باش"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Safe Speaker Protection Without Hardware Volume Muting (Priority: P1)

As a listener playing a track at high boost (>200%), when I tap the "Speaker Protection" (محافظت از اسپیکر) action, I want the booster to immediately return to safe 100% (neutral gain) while leaving my phone's hardware media volume completely untouched, so that my music remains clearly audible without sudden device volume loss.

**Why this priority**:
Currently, triggering speaker protection invokes a native routine that cuts the phone's hardware media volume down to 30%, severely disorienting the user and muting device sound. Fixing this directly restores safety and trust in the booster feature.

**Independent Test**:
Set track volume boost to 300% on a mobile/desktop device with hardware media volume at 80%. Tap "Speaker Protection".
Verify:
1. Boost gain resets to 100% (normal).
2. Hardware media volume remains exactly at 80% (zero change to system stream volume).
3. The track continues playing at standard volume without muting.

**Acceptance Scenarios**:
1. **Given** a song is playing with boost level set to 250% and device media volume at 70%, **When** the user taps the speaker protection / reset button, **Then** the boost level immediately switches to 100% and device media volume remains unchanged at 70%.
2. **Given** any boost level (from 105% to 400%), **When** speaker protection is tapped, **Then** visual and audio gain smoothly transition to 100% and the active preset badge highlights 100% (Normal).

---

### User Story 2 - Modern, Tactile Bottom Sheet UI/UX for Track Booster (Priority: P1)

As a listener in the full-screen track player (NowPlaying view), when I tap the Flame booster button, I want a sleek, modern, and fluid bottom sheet with polished typography, dynamic color stages (emerald -> amber -> orange -> rose), tactile preset buttons, and a smooth slider, so that adjusting boost feels delightful, responsive, and cohesive with the rest of the application.

**Why this priority**:
The existing popup is an unstyled, cramped developer prototype with plain text and raw input bars. Upgrading it to modern mobile-first UI standards significantly elevates perceived app quality and user satisfaction.

**Independent Test**:
Open the NowPlaying view of any song and tap the booster flame icon.
Verify:
1. A refined, backdrop-blurred bottom sheet animates smoothly upward with a rounded card layout and drag handle.
2. The current boost percentage is prominently displayed with dynamic color accenting and subtle glow matching the boost intensity.
3. Quick-preset pills (100%, 150%, 200%, 300%, 400%) are tactile, visually distinct, and easily tappable.
4. Selecting a preset updates audio in real time *without* prematurely closing the sheet, allowing the user to hear the change and continue fine-tuning.
5. The sheet can be dismissed comfortably via close button, backdrop tap, or downward swipe.

**Acceptance Scenarios**:
1. **Given** the track player is open, **When** the user taps the booster icon, **Then** a polished bottom sheet opens displaying the current boost percentage, status, preset chips, and smooth adjustment slider.
2. **Given** the bottom sheet is open at 100%, **When** the user taps the "200%" preset chip, **Then** the gain updates to 200% in real time, the theme transitions to warm amber, and the sheet remains open for further adjustments.
3. **Given** the bottom sheet is open, **When** the user taps outside the sheet or taps the close button, **Then** the sheet smoothly dismisses while retaining the selected boost level.

---

### User Story 3 - High-Boost Safety Confirmation & Feedback (Priority: P2)

As a user adjusting sound boost in the track sheet, when I select or drag to a high boost level exceeding 200% (such as 300% or 400%), I want a clear warning and confirmation prompt before enabling high power, so that I do not accidentally overdrive the device speaker without acknowledging the safety advisory.

**Why this priority**:
Prevents accidental extreme boost jumps while preserving user agency for intentional loud playback.

**Independent Test**:
With boost at 100%, tap the "300%" or "400%" preset pill or drag past 200%.
Verify:
1. If high boost has not been confirmed in the current session, the boost stops at 200% and displays the high-boost advisory modal.
2. If confirmed, the target boost (300% or 400%) activates with the warning indicator badge visible.
3. If canceled, the boost remains safely at 200%.

**Acceptance Scenarios**:
1. **Given** high boost is unconfirmed, **When** the user taps 400%, **Then** the safety confirmation dialog appears.
2. **Given** the safety dialog is visible, **When** the user taps "Confirm", **Then** 400% activates and the theme shifts to high-boost rose/flame.
3. **Given** the safety dialog is visible, **When** the user taps "Cancel", **Then** the level stays at 200% and no extreme gain is applied.

---

### Edge Cases

- **Rapid Preset Tapping**: If the user rapidly taps multiple presets (e.g. 100% -> 200% -> 150%), gain changes must glide smoothly without audio popping or race conditions.
- **Audio Paused / Idle**: If booster settings are modified while playback is paused, the selected boost percentage must persist and immediately take effect upon resuming.
- **Orientation & Screen Sizes**: On small mobile screens (under 380px width) and tablets/desktop, the bottom sheet/dialog must scale gracefully without overflow or clipping.
- **RTL / LTR Consistency**: In Persian (RTL) mode, preset ordering and slider direction must behave predictably without inverted controls.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST decouple the "Speaker Protection" action from device hardware volume (`AudioManager.STREAM_MUSIC`). Triggering speaker protection MUST strictly reset `volumeGainPercent` to 100% and MUST NOT modify system hardware volume.
- **FR-002**: The system MUST remove the native hardware stream volume downscaling routine (`AudioStreamManager.applyReduceHurt`) from the speaker protection button click path.
- **FR-003**: The track sound booster sheet MUST provide a single, unified "Speaker Protection / Reset to Safe (100%)" button (`محافظت از اسپیکر`) when volume gain exceeds 100%, replacing redundant separate reset buttons.
- **FR-004**: The track booster bottom sheet MUST be extracted into a dedicated, modular presentation component adhering to Single Responsibility and the ≤ 300 lines limit.
- **FR-005**: The booster sheet MUST display an interactive, styled gain slider spanning 100% to 400% with smooth graduation marks.
- **FR-006**: The booster sheet MUST display quick-selection preset pills for key stages: 100% (Normal), 150%, 200%, 300%, and 400% (Max).
- **FR-007**: Tapping a preset pill MUST update the gain in real-time without automatically closing the sheet.
- **FR-008**: The booster sheet MUST dynamically reflect visual theme stages based on the active gain:
  - **100%**: Emerald / Neutral
  - **101% - 175%**: Amber / Moderate
  - **176% - 250%**: Orange / High
  - **251% - 400%**: Rose / Extreme with pulsing glow
- **FR-009**: The booster sheet MUST enforce safety gating for levels above 200%, requiring user confirmation via the safety modal before applying extreme gain if not already unlocked.
- **FR-010**: All user-facing strings MUST be localized using `translate(lang, key)` in both English (`en`) and Persian (`fa`) with zero hardcoded text.

---

### Key Entities

- **TrackBoosterState**: Current boost percentage (`volumeGainPercent`: 100–400), enabled status (`isEnabled`: boolean, true when > 100%), safety unlock status (`isHighBoostUnlocked`: boolean).
- **BoostPreset**: Preset configuration containing percentage value (`100`, `150`, `200`, `300`, `400`), localized label, and theme color token.
- **SpeakerProtectionAction**: Action that safely transitions `volumeGainPercent` to 100% without hardware stream side effects.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of speaker protection invocations reset software boost to 100% with exactly 0 dB alteration to the operating system's hardware media volume stream.
- **SC-002**: Users can open the booster sheet, select any preset, and audition the sound difference in under 1 second without sheet auto-dismissal interruptions.
- **SC-003**: Visual design matches modern fluid design principles with dynamic accent colors, smooth sheet animations (≤ 200ms open/close), and zero layout shifting across screen sizes.
- **SC-004**: Zero hardcoded strings across Persian and English locales (100% test coverage for i18n keys).
- **SC-005**: The new modular booster component stays strictly under the 300-line ceiling.

---

## Assumptions

- The underlying sound boost engine (`audioEngine.ts` and `BoostEngine.kt`) already supports real 100%–400% gain mapping (0–8000 mB) and handles DSP limiter protection.
- The user operates in either Persian (`fa`) or English (`en`) interface languages.
- Hardware volume controls (physical rocker buttons on the phone) remain the exclusive domain of the user and the Android OS; the app does not override them when protecting speakers.
