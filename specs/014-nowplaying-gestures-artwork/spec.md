# Feature Specification: Now Playing Gestures and Artwork Synchronization

**Feature Branch**: `014-nowplaying-gestures-artwork`

**Created**: 2026-09-22

**Status**: Draft

**Input**: User description: "۱.مشکل های که کار بر ها گزارش دادهند اهنگ پلی میکنی و عوض میکنی اهنگ عوض میشه ولی کاور اهنگ عوض نمیشه ۲.وقتی تو صفحه پخش موزیکم انتظار دارم با درگ کردن به پایین صفحه بسته بشه و پلی لیستم رو ببینم. و همچنین با swap به چپ و راست بره موزیک قبلی و بعدی همش با حرکت انیمیشنی"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instant & Reliable Artwork Synchronization (Priority: P1)

As a listener playing music, when I change tracks (by tapping next/previous, selecting a song from the playlist/queue, or letting playback advance automatically), I want the song's album artwork to update immediately and reliably to match the newly playing track, so that I never see the previous track's cover image associated with the new song.

**Why this priority**: Displaying incorrect artwork on track changes is a visible data-presentation bug that directly degrades user trust and immersion in the music player. Ensuring accurate metadata and artwork sync is fundamental to playback.

**Independent Test**: Can be fully tested by playing track A with artwork, advancing to track B (which has different artwork) and track C (which has no artwork), and verifying that track B displays its correct artwork immediately without flashing track A's artwork, and track C displays its appropriate placeholder gradient without retaining track B's image.

**Acceptance Scenarios**:

1. **Given** a song with artwork is currently playing, **When** the user skips to a different song with distinct artwork, **Then** the artwork immediately transitions to the new song's cover without lingering on the previous image.
2. **Given** a song with artwork is currently playing, **When** the user selects a song without embedded artwork from the playlist, **Then** the display immediately shows the new song's dedicated placeholder/gradient artwork and does not display the previous song's cover.
3. **Given** rapid consecutive track changes (e.g. skipping 3 songs in rapid succession), **When** playback settles on the final song, **Then** the display reliably presents only the artwork corresponding to the final actively playing song.

---

### User Story 2 - Interactive Drag-Down to Dismiss Fullscreen Player (Priority: P2)

As a listener on the Now Playing screen, I want to pull or drag down on the view to smoothly close/minimize the screen and return to my playlist and music library, with interactive animation that tracks my finger/pointer.

**Why this priority**: Modern mobile music experiences rely on natural pull-down gestures to return to browsing without hunting for a small back button, making library navigation fast and intuitive.

**Independent Test**: Can be fully tested by opening Now Playing, dragging downward on the screen, verifying fluid downward translation following touch/cursor displacement, and confirming that dragging past the dismissal threshold closes the screen while releasing early smoothly snaps the view back into place.

**Acceptance Scenarios**:

1. **Given** the fullscreen player view is open, **When** the user drags down past the minimum threshold (or with a fast downward flick) and releases, **Then** the player view smoothly animates down to close and reveals the playlist/library.
2. **Given** the user begins dragging down, **When** the gesture is released before reaching the dismiss threshold without downward velocity, **Then** the view springs/snaps back to full view with an animated transition and remains open.
3. **Given** the user is interacting with the waveform seekbar or audio sliders, **When** dragging on those controls, **Then** the scrub/slider action takes precedence and does not trigger drag-to-dismiss.

---

### User Story 3 - Horizontal Swipe for Track Navigation with Slide Animation (Priority: P3)

As a listener on the Now Playing screen, I want to swipe horizontally left or right across the album artwork area to move to the next or previous song in my playlist, accompanied by a fluid card sliding animation.

**Why this priority**: Gesture-based track skipping allows quick, one-handed song progression without requiring precision taps on small playback transport buttons.

**Independent Test**: Can be fully tested by swiping horizontally on the artwork card in Now Playing, observing an animated horizontal transition, and verifying that the current track switches to the next or previous song according to the swipe direction.

**Acceptance Scenarios**:

1. **Given** an active playlist with multiple tracks, **When** the user performs a horizontal forward swipe on the album artwork area, **Then** the artwork card smoothly slides out and the next track's artwork slides in, initiating playback of the next song.
2. **Given** an active playlist with multiple tracks, **When** the user performs a horizontal backward swipe on the album artwork area, **Then** the artwork card smoothly slides out and the previous track's artwork slides in, initiating playback of the previous song.
3. **Given** the first song of a non-repeating playlist, **When** the user attempts to swipe backward to a non-existent previous song, **Then** the card applies a rubber-band resistance animation and returns to center without switching songs.
4. **Given** the app is configured in RTL (Persian) or LTR (English) mode, **When** the user swipes, **Then** the gesture direction respects directional expectations (forward gesture advances to next track, backward gesture returns to previous track).

