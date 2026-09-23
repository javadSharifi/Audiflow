# Quickstart: Arch Linux Package Validation

**Feature**: specs/017-arch-linux-package | **Date**: 2026-09-23

Runnable validation proving the spec's user journeys end-to-end. Two paths per the maintainer environment (R7): real Arch host, or Arch Docker container on any host.

## Prerequisites

- **Path A (Arch host)**: Arch Linux x86_64 with `base-devel`, rust, nodejs, pnpm, webkit2gtk-4.1/gtk3/gstreamer dev families installed (`sudo pacman -S --needed base-devel rust nodejs pnpm`). `git clone` the repo.
- **Path B (non-Arch host, e.g., macOS maintainer)**: Docker installed; repo cloned. All commands run inside `docker run --rm -it -v "$PWD":/pkg archlinux:base` (install Path A prerequisites inside the container first).
- No app secrets, no internet except the one-time upstream source downloads the existing flow performs (ffmpeg/lame/opus tarballs, crates, npm packages).

## Scenario 1 — Full flow produces an installable package (P1, spec SC-001/SC-002)

1. From repo root: `./scripts/package-arch.sh`
2. **Expected**: phases print prereq summary → build progress → makepkg output; last line prints the artifact path `audiflow-<version>-<pkgrel>-x86_64.pkg.tar.zst`.
3. Install: `sudo pacman -U ./<artifact>` (Path A) or inside container.
4. **Expected**: `pacman -Ql audiflow` lists files; binary at `/usr/lib/audiflow/audiflow`, sidecar pair ffmpeg/ffprobe next to it, launcher at `/usr/bin/audiflow`, `.desktop` under `/usr/share/applications/`, icons under `/usr/share/icons/hicolor/*/apps/`.

## Scenario 2 — Installed app launches and converts (P1 core value)

1. Launch from desktop grid or terminal: `audiflow`
2. **Expected**: window opens (title "Audiflow", correct icon in taskbar).
3. Convert one audio file (e.g., mp3→flac) end-to-end.
4. **Expected**: conversion completes using the bundled statically-built ffmpeg (verify no `depends` on system ffmpeg was silently assumed: `pacman -Qi audiflow` shows the routed `depends` families but ffmpeg absence does not break conversion).

## Scenario 3 — Package contents land only in standard locations (P2, spec SC-004)

1. `pacman -Ql audiflow | grep -v '^audiflow /usr'`
2. **Expected**: no output — zero files outside `/usr` subpaths.
3. `pacman -Qkk audiflow` — **Expected**: no missing/modified-file errors for the stamped file modes (ELF 0755, `.desktop`/icons 0644).

## Scenario 4 — Uninstall leaves user data untouched (P2 edge case)

1. Run the app once (creates user config/library state in home dir), then `sudo pacman -R audiflow`.
2. **Expected**: only `/usr` files removed; user config/library state remains; re-`pacman -U` of the same artifact reinstalls cleanly (same-version reinstall behavior, spec edge case).

## Scenario 5 — Fail fast and environment escape (P1 FR-002, non-Arch edge case)

1. On non-Arch host: `./scripts/package-arch.sh` (Path B container NOT active).
2. **Expected**: clear error naming the Arch environment requirement *before* any long build; non-zero exit; no partial artifact in output dir.
3. Missing prereq variant (e.g., remove rustc from PATH): **Expected**: one-pass prereq summary naming `rustc` (and any other missing prereqs) without starting the build.

## Scenario 6 — Non-interference (P3, spec SC-003)

1. `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml` on the repo after packaging changes.
2. **Expected**: suites pass exactly as before (no app-code change).
3. `.deb`/`.AppImage` outputs unchanged: existing `release.yml` linux-x64 job still lists the same artifact globs; no deb/appimage file modifications from the packaging flow.

## Scenario 7 — Same-version reinstall/upgrade (P3 edge case)

1. Rebuild with `--skip-build` reusing output; `pacman -U` the freshly produced artifact over an installed same-version package.
2. **Expected**: pacman treats it as reinstall/upgrade without conflict (spec edge case).

## References

- CLI/file-list guarantees: [contracts/packaging-contract.md](contracts/packaging-contract.md)
- Entity/state definitions: [data-model.md](data-model.md)
- Rationale for each decision: [research.md](research.md)
