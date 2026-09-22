# Quickstart & Verification Guide: Now Playing Gestures & Artwork

**Feature**: `014-nowplaying-gestures-artwork`  
**Date**: 2026-09-22  
**Status**: Ready for Implementation

This guide outlines the verification scenarios to prove that the artwork synchronization fix and Now Playing gestures behave correctly end-to-end.

---

## 1. Automated Verification Commands

### Frontend Unit & Component Tests
```bash
# Run unit tests covering TrackCover synchronization and gesture interactions
pnpm test src/components/music-player/__tests__/TrackCover.test.tsx
pnpm test src/components/music-player/__tests__/NowPlayingView.test.tsx
pnpm test src/components/music-player/__tests__/useNowPlayingGestures.test.tsx
```

### Full Frontend Test Suite
```bash
pnpm test
```

### Type Checking & Lint
```bash
pnpm check:types
pnpm lint
```

---

## 2. Manual End-to-End Scenarios

### Scenario 1: Artwork Synchronization on Track Switch (User Story 1)
1. **Setup**: Launch the app with multiple tracks in the music library (at least one song with album art, and one without).
2. **Action**: Start playing Song A (with album art). Open fullscreen Now Playing.
3. **Action**: Click "Next Song" or select Song B (without album art).
4. **Verification**:
   - The artwork view immediately switches away from Song A's image.
   - Song B's custom gradient placeholder appears with zero flicker of Song A's cover.
   - Advancing to Song C (with different album art) immediately displays Song C's artwork without displaying Song A or Song B.

### Scenario 2: Drag-to-Dismiss Gesture (User Story 2)
1. **Setup**: Open the Now Playing fullscreen player.
2. **Action**: Place pointer or finger near the top bar / cover area and slowly drag downward ~50px, then release.
3. **Verification**: The player tracks the pointer downward, then smoothly snaps back to the top (`translateY: 0`) when released.
4. **Action**: Drag downward > 120px (or give a quick downward flick) and release.
5. **Verification**: The sheet animates smoothly to the bottom of the screen (`translateY: 100%`) and closes, revealing the playlist and mini-player underneath.

### Scenario 3: Horizontal Swipe for Track Switching (User Story 3)
1. **Setup**: Open Now Playing with an active playlist of 3 or more songs.
2. **Action**: Place pointer or finger on the album artwork card and swipe left > 60px.
3. **Verification**:
   - The active artwork card slides out smoothly following the gesture.
   - The next song starts playing, and its artwork card slides in smoothly from the right.
4. **Action**: Swipe right > 60px.
5. **Verification**:
   - The card slides out to the right.
   - The previous song starts playing, and its artwork card slides in from the left.

### Scenario 4: Non-Interference with Seekbar and Sliders
1. **Action**: On the Now Playing screen, touch and drag horizontally on the WaveformSeekbar to scrub audio time.
2. **Verification**: Only audio seeking occurs; the album card does not swipe and the screen does not drag down.
