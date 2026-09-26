# Feature Specification: Real-Time AI Live Audio Dubbing (ALAD Integration)

**Feature Branch**: `023-live-audio-dubbing`

**Created**: 2026-09-26

**Status**: Ready for Planning

**Input**: User description: "اگر من بخوام این پروژه [ALAD-Mobile: دوبله زنده صوتی هوش مصنوعی Gemini Live] روی برنامه که خودم ساختم [Audiflow] به صورت ۱۰۰ درصدی اضافه کنم باید چه کار های بکنم و چه روندی باید انجام بدم"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time System Audio Capture & AI Live Speech Dubbing (Priority: P1)

As an Audiflow user watching a foreign-language video (e.g. YouTube, Netflix, educational course) or listening to an international podcast, I want to enable Live Audio Dubbing with one click so that the system audio is captured in real-time, translated by an ultra-low latency AI speech-to-speech engine into my native language (e.g., Persian), and played directly into my headphones/speakers with natural speech synthesis.

**Why this priority**: Real-time speech-to-speech dubbing without requiring video subtitles is the foundational value proposition of the ALAD integration.

**Independent Test**: Can be tested by playing an English video in a media player or browser, starting the Live Dubbing session targeting Persian, and verifying that translated Persian speech begins playing with under 1.5 seconds latency while the original video continues playing.

**Acceptance Scenarios**:

1. **Given** media playing in another application on the device, **When** the user starts Live Dubbing, **Then** clean digital internal audio is captured without ambient microphone noise and streamed to the AI translation engine.
2. **Given** an active dubbing session, **When** the AI engine produces translated speech audio, **Then** the translated audio is immediately output to the active audio device (speakers/headphones).
3. **Given** a network disconnection or packet loss during an active session, **When** the connection drops, **Then** the system notifies the user gracefully and attempts automatic reconnection without crashing or freezing.

---

### User Story 2 - Smart Dynamic Audio Ducking (Priority: P1)

As a listener, when the AI translator is actively speaking, I want the volume of the original application (e.g. YouTube background video) to automatically attenuate (duck) to a lower level and smoothly return to normal volume when the translator finishes a phrase, so that the translated dialogue is completely intelligible without competing with the original audio.

**Why this priority**: Without intelligent ducking, the simultaneous playback of both original and translated speech creates cacophony and unintelligibility.

**Independent Test**: Can be tested by playing loud background audio and verifying that the original volume dips by approximately 60-80% within 100 milliseconds of translated speech start, and returns smoothly to 100% within 500 milliseconds of speech ending.

**Acceptance Scenarios**:

1. **Given** media playing with background audio ducking enabled, **When** the AI translator begins outputting translated speech, **Then** the original audio volume drops smoothly without jarring pops or clicks.
2. **Given** the AI translator finishes speaking a sentence, **When** a short pause (e.g., 400ms) is detected, **Then** original audio volume ramps smoothly back to full volume.
3. **Given** the user toggles dubbing off, **When** playback stops, **Then** system audio volume immediately restores to the original user setting.

---

### User Story 3 - Multi-Language Selection (78 Languages) & Voice Customization (Priority: P2)

As a user, I want to select my preferred target language from a searchable list of 78 supported world languages and pick a voice style/persona, so that the live dubbing matches my language needs and sounds appealing.

**Why this priority**: Broad language support and voice options ensure high accessibility across international user bases.

**Independent Test**: Can be tested by searching for and choosing different languages (e.g. Persian, Spanish, Japanese, German) from the language selector and confirming the speech synthesis output matches the selected language.

**Acceptance Scenarios**:

1. **Given** the Live Dubbing configuration screen, **When** the user opens the target language picker, **Then** a categorized and searchable list of 78 languages with country flags and localized names is displayed.
2. **Given** a selected target language, **When** the user switches language during a session, **Then** subsequent translation turns seamlessly adapt to the newly selected target language.
3. **Given** supported voice personas (e.g., masculine, feminine, varied accents), **When** a persona is chosen, **Then** the translated audio adopts that vocal profile.

---

### User Story 4 - Smart Floating Overlay Controller with Haptic Gestures (Priority: P2)

As a mobile user multitasking between different apps (e.g., scrolling YouTube, watching Netflix, attending online lectures), I want a lightweight floating overlay pill on top of other apps with quick double-tap pause/resume gestures, a pulsating halo indicator, and tactile haptic feedback, so that I can control dubbing without constantly leaving my current app.

**Why this priority**: On mobile devices, switching apps to pause or resume dubbing breaks user immersion; a floating overlay provides effortless multitasking.

**Independent Test**: Can be tested on a mobile device by starting dubbing, exiting to the home screen or YouTube, observing the draggable floating icon, double-tapping to pause/resume, and feeling confirmation haptic vibrations.

**Acceptance Scenarios**:

1. **Given** Live Dubbing active on mobile, **When** the user switches to another app, **Then** a compact floating widget remains accessible on the screen edge.
2. **Given** the floating widget, **When** the user double-taps anywhere on the widget, **Then** dubbing immediately toggles between active and paused, accompanied by a subtle haptic pulse.
3. **Given** the user drags the floating widget, **When** released, **Then** it snaps gracefully to the nearest screen edge without obstructing essential content.

