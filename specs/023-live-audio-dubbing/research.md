# Research: Real-Time AI Live Audio Dubbing & ALAD Integration

**Feature**: `023-live-audio-dubbing`  
**Date**: 2026-09-26  
**Status**: Completed  

---

## 1. System Audio Loopback Capture Architecture

### Context & Problem
To perform live dubbing of foreign videos or podcasts, Audiflow must capture the clean digital audio output of other running applications (YouTube, media players, streaming apps) without recording room echo, background noise, or microphone feedback. Furthermore, the solution must operate across both Desktop (Windows, macOS, Linux) and Android.

### Decision
Implement a decoupled cross-platform audio capture interface `SystemAudioCapturer` in Rust with platform-native capture drivers:
1. **Windows**: WASAPI Loopback Capture via the `windows` crate / `cpal`. Captures the default audio endpoint's render stream in loopback mode (`AUDCLNT_STREAMFLAGS_LOOPBACK`), resampled to 16kHz 16-bit Mono PCM.
2. **Android**: `AudioPlaybackCaptureConfiguration` combined with `MediaProjectionManager` and `AudioRecord` in Kotlin (`src-tauri/android/`), feeding 16kHz PCM chunks into Rust via JNI bridge (`android_fs.rs`).
3. **Linux / macOS**: `cpal` loopback capture / PulseAudio monitor source on Linux, and CoreAudio loopback / virtual sink on macOS.

### Rationale
- Digital loopback capture provides 100% pristine audio quality with zero ambient noise.
- ALAD-Mobile's proven Android capture logic (`AudioPlaybackCapture`) can be directly ported into Audiflow's native Android harness.
- WASAPI loopback on Windows runs with zero external drivers, perfectly matching Audiflow's zero-dependency ethos.

### Alternatives Considered
- *Microphone Recording*: Highly degraded quality, prone to background noise and room reverb; strictly prohibited by Constitution Principle VI for loudness analysis.
- *Virtual Audio Cable Drivers*: Requires administrative driver installation and complex third-party software; rejected.

---

## 2. Ultra-Low Latency Speech-to-Speech Streaming (Gemini Live Bidi)

### Context & Problem
Live dubbing requires conversational speech-to-speech translation with sub-1.5 second turnaround time. Traditional sequential pipelines (STT -> Text Translate -> TTS) take 3-5 seconds, causing intolerable delay between video and dubbing.

### Decision
Connect directly to Google's **Gemini Live Bidirectional Streaming API** (`BidiGenerateContent`) via Secure WebSockets (`tokio-tungstenite` on the Rust backend):
- **Endpoint**: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={API_KEY}`
- **Audio Ingest Format**: 16kHz, 16-bit Linear PCM, Mono, Base64-encoded audio chunks (`realtime_input.media_chunks`).
- **Audio Output Format**: 16kHz or 24kHz PCM chunks received asynchronously in the `serverContent.modelTurn.parts` stream.
- **Session Instructions**: System prompt directing the model to act as a real-time simultaneous interpreter with target language specifications.

### Rationale
- Gemini Live Speech-to-Speech processes audio natively in an end-to-end neural model without intermediate text bottlenecks.
- Placing the WebSocket client in **Rust** (rather than Kotlin) enables shared streaming code for both Desktop and Android, drastically reducing code duplication and ensuring consistent latency across platforms.

### Alternatives Considered
- *Local Whisper + MarianMT + Piper TTS*: Too heavy for low-end mobile devices and CPUs; high battery consumption and memory footprint.
- *Sequential Cloud APIs (Cloud STT + Translate + TTS)*: Multiple roundtrips introduce 3000ms+ latency.

---

## 3. Dynamic Audio Ducking Architecture

### Context & Problem
When the AI translator begins speaking in the user's native language, the original background application (e.g. YouTube) must be lowered (ducked) so the translation is intelligible. When the translator pauses, the original audio should smoothly ramp back up.

### Decision
Provide a dual-layer audio ducking mechanism with a user-configurable attenuation slider (30% to 90%, default 70%):
1. **Android**: Use `AudioManager` focus requests with `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK` or adjust master stream attenuation during active speech detection.
2. **Windows Desktop**: Utilize `IAudioSessionManager2` / `IAudioSessionControl` to lower the volume of background audio sessions while keeping Audiflow's output stream at full volume, with a smooth 100ms attack and 400ms release curve.

### Rationale
- Native OS audio session ducking doesn't interfere with the raw audio capture stream, ensuring the AI model continues receiving unaffected audio for seamless translation continuity.
- The configurable slider lets users tune the balance between hearing the background soundtrack/atmosphere and focusing on the voice translation.

### Alternatives Considered
- *Hard Mute*: Abrupt silence is disorienting and ruins ambient background music/sound effects.
- *Fixed 100% ducking*: Too loud or too soft depending on headphone impedance and user hearing.

---

## 4. Floating Overlay Controller (Android & Desktop)

### Context & Problem
Users watching videos in full screen or using other apps cannot easily navigate back to Audiflow to pause, resume, or view status.

### Decision
Implement an opt-in floating controller:
1. **Android**: Native Android Floating Pill using `WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY` with:
   - Draggable edge-snapping coordinates.
   - Double-tap gesture for instant pause/resume.
   - Haptic vibration feedback on toggle.
   - Pulsing neon ring visualizer reflecting speech activity.
2. **Desktop (Windows/macOS/Linux)**: A lightweight, frameless, transparent, always-on-top Tauri secondary window (`live-dubbing-pill`) positioned at the screen edge.

### Rationale
- Matches the signature user experience of ALAD-Mobile while providing an equivalent seamless experience on Desktop.
- Configurable toggle in settings allows users who prefer notification-only or windowed controls to disable the overlay.

### Alternatives Considered
- *Notification-only*: Less accessible when watching full-screen landscape video.
- *Mandatory always-on overlay*: Can annoy users who prefer minimal UI footprint; solved by making it an opt-in toggle.

---

## 5. Security & Constitution Compliance

### Context & Problem
Constitution Principle VII mandates that secrets NEVER touch plaintext storage. Constitution Principle VI mandates that only ONE active audio stream may play at any time across Audiflow.

### Decision
1. **API Key Storage**: Leverage Audiflow's existing `src-tauri/src/secrets.rs` hardware-backed keychain module (`keyring` crate on Desktop, Android Keystore on Android). Never serialize to `settings.json` or `localStorage`.
2. **Single Active Audio Stream**: Register an inter-store playback coordinator in Zustand. If `useMusicPlayerStore` starts playback or the Converter preview starts, `useLiveDubbingStore` immediately pauses active dubbing, and vice versa.
3. **File Size & Hygiene**: Split all new modules so no `.ts`, `.tsx`, or `.rs` file exceeds 300 lines. All UI strings registered in `src/i18n/en.ts` and `src/i18n/fa.ts` with complete RTL layout support.
