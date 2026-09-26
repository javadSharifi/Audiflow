# Implementation Plan: Real-Time AI Live Audio Dubbing (ALAD Integration)

**Branch**: `023-live-audio-dubbing` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/023-live-audio-dubbing/spec.md`

---

## Summary

Integrate real-time, low-latency AI speech-to-speech audio dubbing into Audiflow, porting and adapting the architecture from ALAD-Mobile into Audiflow's Tauri 2 + Rust + React foundation. The feature captures digital internal system audio across Desktop (Windows WASAPI loopback, macOS, Linux) and Android (MediaProjection AudioPlaybackCapture), streams 16kHz PCM chunks via bi-directional WebSockets to Google Gemini Live (`gemini-2.0-flash-exp` / `Live Bidi`), plays back translated speech in real time with dynamic background audio ducking (configurable 30%-90%), and offers an opt-in floating overlay pill with double-tap haptic controls.

---

## Technical Context

**Language/Version**: Rust 1.77+ (edition 2021), TypeScript 5.9+ (strict mode), React 19, Kotlin 1.9+ (Android)  
**Primary Dependencies**:
- Backend (Rust): `tokio-tungstenite` 0.21 (secure WebSockets), `tokio` 1 (async runtime), `cpal` 0.15 / `windows` (WASAPI loopback capture), `tauri` 2, `specta` 2.0.0-rc.25
- Android Native (Kotlin): `AudioPlaybackCaptureConfiguration`, `MediaProjection`, `WindowManager` (overlay pill), JNI bridge
- Frontend (React): Zustand 5 (slice architecture), Tailwind CSS 4, `lucide-react`  
**Storage**: OS Keychain / Android Keystore for Gemini API credentials (Constitution Principle VII); `localStorage` for UI preferences (language selection, ducking slider value, overlay toggle)  
**Testing**: Vitest + React Testing Library (frontend slices and UI components), `cargo test` (Rust WebSocket engine and audio resampler)  
**Target Platform**: Windows 10/11, macOS, Linux, Android 10+ (API 29+)  
**Project Type**: Cross-platform desktop and mobile application (Tauri 2 shell)  
**Performance Goals**: < 1.5s end-to-end speech-to-speech turnaround latency, < 100ms ducking attack time, 60fps overlay drag and visualizer rendering  
**Constraints**: Zero ambient mic recording, strict offline core functionality preservation (Principle I), single active audio stream discipline (Principle VI), 300-line ceiling per file (Principle VIII), full English + Persian RTL i18n  
**Scale/Scope**: 78 supported translation languages; 5 vocal personas; unified cross-platform streaming pipeline  

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Requirement | Plan Status | Notes |
|---|---|---|---|
| **I. Local-First Privacy** | Offline capability must remain 100% operational with zero internet. No analytics. | **PASS** | Live Dubbing is strictly opt-in; core conversion, boosting, and local music player remain 100% offline. |
| **II. Single-Pass DSP** | Single FFmpeg execution graph; no cascading lossy re-encoding; alimiter terminal stage. | **PASS** | Live audio streaming uses raw PCM buffers directly; does not touch or degrade the FFmpeg converter pipeline. |
| **III. Type-Safe IPC** | Commands in Specta builder; typed helpers in `src/utils/tauri.ts`; CI check:types gate. | **PASS** | All new commands registered with `#[specta::specta]` and exported to `src/types/generated.ts`. |
| **IV. Atomic Operations** | Atomic file operations; clean up on cancel. | **PASS** | Live Dubbing operates in memory/streaming buffers; session cleanup guarantees immediate resource release. |
| **V. Test-First CI** | Unit tests for store and backend modules before merge. | **PASS** | Vitest tests for `liveDubbingSlice.test.ts` and cargo tests for PCM frame chunker/resampler. |
| **VI. Platform Boundaries** | Only ONE active audio stream playing at any time across the entire application. | **PASS** | Inter-store coordinator automatically pauses Live Dubbing if Music Player starts, and vice versa. |
| **VII. Secrets Protection** | No secrets in plaintext files or localStorage. | **PASS** | Gemini API key stored exclusively in OS keychain / Android Keystore (`src-tauri/src/secrets.rs`). |
| **VIII. Code Hygiene** | No hardcoded text (en/fa i18n); SOLID; max 300 lines per file ceiling. | **PASS** | All modules cleanly separated into sub-components <= 300 lines; 100% localized with Persian RTL support. |

