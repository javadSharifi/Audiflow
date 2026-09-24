# Implementation Plan: Maximize Code Health & Repowise Score

**Branch**: `020-maximize-code-health` | **Date**: 2026-09-24 | **Spec**: [specs/020-maximize-code-health/spec.md](spec.md)

**Input**: Feature specification from `specs/020-maximize-code-health/spec.md`

## Summary

This plan provides a structured, phased approach to raise the codebase's Repowise Code Health from 6.9/10 to the maximum possible score (aiming for 9.0+ Excellent band). The plan targets the four main code-level detractors identified by Repowise: (1) eliminating 8 circular import cycles across TypeScript, Rust, and Android Kotlin, (2) adding characterization tests for 13 critical untested hotspots, (3) decomposing high-complexity brain methods (cyclomatic complexity > 10) into focused helper functions, and (4) safely pruning verified dead code and unused exports. All changes strictly adhere to the constitution's 300-line ceiling, single responsibility, and single-pass DSP integrity.

## Technical Context

**Language/Version**: TypeScript 5.9 / React 19, Rust 1.77+ (edition 2021), Kotlin (Android Jetpack Media3)

**Primary Dependencies**: Tauri v2, Zustand v5, Vite 7, Vitest, Testing Library, Tokio, FFmpeg 8.1.2

**Storage**: Local filesystem (atomic `.tmp` writes), OS keychain (keyring crate), local settings JSON

**Testing**: Vitest (`pnpm test`), Cargo test (`cargo test`), Live FFmpeg e2e (`tests/e2e.rs`), JUnit4/Mockito (`./gradlew testArmDebugUnitTest`)

**Target Platform**: Desktop (macOS, Linux x64/Arch, Windows) and Android

**Project Type**: Offline-first Desktop & Mobile Audio Application (Tauri 2)

**Performance Goals**: <50ms IPC command turnaround, 60fps UI rendering, zero audio clipping / speaker distortion, instant hot-path execution

**Constraints**: Max 300 lines ceiling per source file, single responsibility per unit, terminal `alimiter` capped at -0.5 dBFS, offline-first privacy

**Scale/Scope**: 330 tracked files, 52 open refactoring opportunities, 12 structural transformations, 13 untested hotspot targets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Requirement | Assessment | Result |
| :--- | :--- | :--- | :--- |
| **I. Local-First & Zero-Dependency Privacy** | All features work offline without remote network dependencies. | All refactorings are strictly local code architecture improvements. | **PASS** |
| **II. Single-Pass DSP Integrity** | Single `-filter_complex`, at most 1 lossy encode, terminal `alimiter` capped at -0.5 dBFS. | Helper extractions in `pipeline.rs` maintain the identical compiled filtergraph and terminal limiter. | **PASS** |
| **III. Type-Safe IPC Contract** | All command signatures sync with `src/types/generated.ts`. | Re-exports in `commands/mod.rs` maintain 100% signature stability; verified with `pnpm check:types`. | **PASS** |
| **IV. Atomic File Operations** | Temporary file staging, non-destructive renaming, cancellation cleanup. | Retained across all queue and worker refactorings. | **PASS** |
| **V. Test-First & CI Gate Compliance** | CI passes test, build, lint across all platforms. | Characterization tests expand test coverage; zero regression in existing 150+ tests. | **PASS** |
| **VI. Platform Boundary Discipline** | No `RECORD_AUDIO`, single active stream, Android MediaStore compliance. | Cycle breaking in Android preserves Media3 background playback and single active stream. | **PASS** |
| **VII. Secrets in OS Keychain** | No plaintext keys in localStorage or settings. | Unaffected; secrets remain in keychain only. | **PASS** |
| **VIII. Code Hygiene & 300-Line Limit** | No hardcoded text, Single Responsibility, all files <= 300 lines. | All decomposed modules and helpers strictly satisfy the <= 300 lines ceiling. | **PASS** |

*All gates passed without violation.*

## Project Structure

### Documentation (this feature)

```text
specs/020-maximize-code-health/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── refactoring-contracts.md
└── checklists/
    └── requirements.md
```

### Source Code Targets

```text
src/
├── stores/
│   ├── musicPlayer/
│   │   ├── audioEngine.ts         # Cycle breaking & listener decoupling
│   │   ├── selectors.ts
│   │   └── slices/
│   └── slices/
│       └── fileSlice.ts           # Cycle breaking
├── components/
│   ├── music-player/
│   │   └── MusicPlayerView.tsx    # Sub-component extraction & complexity reduction
│   └── waveform/
│       └── audioSource.ts         # Complex method extraction

src-tauri/
├── src/
│   ├── commands/                  # IPC handlers characterization tests
│   │   ├── mod.rs
│   │   ├── queue.rs
│   │   └── android.rs
│   ├── queue/                     # Queue state characterization tests
│   │   └── mod.rs
│   ├── processing/
│   │   └── pipeline.rs            # DSP filtergraph complexity decomposition
│   └── android_fs.rs              # JNI characterization tests
├── android/
│   ├── MainActivity.kt            # Callback contract decoupling
│   ├── PlaybackService.kt         # Break cycle with AudioSessionReceiver
│   └── AudioSessionReceiver.kt
└── tests/
    └── commands_characterization.rs # New characterization test harness
```

## Complexity Tracking

*No constitution violations or unjustified abstractions exist.*
