# Feature Specification: Online Multi-Source Music Streaming & Player

**Feature Branch**: `022-online-stream-player`

**Created**: 2026-09-26

**Status**: Ready for Planning

**Input**: User description: "اگر من این پروژه بخوام بیارم داخل پروژه خودم ایا نیاز به سرور دارم یا میشه روی سیستم عامل کاربر این پیاده سازی کرد ؟ PS C:\Users\javad\Desktop\streamifyweb-player-master>"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Multi-Provider Online Search & Discovery via Search Button (Priority: P1)

As an Audiflow user, I want to click an "Internet Search" button placed next to the existing music library search bar, type a song or artist name, and view matching tracks from multiple online platforms (YouTube, YouTube Music, SoundCloud, and JioSaavn), so that I can discover and listen to online music seamlessly from within the player interface.

**Why this priority**: Discovery is the foundational entry point of the streaming feature. Placing the trigger right next to the current search bar creates zero navigation friction.

**Independent Test**: Can be fully tested by navigating to the Music Player, clicking the "Internet Search" button in the search row, typing a query, and verifying aggregated results with thumbnails, titles, artists, and provider badges appear within 3 seconds.

**Acceptance Scenarios**:

1. **Given** the user is in the Music Player, **When** they click the "Internet Search" button next to the search input and submit a query, **Then** results from online providers (YouTube, SoundCloud, JioSaavn) are displayed in a clean results view.
2. **Given** one online provider is unresponsive or blocked, **When** the user searches, **Then** results from remaining working providers are displayed without crashing or hanging the interface.
3. **Given** the device has no internet connection, **When** the user attempts an online search, **Then** an informative offline banner with a retry option is presented.

---

### User Story 2 - Direct Local Audio Streaming & Playback Controls (Priority: P1)

As a listener, I want to click any online search result and immediately stream the audio through Audiflow's player controls (play, pause, seek, volume, repeat, shuffle) on my operating system without requiring an external hosted server, so that I get a seamless desktop playback experience.

**Why this priority**: Streaming audio playback is the core value proposition of integrating online music capabilities into Audiflow.

**Independent Test**: Can be fully tested by clicking a track in search results and verifying that audio plays smoothly, the progress bar updates, seeking to a new timestamp works without stalling, and pausing halts playback.

**Acceptance Scenarios**:

1. **Given** a selected online track, **When** the user clicks play, **Then** audio streaming begins within 2 seconds and now-playing metadata (title, artist, artwork) is updated.
2. **Given** an active stream, **When** the user seeks to a different part of the song, **Then** playback resumes from the chosen timestamp with minimal buffering.
3. **Given** an active online stream, **When** the user starts playback of a local audio track in the Music Player or plays a preview in the Converter/Booster, **Then** the online stream immediately pauses to ensure only one audio stream plays at any time.

---

### User Story 3 - Download & Save Online Tracks into Local Library and Converter (Priority: P1)

As an Audiflow user, I want a one-click download/save button on online tracks, so that I can save the audio directly to my local Music Library and send it into the Converter/Booster pipeline for permanent offline listening and editing.

**Why this priority**: Bridges the gap between online discovery and Audiflow's core offline converter/library capabilities, delivering immense user value.

**Independent Test**: Can be fully tested by clicking the "Download / Save" button on an online track, observing the download progress, and verifying the file appears in the local Music Library and can be opened in the Converter.

**Acceptance Scenarios**:

1. **Given** an online track in search results or now-playing view, **When** the user clicks "Download / Save", **Then** the audio is fetched, saved to the user's music folder, and automatically registered in the local Music Library.
2. **Given** a downloaded track, **When** the user selects "Open in Converter", **Then** the file is loaded into the converter wizard ready for trimming, boosting, or format conversion.
3. **Given** an ongoing download, **When** the user cancels or the network fails, **Then** partial files are cleaned up per Constitution Principle IV (Atomic, Non-Destructive File Operations).

---

### User Story 4 - Synchronized Timed Lyrics Display (Priority: P2)

