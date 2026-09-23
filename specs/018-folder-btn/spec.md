# Feature Specification: macOS Add-Folder Button

**Feature Branch**: `018-folder-btn`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "نگاه من تو مک یا سیستم های دسترسی معروف برای هر پوشه دسترسی میخواد. میخوام ی دکمه اضافه کردن پوشه بغل سرچ باشه که زدی روش پوشه‌ها باز بشه، انتخاب کن و دسترسی اون پوشه بده و به لیست آهنگ‌ها اضافه بشه. گوشی و ویندوز یا لینوکس این مشکل رو ندارند؛ فقط توی مک بیا اضافه کن."

**Relationship to prior specs**: Refines `specs/016-library-folder-picker` (folder-picker concept, partially shipped as onboarding-level picking). This spec narrows the user-visible scope to macOS and defines the library-level entry point, which is not yet implemented.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a music folder from next to search on macOS (Priority: P1)

A macOS user browsing their song library sees an "add folder" button placed next to the search field, taps it, the system folder picker opens, they pick a folder, and the songs from that folder appear in the library after the scan. The access grant comes from the user's own picker action — no separate permission prompt for the folder.

**Why this priority**: This is the core request. On macOS, every programmatic folder costs its own protected-access prompt on first launch; user-picked folders arrive with the picker's grant and trigger no extra prompt. Putting the button next to search lets the user expand the library at the moment of need, without visiting settings or onboarding again.

**Independent Test**: Can be fully tested on macOS by opening the library, tapping the add-folder button next to search, picking a folder that contains audio files, and confirming its tracks appear in the song list. Delivers on-demand, per-folder library expansion.

**Acceptance Scenarios**:

1. **Given** the library view on macOS with the search bar visible, **When** the user taps the add-folder button and picks a folder containing audio files, **Then** a scan runs and the folder's tracks appear in the track list.
2. **Given** the user picks a folder whose songs are already in the library (exact or nested duplicate), **When** the scan finishes, **Then** tracks are not double-counted and the library remains correct.
3. **Given** the user picks a folder with no audio files, **When** the scan finishes, **Then** the user sees a friendly "no music found" indication and the existing library is unchanged.
4. **Given** the user cancels the system folder picker, **When** the dialog closes, **Then** nothing changes and no error is shown.
5. **Given** a scan is already running, **When** the user taps the add-folder button, **Then** the button is disabled (or queued) and does not corrupt the running scan.

---

### User Story 2 - Button appears only on macOS (Priority: P2)

A user on Android, Windows, or Linux never sees the add-folder button next to search — their platforms do not require per-folder access consent for the library, so the UI stays unchanged for them. A macOS user always sees it next to search.

**Why this priority**: The user explicitly stated phones, Windows, and Linux do not have this problem; adding the button there would be visual noise for zero value. Platform-conditional display keeps the change minimal and focused.

**Independent Test**: Can be fully tested by launching the app on each platform and confirming the button's presence matches the platform (visible on macOS, absent elsewhere), without affecting search/rescan behavior on any platform.

**Acceptance Scenarios**:

1. **Given** the app runs on Android, **When** the library view renders, **Then** no add-folder button appears next to search and the existing layout is unchanged.
2. **Given** the app runs on Windows or Linux, **When** the library view renders, **Then** no add-folder button appears next to search.
3. **Given** the app runs on macOS, **When** the library view renders, **Then** the add-folder button appears adjacent to the search field and works as in User Story 1.

---

### User Story 3 - Added folders persist across restarts (Priority: P3)

A macOS user who added a custom folder closes and reopens the app and finds the folder's songs still in the library without re-picking the folder and without a new permission prompt.

**Why this priority**: Persistence makes the P1 flow durable — re-asking on every launch would defeat the purpose of the per-folder consent. The existing folder-persistence mechanism (used by onboarding folder picking) is reused unchanged.

**Independent Test**: Can be fully tested on macOS by adding a folder, restarting the app, and confirming the folder's tracks are still listed after the normal startup scan without re-picking.

**Acceptance Scenarios**:

1. **Given** a previously added folder, **When** the app restarts and performs its startup scan, **Then** the folder's tracks are listed without any new prompt.
2. **Given** a previously added folder that was deleted or is unavailable (e.g., unplugged drive), **When** the app scans, **Then** the rest of the library still loads and the unavailable folder contributes no tracks, with no crash.

---

### Edge Cases

- What happens when the user picks the same folder twice? The pick is deduplicated: no second library entry and no double-counted tracks.
- What happens when the user picks a nested subfolder of an already-added folder (or vice versa — a parent of an already-added folder)? Tracks are not double-counted; the overlap is resolved by the scan's existing track-dedup behavior.
- What happens when the picked folder is extremely large (thousands of files)? The scan completes with the existing incremental-scan behavior; the UI stays responsive and cached songs remain visible while rescanning.
- What happens when macOS denies the picked folder's access (e.g., grant revoked)? The scan contributes no tracks from that folder, the rest of the library loads, and the user can re-pick.
- What happens when the user has never used the button? The default scan behavior (built-in Music location) is unchanged for them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On macOS, the library track-list view MUST show an add-folder button adjacent to the search field, consistent with the existing search/rescan button row.
- **FR-002**: On Android, Windows, and Linux, the library view MUST NOT show the add-folder button; the existing layout must remain unchanged.
- **FR-003**: On macOS, activating the add-folder button MUST open the native system folder picker, so the protected-folder access grant originates from the user's own picker action rather than a programmatic prompt.
- **FR-004**: The user-picked folder MUST be added to the library's scan sources (reusing the existing persisted custom-folders list) and included in the scan triggered by the pick.
- **FR-005**: Added folders MUST persist across app restarts and be re-scanned on startup without re-picking or new prompts.
- **FR-006**: Duplicate and overlapping (nested) picks MUST NOT result in double-counted tracks.
- **FR-007**: Per-pick outcomes (added-count, no-music-found, unavailable/denied folder) MUST be surfaced to the user in the user's language, without technical jargon; a cancelled picker MUST produce no error and no UI change.
- **FR-008**: The default scan behavior on every platform MUST remain unchanged when the user has never added a custom folder.
- **FR-009**: The feature MUST NOT request blanket full-disk or all-folders access; access is granted only per user picker action, per folder (a user-picked common parent covering several subfolders in one grant is a valid user choice).
- **FR-010**: All new user-facing strings (button label/tooltip, outcome messages) MUST go through the existing translation system with keys in every supported language, and the button MUST work in both LTR and RTL layouts.

### Key Entities *(include if feature involves data)*

- **Library Folder**: A user-granted directory source for the music scan (existing concept from prior onboarding picking); attributes: location reference, availability state (available/unavailable). Relates to many tracks; persisted by the existing custom-folders mechanism.
- **Pick Outcome**: Result of one add-folder action; attributes: status (added / empty / unavailable / cancelled), user-facing message.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: macOS users can add a folder and see its songs in the library in under 1 minute for a typical folder of up to 200 songs.
- **SC-002**: No additional permission prompt appears beyond the user's own picker action in 100% of add-folder attempts on macOS.
- **SC-003**: Added folders survive an app restart in 100% of cases (tracks still listed without re-picking).
- **SC-004**: Users on Android, Windows, and Linux observe no change in the library UI (button absent) and no change in scan behavior.

## Assumptions

- The button lives in the existing search/sort/rescan row of the library track-list view; the Liked view (which shares the same component) follows the same platform rule.
- Reuse the existing folder-picking dialog utility and the existing persisted custom-folders store and scanner; no new scanning or storage mechanism is introduced.
- On macOS the platform constraint stands: programmatic folders each cost their own protected-access prompt on first launch, while user-picked folders arrive with the picker grant and trigger no extra prompt — this feature relies entirely on that mechanism, as before.
- There is no sanctioned blanket "grant all folders at once" on macOS for this app; the closest equivalent (user picks a common parent folder in one action) is always a user choice, never taken silently.
- Removing previously added folders remains handled by the existing flows; this spec does not change folder-removal behavior.
- Bulk recursive pre-scan of arbitrary protected locations without user action is out of scope; folder grants are always explicit and per-picker-action.
