# Feature Specification: OS "Open With" Context Menu & Drag-and-Drop Audio Playback

**Feature Branch**: `019-os-open-drag-playback`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "نگاه تو سیستم عامل ها ازت میخوام ی قبلیتی اضافه کنی که موقعی دیدی کلید راست میکند برنامه موزیک پلی انتخاب میکنند میخوام منم تو سیستم عامل ها هم چین قابلیتی داشته باشم ی قابلیتی دیگه میخوام در سیستم عامل های مک ویندوز لینوکس و.. که کاربر مثل ی پوشه باز کرده ی لیست اهنگ میگیره میکشه تو برنامه حالا اون برنامه باید بیاد دونه دونه اون اهنگ ها رو پلی کنه ی"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Drag and Drop Songs or Folders to Play One by One (Priority: P1)

A desktop user on macOS, Windows, or Linux has a folder open in their system file manager containing music files. They select multiple songs (or an entire music folder) and drag them into the open Audiflow window. When dropped onto the music player, the application instantly receives the files, extracts all valid audio tracks (recursively scanning any dropped folders), loads them into the active playback queue, and immediately starts playing the first song, advancing through each song in the list one by one without user intervention.

**Why this priority**: Direct drag-and-drop from the file manager into the player is the most natural, ubiquitous way desktop users expect a music player to work. It enables instant, on-demand playback of any audio file or folder without needing to import or re-scan an entire music library.

**Independent Test**: Can be tested on macOS, Windows, or Linux by dragging one or more audio files (and/or a folder containing audio files) from the desktop file manager into the music player interface. The dropped tracks appear in the player's queue, the first track starts playing immediately, and when that track finishes, playback automatically advances to the next track.

**Acceptance Scenarios**:

1. **Given** the music player view is open, **When** the user drags and drops a list of multiple audio files into the window, **Then** all valid audio files are loaded into the playback queue, the first track begins playing immediately, and playback sequentially advances through the list.
2. **Given** the music player view is open, **When** the user drags and drops a folder containing audio files into the window, **Then** all supported audio files within that folder (and any subfolders) are discovered, ordered naturally (by filename/track order), loaded into the playback queue, and played sequentially starting from the first track.
3. **Given** a user drags files over the music player window, **When** the files hover over the application, **Then** a clear visual drop indicator appears confirming that dropping the files will start playback.
4. **Given** the user drags a mix of audio files and non-audio files (e.g., text files, images, unsupported documents), **When** dropped, **Then** only the valid audio files are queued for playback, non-audio files are safely ignored without breaking playback, and a brief informational message indicates how many audio tracks were queued.
5. **Given** an audio track is already currently playing, **When** the user drags and drops a new batch of songs into the player, **Then** the new batch replaces the active queue and starts playing the first track of the new batch immediately.

---

### User Story 2 - Right-Click Context Menu / "Open with" Playback Across Operating Systems (Priority: P2)

A desktop user on macOS, Windows, or Linux browses files in their operating system's file manager (Finder, File Explorer, Nautilus/Dolphin). They right-click an audio file or select "Open with" -> "Audiflow" (or "Play in Audiflow"). The operating system launches or brings Audiflow to the foreground, switches to the music player view, loads the chosen audio file(s) into the playback queue, and begins playing immediately.

**Why this priority**: OS-level integration lets users set Audiflow as their default music player or quickly audition audio files directly from their desktop environment without having to manually open the app first.

**Independent Test**: Can be tested on each target operating system (macOS, Windows, Linux) by right-clicking a supported audio file in the system file manager and selecting "Open with Audiflow". The application opens/focuses, enters the music player, and plays the audio file immediately.

**Acceptance Scenarios**:

1. **Given** Audiflow is closed, **When** the user right-clicks an audio file in their OS file manager and chooses "Open with Audiflow", **Then** the application launches, navigates to the music player, resolves track metadata, and starts playing the track immediately.
2. **Given** Audiflow is already running, **When** the user right-clicks an audio file or multiple audio files in the OS file manager and selects "Open with Audiflow", **Then** the existing application window is brought to focus, the selected tracks are queued, and the first selected track starts playing immediately.
3. **Given** the user right-clicks a folder containing music in their OS file manager and chooses "Play in Audiflow" (or "Open with Audiflow"), **Then** the application opens/focuses, scans the folder for audio tracks, queues all found tracks, and begins sequential playback from the first track.
4. **Given** the user opens an audio file from the OS while currently in the Audio Converter tool within Audiflow, **When** the OS open command is received, **Then** the application automatically switches to the Music Player view and starts playing the audio track.

---

### User Story 3 - Preserving Converter Drag-and-Drop Integrity (Priority: P3)

A user working in the Audio Converter tool within Audiflow drags audio or video files into the window to batch convert or compress them. Because the user is currently in the converter tool, the dropped files are added to the converter file list for batch processing, rather than interrupting their workflow to start audio playback.

**Why this priority**: Audiflow is a dual-purpose studio (converter/booster + music player). Drag-and-drop must respect the active user context so that conversion workflows are never disrupted by accidental music playback.

**Independent Test**: Can be tested by switching to the Converter tab, dragging media files into the window, and verifying that files are added to the conversion list without starting music player playback.

**Acceptance Scenarios**:

1. **Given** the user is on the Converter tab, **When** files are dragged and dropped into the window, **Then** the files are ingested into the conversion wizard as pending conversion items, and the music player remains unaffected.
2. **Given** the user switches to the Music Player tab, **When** audio files are dragged and dropped into the window, **Then** the files are loaded into the player queue and sequential playback begins immediately.

---

### Edge Cases

