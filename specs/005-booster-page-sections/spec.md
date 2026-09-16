# Feature Specification: Booster Page Four Sections

**Feature Branch**: `005-booster-page-sections`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "میخوام صفحه مدبیل صدا رو به سه سه بخش تقسیم کنم ۱. اپلود فایل (پایینش یا بالاشم توضیح بده که میتونی چه کار های انجام بدی) ۲. تنظیمات خروجی ۳. خروجی و اشتراک گزاری (توضیحات بده مثل کجا ذخیره شده حجمش چقدر کم شده و..)"

## Clarifications

### Session 2026-09-16

- Q: Where should the capability explainer sit relative to the upload control in section 1? → A: Explainer text below the upload card.
- Q: When the user exports more than once for the same file, what should the result section show? → A: Only the latest export result, replacing the previous summary.
- Q: Which actions must the result section offer for the boosted file? → A: Open folder + play + system share + copy path.
- Q: While an export is running, where should the progress indicator live? → A: Four sections instead of three — dedicated progress section: (1) upload, (2) configs, (3) progress, (4) result.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload a file and understand what the booster can do (Priority: P1)

A user opens the sound-booster page and sees a clearly numbered first section for uploading a file. Below the upload control there is a short explanation of what the page can do (boost loudness, pick a preset, preview before/after, export to a chosen format). The user picks an audio file and immediately sees its name, size, and duration inside the same section.

**Why this priority**: Without a clear entry point and capability explanation, users do not know what the page does or what file to give it. This is the gateway to every other step.

**Independent Test**: Can be fully tested by opening the page with no file selected and by selecting a file — the section title, explainer text, and file summary are all visible without touching settings or export.

**Acceptance Scenarios**:

1. **Given** the booster page with no file selected, **When** the user looks at section 1, **Then** they see a section title (step 1 / upload), an upload control, and a short explainer of capabilities (what can be boosted, previewed, exported).
2. **Given** section 1 with no file, **When** the user chooses an audio file, **Then** the same section shows the file name, original size, and duration plus controls to change or remove the file.
3. **Given** a selected file, **When** the user reads the explainer, **Then** it is understandable in both English and Persian layouts (RTL correct) without jargon.

---

### User Story 2 - Configure output before exporting (Priority: P2)

A user with a file selected moves to the second numbered section ("configs / output settings") where they choose the enhancement (preset or manual gain) and the output format, listen to the original-vs-boosted preview, and start the export. Settings in this section are disabled until a file exists.

**Why this priority**: This is the core value step — choosing how loud and in what format. Separating it from upload, progress, and results removes the current single-column confusion.

**Independent Test**: Can be fully tested by selecting a file, changing preset/gain/format, playing the preview, and starting an export — all inside section 2.

**Acceptance Scenarios**:

1. **Given** no file is selected, **When** the user looks at section 2, **Then** the settings controls are visibly disabled with a hint to upload first.
2. **Given** a file is selected, **When** the user picks a preset or adjusts manual gain and picks a format, **Then** the preview reflects the choice and the export action becomes available.
3. **Given** an export is running, **When** the user tries to change settings, **Then** the settings are locked until the export finishes or fails.

---

### User Story 3 - Follow export progress in its own section (Priority: P2)

A user who started an export follows it in the third numbered section ("progress"), which shows live percent, speed/state, and any error in plain language. Before any export starts the section shows an idle hint of what will appear here.

**Why this priority**: A dedicated progress step keeps the configs section clean and tells the user exactly where to look while the export runs.

**Independent Test**: Can be fully tested by starting an export and watching section 3 — percent advances, completion hands off to section 4, and failures show a plain-language error with no partial file presented as success.

**Acceptance Scenarios**:

1. **Given** no export has started, **When** the user looks at section 3, **Then** they see an idle hint describing what progress will look like here.
2. **Given** an export is running, **When** the user looks at section 3, **Then** they see live progress (percent plus speed/state where available).
3. **Given** an export fails, **When** the user looks at section 3, **Then** they see a plain-language error and sections 1–2 stay usable.

---

### User Story 4 - See output results and share them (Priority: P3)

After an export finishes, the user goes to the fourth numbered section ("result / output & sharing") which explains what happened: where the file was saved, output file name, new size, how much smaller/larger it is versus the original, and offers actions to open the save location, play the result, copy the path, and share it.

**Why this priority**: Users currently do not know where the boosted file went or what changed. This section closes the loop and drives sharing/reuse.

