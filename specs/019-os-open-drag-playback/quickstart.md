# Quickstart & Verification Guide: OS Open With & Drag-and-Drop Playback

**Feature**: `specs/019-os-open-drag-playback`  
**Date**: 2026-09-23  

This guide provides end-to-end verification procedures for drag-and-drop playback and OS "Open with" context menu integration.

---

## Prerequisites & Setup

1. Build and run tests to ensure baseline integrity:
   ```bash
   pnpm test
   cargo test --manifest-path src-tauri/Cargo.toml
   ```

2. Start the development environment:
   ```bash
   pnpm tauri dev
   ```

---

## Scenario 1: Drag & Drop Audio Files to Play (User Story 1 / P1)

1. Launch Audiflow and navigate to the **Music Player** tab.
2. In macOS Finder, Windows File Explorer, or Linux File Manager, select 3 audio files (e.g. `song1.mp3`, `song2.flac`, `song3.wav`).
3. Drag the selected files over the Audiflow window.
   - **Expected**: A sleek drag overlay appears displaying the drop icon and localized message ("Drop audio files or folders to play").
4. Drop the files onto the window.
   - **Expected**:
     - Overlay smoothly disappears.
     - Playback queue is populated with all 3 songs.
     - `song1.mp3` starts playing immediately (time begins counting, play button turns to pause).
     - A toast message announces: "Playing 3 songs" (or Persian equivalent: "در حال پخش ۳ آهنگ").
5. Fast-forward or allow `song1.mp3` to finish.
   - **Expected**: `song2.flac` immediately starts playing automatically (auto-advance verified).

---

## Scenario 2: Drag & Drop an Entire Music Folder (User Story 1 / P1)

1. Ensure the **Music Player** tab is active.
2. In the OS file manager, drag a folder containing subfolders and audio tracks (e.g., an album folder) into Audiflow.
3. Release the drop.
   - **Expected**:
     - All supported audio tracks within the folder and subfolders are extracted in natural alphanumeric order.
     - Any non-audio files (e.g., `.jpg`, `.txt`, `.pdf`) inside the folder are ignored.
     - Track 1 starts playing immediately, and subsequent tracks auto-advance.

---

## Scenario 3: Audio Converter Drag & Drop Regression Check (User Story 3 / P3)

1. Switch to the **Audio Converter** tab.
2. Drag 2 audio or video files into the window.
3. Release the drop.
   - **Expected**:
     - Files are added to the Audio Converter wizard list.
     - The Music Player is NOT opened or triggered.
     - No unexpected music playback occurs.

---

## Scenario 4: OS Context Menu / "Open with" Integration (User Story 2 / P2)

### macOS:
1. In Finder, right-click any audio file -> `Open With` -> `Audiflow`.
2. **Expected**: Audiflow activates, switches to the Music Player tab, and immediately plays the song.

### Windows / Linux:
1. In file manager, right-click an audio file -> `Open with Audiflow` (or run `audiflow /path/to/song.mp3` from terminal).
2. **Expected**: Audiflow focuses, loads the song in the player queue, and starts playback.

---

## Automated Verification Tests

Run the dedicated test suites:
```bash
# Frontend unit and hook tests:
pnpm test src/hooks/__tests__/useAppDragDrop.test.ts
pnpm test src/utils/__tests__/openWith.test.ts

# Backend audio path resolution unit tests:
cargo test --manifest-path src-tauri/Cargo.toml test_resolve_paths
```
