# Feature Specification: Onboarding Layout Fix

**Feature Branch**: `012-onboarding-layout-fix`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "صفحه اولیه هنگام نصب (first-run onboarding) مشکلات layout دارد: ۱. هم از چپ و هم بالا/پایین اسکرول ناخواسته می‌خورد ۲. لوگو زیر دوربین/ناچ گوشی می‌رود ۳. UI/UX ضعیف است — یک طرح پیشنهادی (کارت‌های تیره با برند نارنجی، هدر لوگو، ۴ کارت تنظیمات + دکمه شروع) به‌عنوان مرجع داده شده"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean first-run page with no stray scrolling (Priority: P1)

A person opening the app for the first time sees the start page fitting the phone screen: content scrolls only vertically when it overflows, never sideways, and decorative background layers never create scrollbars or shift the layout in either Persian (RTL) or English (LTR).

**Why this priority**: Unwanted horizontal/vertical scrolling is the top reported defect — it makes the page feel broken on every device.

**Independent Test**: Can be fully tested by launching the start page on a narrow phone viewport (360px wide) in both languages and swiping/observing: no horizontal panning is possible and vertical scroll appears only if content genuinely overflows.

**Acceptance Scenarios**:

1. **Given** the start page is open on a 360px-wide phone, **When** the user tries to pan left/right, **Then** nothing moves horizontally and no horizontal scrollbar appears.
2. **Given** the start page content fits the viewport height, **When** the user tries to scroll up/down, **Then** the page stays fixed (no bounce scroll caused by oversized background layers).
3. **Given** the start page content is taller than the viewport (small screen / large fonts), **When** the user scrolls, **Then** only the content area scrolls vertically while the confirm/skip actions remain reachable.

---

### User Story 2 - Logo and header always clear of notch/camera (Priority: P1)

A person opening the start page on a notched phone sees the app logo, title, and subtitle fully below the device camera/status area, in portrait, with no overlap, in both light and dark appearance.

**Why this priority**: Logo hidden under the camera is the second reported defect — it breaks first impression and brand recognition.

**Independent Test**: Can be fully tested by opening the start page on a device/emulator with a notch and camera cutout and confirming the logo block sits fully inside the safe visible area.

**Acceptance Scenarios**:

1. **Given** the start page is open on a notched phone, **When** the page first renders, **Then** the logo, title, and subtitle are fully visible below the status/camera area with breathing space.
2. **Given** the device is rotated or has a larger status area, **When** the page renders, **Then** the header still clears the top system area without manual scrolling.

---

### User Story 3 - Polished one-page setup per reference design (Priority: P2)

A first-time user sees a visually polished single start page following the provided reference: centered brand header, four clearly separated option groups (permissions, appearance, language, performance mode) with clear selected states, one primary confirm action and one secondary skip action — all labels in the active language with correct RTL/LTR direction.

**Why this priority**: This is the explicitly requested UI/UX upgrade; it turns the functional flow from spec `011-first-run-onboarding` into a shippable first impression.

**Independent Test**: Can be fully tested by walking the start page end-to-end: each of the four groups shows its options, selecting an option visibly marks it active with immediate preview, and finishing or skipping lands on the main screen with choices applied.

**Acceptance Scenarios**:

1. **Given** the start page is open, **When** the user looks at the four groups, **Then** each group has a recognizable title, icon or visual cue, and its options are laid out without crowding or clipped text.
2. **Given** any option group (appearance / language / performance), **When** the user selects an option, **Then** the selected option is visually distinct (highlight + selection indicator) and the app previews the effect immediately.
3. **Given** the start page is open in Persian, **When** the user switches to English (or vice versa), **Then** all labels, layout direction, and option order mirror correctly with no clipped or overlapping text.
4. **Given** the user taps the primary confirm action or the global skip, **When** the action completes, **Then** the main screen appears and the start page never shows again (existing once-only behavior preserved).

---

### Edge Cases

