#!/usr/bin/env bash
# package-arch.sh — Audiflow Arch Linux packaging orchestrator
# Contract: specs/017-arch-linux-package/contracts/packaging-contract.md
# Phases (each fail-fast, plain-language errors): prereq check -> build -> package
# Non-interference: touches no .deb/.AppImage/Android/app-source/tauri.conf.json; never invokes sudo.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_TRIPLE=x86_64-unknown-linux-gnu
MAKEPKG_DIR="$REPO_ROOT/packaging/arch"
ELF="$REPO_ROOT/src-tauri/target/$TARGET_TRIPLE/release/audiflow"
FFMPEG_SIDECAR="$REPO_ROOT/src-tauri/binaries/ffmpeg-$TARGET_TRIPLE"
FFPROBE_SIDECAR="$REPO_ROOT/src-tauri/binaries/ffprobe-$TARGET_TRIPLE"
SKIP_BUILD=0
FORCE_NON_ARCH=0

die() {
  echo "package-arch.sh: error: $1" >&2
  exit "${2:-1}"
}

phase() { echo "package-arch.sh: [phase] $1"; }

usage() {
  echo "Usage: ./scripts/package-arch.sh [--skip-build] [--force-non-arch]"
  echo "  --skip-build     Reuse existing tauri build output (fails with a named guard if outputs are missing)."
  echo "  --force-non-arch Proceed on a non-Arch host for structural checks only (pacman/makepkg must still be available)."
  exit 0
}

# ---------------------------------------------------------------
# Phase 1: prereq check (one pass; names ALL missing prereqs at once)
# ---------------------------------------------------------------
missing_prereqs=()

probe_cmd() { command -v "$1" >/dev/null 2>&1 || missing_prereqs+=("$1"); }

check_arch_environment() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    if [ "${ID:-}" = "arch" ]; then
      echo "package-arch.sh: Arch host detected (ID=arch)."
      return 0
    fi
  fi
  if [ "$FORCE_NON_ARCH" = 1 ]; then
    echo "package-arch.sh: WARNING: not an Arch host; --force-non-arch is active. Structural checks only — install verification still requires an Arch environment."
    return 0
  fi
  die "This flow must run in an Arch Linux environment (makepkg/pacman are Arch tools). On a non-Arch host, run inside a container: docker run --rm -it -v \"\$PWD\":/pkg archlinux:base ... or re-run with --force-non-arch for structural checks only." 2
}

check_prereqs() {
  phase "prereq check (one pass)"
  check_arch_environment

  probe_cmd rustc
  probe_cmd cargo
  probe_cmd node
  probe_cmd pnpm
  probe_cmd makepkg
  probe_cmd bsdtar
  probe_cmd jq

  # Tauri Linux build deps presence probe (Arch names, research R6). pacman -T is a
  # non-elevating check (no sudo): lists deps that are NOT installed.
  if command -v pacman >/dev/null 2>&1; then
    local missing_pkgs
    missing_pkgs="$(pacman -T webkit2gtk-4.1 gtk3 gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly gst-libav || true)"
    if [ -n "$missing_pkgs" ]; then
      for pkg in $missing_pkgs; do
        missing_prereqs+=("system package: $pkg (install: sudo pacman -S --needed $pkg)")
      done
    fi
  else
    missing_prereqs+=("pacman (required for the system-dep presence probe; makepkg calls need it too)")
  fi

  if [ ${#missing_prereqs[@]} -gt 0 ]; then
    echo "package-arch.sh: missing prereqs (all listed in one pass):"
    local item
    for item in "${missing_prereqs[@]}"; do
      echo "  - $item"
    done
    die "Fix the listed prereqs and re-run. No build was started." 3
  fi
  echo "package-arch.sh: prereq check passed (toolchain + system deps present)."
}

# ---------------------------------------------------------------
# Phase 2: build (canonical repo flow, unchanged)
# ---------------------------------------------------------------
run_build() {
  if [ "$SKIP_BUILD" = 1 ]; then
    phase "build skipped (--skip-build)"
    guard_build_outputs
    return 0
  fi
  phase "build (canonical repo flow: pnpm install --frozen-lockfile -> pnpm fetch:ffmpeg -> pnpm tauri build)"
  cd "$REPO_ROOT"
  pnpm install --frozen-lockfile
  pnpm fetch:ffmpeg
  pnpm tauri build --target "$TARGET_TRIPLE"
  guard_build_outputs
}

guard_build_outputs() {
  # Named guards (tasks T003/T005): a cold --skip-build run without a prior build fails here
  # with a plain-language message naming the missing output (quickstart Scenario 5).
  [ -f "$ELF" ] || die "missing tauri build output: src-tauri/target/$TARGET_TRIPLE/release/audiflow. Run ./scripts/package-arch.sh without --skip-build first." 4
  [ -f "$FFMPEG_SIDECAR" ] || die "missing sidecar: src-tauri/binaries/ffmpeg-$TARGET_TRIPLE (pnpm fetch:ffmpeg). Re-run ./scripts/package-arch.sh without --skip-build." 4
  [ -f "$FFPROBE_SIDECAR" ] || die "missing sidecar: src-tauri/binaries/ffprobe-$TARGET_TRIPLE (pnpm fetch:ffmpeg). Re-run ./scripts/package-arch.sh without --skip-build." 4
}

# ---------------------------------------------------------------
# Phase 3: package (makepkg consuming prebuilt output, research R1)
# ---------------------------------------------------------------
run_package() {
  phase "package (makepkg)"
  cd "$MAKEPKG_DIR"

  local pkgver
  pkgver="$(jq -r .version "$REPO_ROOT/src-tauri/tauri.conf.json")"
  [ -n "$pkgver" ] && [ "$pkgver" != "null" ] || die "could not parse version from src-tauri/tauri.conf.json (orchestrator contract: PKGVER_OVERRIDE injected from that file, research R8)." 5

  # Basename PKGVER_OVERRIDE: makepkg parses a literal pkgver at read time; the orchestrator
  # injects it from tauri.conf.json (single source of truth, NO silent default).
  PKGVER_OVERRIDE="$pkgver" BUILDDIR="$MAKEPKG_DIR/.makepkg-build" makepkg -f --noconfirm
  guard_build_outputs

  local artifact
  artifact="$MAKEPKG_DIR/audiflow-$pkgver-1-x86_64.pkg.tar.zst"
  # No partial artifact left behind (Constitution IV / spec FR-006): makepkg writes the
  # complete archive only; the orchestrator confirms existence before printing success.
  [ -f "$artifact" ] || die "makepkg finished but the expected artifact was not found: audiflow-$pkgver-1-x86_64.pkg.tar.zst" 5

  phase "done"
  printf "%s\\n" "$artifact"
}

main() {
  local arg
  for arg in "$@"; do
    case "$arg" in
      --skip-build) SKIP_BUILD=1 ;;
      --force-non-arch) FORCE_NON_ARCH=1 ;;
      -h|--help) usage ;;
      *) die "unknown option: $arg (supported: --skip-build, --force-non-arch, --help)" 1 ;;
    esac
  done
  check_prereqs
  run_build
  run_package
}

main "$@"
