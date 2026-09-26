# Quickstart & Verification Guide: Real-Time AI Live Audio Dubbing

**Feature**: `023-live-audio-dubbing`  
**Date**: 2026-09-26  
**Status**: Completed  

---

## Prerequisites

1. **Google Gemini API Key**: Free key obtained from [Google AI Studio](https://aistudio.google.com/) with Gemini Live access.
2. **Platform Requirements**:
   - **Desktop**: Windows 10/11 (WASAPI loopback capture), macOS, or Linux.
   - **Android**: Android 10+ (API 29+) device or emulator with MediaProjection permissions enabled.
3. **Network**: Active internet connection with >= 100 kbps bandwidth.

---

## Verification Scenarios

### Scenario 1: Key Setup & Preflight Ping
1. Launch Audiflow and navigate to the **Live Dubbing** section in the sidebar.
2. Paste the Gemini API key into the API key input field.
3. Click **"Test Connection"**.
4. **Expected Result**:
   - Status badge turns green with a checkmark: `"Connected (Gemini Live Ready)"`.
   - The key is saved to OS Keychain / Android Keystore.
   - Inspecting `settings.json` and `localStorage` confirms zero plaintext key leakage.

---

### Scenario 2: Live Dubbing of Video with Sub-1.5s Latency
1. Open a browser or video player and start playing a video in English (or another foreign language).
2. In Audiflow, select target language: **Persian (فارسی)**.
3. Select voice persona: **Aoede**.
4. Click **"Start Live Dubbing"** (یا «شروع دوبله زنده»).
5. **Expected Result**:
   - System loopback capture activates instantly.
   - Within ~1.2 to 1.5 seconds, clear synthesized Persian speech begins playing through speakers/headphones.
   - Real-time latency indicator shows `< 1500ms`.
   - Neon wave visualizer pulses in sync with translated speech.

---

### Scenario 3: Dynamic Audio Ducking Verification
1. Play a loud background soundtrack in another app.
2. Start Live Dubbing with ducking enabled and slider set to **70%**.
3. When the AI interpreter speaks:
   - Background audio volume drops smoothly within 100ms.
   - Speech is crisp and intelligible.
4. When the speaker stops for >400ms:
   - Background volume smoothly returns to 100% within 400ms.
5. Move the ducking slider to **90%** and **40%**:
   - Verify that background attenuation adjusts dynamically in real time.

---

### Scenario 4: Floating Overlay Controller (Android & Desktop)
1. In settings, ensure **"Floating Overlay"** is toggled ON.
2. Start Live Dubbing and switch to another app (e.g. YouTube).
3. **Expected Result**:
   - A sleek neon-ring floating pill appears snapped to the screen border.
   - Double-tap the pill: Dubbing pauses immediately; background audio unducks; subtle haptic vibration occurs.
   - Double-tap again: Dubbing resumes immediately with haptic confirmation.
   - Drag the pill: It smoothly moves and snaps to the nearest edge upon release.

---

### Scenario 5: Single Stream Conflict Prevention (Constitution Principle VI)
1. Start an active Live Dubbing session.
2. Navigate to Audiflow's **Music Player** and click Play on a local track.
3. **Expected Result**:
   - The Live Dubbing session automatically transitions to **"Paused"**.
   - Background ducking is released.
   - Local music plays cleanly without audio overlap.
   - Resuming Live Dubbing automatically pauses the Music Player.