As a music enthusiast, I want to view synchronized, line-by-line timed lyrics while an online track is playing, so that I can follow along with the song in real time.

**Why this priority**: Synchronized lyrics significantly elevate the listening experience and are a signature feature of modern streaming players.

**Independent Test**: Can be fully tested by playing a track that has available timed lyrics and verifying that the current lyric line highlights in synchronization with audio playback.

**Acceptance Scenarios**:

1. **Given** a playing track with timed lyrics available in public lyric databases (e.g. LRCLIB), **When** the user opens the lyrics view, **Then** lyrics are presented with line-by-line scrolling and highlighting synchronized with playback time.
2. **Given** a playing track with no available synchronized lyrics, **When** the user views the lyrics pane, **Then** an informative fallback message (or plain static lyrics if available) is displayed without error.
3. **Given** an active timed lyrics display, **When** the user clicks a specific lyric line, **Then** playback seeks directly to that line's timestamp.

---

### User Story 5 - System VPN & Proxy Passthrough (Priority: P2)

As a user in a restricted network environment (e.g., in regions where YouTube or SoundCloud are censored), I want Audiflow to automatically route all streaming and search traffic through my operating system's active VPN or system proxy, so that online music services remain fully functional without manual app reconfiguration.

**Why this priority**: Crucial for accessibility in countries with internet restrictions where services like YouTube and SoundCloud are blocked by default.

**Independent Test**: Can be fully tested by connecting to a system VPN or setting an OS proxy, initiating an online search/playback, and verifying that the network requests succeed over the VPN/proxy tunnel.

**Acceptance Scenarios**:

1. **Given** the user has enabled a system VPN or configured an OS-level proxy, **When** Audiflow initiates search or streaming requests, **Then** all HTTP/HTTPS requests respect and route through the active OS tunnel.
2. **Given** an upstream provider instance becomes rate-limited or fails, **When** a stream resolution is requested, **Then** the system automatically tries alternative backup instances without user intervention.

---

### User Story 6 - Online Queue, Local Bookmarks & Playlist Integration (Priority: P2)

As an Audiflow user, I want to add online tracks to my active queue, bookmark them as favorites, and organize them into playlists saved on my device, so that I can revisit my favorite online discoveries anytime.

**Why this priority**: Queue and playlist management allow continuous listening and personal library curation.

**Independent Test**: Can be fully tested by adding multiple online tracks to the queue, letting one song finish and verifying the next track plays automatically, and adding an online track to a local playlist.

**Acceptance Scenarios**:

1. **Given** an active online playback session, **When** a track ends and repeat is off, **Then** the next track in the queue automatically begins streaming.
2. **Given** any online search result or playing track, **When** the user clicks "Favorite" or "Add to Playlist", **Then** the track reference is saved to the local database on the user's computer.

---

### Edge Cases

