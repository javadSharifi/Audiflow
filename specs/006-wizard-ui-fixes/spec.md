# Feature Specification: Wizard UI Fixes

**Feature Branch**: `006-wizard-ui-fixes`

**Created**: 2026-09-16

**Status**: Draft

## Clarifications

### Session 2026-09-16

- Q: How should files that failed to convert appear on the result step? → A: Failed files appear in the list with an error state (name + error, no size), successes show name/format/size.


**Input**: User description: "تغییر ها ui که باید در صفحه تدبیل فایل بدی: ۱. این باکس های تبدیل تریم و... پاک کن ۲. دکمه مرحله بعدی هم اندازه باتن نویگیشن کن الان خیلی ازش بزرگ تر ۳. وقتی فایل وارد میکنی دو تا ایکون میاد یکیش بوست صداش یکی ترم اینا اصلا معلوم نیست مال چه کاری و خیلی کوچیک — یه جور بزار که کاربر بیشتر بهش دقت کنه یا راهنما زیرش بنویسی افزایش صدا و تریم در همین صفحه انجام میشود فقط بعضی قسمت هاشو رنگی کنی که کاربر بهتر بفهمه ۴. در صفحه تمام شد فقط یک فایل نمایش میدی — میخوام هر چند تا بود بزاری و دکمه کپی مسیر اشتراک گذاری باز کردن پوشه خروجی حذف کنی فقط پیش نمایش نخواد بزاری فقط بگو این کار انجام شد با این اسم و فرمت و حجم و بالا سر همه شون ادرس فایل که ریختی بنویسی به کاربر بگو برای این که فایل ببینی برو تو این جا ۵. کلا در صفحه مبدل صدا دکمه مبدل صدا میفته زیر باتن نویگیشن ۶. وقتی قسمت نتیجه این و اپلود میزنی هنوز فایل های که کاربر قرار داده هست بعد تبدیل این لیست باید خالی بشه"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See every converted file in one result summary (Priority: P1)

A user converts several files at once. When the queue finishes, the result step lists every produced output file — each with a done message, file name, format, and size — with the shared output folder address shown once at the top telling them where to find the files. No per-file action buttons and no audio preview are shown.

**Why this priority**: This is the payoff screen of the whole flow; showing only one file makes users doubt the other files were converted.

**Independent Test**: Convert 3 files, observe the result step lists all 3 outputs with name/format/size plus the folder banner, and no share/copy/open/preview controls exist on the page.

**Acceptance Scenarios**:

1. **Given** 3 files finished converting to the same folder, **When** the result step appears, **Then** all 3 outputs are listed, each showing name, format, and size.
2. **Given** the result step is shown, **When** the user looks at the top, **Then** the output folder address is displayed with guidance to open that folder to see the files.
3. **Given** the result step is shown, **When** the user inspects it, **Then** there are no copy-path, share, open-folder, or audio-preview controls.

---

### User Story 2 - Action buttons never hidden behind navigation (Priority: P1)

A user reaches the settings step and taps the convert button. All wizard action buttons (next, back, convert, restart) are always fully visible above the bottom navigation — never overlapped or cut off.

**Why this priority**: A convert button the user cannot reach blocks the entire flow.

**Independent Test**: Walk through all 4 wizard steps on a small phone-size screen and confirm every action button is fully visible and tappable above the bottom nav.

**Acceptance Scenarios**:

1. **Given** any wizard step on a 360px-wide screen, **When** the step renders, **Then** its action buttons sit fully above the bottom navigation with visible spacing.
2. **Given** files are added (which previously raised the fixed start bar), **When** the user scrolls the wizard, **Then** no floating bar overlaps the content or the bottom nav.

---

### User Story 3 - Discoverable per-file trim and volume boost (Priority: P2)

A user adds a file and immediately understands that trimming and volume boosting are available for that file on the same screen. The per-file trim/boost controls are large enough to notice and tap, with a short helper line explaining both happen on this page with key words highlighted.

**Why this priority**: Users currently miss these features because the icons are tiny and unlabeled.

**Independent Test**: Add one file, confirm each file row shows clearly labeled trim and boost controls plus a helper line under the list mentioning trim and volume boost on this page.

**Acceptance Scenarios**:

