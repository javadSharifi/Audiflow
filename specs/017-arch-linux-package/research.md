# Research: Arch Linux Package

**Feature**: specs/017-arch-linux-package | **Date**: 2026-09-23 | **Status**: Complete

## Unknowns from Technical Context (all resolved)

## R1 — PKGBUILD mechanism: bundle-from-build-output vs full source rebuild inside makepkg

**Decision**: `package()` consumes the output of the repo's standard Tauri build (run before `makepkg` inside the orchestrator script) and stamps it into the package; `build()` inside the PKGBUILD is a no-op pass-through (makepkg requires `build()` to exist).

**Rationale**: The repo already has a battle-tested build flow (`pnpm install --frozen-lockfile` → `pnpm fetch:ffmpeg` → `pnpm tauri build --target x86_64-unknown-linux-gnu`) whose release pipeline (`release.yml`) runs it with `dtolnay/rust-toolchain@stable`, Swatinem cache, and per-OS system deps.órać Rebuilding inside `makepkg` would duplicate this flow (toolchain pinning, cache, frontend build steps) and drift over time. Consuming build output keeps one canonical build path (minimal change + no drift) and matches the `.deb`/`.AppImage` outputs that Tauri already stamps.

**Alternatives considered**:
- Full in-makepkg source build with `prepare()`/`build()` running cargo — rejected: duplicates the canonical flow, harder to cache, higher drift risk.
- `tauri.conf.json` `linux.arch` bundle target — does not exist in Tauri v2 (bundle targets are deb/appimage/rpm on Linux) — not available.

## R2 — ffmpeg runtime strategy: bundle statically-built helpers vs depend on system `ffmpeg`

**Decision**: Bundle the statically-built `ffmpeg`/`ffprobe` sidecars into the package (under `/usr/lib/audiflow/`), exactly as every other desktop output (`.deb`, `.AppImage`, Android APK) already bundles them.

**Rationale**: Constitution I mandates zero-dependency local-first behavior; the spec's deb `depends` list only covers webview/gtk/gstreamer, and Tauri's `externalBin` mechanism (`src-tauri/tauri.conf.json:38`, `binaries/ffmpeg`, `binaries/ffprobe`, triple-suffixed at `src-tauri/binaries/ffmpeg-<triple>`) is already the resolution contract at runtime: `locate_desktop` (`src-tauri/src/ffmpeg/locate.rs:88`) find the helpers **next to the running executable**. Placing the sidecar pair next to `/usr/bin/audiflow` under `/usr/lib/audiflow/` requires either shipping a wrapper or adjusting the locate path — resolved in R3.

**Alternatives considered**:
- `depends=('ffmpeg')` and rely on system ffmpeg — rejected: violates the zero-dep principle and the app's version-pinned FFmpeg 8.1.2 expectations (+ static lame/opus guarantees); different Arch ffmpeg versions could change probe/progress output parsing.

## R3 — Sidecar placement vs `locate_desktop` contract (next-to-exe)

**Decision**: Ship the sidecars at `/usr/lib/audiflow/ffmpeg` + `ffprobe` and launch via a tiny wrapper script `/usr/bin/audiflow` that prepends `/usr/lib/audiflow` to `PATH` (or a `LD_LIBRARY_PATH`-style env; concrete wrapper finalized in implementation), so `current_exe().parent()` resolution (`src-tauri/src/ffmpeg/locate.rs:88-99`) still finds the real binary in `/usr/lib/audiflow` next to its sidecars.

**Rationale**: `locate_desktop` looks only at `current_exe().parent()`. If the ELF went to `/usr/bin/audiflow` directly, sidecars would have to sit in `/usr/bin` (nonstandard land-file hygiene the spec prohibits). The wrapper keeps: (a) ELF + sidecars co-located in one directory (`/usr/lib/audiflow`); (b) `/usr/bin/audiflow` as the standard launcher entry; (c) zero Rust code changes.

**Alternatives considered**:
- Convert `locate_desktop` to also check `/usr/lib/audiflow` — rejected: app-code change for a packaging concern; wrapper requires zero code change.
- `FFMPEG_PATH` env hardcoded in the .desktop launcher — fragile across launch surfaces (terminal/launcher/file associations).

## R4 — Test gate for shell-based packaging (Constitution V compliance)

**Decision**: Structural verification in three layers, all runnable in the `tasks.md` phase: (1) `bash -n scripts/package-arch.sh` syntax; (2) `makepkg --printsrcinfo` parses and emits required fields (name/version/arch/depends) — validated structurally in the dev environment since makepkg itself needs an Arch or Arch-container host; (3) post-build `bsdtar -tf <pkg>` asserts the expected file list (binary at `/usr/lib/audiflow/audiflow`, sidecar pair, launcher in `/usr/bin`, icon under `/usr/share/icons/hicolor/*`, `.desktop` under `/usr/share/applications`).

