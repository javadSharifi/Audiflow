# Feature Specification: Volume Boost Accuracy & Seek Clarity

**Feature Branch**: `003-volume-boost-accuracy`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "مشکل در قسمت افزایش صدا: (۱) درصدهای ۲۰۰٪/۴۰۰٪ حس دروغ بودن می‌دهند — برنامه دیگر روی ۲۰۰٪ صدایی می‌دهد که این برنامه روی ۴۰۰٪ می‌دهد؛ (۲) وقتی آهنگ در حال پخش است و نوار پیشرفت را عقب/جلو می‌کنیم آهنگ خش‌خشی می‌شود و بعد خوب می‌شود، مثل اینکه نویز خش‌خش هم تقویت می‌شود."

## Clarifications

### Session 2026-09-16

- Q: Should the 100%–400% boost scale stay as-is with corrected loudness behind it, or should the labels change? → A: Keep 100%–400% labels, fix the loudness mapping and dB hint behind them.
- Q: On which device do you hear the weak boost and the seek crackle most clearly? → A: Android phone/tablet only.
- Q: What should you hear during the seek drag itself with boost on? → A: Keep playing throughout, just without crackle (no mute, no fade).
- Q: Should this fix also change the offline file-booster output, or only the live player sound? → A: Both live player and converted file output.
- Q: How should rapid consecutive seeks behave? → A: Soft-debounce rapid seeks (about 1 second or more between applied seeks) so fast scrubbing settles on the final position instead of firing a noisy re-seek per movement.
- Q: At maximum boost on an already-loud song, should safety capping limit loudness to avoid distortion? → A: No — always scale honestly even if loud tracks distort at maximum (user accepts the existing high-boost warning as the safety notice).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Honest boost loudness (Priority: P1)

A listener plays a quiet song, enables Sound Booster, and drags the level from 100% to 200% then 400%. What they hear must feel proportional to the number shown, and the dB hint next to the number must match what they actually hear. A 200% setting must be clearly louder than 125% and clearly quieter than 400% in a predictable way.

**Why this priority**: Trust in the headline numbers is broken. If users believe the percentages lie, the whole booster feature is rejected.

**Independent Test**: Play the same track with booster at 100%, 200%, 400% and compare perceived loudness steps. Each step up is audibly louder, in the same order and roughly the same step size on every run.

**Acceptance Scenarios**:

1. **Given** a track playing with booster off (100%), **When** the user sets 200%, **Then** the sound is clearly and repeatably louder than 100% without silence, muting, or distortion that hides the difference.
2. **Given** booster at 200%, **When** the user sets 400%, **Then** the sound is clearly and repeatably louder than 200%.
3. **Given** any boost level shown in the UI, **When** the user reads the level label and dB hint, **Then** raising the number always means louder sound and lowering it always means quieter sound (monotonic, no dead zones or jumps).

---

### User Story 2 - Clean scrubbing while boosted (Priority: P1)

A listener is playing a song with boost enabled (e.g. 200%+) and drags the progress bar back/forward to find a part. During and immediately after the drag, the audio must stay clean — no crackle, harsh burst, or amplified scratch — and playback must resume at the new position at the same boost level within a moment.

**Why this priority**: Crackling on every seek makes the booster unusable for real listening; users scrub constantly.

**Independent Test**: With boost at 200% and at 400%, drag the seekbar to 5 different positions (start, middle, end). Each seek lands cleanly with no sustained crackle.

**Acceptance Scenarios**:

1. **Given** a track playing with boost above 100%, **When** the user drags the seekbar to a new position and releases, **Then** audio resumes at the new position within 2 seconds with no crackle lasting longer than a brief instant.
2. **Given** a track playing with boost at maximum, **When** the user performs 3 rapid consecutive seeks, **Then** no seek produces a loud burst noticeably above the music level and playback never gets stuck silent.
3. **Given** a seek in progress, **When** the seek completes, **Then** the boost level after the seek equals the boost level before the seek (setting is preserved).

---

### User Story 3 - No painful surprises at high boost (Priority: P2)

A listener pushes the booster above 200% on a loud track. The app must keep the output safe and intelligible — loud parts must not turn into harsh clipping, and the warning the user already accepted must still describe reality.

**Why this priority**: A boost that clips or hurts ears at 300-400% reinforces the "percentages are fake/broken" feeling and risks hearing damage.

**Independent Test**: Play an already-loud track at 400% from start to finish. Output stays controlled with no sustained harsh distortion.

