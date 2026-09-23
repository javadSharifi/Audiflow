# Implementation Plan: Arch Linux Package

**Branch**: `017-arch-linux-package` | **Date**: 2026-09-23 | **Spec**: [specs/017-arch-linux-package/spec.md](spec.md)

**Input**: Feature specification from `specs/017-arch-linux-package/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command; its definition describes the execution workflow.

## Summary

Produce an installable Arch Linux `.pkg.tar.zst` package for Audiflow (x86_64) that installs the app binary, icon, `.desktop` entry, and the statically bundled ffmpeg/ffprobe helpers into standard `/usr` locations. The technical approach: a PKGBUILD recipe that drives the repo's existing build flow (`pnpm fetch:ffmpeg` → `pnpm tauri build` at `src-tauri/tauri.conf.json` producing the packaged binary next to its sidecars), then packages the resulting files via `makepkg` into a pacman-installable archive. Prerequisite checking runs before any long build; execution paths are (a) directly on an Arch host, and (b) for automation, a makepkg-capable Arch container. Documentation covers prerequisites, the exact command, and output paths.

## Technical Context

**Language/Version**: Rust stable (edition 2021, MSRV 1.77) via `dtolnay/rust-toolchain@stable` in CI; Node 22 + pnpm 9 for the frontend build; Bash for packaging scripts; `makepkg`/`pacman` toolchain for the Arch package itself.

**Primary Dependencies**: Tauri v2 app shell (v2.x) with statically bundled FFmpeg/FFprobe 8.1.2 (LGPL, built from source via `scripts/build-ffmpeg-minimal.sh` with static lame 3.100 + opus 1.6.1); Tauri Linux system deps on Arch: `webkit2gtk-4.1`, `gtk3`, gstreamer plugin sets (runtime `depends` in PKGBUILD mirrors the deb `depends` list translated to Arch package names).

**Storage**: N/A (packaging only; no new persisted app values introduced by this feature).

**Testing**: `bash -n` syntax checks + shellcheck-compliant style for packaging scripts; structural package verification (`pacman -Ql` on install path, or `bsdtar -tf` offline package contents check); `makepkg --printsrcinfo` structural checks. The packaging flow itself runs in Bash; unit tests cannot exist for pacman. Frontend/Rust suites (`pnpm test`, `cargo test`) MUST still pass unchanged because this feature touches no app code — CI gate compliance is by non-interference.

**Target Platform**: Arch Linux x86_64 (target triple `x86_64-unknown-linux-gnu`) for makepkg `arch=('x86_64')`; out of scope v1: aarch64/Arm, AUR publication, Windows/macOS/Android (already served by existing outputs).

**Project Type**: desktop-app + packaging/distribution tooling (scripts + PKGBUILD; no new app UI or IPC).

**Performance Goals**: Clean-Arch-machine clone-to-installed in under 30 minutes (SC-001); ffmpeg static build is by far the longest step (~10–20 min on 4-core) and is cache-aware (`src-tauri/binaries/build-minimal/` caches are reused on repeated invocations).

**Constraints**: MUST NOT modify unrelated existing outputs (.deb/.AppImage/Android paths unchanged); MUST fail fast naming missing prereqs before any long build; error surfaces in plain language; no `sudo` invocations inside packaging scripts (install-only via `pacman -U` remains the user's action).

**Scale/Scope**: Single-host, single-package deliverable. Artifacts: `packaging/arch/PKGBUILD`, `scripts/package-arch.sh`, docs section. Zero source-code changes to app logic expected.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --- | --- | --- |
| I. Local-first, zero-dependency privacy | PASS | Packaging is fully offline-capable after the one-time upstream source downloads (ffmpeg/lame/opus tarballs + crates) that the existing fetch flow already performs; no telemetry/accounts introduced. |
| II. Single-pass DSP integrity (NON-NEGOTIABLE) | PASS | No app DSP/filtergraph code is touched; packaged binaries are built from this repo unchanged. |
| III. Type-safe Rust ↔ TypeScript IPC (NON-NEGOTIABLE if signatures change) | PASS | No Rust command/struct/enum signature changes expected; if one is forced, `pnpm generate:types` + `pnpm check:types` gate applies and the change would be flagged. |
| IV. Atomic, non-destructive file ops (NON-NEGOTIABLE if outputs change) | PASS | Packaging writes into its own output dir; on Ctrl+C or failure, no partial `.pkg.tar.zst` is left (makepkg semantics: succeeded output only). No user-file overwrite risk (package installs only under `/usr`; uninstall removes only `/usr` files, user data untouched per spec edge case). |
| V. Test-first & CI gate compliance | PASS | No frontend/Rust behavior change → existing suites still run and pass unchanged; packaging scripts get `bash -n` + structural package-content checks per research Decision R4. |
| VI. Platform boundary & permission discipline | PASS | Linux-only packaging; no Android code/permissions touched; no RECORD_AUDIO usage anywhere. |
| VII. Secrets never in plaintext | PASS | No secrets involved; nothing in PKGBUILD touches credentials. |
| VIII. i18n discipline, SOLID, 300-line ceiling | PASS | No app UI strings added (packaging CLI messages are developer-facing, not user-facing UI; spec FR-009 requires plain-language errors, which script comments/todos honor — see research R5 for the boundary). Scripts stay under 300 lines by splitting prereq-check/build/package phases across functions; PKGBUILD is a recipe file (not a source file per AGENTS.md graph scope). |

**Post-Phase-1 re-check**: PASS — no design artifact (research.md, data-model.md, contracts/*, quickstart.md) introduces an app-code change that would violate any principle. Complexity Tracking table is unused (no justified violations).

## Project Structure

### Documentation (this feature)

```text
specs/017-arch-linux-package/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── packaging-contract.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packaging/
└── arch/
    └── PKGBUILD

scripts/
└── package-arch.sh

packaging/
└── docs (locations to be finalized in tasks.md; README section or packaging/README.md)
```

**Structure Decision**: Two tooling additions at the tooling/docs layer — (1) `packaging/arch/PKGBUILD` as the makepkg recipe, and (2) `scripts/package-arch.sh` as the orchestrator (prereq check → build → package) following the existing single-purpose scripts convention seen in `scripts/` (parallel to install-mac.sh). No `src/` or `src-tauri/src/` changes. Doc locations finalize during the implementation phase (minimal change: a dedicated `packaging/README.md`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Unused — no justified violations to track.
