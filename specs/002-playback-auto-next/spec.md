# Feature Specification: Playback Auto-Next Reliability

**Feature Branch**: `002-playback-auto-next`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "بعضی وقت‌ها که آهنگ تموم میشه نمیره آهنگ بعدی" (Sometimes when a song ends, playback does not advance to the next song). Prior investigation found auto-advance depends on a single end-of-track signal with no fallback: files that never emit a clean end signal (corrupt tail, missing duration metadata, decode error) halt the queue, a failed start of the next track leaves a stuck silent state, and reaching the end of a playlist with repeat off leaves a stale "playing" indicator.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Uninterrupted playlist playback (Priority: P1)

A listener starts a playlist and expects every song to play one after another with no manual intervention.

**Why this priority**: This is the reported bug; continuous playback is the core promise of a music player.

**Independent Test**: Can be fully tested by starting a multi-song playlist, letting it run untouched, and confirming each song starts after the previous one ends.

**Acceptance Scenarios**:

1. **Given** a playlist of 3+ playable songs is playing, **When** each song ends, **Then** the next song starts automatically without user action.
2. **Given** a playlist is auto-advancing, **When** the user watches the now-playing indicator, **Then** the displayed song, play state, and progress always match the audible song.

---

### User Story 2 - Predictable repeat and shuffle boundaries (Priority: P2)

A listener using repeat/shuffle expects the queue to behave the same at track boundaries as with manual next.

**Why this priority**: Boundary behavior (last track, repeat-one, shuffle) is where auto-advance diverges most visibly from expectations.

**Independent Test**: Can be fully tested by setting each playback mode and letting the last track end on its own.

**Acceptance Scenarios**:

1. **Given** repeat is off and the last song ends, **When** there is no next song, **Then** playback stops and the player shows a stopped (not playing) state.
2. **Given** repeat-all is on and the last song ends, **When** the queue wraps, **Then** the first song starts automatically.
3. **Given** repeat-one is on and the song ends, **When** the track finishes, **Then** the same song restarts automatically.
4. **Given** shuffle is on, **When** a song ends, **Then** a different song starts automatically (unless the playlist has a single song).

---

### User Story 3 - A bad file never silently kills the queue (Priority: P3)

A listener with one corrupt or unplayable file in a playlist expects playback to continue, not freeze in silence.

**Why this priority**: Single-file failures explain the intermittent ("sometimes") nature of the reports.

**Independent Test**: Can be fully tested by placing an unplayable file between two playable songs and letting playback run through it.

**Acceptance Scenarios**:

1. **Given** the next queued file cannot be played, **When** auto-advance reaches it, **Then** playback continues to the next playable song without user action.
2. **Given** no remaining playable songs exist, **When** auto-advance exhausts the queue, **Then** playback stops with a clear stopped state (never a fake "playing" indicator with silence).

---

### Edge Cases

- What happens when the playlist has exactly one song and repeat is off (ends → stopped state)?
- How does the system handle a file with unknown/missing duration metadata (must still advance at its real end)?
- What happens when the user presses next/previous manually at the exact moment a song ends (exactly one advance, no skip or double-play)?
- How does the system handle back-to-back unplayable files (skips all, stops cleanly at the end)?
- What happens when the app was in the background while a song ended (advance still occurs, state correct on return)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Player MUST automatically start the next queued song when the current song ends, with no user action.
- **FR-002**: Player MUST apply the active repeat mode on automatic advance exactly as on manual next (off → stop at end, all → wrap to first, one → restart same song).
- **FR-003**: Player MUST apply the active shuffle setting on automatic advance (a different song when more than one exists).
- **FR-004**: Player MUST skip a queued file that fails to start and continue to the next playable song without user action.
- **FR-005**: Player MUST show an accurate play state at all times: never display "playing" while silent/stopped, including after the playlist ends or a start failure.
- **FR-006**: Manual next, previous, play, pause, and seek behavior MUST remain unchanged.
- **FR-007**: Automatic advance MUST fire exactly once per track end (no double-advance when manual and automatic triggers coincide).

### Key Entities

- **Playback queue**: The ordered list of songs playback advances through; has a current position and an end.
- **Playback mode**: The combination of repeat setting (off / all / one) and shuffle setting (on / off) governing what "next" means.
- **Play state**: Whether the player is audibly playing, paused, or stopped; always matches what the listener hears.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A playlist of valid songs plays from first to last with zero manual interventions and zero stalls.
- **SC-002**: A playlist containing an unplayable file in the middle plays through to the end with zero manual interventions.
- **SC-003**: At the natural end of a playlist with repeat off, 100% of trials show the stopped state (no stuck "playing" indicator).
- **SC-004**: In 50 consecutive track-end transitions, zero double-advances or skipped songs occur.

## Assumptions

- Desktop auto-advance is the broken path being fixed; the Android native queue's normal auto-advance already works and only its single-song-queue edge is verified, not redesigned.
- "Unplayable file" means any queued entry whose audio cannot be started (missing file, corrupt data, unsupported content); the player skips it rather than stopping with an error dialog.
- Skipped files are reported non-intrusively (e.g., a brief notice or log entry); no modal dialogs interrupt listening.
- Background/foreground behavior must not change: playback continues in the background as today.
