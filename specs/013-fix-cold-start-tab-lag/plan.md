# Implementation Plan: Eliminate Cold-Start Tab Lag (Albums & Liked)

**Branch**: `013-fix-cold-start-tab-lag` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-fix-cold-start-tab-lag/spec.md`

## Summary

Eliminate the perceptible delay, frozen animation frames, and single-frame blank stutter when navigating to the "Albums" or "Liked" tabs for the first time after application cold start. The technical approach introduces:
1. Cooperative idle pre-warming in `KeepAlivePane` and `MusicPlayerView` (`requestIdleCallback` / fallback timer) to quietly mount inactive tabs into the background DOM (`display: none`) off the critical user interaction path.
2. Synchronous render-pass mounting when an inactive tab is explicitly activated, removing the 1-frame asynchronous `useEffect` blank flash.
3. Synchronous responsive column initialization in `AlbumGridVirtualized` to eliminate immediate re-renders and visual layout shifts (CLS = 0).

## Technical Context

**Language/Version**: TypeScript 5.9 (Strict mode enabled) & React 19

**Primary Dependencies**: React 19, Zustand 5, Tailwind CSS v4, @tanstack/react-virtual, lucide-react

**Storage**: Local storage / IndexedDB (cached tracks and albums read-only; no schema changes)

**Testing**: Vitest + @testing-library/react (`pnpm test`)

**Target Platform**: Desktop (macOS, Linux, Windows) & Android (WebView)

**Project Type**: Desktop & Mobile hybrid audio manager

**Performance Goals**:
- First-time tab switch to Albums or Liked: <50ms latency (visually instantaneous).
- Subsequent tab switches: <10ms (preserved via persistent keep-alive container).
- Zero dropped animation frames during bottom dock tab transitions.
- Zero visual layout shift (CLS = 0) on first render of the album grid.
- Zero regression in cold-start time-to-interactive for the primary Songs tab.

**Constraints**:
- Offline-first with zero external telemetry or cloud dependencies (Constitution Principle I).
- All source files strictly under 300 lines (Constitution Principle VIII).
- Preserved RTL/LTR internationalization support and no hardcoded strings (Constitution Principle VIII).
- Single responsibility: container lifecycle separated from presentation views.

**Scale/Scope**: Music libraries with 1 to 10,000 tracks and hundreds of albums.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| **I. Privacy & Local-First** | 100% offline, zero network telemetry | **PASS** | Entirely local UI rendering and lifecycle management. |
| **II. Single-Pass DSP** | Single FFmpeg graph, alimiter guard | **N/A** | Feature does not touch audio encoding or DSP pipelines. |
| **III. Type-Safe IPC** | `tauri.ts` facade & Specta types sync | **PASS** | No backend IPC contract changes required. |
| **IV. Atomic File Ops** | Temp files, non-destructive output | **N/A** | No file writes performed. |
| **V. Test-First & CI Gates** | Unit test coverage & CI matrix compliance | **PASS** | Tests added to Vitest suites; `pnpm build` verified. |
| **VI. Platform Boundary** | Android storage/audio permission discipline | **PASS** | Operates strictly within Web platform boundaries. |
| **VII. Secrets in Keychain** | Credentials never in plaintext | **N/A** | No credentials involved. |
| **VIII. Code Hygiene** | No hardcoded text, SOLID, <300 line limit | **PASS** | Modified files maintain strict single responsibility and stay well below 300 lines. |

## Project Structure

### Documentation (this feature)

```text
specs/013-fix-cold-start-tab-lag/
├── plan.md              # This file
├── research.md          # Phase 0: Pre-warming strategies & state synchronization
├── data-model.md        # Phase 1: Tab lifecycle & grid states
├── contracts/           # Phase 1: KeepAlive & responsive grid contracts
│   └── tab-keepalive-contract.md
├── quickstart.md        # Phase 1: Automated & manual validation steps
└── checklists/
    └── requirements.md  # Quality checklist
```

### Source Code (repository root)

```text
src/
├── components/
│   └── music-player/
│       ├── KeepAlivePane.tsx                # Add prewarm support & synchronous first-mount
│       ├── MusicPlayerView.tsx              # Coordinate idle pre-warming across tabs
│       ├── AlbumGridVirtualized.tsx         # Synchronous initial responsive column calculation
│       └── __tests__/
│           ├── KeepAlivePane.test.tsx       # Verify synchronous mount & idle pre-warm
│           ├── AlbumGridVirtualized.test.tsx # Verify column calculation without re-renders
│           └── MusicPlayerView.test.tsx     # Verify tab keep-alive retention
```

**Structure Decision**:
Changes are focused cleanly within the `src/components/music-player/` directory, directly modifying the lifecycle container (`KeepAlivePane`), the orchestrator (`MusicPlayerView`), and the grid view (`AlbumGridVirtualized`). Zero new architectural layers or unnecessary abstractions are introduced.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *None* | No constitutional violations | Standard patterns used throughout |