**Rationale**: pacman/makepkg are Arch-only tools; CI (`ubuntu-22.04`) cannot run them natively. Non-interference checks (`pnpm test`, `cargo test`) still run as usual since no app code is touched. Full install verification (R7) belongs in quickstart, not CI.

**Alternatives considered**:
- Docker-based Arch container in CI per-PR — excluded from v1 (spec P3 leaves release automation optional; CI container machinery would violate minimal-change for this spec's scope).

## R5 — Error surface boundary: packaging CLI messages vs i18n discipline (Constitution VIII)

**Decision**: Packaging script and PKGBUILD error messages are plain-text developer-facing English. No `translate(lang, ...) keys are introduced for them.

**Rationale**: Constitution VIII governs every *user-facing string* — strings shown in the shipped app's UI. The packaging flow is a developer tool invoked from a terminal (spec Assumption), same convention as `scripts/install-mac.sh` and `release.yml` failure messages today. Creating i18n keys for developer CLI tooling would add dead locale entries in all supported languages for no shipped-UI benefit.

**Alternatives considered**:
- Add packaging-flow i18n keys for EN/FA — rejected: strings never route through the app's `translate()`; would violate SRP by mixing developer-tooling messages into the app i18n catalog.

## R6 — Arch system dependency names for PKGBUILD `depends`

**Decision**: Runtime `depends` translated from the deb list (`src-tauri/tauri.conf.json:51-59`) to Arch package names as listed in spec FR-006. makedepends covers the build host only (rust, nodejs, pnpm) and is intentionally minimal because the orchestrator consumes the pre-built output.

**Rationale**: The deb `depends` list already captures the webview/gtk/gstreamer runtime families Audiflow needs; the Arch mapping (webkit2gtk-4.1, gtk3, gst-plugins-base/good/bad/ugly, gst-libav) is the standard equivalent set documented by Tauri's Arch prerequisites page. ffmpeg/ffprobe are bundled (R2), never in `depends`.

**Alternatives considered**:
- Empty `depends` with static linking of webview — impossible: webkit2gtk is dynamically linked by the Tauri ELF regardless of output format.
- Copy the deb names verbatim — invalid: Arch package names differ from Debian's.

## R7 — Install verification without an Arch dev host (quickstart path)

**Decision**: quickstart.md documents two validation paths: (a) on a real Arch host — `pacman -U ./audiflow-1.5.7-1-x86_64.pkg.tar.zst` then `pacman -Ql` + launch checks; (b) in a Docker Arch container (`docker run --rm -v "$PWD":/pkg archlinux:base`) for maintainers on non-Arch machines — mirroring the spec edge case that non-Arch hosts must either containerize or fail fast with a clear "run inside an Arch environment".

**Rationale**: The maintainer's current dev host is macOS (no pacman available). The container path makes SC-001/SC-002 verifiable without changing the developer's OS, and keeps the "fail fast on non-Arch" requirement while still enabling full validation.

**Alternatives considered**:
- `bsdtar -tf` only (no install check) — insufficient: `pacman -Ql` installability is the spec's Independent Test for P1/P2 journeys.

## R8 — Version identity and package name

**Decision**: Package name `audiflow`, version sourced from `src-tauri/tauri.conf.json` version field (currently 1.5.7 — supersedes the spec's Assumption; the spec was drafted with 1.5.1 which was stale), pkgrel=1, `arch=('x86_64')`, `license=` left as a placeholder to fill in implementation (`NEEDS CLARIFICATION` in spec FR-004 — see below). Description matches `shortDescription` in the same file.

**Rationale**: Single source of truth for app metadata (tauri.conf.json) — already the provenance for release tags and product name; parsing it in the orchestrator avoids version-drift between the spec, the package, and the shipped ELF.

**Alternatives considered**:
- `audiflow-bin` naming — reserved for AUR-prebuilt conventions (out of scope v1).
- Hardcode version in PKGBUILD — rejected: drift with tauri.conf.json.

## Needs Clarification (carried into spec/tasks)

- **License identity**: no LICENSE file exists in the repo, and neither `package.json` nor `src-tauri/Cargo.toml`/`tauri.conf.json` declares a license field (`makepkg` warns on missing license; Arch's standard values apply). The packaged artifact is installable regardless, but FR-004's "license field" requires an actual value. To be resolved during implementation by the repo owner's choice — no silent default will be chosen.
