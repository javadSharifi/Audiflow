# Feature Specification: Bottom Navigation Layout & Mini Player Spacing Fixes

**Feature Branch**: `015-fix-bottom-nav-layout`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "۱. میگن فاصله بین باتن نویگیشن و اهنگ که پیلی میشه خیلی در گوشیخودم و شبیه ساز درست ولی در بعضی گوشی ها مشکل داره ۲. در بعضی گوشی ها اگر کاربر روی دکمه کلیک کنه و دکمه متن نمایش داده بشه باتن نویگیشن از صفحه میزنه بیرون"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consistent Vertical Spacing Between Mini Player and Bottom Navigation (Priority: P1)

As a mobile listener, when a track is playing and I browse my music library or tabs, I want the floating mini player card to sit closely, neatly, and consistently above the bottom navigation dock on all device types, so that there is no awkward oversized gap exposing random content between them.

**Why this priority**: On devices equipped with hardware or on-screen system navigation bars (such as Android 3-button navigation or devices providing non-zero bottom window insets), an inconsistent bottom coordinate offset pushes the mini player high above the navigation dock. This creates an unintended large empty band where underlying track rows leak through, breaking the visual hierarchy and perceived quality of the app.

**Independent Test**: Play any track, open the library on devices or viewports with simulated bottom window insets (e.g., 0px, 24px, 48px, and 72px); verify that the vertical gap between the top border of the bottom navigation dock and the bottom border of the mini player card remains uniform, compact, and visually cohesive across all inset values.

**Acceptance Scenarios**:

1. **Given** a song is actively loaded or playing in the player, **When** the user views the main application tabs on a device with zero bottom safe-area insets (e.g., desktop or gesture-based fullscreen display), **Then** the mini player is positioned above the bottom navigation dock with a small, uniform vertical gap (under 12px) without overlapping.
2. **Given** a song is actively loaded or playing in the player, **When** the user views the main application tabs on a device with positive bottom safe-area insets (e.g., Android devices with 3-button system navigation bars or gesture bars), **Then** both the bottom navigation dock and the mini player elevate together by the same inset offset, preserving the identical compact vertical gap between them.
3. **Given** the mini player is closed or no track is playing, **When** the user navigates between tabs, **Then** the bottom navigation dock remains properly inset from the system navigation bar, and the underlying view's bottom padding gracefully adjusts.

---

### User Story 2 - Overflow-Free Bottom Navigation Dock on Compact Mobile Screens (Priority: P2)

As a listener on a compact smartphone or narrow screen, when I tap any navigation tab and its label expands, I want the bottom navigation dock to stay completely within the visible screen boundaries without spilling off the sides or truncating outer icons.

**Why this priority**: When switching tabs, the active tab expands to show its icon and localized title (e.g., "علاقه‌مندی‌ها" or "افزایش صدا"). On compact viewports (such as 360px width common across Android smartphones), rigid element widths cause the entire dock to exceed the screen width, cutting off the outermost buttons or clipping outside the viewport.

**Independent Test**: Render the navigation dock in a 360px-wide viewport (and down to 320px); tap each of the 5 navigation tabs in both Persian (RTL) and English (LTR) locales; verify that the dock container and all 5 buttons remain 100% visible, fully interactive, and within the screen margins without horizontal overflow.

**Acceptance Scenarios**:

1. **Given** the app is running on a 360px-wide mobile screen in Persian locale, **When** the user taps the tab with the longest text label ("علاقه‌مندی‌ها"), **Then** the navigation dock smoothly expands the active tab while proportionally adapting the overall width so that all 5 destinations remain fully visible within the viewport margins.
2. **Given** the app is displayed on any viewport width from 320px to 480px, **When** any tab transitions between inactive and active states, **Then** the outer icons (e.g., Albums on one end, Converter on the other) never touch or extend beyond the viewport edges.
3. **Given** an expanded active tab with text, **When** the label length exceeds available space on extremely narrow screens, **Then** the label cleanly truncates or compresses gracefully without forcing the parent dock container to overflow.

---

### User Story 3 - Visual Alignment and Clear Separation Above System Bars (Priority: P3)

As a user on any mobile device or desktop platform, I want the bottom navigation dock and mini player to maintain appropriate clearance from the bottom edge of the device screen, ensuring system gestures and system buttons remain easy to reach without accidental taps.

**Why this priority**: When the navigation dock sits too close to the hardware or virtual navigation buttons on Android, users risk accidental home or back button presses when attempting to tap music navigation tabs.