1. **Given** a file is added, **When** the user looks at its row, **Then** trim and volume-boost controls appear with visible text labels (not icon-only) and a touch target at least as large as other tappable controls.
2. **Given** files are listed, **When** the user reads below the list, **Then** a helper line explains volume boost and trim happen on this same page, with the key terms visually emphasized.

---

### User Story 4 - Compact step buttons, no capability cards (Priority: P3)

A user moves through the wizard with normal-sized navigation buttons (matching the bottom navigation scale) instead of oversized full-width hero buttons, and the upload step no longer shows the four capability marketing cards.

**Why this priority**: Visual consistency and less clutter; cosmetic after the functional stories above.

**Independent Test**: Open the upload step (no capability cards present) and compare the next button height against bottom-nav buttons — same scale, not a giant banner.

**Acceptance Scenarios**:

1. **Given** the upload step, **When** it renders, **Then** no trim/convert/boost/share capability cards are shown.
2. **Given** any wizard step, **When** action buttons render, **Then** they use the compact navigation-button scale rather than full-width hero scale.

---

### Edge Cases

- What happens when outputs land in different folders (custom per-run dirs)? The banner shows each distinct folder once, grouped above its files.
- How does the result step handle a file whose size cannot be read? That row shows name and format with size omitted rather than failing the whole list.
- What happens when the user starts a second conversion after the input list was auto-cleared? The wizard begins from a clean upload step; the previous result is replaced by the new run.
- What happens on a failed job among several? Failed files appear as error rows (name + error, no size); only successfully produced outputs show name/format/size.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The upload step MUST NOT render capability/marketing cards.
- **FR-002**: Wizard action buttons (next, back, convert, restart) MUST use the compact navigation-button scale (same visual height and padding as bottom-navigation buttons), not oversized full-width banner sizing.
- **FR-003**: Each file row MUST expose trim and volume-boost controls with visible text labels in addition to icons.
- **FR-004**: The trim/boost controls MUST have a touch target of at least 40px in both dimensions.
- **FR-005**: The file list MUST be followed by a helper line stating volume boost and trim happen on this same page, with the key terms visually emphasized (e.g., colored/bold).
- **FR-006**: The result step MUST list every successfully produced output file across all completed jobs, not only the most recent one.
- **FR-007**: Each successful result row MUST show a done message plus the file name, format, and size. Each failed file MUST appear as an error row showing the file name and the error message, without size.
- **FR-008**: The result step MUST NOT show per-file copy-path, share, open-folder buttons, nor any audio preview player.
- **FR-009**: The result step MUST show the output folder address banner above the list, telling the user to open that folder to see the files.
- **FR-010**: Wizard action buttons MUST render fully above the bottom navigation on all supported screen sizes (no overlap at 360px width and up).
- **FR-011**: When the queue settles and the result step appears, the input file list MUST be cleared automatically.
- **FR-012**: All new/changed user-facing strings MUST be localized (English + Persian) with RTL preserved.

### Key Entities

- **Converted output entry**: one produced file shown on the result step — file name, audio format, size in bytes (when readable), and the folder it was written to.
- **Output folder banner**: the single shared destination directory displayed above the result list with guidance text.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Converting 5 files shows all 5 outputs with name, format, and size on the result step with zero per-file action buttons present; any failed file instead shows its name and error with no size.
- **SC-002**: On a 360px-wide screen, every wizard action button is 100% visible above the bottom navigation on all 4 steps.
- **SC-003**: 9 out of 10 first-time users can point to how to trim or boost a file within 30 seconds of adding it.
- **SC-004**: After conversion completes, the input file list is empty when the result step appears, every time.
- **SC-005**: Zero hardcoded user-facing strings introduced; Persian RTL layout verified on the changed screens.

## Assumptions

- "Buttons the size of nav buttons" means matching the bottom navigation button scale (compact, ~48px height), not the stepper dots.
- Removing share/copy/open actions is acceptable because the folder banner tells users where files are (explicit user request supersedes the earlier design).
- Input clearing happens when the result step appears (queue settled), keeping completed job records so the result list can still render.
- Trim/boost per-file editors themselves stay unchanged; only their entry-point controls and helper text change.
- Existing wizard auto-advance (progress → result) and back-navigation rules are unchanged.
