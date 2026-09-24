# Interface & Refactoring Contracts: Maximize Code Health

## 1. Rust Command IPC Contract Invariance
All command handlers refactored or decomposed MUST preserve the Specta-generated IPC signatures in `src/types/generated.ts`.

- **Guarantee**: No frontend IPC payload breakage.
- **Verification Gate**:
  ```bash
  pnpm generate:types && pnpm check:types
  ```

## 2. Audio Engine Event & Subscriber Contract
To sever cycles between `audioEngine.ts` and store slices:

```typescript
// Interface for decoupled event dispatching from audio engine
export interface IAudioEngineListener {
  onTimeUpdate(seconds: number): void;
  onTrackEnd(): void;
  onError(err: Error): void;
  onPlaybackStateChange(isPlaying: boolean): void;
}

// Injected into AudioEngine during initialization; AudioEngine does NOT directly import useMusicPlayerStore
export interface IAudioEngineController {
  registerListener(listener: IAudioEngineListener): () => void;
  play(trackPath: string): Promise<void>;
  pause(): void;
  seek(positionSeconds: number): void;
}
```

## 3. Android Kotlin Callback Contract
To sever cycles between `AudioSessionReceiver`, `PlaybackService`, and `MainActivity`:

```kotlin
// Interface contract isolating PlaybackService events from MainActivity UI shell
interface PlaybackSessionCallback {
    fun onSessionActive(sessionId: Int)
    fun onSessionReleased(sessionId: Int)
}

// Interface isolating receiver notifications from concrete activity references
interface AudioFocusChangeObserver {
    fun onAudioFocusChanged(focusChange: Int)
}
```

## 4. Single-Pass DSP Invariance Contract
All DSP pipeline helper extractions must produce the exact same `-filter_complex` string and guarantee a terminal `alimiter` capped at -0.5 dBFS (`limit=0.95`).
