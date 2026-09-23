# Feature Specification: Arch Linux Package

**Feature Branch**: `017-arch-linux-package`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "اگر من بخوام برای Arch Linux خروجی بگیرم چه کار های باید بکنم ؟"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build an installable Arch Linux package (Priority: P1)

A developer (or user) working on Audiflow runs a single command and gets an installable `.pkg.tar.zst` package for Arch Linux (x86_64) that installs the app binary, icon, and desktop entry into standard system locations via `pacman`.

**Why this priority**: The core request is "how do I produce an output for Arch Linux" — without a working package there is no value at all. Everything else builds on this.

**Independent Test**: Can be fully tested by running the packaging command on (or for) Arch Linux x86_64 and attempting `pacman -U <package>` in a clean environment, confirming the package installs and the app appears in the app grid.

**Acceptance Scenarios**:

1. **Given** the repository checked out on an Arch Linux x86_64 machine with its build dependencies installed, **When** the packaging command runs to completion, **Then** a `.pkg.tar.zst` package exists in the output directory and contains the app binary, icon, and `.desktop` file.
2. **Given** the built package, **When** the user installs it with `pacman -U`, **Then** the app is launchable from the system menu and runs as an audio converter.
3. **Given** the packaging command failures (missing dependency, build error), **When** the command exits before producing a package, **Then** the error names the failing step in plain language.

---

### User Story 2 - Package contents land in standard locations (Priority: P2)

After installing the Arch package, a user finds the binary in `/usr/bin`, the icon in `/usr/share/icons`, the desktop entry in `/usr/share/applications`, and app data (such as any bundled ffmpeg helper) under `/usr/share` or `/usr/lib`, matching Arch packaging conventions rather than land files scattered in unexpected places.

**Why this priority**: A package that installs to nonstandard paths fails distribution review conventions and confuses users' wallets; correct contents are what make the package genuinely Arch-native.

**Independent Test**: Can be fully tested by installing the package and querying `pacman -Ql` for the file list, then checking each expected standard path exists.

**Acceptance Scenarios**:

1. **Given** an installed Arch package, **When** the user queries the file list (`pacman -Ql`), **Then** the binary lives under `/usr/bin`, icon under `/usr/share/icons/hicolor/*/apps/`, desktop entry under `/usr/share/applications/`, and any bundled helper under `/usr/share` or `/usr/lib` — with no files elsewhere.
2. **Given** the installed desktop entry, **When** the user launches Audiflow from the desktop/app grid, **Then** the correct icon and name show in the taskbar/window title.

---

### User Story 3 - Reproducible packaging documented and CI-adjacent (Priority: P3)

A contributor who wants to rebuild the Arch package finds concise documentation (a section in packaging docs or README) explaining the Prereqs, the packaging command, and where the output lands — and optionally a CI/release hook producing the package artifact alongside the existing `.deb`/`.AppImage` for Linux releases.

**Why this priority**: Packaging must be repeatable by other developers and ideally automated in releases; without this, the P1 flow remains a one-off trick that decays.

**Independent Test**: Can be fully tested by having a fresh contributor follow the documentation on a clean Arch Linux machine and successfully produce an identical-in-structure package.

**Acceptance Scenarios**:

1. **Given** the repository documentation, **When** a contributor on a clean Arch Linux x86_64 machine follows the documented steps, **Then** the packaging command succeeds and produces the same structure of package artifact as expected for a release.
2. **Given** the existing Linux release workflow (release.yml builds `.deb` + `.AppImage` for linux-x64), **When** the packaging automation is invoked for Linux releases, **Then** the Arch package artifact joins the existing artifacts without breaking them.

---

### Edge Cases

