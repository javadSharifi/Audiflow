# Implementation Plan: Track Booster UI/UX Redesign & Safe Speaker Protection

**Branch**: `009-nowplaying-booster-ux` | **Date**: 2026-09-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-nowplaying-booster-ux/spec.md`

## Summary

This feature resolves a critical user-experience defect and modernizes the in-player track sound booster:
1. **Decouple Speaker Protection from Device Hardware Volume**: Eliminates the invocation of `androidApplyReduceHurt` / `AudioStreamManager.applyReduceHurt` on speaker protection clicks, ensuring that protecting speakers strictly resets the software booster gain (`volumeGainPercent`) to safe 100% (neutral 0 dB / 0 mB) without altering the user's phone hardware media volume (`STREAM_MUSIC`).
2. **Modular Track Booster Bottom Sheet (`TrackBoosterSheet.tsx`)**: Extracts the inline popup from `NowPlayingView.tsx` (which is bloated at 798 lines) into a focused presentation component (≤ 250 lines) with modern mobile UI polish (Apple/Emil Kowalski guidelines), dynamic color tiers (emerald -> amber -> orange -> rose), tactile preset chips (100%, 150%, 200%, 300%, 400%), real-time auditioning without sheet auto-closing, and high-boost safety gating.

---

## Technical Context

**Language/Version**: TypeScript 5.9 (Strict), React 19, Kotlin (Android Media3)
**Primary Dependencies**: Tailwind CSS v4, Lucide React, Zustand v5 (`useMusicPlayerStore`, `useAppStore`)
**Storage**: In-memory store + `localStorage` persistence (`player-volume-gain`)
**Testing**: Vitest (`@testing-library/react`, JSDOM)
**Target Platform**: Android (primary mobile), macOS, Linux, Windows
**Project Type**: Desktop/Mobile hybrid (Tauri v2 + React 19)
**Performance Goals**: < 16ms animation frame rate (60 fps), zero layout thrashing, instant real-time gain auditioning
**Constraints**:
- Must not alter `AudioManager.STREAM_MUSIC` on speaker protection
- Component file size ceiling: ≤ 300 lines (Constitution Principle VIII)
- Zero hardcoded strings: all UI text via `translate(lang, key)`

---

## Constitution Check

*GATE: Passed before Phase 0 research. Re-checked after Phase 1 design.*

- **Principle I: Local-First, Zero-Dependency Privacy**: PASS (No telemetry, fully local).
- **Principle II: Single-Pass DSP Integrity**: PASS (Maintains terminal `alimiter` ceiling at -0.5 dBFS).
- **Principle III: Type-Safe IPC Contract**: PASS (No IPC signature changes required; existing `setVolumeGainPercent` store action handles DSP).
- **Principle IV: Atomic, Non-Destructive File Operations**: PASS (N/A for real-time playback).
- **Principle V: Test-First & CI Gate Compliance**: PASS (Dedicated unit tests in `TrackBoosterSheet.test.tsx` and updated `NowPlayingView.test.tsx`).
- **Principle VI: Platform Boundary & Permission Discipline**: PASS (Decouples software booster from Android hardware stream volume, respecting OS boundaries).
- **Principle VII: Secrets Never Touch Plaintext Storage**: PASS (N/A).
- **Principle VIII: Code Hygiene, i18n & File Size Limits**: PASS (All strings translated; component extracted into `TrackBoosterSheet.tsx` ≤ 250 lines, shrinking `NowPlayingView.tsx` from 798 toward compliance).

---

## Project Structure

### Documentation (this feature)

```text
specs/009-nowplaying-booster-ux/
├── spec.md                  # Feature requirements and user scenarios
├── plan.md                  # This implementation plan
├── research.md              # Architecture decisions and research
├── data-model.md            # Entity definitions and props
├── quickstart.md            # Verification and test instructions
├── contracts/
│   └── track-booster.contract.md # UI & behavior contracts
└── checklists/
    └── requirements.md      # Spec quality checklist
```

### Source Code Changes

```text
src/
├── components/
│   └── music-player/
│       ├── TrackBoosterSheet.tsx             # [NEW] Extracted polished booster sheet (≤ 250 lines)
│       ├── NowPlayingView.tsx                # [MODIFY] Delegate booster sheet to TrackBoosterSheet
│       └── __tests__/
│           ├── TrackBoosterSheet.test.tsx    # [NEW] Unit tests for sheet, presets, safe protection
│           └── NowPlayingView.test.tsx       # [MODIFY] Verify integration with TrackBoosterSheet
├── i18n/
│   ├── en.ts                                 # [MODIFY] Add boosterProtectSpeaker, boosterNormalLevel, etc.
│   └── fa.ts                                 # [MODIFY] Add Persian translations
src-tauri/
└── android/
    └── AudioStreamManager.kt                 # [MODIFY] Neutralize applyReduceHurt so it never cuts stream volume
```

---

## Phase 0: Outline & Research

Completed in `specs/009-nowplaying-booster-ux/research.md`:
- Decoupling hardware stream volume from software booster safety flow
- Component modularization for constitution compliance
- Non-dismissive real-time auditioning
- Visual tier token mapping and tactile ergonomics

---

## Phase 1: Design & Contracts

Completed in:
- `specs/009-nowplaying-booster-ux/data-model.md`
- `specs/009-nowplaying-booster-ux/contracts/track-booster.contract.md`
- `specs/009-nowplaying-booster-ux/quickstart.md`