**Independent Test**: Measure the clearance between the bottom-most boundary of the navigation dock and the screen bottom edge across varying device configurations; verify that touch target areas do not intersect with the system navigation strip.

**Acceptance Scenarios**:

1. **Given** an Android device with an active 3-button system navigation bar, **When** the user views the main application, **Then** the bottom navigation dock floats safely above the system navigation bar boundary.
2. **Given** a user scrolling through a long track list with the mini player visible, **When** scrolling to the very bottom of the track list, **Then** the last track is fully visible and clickable above the mini player and navigation dock without being obscured.

---

### Edge Cases

- **Extreme system insets**: When a device reports unusually large bottom insets (e.g., landscape mode or dual-screen displays > 80px), both the dock and mini player must remain within visible viewport bounds without pushing above middle screen content.
- **Rapid tab switching**: When a user rapidly taps different tabs in succession, dock width and button sizing transitions must stay smooth without flickering or temporary layout jumps.
- **Font size accessibility scaling**: When the system or user enables enlarged font sizes (e.g., 125% or 150% text scaling), text labels inside the active tab must clamp or truncate cleanly without breaking the horizontal dock layout.
- **Device rotation / resize**: When rotating between portrait and landscape orientations, the dock and mini player positions must instantly recalculate and adapt to the updated dimensions and insets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The bottom navigation dock MUST account for the device's bottom safe-area window inset, elevating its baseline position to prevent overlap with native on-screen navigation controls.
- **FR-002**: The mini player MUST synchronize its bottom elevation directly with the bottom navigation dock's position, guaranteeing that the vertical distance between the top of the dock and the bottom of the mini player remains constant across all screen sizes and safe-area inset values.
- **FR-003**: The vertical gap between the top edge of the navigation dock and the bottom edge of the mini player MUST not exceed 12px under any device inset condition.
- **FR-004**: The bottom navigation dock MUST fit entirely within the viewport width across all supported screen sizes (down to 320px viewport width) with at least 12px total horizontal margin.
- **FR-005**: All 5 navigation tabs (Albums, Liked, Songs, Booster, Converter) MUST remain visible and individually tappable in both inactive and active states without any tab being clipped or hidden off-screen.
- **FR-006**: When an active navigation tab expands to display its localized text label, the navigation dock MUST accommodate the label using flexible, proportional sizing that prevents the dock container from overflowing the screen width.
- **FR-007**: Active tab labels MUST support clean truncation or compact presentation if the localized label exceeds the dynamically available width on narrow screens.
- **FR-008**: Scrollable list views (including the Songs list, Liked songs, and Album details) MUST provide adequate bottom scroll padding so that the final items in any list can be scrolled completely clear of the floating mini player and navigation dock.

### Key Entities

- **Navigation Dock (`MusicPlayerNav`)**: The persistent floating bottom bar housing the 5 core application destinations (Albums, Liked, Songs, Booster, Converter), supporting interactive tab selection and active state expansion.
- **Mini Player Card (`MiniPlayer`)**: The persistent floating card displaying the current track's artwork, metadata, transport controls, and scrubbable progress bar, displayed directly above the navigation dock when a track is active.
- **Safe-Area Window Inset**: The device-reported boundary inset (specifically bottom inset) reserved for system navigation bars, gesture indicators, and display cutouts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On devices with positive safe-area bottom insets (e.g., 24px to 72px), the measured visual vertical gap between the mini player and the bottom navigation dock is identical (+/- 2px) to the gap observed on zero-inset devices.
- **SC-002**: On mobile viewports of 360px width and below, the total width of the bottom navigation dock does not exceed 100% of the available viewport width minus 16px margins, achieving 0px horizontal overflow across all 5 tab states in both Persian and English.
- **SC-003**: 100% of touch targets within the navigation dock maintain at least 44px effective height and width for accessibility compliance.
- **SC-004**: Zero clipping or horizontal scrollbars occur on the main viewport when switching between any of the 5 tabs.
- **SC-005**: The last item in any virtualized track list remains fully unobstructed and interactive above the mini player when scrolled to the end.

## Assumptions

- The application continues to support screen widths down to 320px (covering compact Android phones and small viewports).
- The desktop layout (where screen widths exceed 640px) will continue to display the expanded navigation dock without changes to desktop usability.
- Device safe-area insets are communicated via standard web platform environment variables (`env(safe-area-inset-bottom)`), which are supported by the embedded webview on Android and desktop.
- The 5 core navigation tabs remain unchanged in scope; no tabs are added or removed as part of this layout fix.
