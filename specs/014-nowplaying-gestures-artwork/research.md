# Technical Research: Now Playing Gestures and Artwork Synchronization

**Feature**: `014-nowplaying-gestures-artwork`  
**Date**: 2026-09-22  
**Status**: Completed

## Executive Summary

This research resolves the root causes of the artwork synchronization bug and identifies best practices for fluid, interruptible touch and pointer gesture interactions (drag-to-dismiss and horizontal swipe-to-skip) within the Tauri React frontend, respecting Apple/Emil design engineering principles and Constitution constraints.

---

## 1. Artwork Synchronization Root Cause & Fix

### Context
Users report that when advancing or changing songs, the song audio changes immediately, but the cover artwork displayed in `NowPlayingView` and `TrackCover` does not update or lingers on the previous song's image.

### Findings & Analysis
Inspection of `src/components/music-player/TrackCover.tsx` and `NowPlayingView.tsx` reveals three compounding failure points:
1. **Persistent State on Identity Change**:
   In `TrackCover.tsx`, `coverKey` is computed as `track.id ?? track.coverUrl ?? null`. Many tracks in the library lack an `id` or share empty `coverUrl` fields, so `coverKey` evaluates to null or does not change when `track.uri` or `track.path` changes. Consequently, the effect `setImgFailed(false)` never fires on track switches.
2. **Stale In-Memory Closure in `extractedSrc`**:
   `extractedSrc` state is initialized with `getCachedArtworkSrc(track)`. When `artKey` changes, if `getCachedArtworkSrc(track)` returns `undefined` (async extraction needed), `setExtractedSrc` is **not** immediately reset to `null`. It retains the previous track's image blob/data URL until the asynchronous `resolveArtworkSrc(track)` promise resolves. If extraction fails or returns `null` (track has no embedded artwork), `setExtractedSrc` remains stale, showing the previous track's artwork.
3. **Missing React Reconciliation Key**:
   In `NowPlayingView.tsx`, `<TrackCover track={currentTrack} size="full" className="rounded-3xl" />` is rendered without a unique `key` prop. React reuses the same DOM and component state instance across song transitions.

### Decision
- Define a canonical `trackIdentity(track)` helper (`track.uri || track.path || track.id || ""`).
- In `TrackCover.tsx`, synchronously reset both `imgFailed` and `extractedSrc` whenever `trackIdentity(track)` changes. If a synchronous cached artwork exists, use it immediately; otherwise set `extractedSrc = null` immediately so the previous artwork never flashes or persists.
- Provide dynamic fallback gradients uniquely keyed to the incoming track metadata (`title + artist`) while loading.
- Add an explicit `key={trackIdentity(currentTrack)}` where `TrackCover` is mounted in hero views.

### Alternatives Considered
- *Full unmount/remount only in parent*: Would work in `NowPlayingView`, but would leave `TrackRow`, `MiniPlayer`, and `TrackListView` vulnerable to the same stale state bug. Fixing `TrackCover` internally ensures global correctness across the entire app.

---

## 2. Drag-to-Dismiss Gesture Interaction

### Context
When the fullscreen `NowPlayingView` is open, dragging down should dismiss the sheet back to the playlist/library view, tracking user touch/pointer position in real time with spring-back physics.

### Findings & Best Practices
- According to Apple Design Guidelines and Emil Kowalski's interaction physics:
  - Dragging down must directly map `1:1` to finger/pointer vertical displacement (`translateY`).
  - Pulling upward (negative `translateY`) should either be clamped to `0` or apply heavy rubber-band resistance (`sqrt` or `0.2` friction) so the user cannot drag the sheet off the top of the viewport.
  - Directional disambiguation: Touches begin with an initial deadband (~8-10px). If vertical movement exceeds horizontal movement, the gesture locks to vertical drag.
  - Interactive dismiss threshold:
    - Distance threshold: `translateY > 120px` (or >20% of screen height).
    - Velocity threshold: Downward flick velocity `vy > 0.5 px/ms` on release dismisses even if distance < 120px.
  - Animated release:
    - If dismissed: animate `translateY` smoothly to `100%` using `cubic-bezier(0.32, 0.72, 0, 1)` (~280-320ms) then call `setFullscreenOpen(false)`.
    - If cancelled: spring back to `translateY(0)` with a snappy, damped curve (~240ms).