- **Empty or Audio-Free Dropped Folders**: If a user drops a folder that contains zero supported audio files, the application alerts the user with a friendly, localized notification ("No playable audio found") and preserves any existing playback state without stopping or crashing.
- **Deeply Nested Folders**: If a dropped folder contains multi-level subdirectories (e.g., Artist -> Album -> Discs -> Tracks), the system traverses and discovers all audio files across subfolders, sorting them in a logical hierarchical sequence.
- **Corrupt or Unreadable Audio Files**: If one of the queued tracks in a dropped batch cannot be decoded or played, the player gracefully reports the error, skips the unplayable file, and continues playing the next track in the queue.
- **Huge Batch Drops (Hundreds of Tracks)**: When dropping a large library folder with hundreds or thousands of songs, the UI remains fluid and responsive; tracks are streamed or batched into the queue without freezing the user interface, and playback of the first track begins immediately while remaining tracks populate.
- **Multiple Simultaneous Launches**: If the user rapidly selects multiple files in Explorer/Finder and hits Enter or "Open with", the operating system may send multiple paths simultaneously or sequentially; the application must deduplicate and assemble them into a single consolidated playlist rather than spawning duplicate windows or restarting playback multiple times.
- **Drop During Onboarding Gate**: If a fresh installation has the onboarding gate active, dropping files or opening via OS should either fulfill the gate or cleanly queue playback once the gate is dismissed, preventing broken or stuck playback states.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST register system file associations on macOS, Windows, and Linux for all standard audio file formats (`.mp3`, `.flac`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.aiff`, `.alac`, `.wma`, `.weba`) so that the application appears in the OS "Open with" context menu.
- **FR-002**: On desktop operating systems (macOS, Windows, Linux), opening audio files via the OS context menu ("Open with Audiflow") MUST bring the application to the foreground, switch to the Music Player view, load the files into the playback queue, and immediately begin playing the first track.
- **FR-003**: The application MUST support folder context menu / "Play in Audiflow" integration or folder command-line ingestion, recursively discovering all supported audio files inside the specified directory.
- **FR-004**: When the Music Player view is active, the application window MUST accept native drag-and-drop of one or more audio files from the host file manager.
- **FR-005**: When the Music Player view is active, the application window MUST accept native drag-and-drop of directories/folders, recursively extracting all supported audio tracks within the dropped directories.
- **FR-006**: When dragging files over the application window while the Music Player is active, the interface MUST display a distinct visual drop zone indicator informing the user that releasing the files will queue and play them.
- **FR-007**: Dropping audio files or folders into the Music Player MUST set the playback queue with the discovered tracks, initiate immediate playback of the first track, and automatically advance through the remaining tracks one by one as each track finishes.
- **FR-008**: When non-audio files (or mixed batches containing unsupported files) are dropped onto the Music Player, the application MUST filter out unsupported files, queue all valid audio files, and notify the user via a localized toast if any files were skipped.
- **FR-009**: When the Audio Converter view is active, native drag-and-drop MUST continue routing dropped files to the converter file ingestion pipeline, preserving existing converter behavior without triggering music player playback.
- **FR-010**: All user-facing notifications, drop zone labels, error messages, and context menu descriptors MUST use the application's internationalization system with complete translations in English and Persian, maintaining RTL layout fidelity.
- **FR-011**: Only a single audio playback stream may be active at any time; starting playback via drag-and-drop or "Open with" MUST stop or pause any existing audio conversion previews or prior playback sessions.

### Key Entities *(include if feature involves data)*

- **Playback Queue**: An ordered list of audio tracks loaded in the music player. Contains the active track pointer, remaining tracks to play, and playback modes (sequential, loop, shuffle).
- **Dropped Ingestion Batch**: A collection of filesystem paths (files and directories) supplied by an external OS drag-and-drop or command-line action. Contains resolved audio tracks, ignored non-audio paths, and traversal state.
- **System File Association**: Operating system registration linking supported audio MIME types and file extensions to Audiflow as an audio viewer/player.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When a user drops a list of 1 to 50 audio files onto the Music Player, playback of the first track begins within 1 second of drop completion on all desktop platforms.
- **SC-002**: When a user drops a folder containing up to 200 audio tracks, all valid tracks are identified and loaded into the playback queue within 2 seconds, and the first track starts playing immediately.
- **SC-003**: When a playing track finishes, 100% of consecutive tracks in the dropped queue play automatically without manual intervention (auto-advance success rate: 100%).
- **SC-004**: Opening an audio file from the OS "Open with" context menu successfully brings the app to focus and begins playback in under 1.5 seconds when the application is already running.
- **SC-005**: 100% of non-audio files included in a dropped folder or batch are filtered out cleanly without crashing or interrupting audio playback.
- **SC-006**: Zero regressions in Audio Converter drag-and-drop functionality when dragging files onto the Converter tab.

## Assumptions

- **Default Queue Behavior on Drop**: Dropping new tracks onto the Music Player replaces the current playback queue and starts playing track 1 of the new batch immediately. This matches universal expectations of media players (VLC, QuickTime, Windows Media Player). (Future enhancement could support holding Shift/Alt to append without interrupting).
- **Tool Context Gating**: Drag-and-drop routing is context-aware based on the active view: dropping onto the Converter view feeds the converter, while dropping onto the Music Player view queues and plays audio tracks.
- **Single Instance Enforcement**: Desktop builds already enforce single-instance mode; subsequent "Open with" invocations from the OS pass arguments to the running instance rather than spawning parallel processes.
- **Supported Audio Extensions**: Supported audio file formats are strictly defined as: `.mp3`, `.flac`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.opus`, `.aiff`, `.alac`, `.wma`, and `.weba`. Video files dropped into the player will not be queued for audio-only playback unless opened via converter.
- **Local-First & Offline**: All file resolution, folder traversal, metadata reading, and playback occur 100% locally with zero internet dependency, zero telemetry, and zero cloud services.
