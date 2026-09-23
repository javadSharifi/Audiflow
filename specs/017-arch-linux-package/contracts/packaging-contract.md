# Packaging Contract: Arch Linux Package

**Feature**: specs/017-arch-linux-package | **Date**: 2026-09-23

Public contract of the packaging tooling — what it accepts, what it guarantees, and what the produced artifact must contain. This is a developer-facing CLI contract (not app IPC; no IPC changes).

## CLI Contract: `scripts/package-arch.sh`

### Invocation

```bash
./scripts/package-arch.sh          # full flow: prereq check → build → package
./scripts/package-arch.sh --skip-build   # reuse existing tauri build output
```

### Guarantee: phases (each fail-fast, plain-language error per spec FR-002/FR-009)

1. **Prereq check** — MUST complete before any long build; names every missing prereq in one pass (not one per retry):
   - Arch environment detection (`/etc/os-release` ID=arch, or explicit `--force-non-arch` escape hatch that errors clearly)
   - Toolchain presence: `rustc`, `cargo`, `node`, `pnpm`, `makepkg`, `bsdtar`
   - Tauri Linux build deps (webkit2gtk-4.1, gtk3, gstreamer dev families) — via `pacman -T` presence probe
2. **Build** — canonical repo flow invoked unchanged: `pnpm install --frozen-lockfile` → `pnpm fetch:ffmpeg` → `pnpm tauri build --target x86_64-unknown-linux-gnu`
3. **Package** — `makepkg` in `packaging/arch/` consuming the build output; produces `.pkg.tar.zst`

### Output contract

- Artifact path: printed as the last line on success
- On Ctrl+C or failure: no partial `.pkg.tar.zst` left in output dir (spec FR-006 / Constitution IV)
- Exit codes: 0 success; non-zero names the failing phase in the error message

### Non-interference guarantee

- MUST NOT modify: `.deb` outputs, `.AppImage` outputs, Android outputs, app source, `tauri.conf.json`
- MUST NOT elevate privileges (no `sudo` inside the script; `pacman -U` is the user's explicit action)

## Artifact Contract: PKGBUILD file list (stamped into `$pkgdir`)

| Path in package | Content | Rule |
| --- | --- | --- |
| `/usr/bin/audiflow` | launcher wrapper (shell) | MUST exist; launches the real ELF (R3) |
| `/usr/lib/audiflow/audiflow` | ELF binary | next to sidecars (`locate_desktop` next-to-exe contract) |
| `/usr/lib/audiflow/ffmpeg` | sidecar helper | statically built LGPL ffmpeg (R2) |
| `/usr/lib/audiflow/ffprobe` | sidecar helper | statically built LGPL ffprobe |
| `/usr/share/applications/audiflow.desktop` | desktop entry | reused assets; Name/Icon/Exec referencing standard paths |
| `/usr/share/icons/hicolor/32x32/apps/audiflow.png` | icon set | reused `.deb`/`.AppImage` icon assets (spec Assumption) |
| `/usr/share/icons/hicolor/128x128/apps/audiflow.png` | icon set | same |
| `/usr/share/icons/hicolor/256x256@2x/apps/audiflow.png` | icon set | same (filename per icon source set) |

Zero files outside `/usr` subpaths (spec SC-004). Modes: ELF/sidecars 0755; `.desktop` 0644; icons 0644. Owners: root:root.

## SRCINFO structural check (R4)

`makepkg --printsrcinfo` MUST parse and emit: pkgname=`audiflow`, pkgver=<app version>, pkgrel=1, arch=x86_64, depends rendering of the runtime family, makedepends rendering. No missing pkgver/pkgname (makepkg hard-fail conditions).
