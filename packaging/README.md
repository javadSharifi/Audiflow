# Arch Linux Packaging (Audiflow)

Produce an installable Arch Linux package (`audiflow-<version>-1-x86_64.pkg.tar.zst`) from the repo's standard Tauri build output. Spec: `specs/017-arch-linux-package/`; decisions: `specs/017-arch-linux-package/research.md`.

## What it produces

- Artifact: `packaging/arch/audiflow-<version>-1-x86_64.pkg.tar.zst` (version injected from `src-tauri/tauri.conf.json` — currently **1.5.8**; `pkgrel=1`; never hardcoded).
- Contents (all under `/usr`, per `specs/017-arch-linux-package/contracts/packaging-contract.md`):
  - `/usr/bin/audiflow` — launcher wrapper (execs the real ELF)
  - `/usr/lib/audiflow/audiflow` — the app ELF
  - `/usr/lib/audiflow/ffmpeg` + `/usr/lib/audiflow/ffprobe` — statically built sidecars (bundled; system ffmpeg is NOT required)
  - `/usr/share/applications/audiflow.desktop` + `/usr/share/icons/hicolor/{32x32,128x128,256x256@2x}/apps/audiflow.png`

## Command

```bash
./scripts/package-arch.sh                # full flow: prereq check → build → package
./scripts/package-arch.sh --skip-build   # reuse existing tauri build output
```

- The artifact path is printed as the **last line** on success.
- `--skip-build` without a prior build fails fast naming the missing output — run the full flow first.
- Never invokes `sudo`; install stays the user's action: `sudo pacman -U ./packaging/arch/audiflow-<version>-1-x86_64.pkg.tar.zst`

### Flags

| Flag | Purpose |
| --- | --- |
| `--skip-build` | Reuse the existing `src-tauri/target/x86_64-unknown-linux-gnu/release/audiflow` + sidecars |
| `--force-non-arch` | Structural checks on a non-Arch host (makepkg/pacman must still be on PATH) |

## Prerequisites (Arch x86_64)

```bash
sudo pacman -S --needed base-devel rust nodejs pnpm jq \
  webkit2gtk-4.1 gtk3 gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav
```

The orchestrator runs a one-pass prereq check (toolchain `rustc`/`cargo`/`node`/`pnpm`/`makepkg`/`bsdtar`/`jq` + system-dep presence via `pacman -T`) and names **all** missing prereqs before any build starts.

## Non-Arch hosts (e.g., macOS/Debian maintainers)

Two paths (research R7):

1. **Fail fast** — the script exits naming the Arch-environment requirement (quickstart Scenario 5).
2. **Container** — run the whole flow inside an Arch container:

```bash
docker run --rm -it -v "$PWD":/pkg archlinux:base
# inside: pacman -Syu --needed base-devel rust nodejs pnpm jq webkit2gtk-4.1 gtk3 \
#   gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav
# then: ./scripts/package-arch.sh
```

Install verification (quickstart Scenarios 1–4) requires pacman — real Arch host or the container above. `bsdtar -tf <artifact>` works anywhere for an offline contents check.

## Build outputs consumed

The PKGBUILD does not rebuild (research R1). It consumes:

- `src-tauri/target/x86_64-unknown-linux-gnu/release/audiflow` — the Tauri ELF (canonical flow: `pnpm install --frozen-lockfile` → `pnpm fetch:ffmpeg` → `pnpm tauri build --target x86_64-unknown-linux-gnu`)
- `src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu` + `ffprobe-…` — statically built sidecars from `pnpm fetch:ffmpeg`, co-located next to the ELF (next-to-exe locate contract, `src-tauri/src/ffmpeg/locate.rs:88`)

The orchestrator injects `PKGVER_OVERRIDE=<version of src-tauri/tauri.conf.json>` into makepkg (`makepkg` needs a literal `pkgver` at parse time; direct `makepkg` without it is rejected with a named error — no silent default).

## Status / known gaps

- **license= is unset (NEEDS CLARIFICATION)** — the repo carries no LICENSE file and no license field in `package.json`/`Cargo.toml`/`tauri.conf.json`. `makepkg` warns while it is unset; the artifact remains installable. Repo owner's choice: `MIT` / `GPL-3.0-only` / `LicenseRef-Proprietary` (spec FR-004).
- Release automation (CI): the `linux-x64` matrix job in `.github/workflows/release.yml` packages the artifact inside an `archlinux:base` container (`docker run`, non-root `builder` user, `--skip-build` consuming the job's Tauri build output) and attaches `audiflow-<version>-1-x86_64.pkg.tar.zst` to the GitHub release.
- Out of scope: AUR publication, aarch64/arm packaging.