- Integration with Android Back button:
  - `NowPlayingView` already listens for `ANDROID_BACK_EVENT`. The drag-to-dismiss behavior provides a natural touch equivalent.

### Decision
Implement a dedicated hook `useNowPlayingGestures` handling Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`). Apply inline `transform: translateY(...)` on the root container during active drags to avoid rerender overhead, toggling CSS transition classes only on pointer release.

### Alternatives Considered
- *External gesture libraries (e.g. Framer Motion, @use-gesture/react)*: Rejected per Constitution Principle I & Minimal Change Principle. The project uses standard React 19 + Tailwind CSS. A lightweight (~70 lines) native pointer hook provides 60fps hardware-accelerated transforms with zero added dependencies.

---

## 3. Horizontal Swipe-to-Skip with Animated Card Transitions

### Context
Swiping horizontally (left or right) across the album art card should navigate between previous and next songs in the playlist, accompanied by a slide transition.

### Findings & Best Practices
- Surface isolation: Horizontal swipe must be scoped to the album art card and hero area, avoiding conflicts with horizontal sliders (WaveformSeekbar, volume slider, speed slider).
- Gesture metrics:
  - Horizontal swipe threshold: `|translateX| > 60px` or horizontal flick velocity `vx > 0.4 px/ms`.
  - While dragging: Card translates horizontally tracking finger displacement (`translateX(offset)` with slight rotation `rotate(offset * 0.03deg)`).
  - On release past threshold:
    - Animate current card off-screen in the swipe direction (`translateX(±100%)` with opacity decay).
    - Trigger `playNextTrack()` or `playPreviousTrack()`.
    - New card enters smoothly from opposite side (`translateX(∓100%) -> translateX(0)`).
  - Boundary handling:
    - If swiping toward previous at track 0 (or next at end without repeat), apply rubber-band damping (`offset * 0.3`) and snap back to center without switching.
- RTL / Locale handling:
  - In LTR (English): Swiping left (dragging finger towards left) advances to Next song; swiping right moves to Previous song.
  - In RTL (Persian / `lang === "fa"`): Directionality mirrors the visual flow: swiping towards the reading end (left-to-right or right-to-left) maps intuitively. In Persian UI conventions, forward progression aligns with reading direction.

### Decision
Extract the artwork display in `NowPlayingView` into a dedicated `NowPlayingArtworkCarousel` component managed by `useNowPlayingGestures`. This decouples gesture coordinates from the large `NowPlayingView` container and preserves the 300-line ceiling rule.

### Alternatives Considered
- *Whole-screen horizontal swipe*: Rejected because horizontal swiping across the bottom half of the screen would accidentally trigger while seeking on `WaveformSeekbar` or adjusting speed/booster sliders. Confining track swipe to the album art hero card prevents gesture ambiguity.

---

## 4. Constitution & Architecture Verification

- **Principle I (Local-First, Zero Dependencies)**: Uses native browser Pointer Events; zero external gesture packages.
- **Principle VIII (Code Hygiene & 300-Line Limit)**: `NowPlayingView.tsx` currently has 693 lines. To prevent exceeding limits and resolve design smell, we extract:
  - `useNowPlayingGestures.ts` (~120 lines): Gesture detection, velocity tracking, and physics.
  - `NowPlayingArtworkCarousel.tsx` (~110 lines): Card container, swipe transforms, and slide animations.
  - Updating `TrackCover.tsx` (~130 lines): Immediate state reset and identity sync.
- **Principle VIII (i18n Discipline)**: All accessibility labels, tooltips, and messages use `translate(lang, ...)`.
