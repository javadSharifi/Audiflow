# Feature Specification: First-Run Onboarding

**Feature Branch**: `011-first-run-onboarding`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "میخوام وقتی کاربر برنامه نصب کرد فقط یکبار ی صفحه ببنه که صفحه شروع باشه: ۱. دسترسی‌ها رو از کاربر بگیره ۲. انتخاب تم ۳. انتخاب زبان ۴. حالت عملکرد بالا میخواد یا نه ----- ی تغییراتی باید بدی این که ی دکمه تو نوار داریم تنظیمات؛ تو تنظیمات عوض کردن تم بردار، باز کردن خودکار پوشه بردار"

## Clarifications

### Session 2026-09-19

- Q: Should the first-run start flow be a single scrolling page showing all four groups at once, or a step-by-step wizard with back/next navigation? → A: Single page with all four sections stacked, one confirm/finish button.
- Q: After the theme row is removed from Settings, how should the user change the theme later if they want to? → A: Top-bar quick theme toggle stays as the only way to change theme later.
- Q: For users who already turned "open output folder automatically" on, what should happen to that saved value when the control is removed? → A: Force the saved value off for everyone and always use do-not-auto-open.
- Q: If the user closes or kills the app in the middle of the start page without confirming, what should the next launch show? → A: Show the start page again with already-selected values kept.
- Q: Should the start page offer one global skip for the whole page, or also individual skips per section? → A: Global skip for the whole page plus a skip inside the permission section.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete one-time start page on fresh install (Priority: P1)

A person who just installed the app opens it for the first time and sees a single start/onboarding flow covering permissions, theme, language, and high-performance mode. After finishing (or skipping) it, the start page never appears again on later launches.

**Why this priority**: This is the core requested behavior — one-time first-run experience. Without it there is no feature.

**Independent Test**: Can be fully tested by resetting app data, launching the app, walking through (or skipping) the start page, restarting the app, and confirming the main screen appears directly with chosen preferences applied.

**Acceptance Scenarios**:

1. **Given** a fresh install with no prior completion record, **When** the user launches the app, **Then** the start page appears before the main screen.
2. **Given** the user completed or skipped the start page, **When** the user closes and reopens the app, **Then** the start page does not appear again and the main screen shows directly.
3. **Given** the user chose language, theme, and performance mode in the start page, **When** the main screen loads, **Then** all three choices are already applied (correct language/RTL direction, correct brightness, correct motion/blur behavior).

---

### User Story 2 - Grant or skip access permissions during onboarding (Priority: P1)

During the start page, the user is asked for the permissions the app needs (media/library access on mobile, library folders on desktop) with a clear explanation, and can grant, deny, or skip. Denying or skipping never blocks completing onboarding or using the app later.

**Why this priority**: Permissions are step 1 of the requested flow and gate library content; a broken permission step breaks first-run value on every platform.

**Independent Test**: Can be fully tested by walking only the permission step on each platform: grant path shows library content, deny/skip path still finishes onboarding and the app remains usable.

**Acceptance Scenarios**:

1. **Given** the start page permission step is visible, **When** the user grants access, **Then** the app records the grant and continues to the next step without requiring a restart.
2. **Given** the start page permission step is visible, **When** the user denies or skips, **Then** onboarding continues to the next step and the app remains usable with an empty/unscanned library state.
3. **Given** access was permanently denied at OS level, **When** the permission step is shown, **Then** the user is guided to the OS settings screen instead of a dead-end retry button.

---

### User Story 3 - Pick theme, language, and performance mode with live preview (Priority: P2)

During the start page, the user picks app theme (light/dark/system), language (Persian/English), and whether high-performance mode is on. Each choice previews immediately so the user sees the effect before confirming.

**Why this priority**: These are steps 2–4 of the requested flow; they personalize the app once so the user never has to hunt for them later.

**Independent Test**: Can be fully tested by changing each option in the start page and observing immediate preview (brightness, language direction/labels, reduced motion/blur), then finishing and confirming persistence after restart.

**Acceptance Scenarios**:

1. **Given** the theme step is visible, **When** the user selects light, dark, or system-follow, **Then** the preview and the whole start page immediately reflect that brightness.
2. **Given** the language step is visible, **When** the user switches between Persian and English, **Then** all visible labels and layout direction (RTL/LTR) update immediately.
3. **Given** the performance-mode step is visible, **When** the user turns high-performance mode on or off, **Then** heavy visual effects are reduced or restored immediately and the choice persists after restart.

---

### User Story 4 - Simplified settings without theme and auto-open-folder (Priority: P2)

A returning user opens Settings from the top-bar button and finds a smaller list: theme switching and "open output folder automatically" are gone. Language, performance mode, and remaining preferences stay and keep working.

**Why this priority**: Explicitly requested cleanup — theme and auto-open-folder move exclusively to first-run so Settings stays minimal.

**Independent Test**: Can be fully tested by opening Settings after the change and verifying the two removed rows are absent while language, performance mode, and other remaining rows still read and save correctly.

**Acceptance Scenarios**:

1. **Given** the Settings dialog is open, **When** the user looks through all rows, **Then** no theme control and no auto-open-output-folder control are present.
2. **Given** the Settings dialog is open, **When** the user changes language or performance mode, **Then** the change applies immediately and persists after restart.
3. **Given** a user who previously relied on auto-open-folder, **When** a conversion/processing job finishes, **Then** the app uses the fixed default folder behavior and still offers an explicit manual "open folder" action on the result.

---

### Edge Cases

- User closes/kills the app mid-onboarding without confirming: next launch shows the start page again with already-selected values kept; onboarding counts as complete only after confirm or skip.
- OS permission dialog dismissed without answering: onboarding does not hang; it treats it as "not yet granted" and lets the user retry or skip.
- System theme changes after choosing "system-follow" in onboarding: app follows the OS without requiring another onboarding run.
- App reinstalled or app data cleared: onboarding appears again (completion record is gone); upgrade without data loss does not re-show onboarding.
- Right-to-left layout: Persian choice renders fully RTL including the onboarding steps themselves; English renders LTR; no mirrored icons or clipped text.
- Small screens / large fonts: the single page scrolls vertically with the confirm action reachable; permission grant buttons are never hidden behind the fold without a visible scroll cue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show a start/onboarding flow exactly once on first launch after a fresh install, before the main screen.
- **FR-002**: System MUST persist an onboarding-completed record so the flow never reappears on later launches unless app data is cleared or the app is reinstalled.
- **FR-003**: Onboarding MUST include a permission step that requests required media/library access appropriate to the current platform, explains why access is needed, and offers grant, retry/open-OS-settings (when permanently denied), and skip paths.
- **FR-004**: Onboarding MUST include a theme step offering light, dark, and system-follow options with immediate visual preview.
- **FR-005**: Onboarding MUST include a language step offering Persian and English with immediate label and layout-direction (RTL/LTR) preview.
- **FR-006**: Onboarding MUST include a high-performance-mode step (reduced heavy visual effects for smoother scrolling) with on/off choice and immediate effect preview.
- **FR-007**: System MUST persist the theme, language, and performance-mode choices made in onboarding and apply them on every later launch.
- **FR-008**: Onboarding MUST present all four groups (permissions, theme, language, performance mode) on a single page with one confirm/finish action and one global skip; the permission group additionally offers its own skip; skipping keeps safe defaults and still marks onboarding complete.
- **FR-009**: System MUST remove the theme control and the auto-open-output-folder control from the Settings dialog reachable via the top-bar settings button; the top-bar quick theme toggle remains the only later theme control.
- **FR-010**: Settings dialog MUST continue to offer language, performance mode, and all other remaining preferences with working read, change, and save behavior.
- **FR-011**: Every user-facing string in onboarding and in the changed Settings dialog MUST be available in both Persian and English with correct RTL/LTR layout.
- **FR-012**: Onboarding MUST work fully offline; no step may require network access to display or complete.

### Key Entities

- **Onboarding completion record**: Whether the one-time start flow was finished or skipped; drives show-once behavior.
- **User preferences**: Language (Persian/English), theme (light/dark/system-follow), high-performance mode (on/off); chosen in onboarding, applied app-wide, changeable later only where Settings still exposes them.
- **Permission grant state**: Per-platform access state (granted / denied / permanently-denied / skipped / not-required); determines library availability, never blocks onboarding completion.
- **App settings (simplified)**: Remaining user-adjustable preferences after removal of theme and auto-open-folder controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh install, the start page appears before the main screen on the first launch, and does not appear on the next 3 consecutive restarts.
- **SC-002**: Users can complete the full start flow (permissions + 3 preference steps) in under 2 minutes.
- **SC-003**: 95% of first-time users reach the main screen (by finishing or skipping) on their first attempt without force-quitting or getting stuck.
- **SC-004**: 100% of onboarding theme/language/performance choices are applied on the next launch (no reverted or default-overwritten values).
- **SC-005**: Settings dialog contains zero theme controls and zero auto-open-folder controls, verified by inspection in both languages.
- **SC-006**: Denying or skipping permissions during onboarding still leads to a usable main screen in under 5 seconds with a clear empty-library state.

## Assumptions

- Safe defaults when the user skips: language Persian, theme system-follow, performance mode on for constrained/mobile devices and off otherwise; existing platform defaults are reused where already defined.
- "Permissions" means the already-existing platform permission flows (mobile media permission; desktop library-folder selection) — no new OS permission types are introduced.
- The top-bar quick theme toggle button (outside the Settings dialog) is out of scope and stays as-is; only the theme row inside Settings is removed.
- The fixed post-removal folder behavior is do-not-auto-open for everyone: existing saved on-values are migrated to off on update; the explicit per-result "open folder" action stays available.
- Onboarding layout is a single page with four stacked sections in the request order: 1 permissions, 2 theme, 3 language, 4 performance mode — with one confirm/finish action (no wizard back/next or progress indicator).
- Supported languages remain Persian and English only; no new locale is added by this feature.
- Existing secret storage rules are unaffected (no credentials are collected in onboarding).
