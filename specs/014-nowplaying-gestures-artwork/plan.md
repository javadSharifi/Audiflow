# Implementation Plan: Now Playing Gestures and Artwork Synchronization

**Branch**: `014-nowplaying-gestures-artwork` | **Date**: 2026-09-22 | **Spec**: [specs/014-nowplaying-gestures-artwork/spec.md](spec.md)

**Input**: Feature specification from `specs/014-nowplaying-gestures-artwork/spec.md`

## Summary

Fix the album cover desynchronization bug across track switches by hardening track identity synchronization in `TrackCover` and `NowPlayingView`. Implement fluid, physics-based touch and pointer gestures for the Now Playing view:
1. Drag-down gesture from the player surface to smoothly dismiss/minimize fullscreen player to the playlist/library view.
2. Horizontal swipe gesture on the album artwork card to switch between previous and next songs with slide transitions.
Refactor `NowPlayingView` by extracting `useNowPlayingGestures` and `NowPlayingArtworkCarousel` to enforce Constitution Principle VIII (file size ceiling <= 300 lines) and enable high-fidelity automated unit testing.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (Strict mode), React 19  
**Primary Dependencies**: React 19, Tailwind CSS v4, Lucide React, Zustand 5  
**Storage**: In-memory artwork cache + localStorage manifest (`player-artwork-manifest-v1`)  
**Testing**: Vitest + @testing-library/react  
**Target Platform**: Desktop (macOS, Windows, Linux) & Android (via Tauri v2)  
**Project Type**: Desktop/Mobile Audio Player Application (React SPA over Tauri v2 Rust backend)  
**Performance Goals**: 60fps smooth gesture animations, <16ms gesture response, 0% stale artwork persistence  
**Constraints**: Zero external runtime animation/gesture dependencies (Constitution Principle I); zero hardcoded strings (Constitution Principle VIII); files <= 300 lines (Constitution Principle VIII).  
**Scale/Scope**: Music player fullscreen overlay (`NowPlayingView`), `TrackCover`, and gesture hooks.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Assessment | Passed |
| --------- | ----------- | ---------- | :----: |
| **I. Local-First, Zero-Dependency Privacy** | Zero telemetry, zero external network dependency, no unnecessary external libraries | Uses native browser Pointer Events and existing React/Tailwind animation primitives; zero external packages added. | **YES** |
| **II. Single-Pass DSP Integrity** | Non-negotiable audio DSP single pass | Purely UI playback navigation; no audio filtergraph modifications. | **YES** |
| **III. Type-Safe Rust ↔ TS IPC Contract** | All IPC funneled through typed facade in `src/utils/tauri.ts` | Uses existing typed store actions (`playNextTrack`, `playPreviousTrack`, `setFullscreenOpen`); no IPC schema changes. | **YES** |
| **IV. Atomic, Non-Destructive File Operations** | Safe atomic file operations | N/A (read-only playback UI). | **YES** |
| **V. Test-First & CI Gate Compliance** | Vitest unit/component coverage; CI passing | Comprehensive unit tests for `TrackCover` artwork reset and `useNowPlayingGestures` calculations. | **YES** |
| **VI. Platform Boundary & Permission Discipline** | Android back button preserved, no unauthorized permissions | Preserves existing `ANDROID_BACK_EVENT` hierarchy and supports Android touch surfaces. | **YES** |
| **VII. Secrets Never Touch Plaintext Storage** | OS keychain / native keystore | N/A (no secrets). | **YES** |
| **VIII. Code Hygiene: i18n & 300-Line Limit** | No hardcoded text; files <= 300 lines; Single Responsibility | All strings use `translate(lang, ...)`; decomposes 693-line `NowPlayingView.tsx` into modular components each < 300 lines. | **YES** |

---

## Project Structure

### Documentation (this feature)

```text
specs/014-nowplaying-gestures-artwork/
├── plan.md              # This implementation plan
├── research.md          # Technical research and design decisions
├── data-model.md        # Entities, gesture state machine, and directionality rules
├── quickstart.md        # Runnable validation scenarios
├── contracts/           # Component and hook interface contracts
│   ├── gestures-contract.ts
│   └── artwork-contract.ts
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code Changes (repository root)

```text
src/
├── components/
│   └── music-player/
│       ├── TrackCover.tsx                      # [MODIFY] Hardened identity key & synchronous state reset
│       ├── useNowPlayingGestures.ts            # [NEW] Pointer gesture hook for drag-to-dismiss and swipe-to-skip
│       ├── NowPlayingArtworkCarousel.tsx       # [NEW] Swipeable artwork card with horizontal slide animations
│       ├── NowPlayingView.tsx                  # [MODIFY] Integrated gestures, extracted subcomponents, reduced lines
│       └── __tests__/
│           ├── TrackCover.test.tsx             # [MODIFY] Add tests verifying immediate cover reset on track change
│           ├── useNowPlayingGestures.test.tsx  # [NEW] Test physics, thresholds, velocity, and deadband disambiguation
│           └── NowPlayingView.test.tsx         # [MODIFY] Test dismiss on drag-down and skip on swipe
```

**Structure Decision**: Extracting `useNowPlayingGestures.ts` and `NowPlayingArtworkCarousel.tsx` solves the 300-line ceiling violation on `NowPlayingView.tsx` and provides dedicated, clean test boundaries for touch gestures.

---

## Complexity Tracking

> No constitution violations. All gates passed.
