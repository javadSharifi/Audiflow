# Data Model: Arch Linux Package

**Feature**: specs/017-arch-linux-package | **Date**: 2026-09-23

No app entities are created or modified — the feature's data lives at the tooling/packaging layer. Entities below are packaging artifacts, not runtime app state.

## Entity: Arch Package (deliverable)

| Field | Value / Rule | Source |
| --- | --- | --- |
| name | `audiflow` | tauri.conf.json productName-derived, lowercase (R8) |
| version | app version from `tauri.conf.json`.version (currently 1.5.7); validation: MUST match the ELF binary's build version | tauri.conf.json:4 |
| pkgrel | `1` (reset only on app version change; bumped for packaging-only fixes) | Arch convention |
| arch | `x86_64` | spec scope (v1) |
| format | `.pkg.tar.zst` | pacman/makepkg standard |
| file list | see Package Contents contract | contracts/packaging-contract.md |
| depends | webkit2gtk-4.1, gtk3, gst-plugins-base/good/bad/ugly, gst-libav | tauri.conf.json:51-59 mapped per R6 |
| makedepends | rust, nodejs, pnpm (minimal — orchestrator consumes prebuilt output) | R1 |
| license | placeholder — NEEDS CLARIFICATION (repo owner choice; no LICENSE file exists) | R8 |

**State transitions**: absent → built (makepkg success) → installed (`pacman -U`) → upgraded (same name, higher version/pkgrel) → removed (`pacman -R`; only `/usr` files removed, user data untouched).

## Entity: PKGBUILD Recipe

| Field | Rule | Validation |
| --- | --- | --- |
| pkgname/pkgversion/pkgrel/arch/license/description | metadata identity; single source: tauri.conf.json (parsed by orchestrator, injected into recipe) | `makepkg --printsrcinfo` must parse and emit all fields (R4) |
| depends | runtime family only; MUST NOT include ffmpeg/ffprobe (bundled) | differs from SRCINFO rendering |
| build() | no-op pass-through (output consumed from orchestrator run) | R1 |
| package() | stamps files into `$pkgdir` per the Package Contents contract | `bsdtar -tf` post-build (R4) |

## Entity: Packaging Output

| Field | Rule |
| --- | --- |
| location | `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/arch/` (or`packaging/arch/` staging — finalized in tasks) |
| artifact | `audiflow-<version>-<pkgrel>-x86_64.pkg.tar.zst` |
| environment | MUST run on an Arch host or inside an Arch container; orchestrator MUST fail fast naming the environment requirement (R7) |
| last-build log | plain-language success/failure summary per phase (prereq → build → package) |

**Relationships**: Arch Package is produced *from* PKGBUILD Recipe *via* makepkg; PKGBUILD Recipe *consumes* the Tauri build output (produced by the existing canonical flow); Packaging Output *holds* the Arch Package.