- What happens when packaging runs on a non-Arch machine (e.g., macOS, Debian-based Linux)? The flow either produces the package via `makepkg` inside a controlled Arch build environment (when automation is used) or fails fast with a clear "this must run in an Arch environment" message — never producing an incorrect hybrid package.
- What happens when a required build dependency (e.g., ffmpeg headers, Tauri/Rust toolchain, `makepkg` utilities) is missing? The flow checks prerequisites upfront and names the missing dependency before any long build starts.
- How does the system handle the same package version being rebuilt repeatedly? `makepkg` rebuild overwrites by version; installing with `pacman -U` treats the same version as an upgrade/reinstall without conflict.
- What happens when the app requires the bundled ffmpeg binary at runtime but the package ships it separately (or relies on system ffmpeg)? The package declares its runtime expectations and the decision is recorded explicitly; the app must not install-but-then-fail-to-play due to a missing helper.
- What happens when a user uninstalls the package? User data (app config, library folder list, conversion history in their home directory) remains untouched — only files under `/usr` are removed, matching standard pacman behavior.
- What happens on Arm variants (aarch64)? Out of scope for v1 unless trivially derivable; x86_64 is the priority since release.yml linux-x64 targets it today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a documented packaging command that produces an installable Arch Linux `.pkg.tar.zst` package for x86_64 from the current source (binary, icon, `.desktop`, and any bundled runtime helper).
- **FR-002**: The packaging flow MUST check prerequisites upfront (Rust toolchain, Tauri system dependencies per target, `makepkg` availability) and fail fast naming any missing prerequisite.
- **FR-003**: The produced package MUST install all contents under standard Arch locations (`/usr/bin`, `/usr/share/icons/hicolor/*`, `/usr/share/applications`, and any helper under `/usr/share` or `/usr/lib`) with correct permissions and owners.
- **FR-004**: The package MUST carry a valid PKGBUILD-derived metadata identity (package name like `audiflow` or `audiflow-bin`, version derived from the existing app version 1.5.1, description, arch list, license field, dependencies).
- **FR-005**: The packaging flow MUST NOT modify unrelated existing outputs; producing the Arch package leaves existing `.deb`. `.AppImage`, and Android build flows unchanged.
- **FR-006**: The packaging flow MUST support canceling a long-running build step (Ctrl+C at the CLI) without leaving stale lockfiles or partially written package outputs in the output directory.
- **FR-007**: Documentation MUST exist (README or packaging docs section) explaining: prerequisites per Arch build environment, the exact packaging command, and the output path.
- **FR-008**: If a runtime helper (e.g., ffmpeg fetch/build script output) is needed at runtime, the package MUST either bundle it explicitly in the package or declare a system dependency (e.g., `ffmpeg`), with the decision recorded (explicitly documented; no silent "works only on my machine" behavior).
- **FR-009**: Error surfaces in the packaging CLI path MUST be plain-language errors naming the failing step and the suggested fix (missing system dependency names, missing toolchains), no raw stack traces as the only output.
- **FR-010**: If release automation produces the Arch package, the artifact MUST join existing linux-x64 artifacts (`.deb`, `.AppImage`) in the same release workflow run without changing their contents or names.

### Key Entities

- **Arch Package**: The deliverable installable file; attributes: package name, version (matches app version), arch (x86_64), file list (binary/icon/desktop/helper), metadata (description, license, dependencies).
- **PKGBUILD Recipe**: The recipe file that drives arch package building; attributes: source mechanism (build from source in this repo), build steps (rust/tauri build), package() file layout, and metadata fields.
- **Packaging Output**: The directory where the produced `.pkg.tar.zst` lands; attributes: path, platform environment required (Arch x86_64), and the log of the last build's success/failure summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from repo clone to installed Audiflow on a clean Arch Linux x86_64 machine in under 30 minutes following the documentation alone.
- **SC-002**: The packaging command produces a valid `.pkg.tar.zst` that passes `pacman -U` install and `pacman -Ql` verification in 100% of attempts on a clean Arch environment.
- **SC-003**: Zero regressions in existing Linux outputs: the `.deb` and `.AppImage` flows continue to succeed unchanged after this feature lands.
- **SC-004**: Package contents contain zero files outside `/usr` subpaths and ship with a valid desktop entry and icon that render correctly in the app grid.

## Assumptions

- Primary target is the repo maintainer/developer (and secondarily package users); the flow is invoked from the CLI (scripts or makepkg), not from the app's UI.
- The most common maintainer environment today is not Arch itself (release.yml runs `ubuntu-22.04`); the packaging path therefore either runs inside an Arch-controlled build environment for automation or must error clearly when run directly on non-Arch hosts — final mechanism choice is fixed during planning.
- Package naming and version derive from existing app metadata (Audiflow, version 1.5.1) rather than introducing a new versioning scheme.
- Scope boundary: AUR publication (submitting to the AUR as `audiflow` or `audiflow-bin`) is out of scope for this feature; producing a locally installable package (and optionally including it in releases) is the deliverable.
- Scope boundary: aarch64/Arm Arch packaging is out of scope for v1.
- Runtime ffmpeg strategy (bundle in the package vs declare system `ffmpeg` dependency) is not fixed by this spec; it must be decided and documented during planning.
- The existing desktop-entry name/icon assets used by `.deb`/`.AppImage` outputs are reused for the Arch package rather than being recreated.