- **Provider Outage / Rate-Limiting**: An upstream public instance (e.g. Invidious or Piped instance) goes down or is rate-limited by YouTube. System must automatically iterate through fallback instances and notify the user if all instances are currently unreachable.
- **Network Drop Mid-Stream**: The internet connection drops during playback. System must pause playback cleanly, show a network reconnecting state, and resume when the connection returns without crashing.
- **Audio Conflict**: User initiates offline conversion or local music playback while an online stream is active. Per Constitution Principle VI, the system must pause the online stream immediately to prevent concurrent audio playback.
- **Restricted / Geo-Blocked Content**: Specific audio tracks that are geo-restricted or require DRM/licenses. System must display a clear, non-technical notification explaining that the track cannot be streamed in the current region and suggest alternative versions.
- **Offline Mode Integrity**: When the user has no network connection, the rest of Audiflow (Converter, Local Music Player, Sound Booster) must function 100% normally without any delays or network timeout lags.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to perform unified keyword searches across multiple online audio sources (including YouTube, YouTube Music, SoundCloud, and JioSaavn) without requiring any user registration or third-party authentication.
- **FR-002**: System MUST execute all search aggregation, metadata normalization, and audio stream routing directly on the user's local operating system using client-side execution, requiring zero remote server infrastructure or paid cloud hosting.
- **FR-003**: System MUST stream audio directly into the application audio player with full controls including play, pause, seek, volume, mute, repeat (off/one/all), and shuffle.
- **FR-004**: System MUST fetch and render synchronized timed lyrics (line-by-line scrolling and timestamp seeking) when available from open lyric catalogs (e.g. LRCLIB), and provide graceful fallback when lyrics are not found.
- **FR-005**: System MUST maintain an active playback queue for online tracks, with automatic progression to the next song upon track completion.
- **FR-006**: System MUST persist online playlists, favorites, and recently played history locally on the user's storage device without sending telemetry or personal library data to external servers.
- **FR-007**: System MUST automatically inherit and route all network streaming and search traffic through the operating system's active proxy and VPN configurations, ensuring seamless connectivity in restricted network environments when the user enables a system VPN or proxy.
- **FR-008**: System MUST provide a one-click download/save action on online tracks, allowing users to save the streamed audio directly into their local Music Library and send it into the Converter/Booster pipeline for offline playback, editing, and format conversion.
- **FR-009**: System MUST integrate online discovery directly into the existing Music Player interface by placing an "Internet Search" button/toggle next to the current library search bar, allowing users to switch effortlessly between local library filtering and online web search without leaving the player.
- **FR-010**: System MUST strictly isolate all online network operations from core offline conversion, local music playback, and audio enhancement features, ensuring zero disruption or slowdown when working offline.
- **FR-011**: System MUST provide full bilingual localization (English and Persian with RTL layout support) for all online streaming user interface elements, error messages, and status indicators without any hardcoded text.

### Key Entities

- **OnlineTrack**: Represents an online streamable item. Attributes: unique ID, title, artist name, album name, duration, cover artwork URL, provider identifier (YouTube, SoundCloud, JioSaavn), and stream resolution status.
- **StreamSource**: Audio stream details containing resolved stream URL, MIME type, bitrate/quality, and necessary request headers.
- **TimedLyricLine**: Single lyric line containing text, start timestamp, and end timestamp.
- **OnlineQueue**: Ordered collection of OnlineTrack items currently scheduled for sequential playback.
- **OnlinePlaylist**: User-curated list of OnlineTrack references with a user-assigned title, creation timestamp, and local storage identifier.
- **DownloadedMedia**: Record of an online track saved to local disk, including local filesystem path, original source ID, and library index status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Online search queries display aggregated results within 3 seconds under a standard 10 Mbps broadband connection.
- **SC-002**: Audio streaming starts within 2 seconds of selecting a track from search results.
- **SC-003**: 100% of offline features (file conversion, sound booster, offline library playback) remain fully operational when internet access is unavailable or disabled.
- **SC-004**: If an upstream media instance fails, the system automatically falls back to an alternative instance within 1.5 seconds without crashing or dropping user queue state.
- **SC-005**: Zero external servers, subscriptions, or paid hosting are required to operate the search, streaming, download, and lyrics features.
- **SC-006**: 100% of user-facing strings are localized in English and Persian with proper bidirectional (LTR/RTL) rendering.
- **SC-007**: One-click download successfully saves tracks to disk with matching metadata (title, artist, artwork) ready for local playback and conversion.

## Assumptions

- Target users have an active internet connection when using online search, streaming, and download.
- Operating system VPN/proxy handles routing for blocked domains (YouTube/SoundCloud) without requiring custom in-app SOCKS credentials.
- Public provider instances (Piped, Invidious, JioSaavn, SoundCloud, LRCLIB) remain accessible and operable without proprietary API keys.
- Audio streaming and download run on the user's operating system via the local desktop environment without requiring a paid or hosted backend server.
- All online bookmarks, playlists, and downloaded files are stored locally on the user's machine in alignment with the Local-First Privacy principle of the project constitution.
