Audiflow — macOS Install Guide
==============================

Thanks for downloading Audiflow, the free offline audio converter,
editor, and music player.

This folder was unzipped from Audiflow_*_macos-arm64-install.zip and
contains everything you need:

  - Audiflow_*.dmg       the app disk image
  - install-mac.sh       the installer script
  - README.txt           this file

HOW TO INSTALL (no file paths needed)
-------------------------------------

1. Open Terminal in this folder:
   Right-click this folder > Services > New Terminal at Folder,
   or type "cd " in Terminal and drag this folder into the window, then
   press Enter.

2. Run the installer:

      bash install-mac.sh

   That's it. The script finds the DMG in this folder by itself, copies
   Audiflow to /Applications, fixes the "damaged and can't be opened"
   Gatekeeper warning, verifies the signature, and opens Audiflow.

3. If macOS still asks:
   Right-click Audiflow > Open > Open,
   or allow it in System Settings > Privacy & Security > Open Anyway.

WHY THE "DAMAGED" WARNING HAPPENS
---------------------------------

Audiflow is a free open-source project and its macOS build is ad-hoc
signed — it has no paid Apple Developer notarization ($99/yr), so macOS
quarantines the downloaded file and shows the "damaged / move to Trash"
message. This is Gatekeeper, not a broken download. The installer script
removes the quarantine and re-signs the app locally, which is the
standard free workaround used by open-source apps.

MANUAL INSTALL (without the script)
-----------------------------------

  xattr -dr com.apple.quarantine /Applications/Audiflow.app
  codesign --force --deep --sign - /Applications/Audiflow.app
  open /Applications/Audiflow.app

Enjoy Audiflow — your audio stays on your device.