---

### Edge Cases

- **Interrupted / Cancelled Gestures**: Releasing a drag or swipe mid-gesture smoothly animates the view back to its stable resting state without stutter or abrupt jumps.
- **Concurrent Gestures**: A horizontal swipe gesture and a vertical drag gesture cannot both activate simultaneously; once a directional gesture passes its initial movement deadband (horizontal vs. vertical disambiguation), the dominant direction locks in.
- **Slider Interference**: Dragging on seekbars, volume sliders, or speed sliders must never trigger screen dismissal or track changes.
- **Sub-Sheet Interactions**: When a modal sheet (e.g. Sound Booster or Options sheet) is open on top of Now Playing, gestures inside that sheet must not trigger Now Playing dismissal or track navigation.
- **Rapid Swipe Spamming**: Swiping rapidly multiple times in succession safely enqueues or advances tracks without skipping index bounds, crashing, or desynchronizing artwork.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Now Playing screen and cover artwork components MUST immediately clear or update displayed artwork whenever the active track changes, preventing any stale artwork from a previous track from persisting.
- **FR-002**: If artwork for a newly selected track is not immediately available in cache, the system MUST display the fallback placeholder artwork (or stylized gradient) for the new track until the artwork resolves, rather than displaying the prior track's artwork.
- **FR-003**: The Now Playing screen MUST support an interactive drag-down gesture that translates the view vertically in direct response to user finger or pointer position.
- **FR-004**: The drag-down gesture MUST execute a smooth closing animation to dismiss the fullscreen player and reveal the playlist/library when dragged beyond the dismiss threshold or flicked downwards with sufficient velocity.
- **FR-005**: If the drag-down gesture does not meet the dismissal criteria upon release, the view MUST spring or transition smoothly back to its fully expanded resting state.
- **FR-006**: The album artwork area MUST support horizontal swipe gestures (swipe left and swipe right) to trigger previous and next track navigation.
- **FR-007**: Horizontal track-switch gestures MUST be accompanied by an animated slide or transition effect indicating the departure of the current track and the arrival of the incoming track.
- **FR-008**: The gesture system MUST disambiguate between vertical drag, horizontal swipe, and seekbar/slider interaction using a directional deadband, ensuring seekbar scrubbing never triggers swipe-to-skip or drag-to-dismiss.
- **FR-009**: Horizontal navigation gestures MUST respect locale directionality (RTL/LTR) so that swipe forward advances to the next track and swipe backward returns to the previous track across Persian and English locales.
- **FR-010**: When at the boundary of a playlist (e.g., start of playlist with no previous track or end of playlist without repeat), a horizontal swipe MUST provide physical resistance/elastic bounce feedback without advancing the track.

### Key Entities

- **Track Artwork Display**: The visual representation of a song's album art or procedural fallback gradient, tied strictly to the identity of the currently active track.
- **Now Playing Sheet Surface**: The gesture-interactive container presenting the current track details, controls, and dismissible drag behavior.
- **Artwork Carousel/Card**: The swipeable visual card within Now Playing that visually handles horizontal movement, momentum, and transitions between consecutive playlist tracks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Stale artwork persistence is reduced to 0%: every track transition reflects the new song's cover or its placeholder within 50ms of track change.
- **SC-002**: 100% of downward drag gestures meeting the threshold or velocity trigger a smooth dismissal animation completing in under 350ms, returning the user to the underlying playlist view.
- **SC-003**: Swipe left/right gestures trigger track change and commence the transition animation within 16ms of gesture threshold crossing on supported devices.
- **SC-004**: Accidental dismissals or track switches while interacting with the waveform seekbar or audio control sliders occur in 0% of test runs.
- **SC-005**: Both mobile touch events and desktop mouse/touchpad drag interactions function consistently with smooth, non-jerky animation curves (60fps performance target).

## Assumptions

- The dismiss gesture closes the fullscreen Now Playing overlay, restoring view of whatever library or playlist screen was underneath, and leaving the mini-player visible at the bottom of the screen.
- The drag-down gesture can be initiated anywhere on the Now Playing view that is not an interactive control (header, background, and artwork card).
- Swiping horizontally directly on the album artwork card is the primary surface for switching tracks, preventing accidental skips when touching metadata or lower controls.
- Directionality in RTL (Persian): Swiping to the left in LTR is next song, while in RTL standard conventions, swipe direction aligns with the user's reading flow (or can be configured with intuitive visual momentum).