---

### User Story 5 - Secure Credential Management & Health Preflight (Priority: P1)

As a user, I want to supply my Google Gemini API key securely, have the application validate it with a quick preflight ping, and ensure it is saved strictly in the operating system's hardware-backed credential keychain, so that my key is never exposed in plaintext files or logs.

**Why this priority**: Compliance with Constitution Principle VII (Secrets Never Touch Plaintext Storage) and preventing runtime authentication failures.

**Independent Test**: Can be tested by saving an API key, verifying that a connection test checks validity, checking that the key is encrypted in OS keychain, and starting a session successfully.

**Acceptance Scenarios**:

1. **Given** a new user setting up Live Dubbing, **When** they paste their Gemini API key and press Test Connection, **Then** the system performs an authenticated ping and reports key validity status.
2. **Given** a valid key, **When** saved, **Then** the key is stored in the OS credential vault / Android Keystore and never written to `settings.json` or `localStorage`.
3. **Given** an invalid or quota-exhausted API key, **When** starting a session, **Then** an informative error message guides the user to check their key or quota in AI Studio.

---

### Edge Cases

- What happens when the user receives an incoming phone call during active dubbing? The dubbing service must automatically pause audio capture and release ducking immediately.
- How does the system handle media protected by DRM (e.g. some encrypted streaming services where OS prevents loopback capture)? The system should detect silent or prohibited capture buffers and present an informative banner explaining OS DRM restrictions.
- What happens when switching between Wi-Fi and mobile data during an active session? The WebSocket stream must handle transient network migration and auto-reconnect without terminating the foreground service.
- What happens when the user plays local audio in Audiflow's Music Player while Live Dubbing is active? Per Constitution Principle VI, starting local audio playback must pause the live dubbing session to prevent overlapping internal audio streams.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST capture digital internal audio playback using OS loopback facilities without capturing ambient room noise through physical microphones.
- **FR-002**: System MUST establish a bidirectional streaming connection with the real-time AI speech translation service supporting live 16kHz mono audio exchange.
- **FR-003**: System MUST play back received translated speech chunks in real time with end-to-end latency below 1.5 seconds under normal network conditions.
- **FR-004**: System MUST dynamically lower (duck) background media volume when translated speech is playing and restore original volume when speech ceases.
- **FR-005**: System MUST provide a target language selector supporting 78 languages with search and localization (English & Persian).
- **FR-006**: System MUST persist user credentials exclusively in secure OS-level keychain/keystore storage per Constitution Principle VII.
- **FR-007**: System MUST run an ongoing session inside a persistent foreground service with a persistent notification on mobile to prevent OS process killing during background execution.
- **FR-008**: System MUST comply with single active audio stream discipline (Constitution Principle VI) by coordinating pause/resume with Audiflow's Music Player and Converter audio previews.
- **FR-009**: System MUST support cross-platform operation covering both Desktop (Windows WASAPI loopback, macOS, Linux) and Android (AudioPlaybackCapture via MediaProjection) with a shared core audio streaming pipeline.
- **FR-010**: System MUST provide a configurable floating overlay toggle allowing users to enable or disable the floating controller pill in settings, with persistent state across app launches.
- **FR-011**: System MUST provide a user-configurable audio ducking slider (allowing background volume attenuation adjustment between 30% and 90%, default 70%) during active speech dubbing.

### Key Entities

- **DubbingSession**: Represents an active or paused live dubbing session (status, target language, selected voice, uptime, latency indicator, bytes streamed).
- **LanguageProfile**: Language descriptor (ISO code, localized name in English & Persian, flag emoji, supported speech synthesis voices).
- **AudioDuckingConfig**: Settings governing ducking threshold, attenuation percentage (e.g. 70%), attack ramp duration (ms), and release ramp duration (ms).
- **CredentialProfile**: Encrypted keychain reference containing validated Gemini API token and quota status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: End-to-end translation latency (time from original speech utterance to audible translated playback) is under 1.5 seconds on average over standard broadband or 4G connection.
- **SC-002**: Audio ducking attenuation engages within 100 milliseconds of speech detection and restores smoothly within 500 milliseconds of silence.
- **SC-003**: 100% of sensitive API credentials are stored in hardware-backed/OS-level secure vaults with zero plaintext persistence.
- **SC-004**: Dubbing session runs continuously for at least 60 minutes in the background without unexpected process termination by OS power management.
- **SC-005**: Users can initiate live dubbing in fewer than 2 clicks from the primary interface or the floating widget.
- **SC-006**: 100% of UI text is internationalized with zero hardcoded strings across English and Persian locales per Constitution Principle VIII.

## Assumptions

- Users have access to a Google Gemini API key supporting live speech-to-speech models (`gemini-2.0-flash-exp` / `Live Bidi`).
- On Android, devices run Android 10 (API 29) or higher to support `AudioPlaybackCaptureConfiguration` and `MediaProjection`.
- Internet connection speed has at least 100 kbps upstream and downstream bandwidth for continuous 16kHz audio streaming.
- Core conversion, trimming, and music player features remain 100% offline and functional without requiring Live Dubbing or network access (Constitution Principle I).
