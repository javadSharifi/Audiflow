# Implementation Plan: Android Media Rescan & Indexing Sync

**Branch**: `021-android-media-rescan` | **Date**: 2026-09-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/021-android-media-rescan/spec.md`

## Summary

Resolve the issue where newly transferred audio files (e.g. 100 songs copied from a USB flash drive or computer) are not detected by Audiflow until another music app triggers a system media scan. Implement an active media scanning synchronization pipeline in the Android native layer (`MediaScanSynchronizer.kt`) using Android's native `MediaScannerConnection.scanFile` over user-accessible audio storage (`Music`, `Download`, and mounted external OTG volumes) with a resilient `CountDownLatch` timeout. Broaden the MediaStore query selection in `MediaStoreManager.kt` to prevent OEM ROMs from dropping untagged audio files where `IS_MUSIC == 0`.

## Technical Context

**Language/Version**: Kotlin (Android 8.0+ / API 26+), Rust (2021 edition), TypeScript 5.9 (strict) on React 19

**Primary Dependencies**: Android Jetpack / MediaStore, `android.media.MediaScannerConnection`, Tauri v2 JNI bridge (`android_fs.rs`), Zustand ^5

**Storage**: Android `MediaStore.Audio.Media` system provider and local disk cache (`persistence.ts`)

**Testing**: Android build & Kotlin compilation via `./scripts/build-android-local.sh`, Rust tests via `cargo test`, Vitest unit tests via `pnpm test`

**Target Platform**: Android (mobile) with parity for desktop platforms; desktop scanning remains unchanged

**Project Type**: Mobile hybrid application (Tauri v2 + Kotlin native Android layer + React 19 frontend)

**Performance Goals**: Rescan of 100 newly added tracks completes and updates the UI within 3 seconds; zero playback glitches

**Constraints**: Strict compliance with Android Scoped Storage and Constitution Principle VI; Single Responsibility Principle and 300-line ceiling per file (Principle VIII); zero new untyped IPC calls (Principle III)

**Scale/Scope**: 1 new Kotlin class (`MediaScanSynchronizer.kt`), focused modifications to `MediaStoreManager.kt` (~30 lines), no breaking changes to IPC or frontend interfaces.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Local-First Privacy | ✅ PASS | All scanning and indexing is 100% offline and device-local with zero network usage. |
| II. Single-Pass DSP Integrity | ✅ N/A | No DSP or FFmpeg pipeline modifications. |
| III. Type-Safe Rust↔TypeScript IPC | ✅ PASS | `scan_audio_files` command signature and Specta contract remain 100% preserved. |
| IV. Atomic File Operations | ✅ N/A | Only read, scan, and indexing operations; no file writes or re-encodes. |
| V. Test-First & CI Gate | ✅ PASS | Unit tests and compiler checks verify Android layer and Rust IPC contract. |
| VI. Platform Boundary & Perms | ✅ PASS | Leverages standard Android `MediaScannerConnection` and `MediaStore` ContentResolver APIs, strictly honoring scoped storage. |
| VII. Secrets | ✅ N/A | No secrets or credentials involved. |
| VIII. i18n / SRP / 300-Line Ceiling | ✅ PASS | Scanning logic is extracted into a dedicated `MediaScanSynchronizer.kt` (~120 lines) to keep `MediaStoreManager.kt` (221 lines) well below the 300-line ceiling. |

**GATE RESULT: PASS** — all gates satisfied.

## Project Structure

### Documentation (this feature)

```text
specs/021-android-media-rescan/
├── spec.md                  # Feature specification
├── plan.md                  # Implementation plan (this file)
├── research.md              # Phase 0 research & technical decisions
├── data-model.md            # Phase 1 data model & state flow
├── quickstart.md            # Phase 1 quickstart validation guide
├── contracts/
│   └── android-media-scan-contract.md # JNI and IPC contracts
└── checklists/
    └── requirements.md      # Spec quality checklist (all pass)
```

### Source Code (repository root)

```text
src-tauri/
├── android/
│   ├── MediaScanSynchronizer.kt    # NEW: Discovers audio files & drives MediaScannerConnection batch sync
│   └── MediaStoreManager.kt        # MODIFIED: Integrates MediaScanSynchronizer + broadens query selection
└── src/
    └── music_library/
        └── platform/
            └── android.rs           # UNCHANGED: Calls queryMediaStoreMusic via JNI
```

**Structure Decision**: Clean native separation in `src-tauri/android/`. Extracting `MediaScanSynchronizer.kt` isolates filesystem traversal and Android `MediaScannerConnection` callbacks from `MediaStoreManager.kt`'s query/projection responsibilities, guaranteeing both stay under the 300-line ceiling.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *None* | All principles satisfied without exemptions. | N/A |
