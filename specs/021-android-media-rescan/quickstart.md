# Quickstart Validation Guide: Android Media Rescan & Indexing Sync

This guide describes end-to-end verification of newly transferred music detection on Android.

## Prerequisites
1. Android test device or emulator running Android 10+ (API 29+).
2. App built and installed: `./scripts/dev-android.sh` or `./scripts/build-android-local.sh`.
3. Storage / Audio media permissions granted.

## Scenario 1: USB / OTG / Transfer 100 Audio Files
1. Connect device to a computer via USB (MTP) or attach a USB OTG flash drive containing audio files (`.mp3`, `.m4a`, `.flac`).
2. Copy 10–100 new songs into the device's internal `Music/` or `Download/` directory using a file manager.
3. Open Audiflow and navigate to the **Songs** tab in the Music Player.
4. Tap the **Reload** button (spinning arrow icon next to sort/search).
5. **Expected Outcome**:
   - The reload icon spins while the background sync executes.
   - Within 1–3 seconds, all newly copied songs appear in the track list with accurate title, duration, and metadata.
   - No device restart or external third-party music application is required.

## Scenario 2: Audio Playback Continuity During Rescan
1. Start playing any existing song in the Music Player.
2. While audio is playing, tap the **Reload** button.
3. **Expected Outcome**:
   - Audio playback continues smoothly without audio stutter, glitch, or pause.
   - When the rescan finishes, the song list updates seamlessly.

## Scenario 3: Missing Metadata & Untagged Tracks
1. Copy an audio file with no ID3 title/artist tags into `Download/`.
2. Tap the **Reload** button.
3. **Expected Outcome**:
   - The file is recognized by its audio MIME type and extension.
   - It appears in the track list with its file display name instead of being omitted.
