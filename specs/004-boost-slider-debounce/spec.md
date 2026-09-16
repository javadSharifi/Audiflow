# Feature Specification: Boost Slider Debounce

**Feature Branch**: `004-boost-slider-debounce`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "وقتی نوار بست (بوست) صدا رو می‌کشیم، هر حرکت سریع می‌خواد صدا رو بوست کنه و صدا بریده‌بریده می‌شه. قرار شد دیبانس بدیم. نمی‌خوام اصلاً صدا جرجر بشنوم."

## Clarifications

### Session 2026-09-16

- Q: Should dragging the boost slider apply every intermediate value live, or coalesce rapid changes? → A: Coalesce — audio follows with a soft debounce, zero chopping/crackle is the hard requirement.
- Q: Should the dial/slider UI itself lag while debounced? → A: No — the UI number follows the finger instantly (optimistic); only the audio engine application is debounced.
- Q: While the finger is still moving, should loudness glide behind the finger or hold-and-jump on release? → A: Glide smoothly behind the finger during the drag, settle exactly on release.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smooth boost dragging with zero chopping (Priority: P1)

A listener plays a song and drags the boost slider/dial continuously from 100% to 400% (or back down). While dragging, the loudness changes smoothly with the finger — never stuttering, chopping, or crackling — and when the finger stops, the sound settles exactly on the shown number within a moment.

**Why this priority**: Chopped audio on every boost drag makes the flagship booster feel broken; the user explicitly demands zero crackle.

**Independent Test**: Drag the slider slowly and quickly across the full range at least 10 times (up and down, at 200% and 400% regions). Every drag sounds smooth with no chop, and the final heard level always matches the shown number.

**Acceptance Scenarios**:

1. **Given** a track playing with booster on, **When** the user drags the boost slider continuously from 100% to 400%, **Then** the loudness rises smoothly with no stutter, chop, or crackle at any point during the drag.
2. **Given** a drag in progress, **When** the user releases the slider at 300%, **Then** the audio settles exactly on the 300% level within 1 second and the shown number and heard level agree.
3. **Given** rapid back-and-forth wiggles of the slider, **When** the finger stops, **Then** playback never goes silent, never gets stuck at an intermediate level, and the final level equals the shown number.

---

### User Story 2 - Live UI number while audio follows softly (Priority: P2)

A listener drags the boost dial. The big percentage number and the arc track the finger frame-by-frame with no lag, even though the audio engine applies the change softly behind the scenes.

**Why this priority**: A lagging number feels like a frozen app; the number must stay alive while the audio stays clean.

**Independent Test**: Drag the dial quickly and watch the number — it updates on every movement with no visible delay, while the audio stays smooth.

**Acceptance Scenarios**:

1. **Given** a boost drag, **When** the finger moves, **Then** the displayed percentage updates immediately on every movement (no batching of the UI itself).
2. **Given** the finger stops, **When** the audio settles, **Then** the heard level matches the last displayed number.

### Edge Cases

- What happens when the user drags the slider while a seek is also settling — do both settle correctly without fighting?
- What happens when the user toggles the booster off mid-drag?
- What happens when the user drags past the 200% gate without confirming — does the pending high-boost value behave as before?
- What happens on an already-loud track dragged quickly to 400% — still smooth, with the existing warning as the safety notice?
- What happens when the app goes to background mid-drag on Android?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST coalesce rapid boost-level changes during a drag into a smooth glide that follows the finger — the audio engine applies throttled intermediate values (never one restart per movement) so dragging MUST NOT produce stutter, chop, or crackle.
- **FR-002**: System MUST always settle the audio exactly on the final shown value within 1 second after the drag ends (no stuck intermediate level, no silence).
- **FR-003**: System MUST keep the displayed percentage, dial arc, and dB badge live on every finger movement (optimistic UI, no debounced display).
- **FR-004**: System MUST apply the settled gain change smoothly (no clicks, pops, or momentary silence).
- **FR-005**: System MUST preserve the existing above-200% confirmation gate and warning banner behavior unchanged.
- **FR-006**: System MUST preserve the chosen boost level across the drag (no reset to 100% or to the drag-start value).

### Key Entities

- **Boost Drag**: A continuous gesture (slider move, dial rotation) producing a stream of requested percentages; the UI reflects each one instantly while the engine applies a coalesced subset.
- **Settled Gain**: The single gain value the audio engine converges to after the gesture ends — always equal to the last shown number.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 20 full-range drags (slow + fast, up + down), zero drags produce any audible chop, stutter, or crackle as judged by the reporting user.
- **SC-002**: 100% of drags settle the heard level on the shown number within 1 second of release.
- **SC-003**: The displayed number visibly updates on every movement of every test drag (no UI lag perceived).

## Assumptions

- Scope is the live Music Player boost controls (slider + rotary dial in `BoosterView`); the file-converter Manual path is unaffected (no gesture stream there).
- The honest single-path gain mapping from `003-volume-boost-accuracy` is the foundation; this feature only changes *when/how often* the engine applies values during a gesture, not the values themselves.
- The ~1 second settle budget mirrors the seek-debounce window already accepted by the user; the exact coalescing interval is an implementation detail within that budget.
- Offline-first, single-stream, and no-new-permission rules from the constitution still hold.
