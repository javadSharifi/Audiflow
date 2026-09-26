# Quickstart: Online Multi-Source Music Streaming & Player

This guide documents runnable validation scenarios that verify the feature works end-to-end across search, playback, timed lyrics, download, and offline resilience.

---

## Prerequisites

1. Operating System: Windows, macOS, or Linux.
2. Active internet connection (or system VPN/proxy if testing in regions with blocked services like YouTube/SoundCloud).
3. Audiflow dev environment running:
   ```bash
   pnpm install
   pnpm tauri dev
   ```

---

## Scenario 1: Multi-Source Online Search Verification

### Objective
Verify that typing an artist or song name returns aggregated results from available online providers.

### Steps
1. Navigate to the **Music Player** tab.
2. In the search bar row, click the **Internet Search** button (globe icon next to search input).
3. Type a popular song query (e.g. `"Imagine Dragons Believer"`) and press Enter.

### Expected Outcome
- Search loading indicator appears for < 3 seconds.
- Results list populates with track titles, artist names, duration, album art thumbnails, and provider tags (`YouTube`, `SoundCloud`, `JioSaavn`).

---

## Scenario 2: Online Audio Streaming & Playback Verification

### Objective
Verify that clicking an online search result initiates audio streaming and player controls operate smoothly.

### Steps
1. Click the **Play** button on any search result.
2. Observe the bottom mini-player and playback timeline.
3. Drag the seek slider to skip forward 60 seconds.
4. Click **Pause**, then click **Play**.

### Expected Outcome
- Audio starts streaming within 2 seconds.
- Now-playing bar displays the online track's title, artist, and cover thumbnail.
- Seeking resumes audio from the selected timestamp without audio corruption.
- Pause and resume respond immediately.

---

## Scenario 3: Timed Lyrics Verification

### Objective
Verify that synchronized lyrics load and highlight in sync with playback.

### Steps
1. While an online track is playing, click the **Lyrics** button in the now-playing player bar.
2. Observe the lyrics sheet.
3. Click a specific lyric line 30 seconds ahead.

### Expected Outcome
- If lyrics are found on LRCLIB, the lyrics pane scrolls smoothly with the active line highlighted.
- Clicking a lyric line instantly seeks audio playback to that line's exact timestamp.
- If lyrics are not found, an informative fallback banner is shown without app errors.

---

## Scenario 4: One-Click Download & Converter Pipeline Verification

### Objective
Verify that clicking "Download / Save" downloads the audio file, tags it, saves it to disk, and makes it available to the Converter.

### Steps
1. In the search results or now-playing bar, click the **Download** icon.
2. Observe download progress in the notification/toast.
3. Switch back to the local **Track List**; verify the downloaded track appears.
4. Click the track context menu -> **Open in Converter**.

### Expected Outcome
- File is downloaded to the local Music folder (atomic `.part` -> final file rename).
- Metadata (title, artist, artwork) is cleanly tagged via the FFmpeg sidecar.
- The track opens directly in Audiflow's 4-step Converter Wizard ready for trimming, sound boosting, or format conversion.

---

## Scenario 5: Single Audio Stream & Offline Isolation Verification

### Objective
Verify that online streaming adheres to Constitution Principle VI (only one audio stream) and Principle I (offline-first integrity).

### Steps
1. Play an online stream.
2. Click any local audio file in the library or start a preview in the Converter.
3. Disconnect internet connection (toggle Wi-Fi off).
4. Attempt local file conversion and local audio playback.

### Expected Outcome
- The online stream immediately pauses when local playback begins.
- Offline file conversion, trimming, and local library playback function with zero degradation while offline.