- Very small viewport (320px wide) or largest system font size: groups stack vertically, text wraps without clipping, primary action stays reachable via vertical scroll; horizontal scroll never appears.
- Content shorter than viewport: footer actions sit at a natural resting position without a large empty gap or forced overlap.
- Decorative background layers (glows, grid patterns): never intercept taps, never create scrollable overflow, and respect reduced-motion / high-performance mode (effects reduced immediately when that option is on).
- Light appearance: the polished card design remains readable (sufficient contrast) — the reference dark styling is adapted, not forced dark-only.
- Screen reader / keyboard: each option group exposes its options as a labeled single-choice group; selected state is announced.
- Permission permanently denied at OS level: permission card offers open-system-settings path, never a dead-end retry; skipping still completes onboarding.
- App killed mid-page without confirming: next launch re-shows the page with already-chosen values kept (behavior inherited from `011-first-run-onboarding`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Start page MUST NEVER scroll horizontally on any supported viewport (≥320px width) in either Persian (RTL) or English (LTR); background/decorative layers MUST be clipped inside the viewport and MUST NOT create scrollable overflow.
- **FR-002**: Vertical scrolling MUST occur only inside the page content region and only when content genuinely overflows the viewport; when content fits, the page MUST NOT scroll.
- **FR-003**: App logo, title, and subtitle MUST render fully inside the device safe visible area (below notch/camera/status area) on first paint with no overlap, on both standard and notched devices.
- **FR-004**: Start page MUST present exactly the four existing setup groups in the existing order (permissions, appearance/theme, language, performance mode) on a single page with one primary confirm action and one global skip; the permission group keeps its own skip path.
- **FR-005**: Each option group MUST show a clear selected state (highlight + selection indicator) and MUST preview the choice immediately (brightness for theme, labels/direction for language, reduced effects for performance mode).
- **FR-006**: All user-facing strings on the redesigned page MUST be available in both Persian and English with correct RTL/LTR layout and no hardcoded text; no new locale is added.
- **FR-007**: Page MUST remain fully usable offline; no step may require network access (fonts/icons already bundled or system-fallback).
- **FR-008**: Existing once-only behavior MUST be preserved: completion record written only via confirm or global skip, re-show with kept values if killed mid-page, never re-show after completion unless app data is cleared.
- **FR-009**: Primary confirm and global skip actions MUST always be reachable: visible without scrolling when content fits, reachable via content scroll when it overflows; decorative layers MUST never cover or intercept these actions.
- **FR-010**: Redesigned page MUST meet minimum readability contrast in both light and dark appearances and MUST respect high-performance mode by reducing heavy visual effects immediately when enabled.
- **FR-011**: Option groups MUST be exposed as labeled single-choice groups for assistive technology with the selected option programmatically indicated.

### Key Entities

- **Start page layout**: Single-page container with header (logo/title/subtitle), four stacked option groups, and footer actions; owns scroll containment and safe-area behavior.
- **Option group state**: Per-group selection (theme: light/dark/system-follow; language: Persian/English; performance: on/off; permission: granted/denied/skipped) with immediate preview and persistence on confirm.
- **Onboarding completion record**: Unchanged from prior spec — whether the one-time flow was finished or skipped; drives show-once behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a 360×800 phone viewport in both languages, zero horizontal scrolling is possible (verified by manual swipe inspection) and no horizontal scrollbar appears.
- **SC-002**: On a notched-device emulation, the logo block is fully visible below the status/camera area on first paint with no overlap.
- **SC-003**: Users can complete the full start flow (4 groups + confirm) in under 2 minutes, matching the prior onboarding baseline.
- **SC-004**: 95% of first-time users reach the main screen (finish or skip) on the first attempt without force-quitting or getting stuck.
- **SC-005**: 100% of theme/language/performance choices made on the redesigned page are applied on the next launch with no reverted values.
- **SC-006**: At 320px width with largest system font, all text is readable without clipping and the primary action is reachable within 3 vertical scroll gestures.

## Assumptions

- The provided HTML mock is a visual reference (dark cards, orange brand, grouped options, CTA hierarchy), not a literal implementation mandate — no external CDN styles/fonts are introduced; existing bundled fonts, icons, and design tokens are reused per offline-first and hygiene rules.
- Supported languages remain Persian and English only; safe skip defaults (Persian, system-follow theme, performance on for constrained/mobile) are inherited from `011-first-run-onboarding`.
- "Permissions" reuses the already-existing platform permission flows — no new OS permission types are introduced.
- Light appearance is kept (theme step still offers light/dark/system-follow); the reference dark styling is adapted to both appearances rather than forcing dark-only.
- File-size and responsibility-split rules (max ~300 lines per source file, no mixed IPC/presentation units) from the project constitution apply to the rework.
