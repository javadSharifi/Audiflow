# Feature Specification: Converter Modal Z-Index and Trim Editor Playback Fixes

**Feature Branch**: `010-fix-converter-trim-modal`

**Created**: 2026-09-19

**Status**: Ready for Planning

**Input**: User description: "توی صفحه مبدل صدا ما باگ داریم نگاه وقتی فایل اپلود میکنیم icon تقویمت صدا رو میزنیم ی مودال باز میشه ولی میره پشت باتن نویگشن ویرایش برش همین طور باگ بعدی ۱.در قسمت ویرایش برش وقتی ۱۰ ثانیه اخر میزنمی اهنگ پلی نمیشه ۲. به جای ۱۰ ثاینه بکن ۵ ثانیه ۳.این متن برای شنیدن وی بخش نارنجی بزن" -> Clarified: "کلن متن اون بالا رو پاک کن زیر اون نوار ی راهنمای کوچیک برای نوار بزار"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Unobstructed Modal Stacking in Converter (Priority: P1)

As a user uploading audio files in the converter on mobile or narrow screens,
When I tap either the Sound Booster icon ("تقویت صدا") or Trim icon ("ویرایش برش") on a file card,
I want the editor bottom sheet modal to open fully in front of the bottom navigation dock,
So that all controls, waveform visuals, and action buttons are immediately accessible and not hidden behind the navigation bar.

**Why this priority**: High-severity visual and usability defect. Tapping the edit buttons opens a modal partially obscured by the bottom navigation bar (`z-[55]`), preventing users from reaching controls or comfortably interacting with the editor.

**Independent Test**:
- Open the app on a viewport narrower than 768px (or mobile view).
- Add an audio file in the Converter Wizard step 1.
- Tap the Volume Booster button or the Trim button.
- Verify the modal sheet renders entirely in front of the bottom navigation dock, with all bottom controls, inputs, and waveforms clearly visible and interactive.

**Acceptance Scenarios**:
1. **Given** an uploaded file in the Converter file list on a mobile/tablet viewport, **When** the user taps the Trim button, **Then** the Trim Editor modal opens on top of the entire screen including the bottom navigation dock.
2. **Given** an uploaded file in the Converter file list on a mobile/tablet viewport, **When** the user taps the Sound Booster button, **Then** the Sound Booster modal opens on top of the entire screen including the bottom navigation dock.
3. **Given** an active editor modal, **When** the user scrolls through the modal contents, **Then** no modal interactive elements are occluded by or trapped underneath the floating navigation bar.

---

### User Story 2 - Reliable "Last 5s" and "First 5s" Preview Audition (Priority: P1)

As a user adjusting audio cut points in the Trim Editor,
When I tap the "Last 5s" ("۵ ثانیه آخر") preview button,
I want the audio to seek to 5 seconds before the selection end and play smoothly until the selection end,
So that I can verify the exact boundary without playback stalling, failing, or immediately pausing.

**Why this priority**: Functional failure in core trimming preview. Users cannot audition the end of their cut point if playback does not start.

**Independent Test**:
- Open the Trim Editor for an audio track.
- Tap "Last 5s" ("۵ ثانیه آخر").
- Verify the audio immediately begins playing from `end - 5s` up to `end`, and automatically stops upon reaching `end`.
- Repeat the test immediately after full playback or end-of-track has been reached to verify seek recovery.

**Acceptance Scenarios**:
1. **Given** an audio file with default selection (full length) or custom trim bounds, **When** the user taps "Last 5s", **Then** the playhead jumps to 5 seconds before the end bound and begins audible playback.
2. **Given** playback has reached the end bound and stopped, **When** the user taps "Last 5s" again, **Then** the playhead properly re-seeks and replays the final 5 seconds without immediately re-pausing.
3. **Given** a selection where the duration between start and end is between 5 and 10 seconds, **When** the user taps "Last 5s", **Then** the snippet plays from `end - 5s` without clipping below the start bound.

---

### User Story 3 - 5-Second Snippet Auditioning & Timing Update (Priority: P2)

As a user fine-tuning cut points,
I want the quick preview buttons to audition 5-second snippets rather than 10-second snippets,
So that I can quickly verify boundaries with concise, focused previews.

**Why this priority**: Directly requested UX refinement to shorten audition intervals from 10s to 5s for faster editing loops.

**Independent Test**:
- Verify button labels display "First 5s" ("۵ ثانیه اول") and "Last 5s" ("۵ ثانیه آخر").
- Verify that tracks with duration >= 5.05s show the quick snippet buttons (previously requiring >= 10.05s).
- Verify that tapping "First 5s" auditions exactly up to 5 seconds from the start bound.

**Acceptance Scenarios**:
1. **Given** an audio file longer than 5 seconds, **When** the trim editor is displayed, **Then** the preview buttons show "۵ ثانیه اول" and "۵ ثانیه آخر" (in Persian) / "First 5s" and "Last 5s" (in English).
2. **Given** an audio file between 5.05s and 10s in length, **When** the user opens the trim editor, **Then** the 5s preview buttons are visible and active.
3. **Given** an audio file shorter than 5.05s, **When** the user opens the trim editor, **Then** the snippet buttons are cleanly hidden and only the full selection play button is offered.