**Acceptance Scenarios**:

1. **Given** an already-loud track, **When** the user confirms the high-boost warning and sets maximum boost through the loudest chorus, **Then** the output follows the same honest percentage step as quiet tracks (no hidden capping) and playback continues without dropouts.
2. **Given** boost above 200%, **When** the user mutes or returns to 100%, **Then** the change is immediate and click-free.

### Edge Cases

- What happens when the user seeks while paused with boost enabled — does resume stay clean and at the same level?
- How does the system handle seeking a very short track (< 5 seconds) or seeking past the end while boosted?
- What happens when the user toggles booster off mid-seek?
- How does the system behave on an already-loud/mastered track at 400% — is output kept safe instead of clipping?
- What happens when the user drags the boost slider rapidly from 100% to 400% during playback — are changes smooth with no clicks/pops?
- How does the system handle boost on a silent/very quiet intro — does the noise floor get amplified into audible hiss?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST make each boost percentage step audibly distinct and ordered — a higher shown number always produces louder output than a lower one across the full 100%–400% range.
- **FR-002**: System MUST display a loudness hint alongside the percentage that truthfully describes the change (relative loudness units), consistent with what the listener hears.
- **FR-003**: System MUST preserve the user's chosen boost level across seeks, track changes, pause/resume, and app restarts of the same session (no silent reset to 100%).
- **FR-004**: System MUST keep seeking clean while boost is active — scrubbing the progress bar keeps playing throughout with NO mute or fade dip and MUST NOT produce sustained crackle, loud bursts, or amplified seek noise. Rapid consecutive seeks MUST be soft-debounced (about 1 second between applied seeks) so fast scrubbing settles on the final position.
- **FR-004b**: Converted file output MUST follow the same honest percentage-to-loudness progression as the live player — the same percentage chosen live produces the same relative loudness step in the converted file.
- **FR-005**: System MUST resume normal boosted playback at the new position within 2 seconds after a seek ends.
- **FR-006**: System MUST scale honestly at maximum boost even on already-loud tracks — no safety capping that would make 400% sound quieter than the promised step. The existing above-200% warning/confirmation is the safety notice; the listener accepts the distortion risk.
- **FR-007**: System MUST apply boost changes (slider, dial, toggle) smoothly with no clicks, pops, or momentary silence during normal playback.
- **FR-008**: System MUST fix and verify the boost progression and clean seeking on Android first; desktop behavior MUST NOT regress and should follow the same relative loudness progression where the booster is offered.

### Key Entities

- **Boost Level**: The user-facing 100%–400% setting plus its truthful loudness description; the single value the listener controls and the system preserves.
- **Playback Session**: The currently playing track plus its position, playing/paused state, and active boost level; seeking moves within it without losing the boost.
- **Seek Operation**: A user-initiated jump to a new position (drag, tap on bar, skip); the moment during which output must stay clean and then resume boosted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a listening check of 100% vs 200% vs 400% on the same track, 9 out of 10 listeners correctly order the three levels by loudness.
- **SC-002**: 95% of test seeks performed with boost at 200% and 400% (at least 20 seeks across start/middle/end of tracks) complete with no crackle lasting longer than a brief instant and resume at the new position within 2 seconds.
- **SC-003**: At maximum boost the loudness step measures the same on loud and quiet tracks (no hidden capping); the above-200% warning is shown and confirmed before the maximum is applied.
- **SC-004**: Boost-related complaints of type "percentages feel fake" drop to zero in follow-up testing with the reporting user (user confirms 200% now sounds like a true middle step between 100% and 400%).

## Assumptions

- Scope is the live Music Player booster (the 100%–400% dial/slider) AND the offline file-booster output levels: per clarification 2026-09-16 both the live loudness progression and the converted-file loudness must feel like the same honest percentage scale.
- "Percent" is relative amplitude multiplier (200% = twice the amplitude of 100%). Per clarification 2026-09-16 the 100%–400% labels are kept; the fix corrects the loudness mapping and dB hint behind them with no new range beyond 400% and no relabeling to a dB-only scale.
- The comparison app cited by the user is a real-time playback booster, so calibration is judged by ear on the same device/speakers, not by file-output measurements.
- Existing safety UX (confirmation modal above 200%, warning banner) is kept; only the truthfulness of levels and the seek behavior change.
- Offline-first and single-active-stream rules from the constitution still hold; no cloud, account, or new permission is needed for this fix.
