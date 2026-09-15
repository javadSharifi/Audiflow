# Implementation Plan: Mobile Performance & Smoothness Optimization

**Branch**: `001-mobile-performance-optimization` | **Date**: 2026-09-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-mobile-performance-optimization/spec.md`

## Summary

Eliminate scrolling stutter and navigation latency in the Android mobile application while maintaining 100% cross-platform code parity. The solution adopts `@tanstack/react-virtual` for windowed virtual list/grid rendering (`TrackListView` + `AlbumsView`), implements a two-level CSS Keep-Alive view pattern to preserve state without unmounting — both inner player tabs (Songs/Liked/Albums/Booster in `MusicPlayerView.tsx:54`) AND top-level Converter ↔ Player in `App.tsx:360-379` (root cause of reported lag) — with `lazy={false}` for top-level panes. Artwork extraction is viewport-gated (only `virtualizer.getVirtualItems()` triggers `resolveArtworkSrc`) with LRU-100 memory cache and concurrency 4, search/sort debounced at 150 ms via `useDeferredValue`, and a hardware-adaptive "High Performance / Reduced Blur Mode" (default ON on mobile via `isAndroid()`) eliminates costly GPU backdrop-blur compositing.

## Technical Context

**Language/Version**: TypeScript 5.9.3, React 19.2.0, Rust 1.77+ (edition 2021)
**Primary Dependencies**: Tauri v2 (`@tauri-apps/api` ^2.9.0), `@tanstack/react-virtual` ^3.x, Zustand ^5.0.8, Tailwind CSS v4.1.14, Vite 7.1.10
**Storage**: `localStorage` (`ac:reduced-blur`), Scoped Storage / MediaStore (Android)
**Testing**: Vitest 3.2.4 + `@testing-library/react` 16.3.2 + jsdom 30.0.1, `cargo test`
**Target Platform**: Android (APK, WebView Chromium 90+), Desktop (macOS Apple Silicon/Intel, Windows, Linux)
**Project Type**: Cross-platform desktop & mobile Tauri v2 application (Audio Converter & Sound Booster)
**Performance Goals**: 60–120 FPS sustained scroll rate in libraries with 10,000 tracks; <50ms tab-switch latency; <120MB web process memory footprint; <16ms touch gesture response
**Constraints**: Offline-first (Constitution Principle I); Single-pass DSP integrity (Principle II); Type-safe IPC (Principle III); No hardcoded text (translate() in i18n, Principle VIII); File size ceiling ≤ 300 lines per file (Principle VIII); No RECORD_AUDIO permission (Principle VI)
**Scale/Scope**: Libraries with 1 to 10,000+ audio tracks; 5 main tabs (Songs, Albums, Booster, Liked, Converter); instant mobile responsiveness

## Constitution Check

_GATE: Evaluated and Passed._

| Gate | Status | Justification / Notes |
|------|--------|----------------------|
| **Principle I: Local-First Privacy** | PASS | Zero network endpoints, zero telemetry. |
| **Principle II: Single-Pass DSP Integrity** | PASS | Audio conversion and booster DSP pipelines are unmodified. |
| **Principle III: Type-Safe IPC** | PASS | No backend IPC contract changes; settings persisted cleanly. |
| **Principle IV: Atomic Operations** | PASS | File encoding operations are untouched. |
| **Principle V: Test-First CI Gates** | PASS | Frontend unit tests with Vitest covering virtualization and tab caching. |
| **Principle VI: Platform Boundaries** | PASS | No new Android permissions requested; RECORD_AUDIO never used. |
| **Principle VII: Secrets Storage** | PASS | No secrets or sensitive credentials touched. |
| **Principle VIII: i18n, SOLID, File Size** | PASS | All new user-facing strings added to `src/i18n` for `fa` and `en`; all files kept under 300 lines. |

## Project Structure

### Documentation (this feature)

```text
specs/001-mobile-performance-optimization/
├── plan.md                 # This implementation plan
├── research.md             # Phase 0 research & architectural decisions
├── data-model.md           # Phase 1 data entities and schemas
├── quickstart.md           # Phase 1 verification and test guide
├── contracts/              # Phase 1 component & interface contracts
│   ├── virtual-list.contract.md
│   ├── view-cache.contract.md
│   └── performance-settings.contract.md
├── checklists/
│   └── requirements.md     # Quality validation checklist
└── spec.md                 # Feature specification
```

### Source Code (affected components)

```text
src/
├── App.tsx                          # [MODIFY] Top-level KeepAlive for Converter ↔ Player (root lag fix, :370)
├── components/
│   └── music-player/
│       ├── TrackListView.tsx        # [MODIFY] Virtualized list + 150ms deferred search (FR-008)
│       ├── AlbumsView.tsx           # [MODIFY] Virtualized grid (was unvirtualized, :291) via @tanstack/react-virtual
│       ├── MusicPlayerView.tsx      # [MODIFY] Keep-Alive inner tabs pattern
│       ├── KeepAlivePane.tsx        # [VERIFY] Reusable pane with lazy=false support for top-level
│       ├── TrackRow.tsx             # [MODIFY] Memo + useDeferredValue subscriptions, height 64px
│       └── TrackCover.tsx           # [MODIFY] Viewport-only resolve, concurrency 4
├── stores/
│   └── slices/
│       └── settingsSlice.ts         # [MODIFY] Add reducedBlur with isAndroid() default
├── types/
│   └── index.ts                     # [MODIFY] Extend AppSettings with reducedBlur
├── utils/
│   └── artwork.ts                   # [MODIFY] LRU 100 + concurrency 4 + eviction
├── i18n/
│   ├── en.ts                        # [MODIFY] Add translations for performance mode
│   └── fa.ts                        # [MODIFY] Add translations for performance mode
└── index.css                        # [MODIFY] CSS utility for conditional backdrop-blur suppression
```

**Structure Decision**: Standard Tauri v2 frontend structure in `src/`. Changes are modularized across existing slices and components without violating the 300-line limit per file.

## Complexity Tracking

_No constitution violations; no complexity exemptions required._