---

### User Story 4 - Clean Trim Layout with Compact Waveform Guide (Priority: P3)

As a user trimming audio,
I want the redundant text at the very top of the editor removed, and a small, subtle guide placed directly under the waveform bar,
So that the interface is decluttered and the guidance is situated directly where the interaction occurs.

**Why this priority**: Directly requested UI refinement to eliminate clutter at the top of the editor and position contextual help right next to the waveform.

**Independent Test**:
- Open the Trim Editor in both Persian and English locales.
- Verify the top `<p>` heading guide text is completely removed.
- Verify a subtle, compact hint ("برای شنیدن روی بخش نارنجی بزن" / "Tap the orange section to listen") appears directly beneath the waveform canvas.

**Acceptance Scenarios**:
1. **Given** the Trim Editor is opened, **When** the user looks at the top of the editor, **Then** there is no redundant header guide text above the action buttons.
2. **Given** the Trim Editor is opened, **When** the user looks directly below the waveform canvas, **Then** a compact contextual hint explains that tapping the orange area plays the selection.
3. **Given** the app language is toggled between Persian and English, **Then** the localized guide text updates accordingly without hardcoded literals.

---

### Edge Cases

- **Audio duration < 5 seconds**: The "First 5s" and "Last 5s" buttons are hidden; only "Play Selection" and "Reset" are available.
- **Selection duration < 5 seconds**: When custom handles are dragged such that `end - start < 5s`, tapping "First 5s" or "Last 5s" clamps cleanly to the selection interval without seeking before `start` or after `end`.
- **Seek latency / asynchronous browser audio**: When seeking to `end - 5s`, the playback guard must not interpret previous playhead positions (e.g. `currentTime >= end`) as an immediate stop condition while `seeking` is underway.
- **Audio element duration mismatch**: If container duration reported by backend slightly exceeds decoded duration in the browser, seeking to `end - 5s` uses safe clamped boundaries (`Math.min(audio.duration, duration)`).
- **Navigation Dock Visibility**: When modal is open on small screens, the modal sheet must have a higher z-index (e.g., `z-[60]` or `z-[70]`) so the backdrop covers the screen and the dock sits underneath the backdrop.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The modal container in `FileList.tsx` (`MobileEditModal`) MUST have a stacking context (`z-index`) higher than the navigation dock (`MusicPlayerNav`, `z-[55]`).
- **FR-002**: The modal backdrop and bottom sheet MUST prevent user clicks from falling through to the bottom navigation buttons while the modal is open.
- **FR-003**: The Trim Editor quick preview buttons MUST be configured for 5-second snippets instead of 10-second snippets.
- **FR-004**: The minimum duration threshold for displaying the quick preview buttons MUST be reduced from 10.05 seconds to 5.05 seconds.
- **FR-005**: Tapping "Last 5s" MUST reliably play audio starting from `Math.max(start, end - 5)` up to `end`.
- **FR-006**: The playback time-update handler MUST ignore boundary termination checks while the audio element is in a `seeking` state or before the seek to `targetStart` has completed.
- **FR-007**: When playback reaches `targetEnd`, the audio MUST pause cleanly and reset internal preview bounds without preventing subsequent preview triggers.
- **FR-008**: All user-facing strings MUST be defined in `src/i18n/fa.ts` and `src/i18n/en.ts` using `translate(lang, key)`. No hardcoded strings are permitted.
- **FR-009**: The top guide text at the start of `TrimEditor.tsx` MUST be removed.
- **FR-010**: A small, subtle guide label MUST be placed directly beneath the waveform canvas container reading "برای شنیدن روی بخش نارنجی بزن" in Persian and "Tap the orange section to listen" in English.

### Key Entities

- **InputFile**: Stores audio metadata (`path`, `durationSecs`, `trimStartSecs`, `trimEndSecs`, `boostEnabled`, etc.).
- **TrimPreviewRange**: Defines the active audition window (`from`, `to`, `previewEndRef`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0% occlusion of editor modal controls by the bottom navigation dock across all supported viewport sizes.
- **SC-002**: 100% reliable playback when tapping "Last 5s" (audio auditions for 5 seconds and pauses at the end bound, across consecutive attempts).
- **SC-003**: 5-second snippet preview buttons appear for any audio file with duration >= 5.05s.
- **SC-004**: Top guide text in Trim Editor is removed; waveform sub-guide is displayed with accurate i18n keys.
- **SC-005**: All automated frontend tests pass (`pnpm test`) and typechecks pass (`pnpm check:types`).

## Assumptions

- Elevating `MobileEditModal` from `z-50` to `z-[60]` (or higher, below toast notifications at `z-[100]`) is sufficient to ensure proper visual layering above `MusicPlayerNav` (`z-[55]`).
- The 10s snippet functionality was isolated to `TrimEditor.tsx` and can be migrated to 5s without regressions to other converter functions.
- The browser `<audio>` element with `convertFileSrc` supports seeking within the decoded file buffer.
