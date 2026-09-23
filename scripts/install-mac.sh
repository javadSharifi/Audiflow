#!/usr/bin/env bash
# ==============================================================================
# Audiflow macOS installer (free, no Apple Developer account needed)
# Fixes: "Audiflow is damaged and can't be opened. Move it to the Trash."
# Root cause: release DMG is ad-hoc signed (no paid notarization), so Gatekeeper
# quarantines it on download. This script removes quarantine + re-signs ad-hoc
# locally, which is the standard free workaround used by OSS Tauri apps.
#
# Usage:
#   bash install-mac.sh
#   (from the unzipped Audiflow_*_macos-arm64-install folder — the DMG sits
#    right beside this script; no file paths needed)
#   Optional: bash install-mac.sh [path/to/Audiflow_*.dmg]
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
APP_NAME="Audiflow.app"
APP_DEST="/Applications/${APP_NAME}"

find_dmg() {
  for d in "${1:-}" ./Audiflow*.dmg ~/Downloads/Audiflow*.dmg ~/Desktop/Audiflow*.dmg; do
    # shellcheck disable=SC2086
    for f in $d; do [ -f "$f" ] && { echo "$f"; return 0; }; done
  done
  return 1
}

DMG="${1:-}"
if [ "${DMG}" = "-h" ] || [ "${DMG}" = "--help" ]; then
  echo "Usage: bash install-mac.sh   (run from the unzipped install folder)"
  exit 0
fi
if [ -z "$DMG" ]; then
  DMG="$(find_dmg)" || {
    echo -e "${RED}Audiflow DMG not found.${NC} This script must sit in the same folder as ${YELLOW}Audiflow_*.dmg${NC} — unzip ${YELLOW}Audiflow_*_macos-arm64-install.zip${NC} first, then run: bash install-mac.sh"
    exit 1
  }
fi
[ -f "$DMG" ] || { echo -e "${RED}Not found: $DMG${NC}"; exit 1; }
echo -e "${GREEN}DMG: $DMG${NC}"

# 1. Remove download quarantine from DMG itself
xattr -d com.apple.quarantine "$DMG" 2>/dev/null || true

# 2. Mount, copy to /Applications, unmount
MNT="$(mktemp -d /tmp/audiflow-mnt.XXXXXX)"
hdiutil attach "$DMG" -nobrowse -mountpoint "$MNT" -quiet
trap 'hdiutil detach "$MNT" -quiet 2>/dev/null || true; rmdir "$MNT" 2>/dev/null || true' EXIT
[ -d "$MNT/$APP_NAME" ] || { echo -e "${RED}$APP_NAME inside DMG not found${NC}"; exit 1; }
echo "Copying to $APP_DEST ..."
rm -rf "$APP_DEST"
cp -R "$MNT/$APP_NAME" "$APP_DEST"
hdiutil detach "$MNT" -quiet
trap - EXIT; rmdir "$MNT" 2>/dev/null || true

# 3. Free Gatekeeper workaround: strip quarantine + ad-hoc re-sign (sidecars incl.)
xattr -dr com.apple.quarantine "$APP_DEST" 2>/dev/null || true
codesign --force --deep --sign - "$APP_DEST"

# 4. Verify + launch hint
if codesign --verify --deep --strict "$APP_DEST" 2>/dev/null; then
  echo -e "${GREEN}OK: signed + verified.${NC}"
else
  echo -e "${YELLOW}Note: strict verify warns (ad-hoc, expected without paid cert) — app should still open.${NC}"
fi
echo -e "${GREEN}Installed. Opening Audiflow ...${NC}"
echo -e "${YELLOW}If macOS asks: right-click Audiflow > Open > Open.${NC}"
open "$APP_DEST"
