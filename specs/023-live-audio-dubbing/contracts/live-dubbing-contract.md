# IPC & API Contracts: Real-Time AI Live Audio Dubbing

**Feature**: `023-live-audio-dubbing`  
**Date**: 2026-09-26  
**Status**: Completed  

---

## 1. Rust ↔ TypeScript IPC Commands

All commands are defined with `#[tauri::command]` and `#[specta::specta]` in `src-tauri/src/live_dubbing/mod.rs`, exported to `src/types/generated.ts`, and invoked strictly through `src/utils/tauri.ts`.

### `start_live_dubbing`
Starts loopback audio capture and establishes the Gemini Live bidirectional WebSocket session.

```rust
#[tauri::command]
#[specta::specta]
pub async fn start_live_dubbing(
    target_language: String,
    voice_persona: String,
    ducking_percent: u32,
    enable_overlay: bool,
) -> Result<String, String>;
```

**TypeScript Facade (`src/utils/tauri.ts`)**:
```typescript
export async function startLiveDubbing(
  targetLanguage: string,
  voicePersona: string,
  duckingPercent: number,
  enableOverlay: boolean
): Promise<string>;
```

---

### `stop_live_dubbing`
Terminates WebSocket session, releases loopback audio buffers, dismisses floating overlay, and restores system audio volume.

```rust
#[tauri::command]
#[specta::specta]
pub async fn stop_live_dubbing() -> Result<(), String>;
```

---

### `toggle_live_dubbing_pause`
Pauses or resumes audio capture and speech translation turns.

```rust
#[tauri::command]
#[specta::specta]
pub async fn toggle_live_dubbing_pause() -> Result<bool, String>;
```

---

### `set_ducking_level`
Updates background audio attenuation level in real time.

```rust
#[tauri::command]
#[specta::specta]
pub async fn set_ducking_level(level_percent: u32) -> Result<(), String>;
```

---

### `set_floating_overlay_enabled`
Toggles the floating pill overlay on Android and Desktop.

```rust
#[tauri::command]
#[specta::specta]
pub async fn set_floating_overlay_enabled(enabled: bool) -> Result<(), String>;
```

---

### `get_live_dubbing_status`
Retrieves current telemetry, session state, and streaming metrics.

```rust
#[tauri::command]
#[specta::specta]
pub async fn get_live_dubbing_status() -> Result<LiveDubbingStatus, String>;
```

```typescript
export interface LiveDubbingStatus {
  state: "idle" | "starting" | "capturing" | "translating" | "speaking" | "paused" | "error";
  targetLanguage: string;
  voicePersona: string;
  duckingPercent: number;
  isOverlayActive: boolean;
  latencyMs: number;
  bytesStreamed: number;
  errorMessage: string | null;
}
```

---

### `save_gemini_api_key` & `verify_gemini_api_key`
Saves key securely into OS keychain (Principle VII) and validates live model connectivity.

```rust
#[tauri::command]
#[specta::specta]
pub async fn verify_gemini_api_key(key: String) -> Result<bool, String>;

#[tauri::command]
#[specta::specta]
pub async fn save_gemini_api_key(key: String) -> Result<(), String>;
```

---

## 2. Event Payloads (Tauri Event Stream)

### `live-dubbing://state-changed`
Emitted whenever the session state transitions.

```typescript
export interface StateChangedPayload {
  previousState: DubbingSessionState;
  newState: DubbingSessionState;
  timestamp: number;
}
```

### `live-dubbing://speech-activity`
Emitted to drive the neon halo visualizer on the floating overlay and UI.

```typescript
export interface SpeechActivityPayload {
  isSpeaking: boolean;
  audioRmsDb: number;
}
```

---

## 3. Native Android JNI Contract (`src-tauri/src/android_fs.rs`)

Connects Kotlin foreground service (`MediaProjection`) with Rust streaming engine:

```c
// Kotlin -> Rust: Push captured 16kHz PCM audio chunk
JNIEXPORT void JNICALL
Java_com_alad_bridge_AudioBridge_nativePushAudioChunk(
    JNIEnv *env, jobject thiz, jbyteArray pcm_data, jint length
);

// Rust -> Kotlin: Signal audio ducking on/off
JNIEXPORT void JNICALL
Java_com_alad_bridge_AudioBridge_nativeTriggerDucking(
    JNIEnv *env, jobject thiz, jboolean should_duck, jfloat attenuation_factor
);
```