**Independent Test**: Can be fully tested by completing one export — section 4 shows save location, size comparison, and working open/play/copy/share actions. Only the latest export result is shown.

**Acceptance Scenarios**:

1. **Given** a completed export, **When** the user looks at section 4, **Then** they see the saved file path/location, output size, and size difference versus the original (e.g., saved X MB / Y% smaller).
2. **Given** a completed export, **When** the user activates the location action, **Then** the save folder opens (or the path is revealed/copyable on platforms where opening a folder is unavailable).
3. **Given** a completed export, **When** the user activates share/play/copy actions, **Then** they can share the file through the platform share options, copy the saved path, and play back the boosted result.

---

### Edge Cases

- What happens when the user tries to export with no file? Export stays unavailable; section 2 shows the upload-first hint.
- How does the page handle export failure? Section 3 shows a plain-language error; sections 1–2 stay usable and no partial file is presented as success.
- What happens with an unsupported or corrupt file? Section 1 shows a plain-language rejection and stays in the no-file state.
- How do sections behave on narrow screens? The four sections stack vertically in 1 → 2 → 3 → 4 order with no overlap or hidden actions.
- What happens when the user changes the file after an export? Previous progress state and output summary in sections 3–4 are cleared or marked as belonging to the old file so they cannot be mistaken for the new file's result.
- What happens when the user starts a second export for the same file? Section 3 restarts live progress and section 4 is replaced by the newest result on completion (only the latest result is kept).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Page MUST present exactly four visually distinct, numbered sections in order: (1) file upload, (2) configs / output settings, (3) progress, (4) result / output & sharing.
- **FR-002**: Section 1 MUST contain a file-upload control followed below by a short capability explainer (what the user can do: boost, preview, choose format, export).
- **FR-003**: Section 1 MUST display the selected file's name, original size, and duration, plus change-file and remove-file actions.
- **FR-004**: Section 2 MUST contain enhancement choice (preset selection including manual gain control), output format choice, before/after preview playback, and the export trigger.
- **FR-005**: Section 2 controls MUST be disabled with an upload-first hint while no file is selected, and locked while an export is in progress.
- **FR-006**: Section 3 MUST show export progress: an idle hint before any export, live percent (plus speed/state where available) while running, and a plain-language error on failure.
- **FR-007**: Section 4 MUST display, after each completed export: saved location/path, output file name, output size, and size comparison against the original (absolute difference and direction, e.g., smaller/larger). Only the latest export result is shown; each new export replaces the previous summary.
- **FR-008**: Section 4 MUST provide actions to open/reveal the save location, play the boosted result, share the output file via platform share options, and copy the saved file path.
- **FR-009**: Section 4 MUST show an empty state (what will appear here after export) before any export has completed.
- **FR-010**: Changing or removing the selected file MUST invalidate the previous progress state and output summary so stale results cannot be confused with the new file.
- **FR-011**: All section titles, explainers, hints, and result descriptions MUST be available in English and Persian with correct RTL layout; no hardcoded user-facing text.
- **FR-012**: Existing booster behavior (presets, gain range, preview, export success/failure semantics) MUST NOT change — only the page grouping, ordering, and explanations change.

### Key Entities

- **Booster job input**: The user-selected audio file; attributes: name, original size, duration.
- **Output settings**: The user's enhancement + format choices for the current file; attributes: preset/manual gain, output format.
- **Export progress**: The running export state; attributes: percent, speed/state, error (if failed).
- **Boost result summary**: The completed export description; attributes: saved location, output name, output size, size difference vs. original, shareable reference.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: First-time users can go from opening the page to a completed boosted file in under 3 minutes without asking for help.
- **SC-002**: 90% of test users can correctly state where their boosted file was saved and whether it is smaller or larger than the original after one export.
- **SC-003**: 90% of test users complete upload → configs → progress → result in the 1 → 2 → 3 → 4 section order with no backtracking on the first attempt.
- **SC-004**: Zero reports of "I can't find my boosted file" or "I don't know what this page does" in usability walkthroughs after the change.

## Assumptions

- Users are on the existing desktop/Android app shells; no new platform support is introduced by this change.
- Supported audio types, preset catalog, gain limits, and export pipeline stay as-is; this feature only regroups the page and adds explanations.
- Sections stack vertically (1 → 2 → 3 → 4) on narrow screens and may sit side-by-side on wide screens while preserving the same order.
- "Share" means the platform-native share/open mechanism already available to the app; no new accounts or cloud uploads are introduced.
- Size comparison uses the original selected file vs. the final exported file, both measured in bytes and shown in human-friendly units.
