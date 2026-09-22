# Feature Specification: Library Folder Picker

**Feature Branch**: `016-library-folder-picker`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "نگاه میخوام ی دکمه بغل سرچ باشه که کاربر بتونه پوشه‌ای که می‌خواد بده به برنامه چون مثلا در مک باید دسترسی همه پوشه‌ها رو از کاربر بگیرم؛ اینجوری خودش هر وقت خواست اضافه کنه. اگر دسترسی‌ای هست که بتونه کل پوشه‌ها رو با یه دسترسی بگیره اونم خیلی خوبه."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a music folder from next to search (Priority: P1)

A user browsing their song library taps an "add folder" button placed next to the search field, picks a folder through the system folder picker, and sees the songs from that folder appear in the library after a scan.

**Why this priority**: This is the core request — user-driven, on-demand folder access that avoids upfront permission prompts for every folder, especially on macOS where each protected folder costs its own system prompt.

**Independent Test**: Can be fully tested by opening the library, tapping the add-folder button, picking a folder with audio files, and confirming its tracks appear in the list. Delivers user-chosen library expansion without touching settings screens.

**Acceptance Scenarios**:

1. **Given** the library view with the search bar visible, **When** the user taps the add-folder button and picks a folder containing audio files, **Then** a scan runs and the folder's tracks appear in the track list.
2. **Given** the user picks a folder with no audio files, **When** the scan finishes, **Then** the user sees a friendly "no music found" message and the existing library is unchanged.
3. **Given** the user cancels the system folder picker, **When** the dialog closes, **Then** nothing changes and no error is shown.

---

### User Story 2 - Keep added folders across restarts (Priority: P2)

A user who added custom folders closes and reopens the app and finds their added folders still part of the library without having to re-pick them.

**Why this priority**: Re-asking on every launch would defeat the purpose of on-demand consent; persistence makes the P1 flow durable.

**Independent Test**: Can be fully tested by adding a folder, restarting the app, and confirming the folder's tracks are still listed (after the normal startup scan) without re-picking.

**Acceptance Scenarios**:

1. **Given** a previously added folder, **When** the app restarts and performs its startup scan, **Then** the folder's tracks are listed without any new permission prompt.
2. **Given** a previously added folder that was deleted or is on an unplugged drive, **When** the app scans, **Then** the user sees a clear "folder unavailable" state and the rest of the library still loads.

---

### User Story 3 - Manage added folders (Priority: P3)

A user views the list of folders they added and removes one they no longer want, after which that folder's tracks disappear from the library.

**Why this priority**: Control over consent — users must be able to revoke a folder they previously granted, completing the permission lifecycle.

**Independent Test**: Can be fully tested by opening the folder list, removing a folder, and confirming its tracks leave the library while other folders' tracks remain.

**Acceptance Scenarios**:

1. **Given** at least one added folder, **When** the user removes it and confirms, **Then** its tracks are removed from the library and the change persists after restart.
2. **Given** the folder removal, **When** liked/favorite tracks belonged only to that folder, **Then** the app handles them gracefully (they no longer play) without crashing.

---

### Edge Cases

- What happens when the user picks a folder the OS denies access to (e.g., revoked permission, external drive unplugged)? The scan skips it with a clear per-folder message; other folders still load.
- How does the system handle picking the same folder twice? It is detected as a duplicate, no second entry is created, and the user is told it is already added.
- What happens when a picked folder contains a very large collection (thousands of files)? The scan still completes with progress feedback and remains cancellable; the UI stays responsive.
- How does the system handle nested picks (a subfolder of an already-added folder)? It is accepted but flagged as overlapping, or deduplicated, so tracks are not double-counted.
- What happens on platforms with scoped-storage limits (Android) or sandbox prompts (macOS)? The system-picker grant is the access mechanism; no raw-filesystem workaround is attempted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Library view MUST show an add-folder button adjacent to the search field in `TrackListView`.
- **FR-002**: System MUST open the native system folder picker when the user activates the add-folder button (so the OS grant — including macOS TCC — comes from the user's own picker action, not a programmatic prompt).
- **FR-003**: System MUST add the user-picked folder to the library's scan sources and include it in subsequent scans.
- **FR-004**: System MUST persist the list of user-added folders across app restarts and re-scan them on startup without new prompts.
- **FR-005**: System MUST detect duplicate folder picks and overlapping (nested) picks and avoid double-counting tracks.
- **FR-006**: System MUST let the user view the list of added folders and remove any of them, with confirmation before removal takes effect.
- **FR-007**: System MUST surface per-folder scan outcomes to the user (added track count, no-music-found, access-denied/unavailable) in the user's language, without technical jargon.
- **FR-008**: System MUST keep the default scan behavior unchanged when no custom folder was ever added (built-in music location still scanned as today).
- **FR-009**: System MUST NOT request blanket full-disk access; folder access is granted only through the user's explicit picker choice per folder (or a user-picked common parent folder covering several subfolders in one grant).
- **FR-010**: All new user-facing strings (button label/tooltip, dialogs, empty and error states) MUST go through the existing translation system with keys in every supported locale, and the button MUST work in both LTR and RTL layouts.

### Key Entities

- **Library Folder**: A user-granted directory source for the music scan; attributes: location reference, display name, availability state (available/unavailable), added date. Relates to many tracks.
- **Scan Result (per folder)**: Outcome of scanning one folder; attributes: track count added, status (success / empty / denied / unavailable), message shown to the user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a folder and see its songs in the library in under 1 minute (for a typical folder of up to 200 songs).
- **SC-002**: 90% of users who start the add-folder flow complete it on the first attempt without needing help.
- **SC-003**: Added folders survive an app restart in 100% of cases (tracks still listed without re-picking).
- **SC-004**: First-run permission friction is reduced: users who never tap the button see no additional folder-access prompts beyond today's behavior.

## Assumptions

- Target users are desktop (macOS first) and Android users of the existing music-library view; the button lives in `TrackListView` (Songs/Liked views inherit it).
- macOS platform constraint (from `src-tauri/src/music_library/platform/macos.rs`): each programmatic folder costs its own TCC prompt, but a user-picked folder via the system picker arrives with a grant and triggers no extra prompt — this feature relies on that mechanism.
- There is no single OS-level "grant all folders at once" consent suitable for a sandboxed app; the closest equivalent is the user picking a common parent folder (e.g., home directory) in one picker action, which then covers its subfolders. This is offered as a user choice, never taken silently.
- Scope boundary: bulk recursive pre-scan of arbitrary protected locations without user action is out of scope; folder grants are always explicit and per-picker-action.
- Existing scanner, artwork, and sort/search behavior are reused unchanged; only the folder-source list and the entry-point button are new.
- Persistence location for the folder list follows the existing settings/storage conventions and will be fixed during planning (no plaintext secrets involved — folder paths are not credentials).
