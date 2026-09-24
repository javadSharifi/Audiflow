# Feature Specification: Android Media Rescan & Indexing Sync

**Feature Branch**: `021-android-media-rescan`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "من ی باگی در برنامه دیدم نگاه من ی ۱۰۰ تا اهنگ با فلاش ریختم تو گوشیم رفتم تو برنامه هرچی دکمه ریستارت لیست اهنگ ها رو میزدم نمی اود رفتم داخل ی برنامه اهنگ دیگه اون جا دکمه ریلود زدم لیست اهنگ ها رو اورد بعد امدم تو برنامه ریلود زدم لیست اهنگ ها رو اورد چرا برنامه من اهنگ پیدا نمیکرده ؟"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detect Newly Transferred Songs on Manual Rescan (Priority: P1)

A user copies a batch of audio tracks (e.g. 100 songs) from a USB flash drive, computer, or external source into their phone storage. They open Audiflow and tap the reload / rescan button in the library. The application actively requests the device media indexer to scan and register newly added files, immediately updating the song list so all transferred tracks appear without requiring the user to open any third-party app or reboot their device.

**Why this priority**: This is the core defect reported by the user. If newly added files are not detected upon tapping reload, the user is left believing the app is broken or unable to read their files.

**Independent Test**: Can be tested by copying new audio files to the device via file transfer/OTG, tapping reload in the music library, and verifying that the newly transferred files immediately appear in the library track list.

**Acceptance Scenarios**:

1. **Given** 100 new audio tracks transferred to device storage that have not yet been indexed by the operating system, **When** the user taps the reload button in the library, **Then** the application triggers a media indexing sync and displays all 100 tracks in the track list upon completion.
2. **Given** an existing library with songs already loaded, **When** the user taps reload after adding new tracks, **Then** existing songs remain intact, no duplicate entries are created, and only new tracks are added to the list.
3. **Given** no new tracks were added to storage, **When** the user taps reload, **Then** the library reloads quickly without clearing or flashing the existing list.

---

### User Story 2 - Rescan Progress & Feedback (Priority: P2)

When the user taps the reload button, the application presents immediate visual feedback indicating that a scan is in progress. Once the scan and indexing sync are finished, the user receives confirmation (such as a status toast or updated song count) and the list smoothly updates.

**Why this priority**: Large batch scans (such as 100+ tracks) take a brief moment. Providing visual feedback prevents repeated anxious taps and lets the user know the system is actively looking for new media.

**Independent Test**: Can be tested by tapping reload and verifying that a progress state appears immediately, does not freeze the UI, and clears upon scan completion.

**Acceptance Scenarios**:

1. **Given** the user is viewing the track list, **When** they tap the reload button, **Then** a loading indicator or spinner is visibly active during the scan.
2. **Given** an active scan in progress, **When** the user interacts with the UI (e.g., scrolls or switches tabs), **Then** the interface remains responsive without stutter or freeze.
3. **Given** an active audio track currently playing, **When** a background rescan is executed, **Then** audio playback continues uninterrupted.

---

### User Story 3 - Tolerant Recognition of Audio Files (Priority: P3)

Audio files copied from varying sources or operating systems may have missing tags, non-standard folder locations (e.g. Download, Music, custom folders, or external drives), or temporarily unset classification flags. The rescan process recognizes all valid audio files regardless of whether third-party metadata flags have been populated.

**Why this priority**: Files copied via OTG flash drives often come from different OS environments and may lack complete media tags or metadata classification. The player must be resilient and list them reliably.

**Independent Test**: Can be tested with audio files lacking artist/album tags or placed in diverse accessible folders, confirming they are recognized and listed by file name.

**Acceptance Scenarios**:

1. **Given** audio files with missing metadata (no artist or album), **When** scanned, **Then** they appear in the library using their display file name rather than being skipped.
2. **Given** audio files placed in various user storage directories (e.g. Music, Downloads, or OTG mounts), **When** a manual rescan occurs, **Then** all supported audio files across accessible paths are discovered.

---

### Edge Cases

- **Storage write in progress**: If the user taps reload while files are still transferring from a flash drive, already completed files are indexed, and partially copied files do not crash the scanner.
- **Flash drive disconnected**: If an external drive is removed after scanning, attempting to play missing tracks gracefully alerts the user without crashing the player.
- **Large file volume**: Adding thousands of tracks in one go must not exhaust memory or block the main thread; scanning runs in chunks or background tasks.
- **Permission revoked**: If media read permission is not granted, the system prompts the user with an explanation instead of failing silently with an empty list.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST initiate an active operating system media scan and indexing synchronization on user-accessible audio storage when a manual library reload is requested.
- **FR-002**: System MUST discover and display newly transferred audio files without requiring device restart or interaction with third-party applications.
- **FR-003**: System MUST execute the media indexing and library scanning asynchronously in the background without blocking the user interface.
- **FR-004**: System MUST NOT interrupt, pause, or degrade ongoing audio playback while scanning runs.
- **FR-005**: System MUST prevent duplicate entries for existing tracks during and after rescanning.
- **FR-006**: System MUST recognize standard audio formats (MP3, M4A, AAC, FLAC, WAV, OGG, OPUS) even if media classification tags have not yet been generated by the OS.
- **FR-007**: System MUST provide immediate visual indication that a scan is in progress and clear it when finished.

### Key Entities

- **Audio Track**: Represents an audio item in the library, containing identity, file path / media URI, title, artist, album, duration, file size, format, and creation/modification timestamps.
- **Library Rescan Request**: Represents a user-initiated command to refresh the audio library, encompassing storage scan, OS indexing trigger, and track list reconciliation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly copied valid audio files in accessible directories appear in the music library after a single reload action.
- **SC-002**: Manual rescan of 100 newly added tracks updates the library list within 3 seconds under normal operating conditions.
- **SC-003**: Users never need to launch an external application or restart their device to discover newly added music.
- **SC-004**: Zero audio dropouts or UI freezes during background rescanning.

## Assumptions

- The user has granted necessary storage / audio permissions to the application.
- Files are located in standard accessible device storage (Internal Storage `Music`, `Download`, or connected USB OTG storage).
- The device operates on Android 8.0+ where MediaStore and media scanner services are standard.