---

## Project Structure

### Documentation (this feature)

```text
specs/023-live-audio-dubbing/
├── spec.md                  # Feature specification with resolved user clarifications
├── checklists/
│   └── requirements.md      # Completed quality checklist
├── research.md              # Phase 0 architecture research and decisions
├── data-model.md            # Phase 1 data models and state machines
├── contracts/
│   └── live-dubbing-contract.md  # Phase 1 IPC, JNI, and TypeScript contracts
├── quickstart.md            # Phase 1 runnable end-to-end verification scenarios
└── plan.md                  # This implementation plan
```

### Source Code Layout

```text
src-tauri/src/
├── live_dubbing/
│   ├── mod.rs               # Tauri IPC command handlers (start, stop, pause, ducking)
│   ├── client.rs            # Tokio-Tungstenite WebSocket client for Gemini Live Bidi
│   ├── audio_capture.rs     # Cross-platform audio loopback trait & resampler
│   ├── platform_windows.rs  # Windows WASAPI loopback audio capturer
│   ├── platform_linux.rs    # Linux PulseAudio/Pipewire monitor capturer
│   ├── ducking.rs           # Dynamic audio session ducking manager
│   └── types.rs             # Specta types and telemetry models
├── android_fs.rs            # JNI bindings connecting Kotlin audio stream with Rust
└── lib.rs                   # Register live_dubbing commands in Specta builder

src-tauri/android/
└── app/src/main/kotlin/com/audiflow/app/
    ├── dubbing/
    │   ├── DubbingService.kt      # Android Foreground service for MediaProjection
    │   ├── AudioCaptureManager.kt # AudioPlaybackCapture & 16kHz PCM buffer pipeline
    │   └── FloatingOverlayView.kt # WindowManager draggable overlay with haptics
    └── MainActivity.kt            # MediaProjection permission dispatch

src/
├── stores/
│   ├── slices/
│   │   └── liveDubbingSlice.ts    # Zustand slice for session state, language, ducking, overlay
│   └── useAppStore.ts             # Combine live dubbing slice
├── components/live-dubbing/
│   ├── LiveDubbingPanel.tsx       # Main dubbing dashboard in Audiflow UI
│   ├── LanguagePickerModal.tsx    # 78-language searchable selector with flags
│   ├── DuckingSlider.tsx          # Configurable 30%-90% ducking attenuation slider
│   ├── VoicePersonaSelect.tsx     # Voice style selector (Puck, Aoede, Fenrir, etc.)
│   └── FloatingOverlayToggle.tsx  # Toggle switch for on-screen floating pill
├── utils/
│   └── tauri.ts                   # Type-safe IPC facade helpers
└── i18n/
    ├── en.ts                      # English i18n dictionary for live dubbing
    └── fa.ts                      # Persian i18n dictionary for live dubbing (RTL)
```

**Structure Decision**:
- Centralize all WebSocket streaming and protocol logic in Rust (`src-tauri/src/live_dubbing/`) so that desktop and mobile share 100% of the AI communication layer.
- Keep platform-specific capture isolated: Android uses Kotlin foreground service with JNI; Windows uses native WASAPI.
- Frontend components strictly adhere to the 300-line ceiling by separating the language picker modal, ducking slider, and voice selectors into focused standalone modules.

---

## Complexity Tracking

*No constitution violations. All architecture gates passed without exceptions.*
