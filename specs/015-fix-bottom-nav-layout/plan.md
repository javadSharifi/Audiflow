# Implementation Plan: Bottom Navigation Layout & Mini Player Spacing Fixes

**Branch**: `015-fix-bottom-nav-layout` | **Date**: 2026-09-22 | **Spec**: [specs/015-fix-bottom-nav-layout/spec.md](spec.md)

**Input**: Feature specification from `specs/015-fix-bottom-nav-layout/spec.md`

## Summary

Resolve mobile layout disparities reported by users on diverse Android and mobile devices:
1. **Vertical Spacing Bug**: Unify and lock the vertical relationship between the floating `MiniPlayer` and bottom navigation dock (`MusicPlayerNav`) by applying synchronized `env(safe-area-inset-bottom, 0px)` offsets. Eliminates the 50–80px gap seen on Android 3-button navigation devices where the background track list was exposed between components.
2. **Horizontal Viewport Overflow Bug**: Redesign the 5-item bottom navigation dock with fluid, responsive flex rules (proportional compression of inactive tabs, dynamic padding, label clamping, and `max-w-[calc(100vw-1.5rem)]`). Guarantees zero viewport overflow or icon clipping across compact mobile screens down to 320px in both Persian (RTL) and English (LTR).
3. **Scroll Clearance**: Synchronize bottom list padding (`TrackListView`) to account for positive safe-area insets so bottom-most items remain unobstructed.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (Strict mode), React 19  
**Primary Dependencies**: React 19, Tailwind CSS v4, Lucide React, Zustand 5  
**Storage**: N/A (pure presentation & responsive layout)  
**Testing**: Vitest + @testing-library/react  
**Target Platform**: Desktop (macOS, Windows, Linux) & Android (via Tauri v2 WebView)  
**Project Type**: Desktop/Mobile Audio Player Application (React SPA over Tauri v2 Rust backend)  
**Performance Goals**: 60fps smooth tab transitions, 0px horizontal viewport overflow, constant 8px vertical gap between mini player and dock  
**Constraints**: Zero external runtime layout dependencies (Constitution Principle I); zero hardcoded strings (Constitution Principle VIII); all files strictly <= 300 LOC (Constitution Principle VIII).  
**Scale/Scope**: `MusicPlayerNav.tsx`, `MiniPlayer.tsx`, `TrackListView.tsx`, and associated layout unit tests.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Assessment | Passed |
| --------- | ----------- | ---------- | :----: |
| **I. Local-First, Zero-Dependency Privacy** | Zero telemetry, zero external network dependency, no unnecessary external libraries | Solved using standard CSS environment variables (`env(safe-area-inset-bottom)`), Flexbox, and Tailwind primitives; zero dependencies added. | **YES** |
| **II. Single-Pass DSP Integrity** | Non-negotiable audio DSP single pass | Pure presentation layout coordination; no DSP or audio graph modifications. | **YES** |
| **III. Type-Safe Rust ↔ TS IPC Contract** | All IPC funneled through typed facade in `src/utils/tauri.ts` | No IPC changes needed; presentation layer only. | **YES** |
| **IV. Atomic, Non-Destructive File Operations** | Safe atomic file operations | N/A (presentation layer). | **YES** |
| **V. Test-First & CI Gate Compliance** | Vitest unit/component coverage; CI passing | Comprehensive unit tests in `MusicPlayerNav.test.tsx` and layout regression assertions. | **YES** |
| **VI. Platform Boundary & Permission Discipline** | Android system bar alignment and touch ergonomics | Respects Android window insets, elevates touch targets above system navigation bars, and maintains >= 44px touch targets. | **YES** |
| **VII. Secrets Never Touch Plaintext Storage** | OS keychain / native keystore | N/A (no credentials). | **YES** |
| **VIII. Code Hygiene: i18n & 300-Line Limit** | No hardcoded text; files <= 300 lines; Single Responsibility | All strings use `translate(lang, ...)`; `MusicPlayerNav.tsx` remains ~100 lines; `MiniPlayer.tsx` remains ~250 lines; `TrackListView.tsx` trimmed to <= 300 lines. | **YES** |

---

## Project Structure

### Documentation (this feature)

```text
specs/015-fix-bottom-nav-layout/
├── plan.md              # This implementation plan
├── research.md          # Technical research and mathematical layout budget
├── data-model.md        # Layout geometry entities and state relations
├── quickstart.md        # Visual and automated verification guide
├── contracts/           # Component and layout geometry contracts
│   └── navigation-layout-contract.ts
└── checklists/
    └── requirements.md  # Specification quality checklist
```

### Source Code Changes (repository root)

```text
src/
├── components/
│   └── music-player/
│       ├── MusicPlayerNav.tsx              # [MODIFY] Fluid flex sizing, safe-area elevation, mobile compression
│       ├── MiniPlayer.tsx                  # [MODIFY] Synchronized bottom elevation (calc(5.25rem + safe-area))
│       ├── TrackListView.tsx               # [MODIFY] Synchronized bottom scroll padding for safe-area insets
│       └── __tests__/
│           └── MusicPlayerNav.test.tsx     # [MODIFY] Add tests for 360px viewport overflow and safe-area geometry
```

**Structure Decision**: Enhancing `MusicPlayerNav.tsx` and `MiniPlayer.tsx` in-place maintains clean component boundaries without introducing redundant wrapper layers.

---

## Complexity Tracking

> No constitution violations. All gates passed.
