#!/usr/bin/env python3
"""Generate app icons (.icns + .ico + PNG set + Android/iOS) from app-icon.png."""
import os
import shutil
import struct
import subprocess
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "src-tauri" / "icons"
SRC_ICON = ROOT / "app-icon.png"


def generate_with_tauri_icon() -> bool:
    if not SRC_ICON.exists():
        return False
    try:
        subprocess.run(["pnpm", "tauri", "icon", str(SRC_ICON)], cwd=str(ROOT), check=True)
        return True
    except Exception as e:
        print(f"tauri icon failed: {e}", file=sys.stderr)
        return False


def generate_with_pillow() -> bool:
    try:
        from PIL import Image
    except ImportError:
        return False

    if not SRC_ICON.exists():
        return False

    img = Image.open(SRC_ICON).convert("RGBA")
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    iconset = ICONS_DIR / "icon.iconset"
    iconset.mkdir(exist_ok=True)

    sizes = [16, 32, 64, 128, 256, 512, 1024]
    for s in sizes:
        resized = img.resize((s, s), Image.Resampling.LANCZOS)
        resized.save(ICONS_DIR / f"{s}x{s}.png")

    (ICONS_DIR / "32x32.png").write_bytes((ICONS_DIR / "32x32.png").read_bytes())
    (ICONS_DIR / "128x128.png").write_bytes((ICONS_DIR / "128x128.png").read_bytes())
    (ICONS_DIR / "128x128@2x.png").write_bytes((ICONS_DIR / "256x256.png").read_bytes())

    for filename, (w, h) in [
        ("icon_16x16.png", (16, 16)),
        ("icon_16x16@2x.png", (32, 32)),
        ("icon_32x32.png", (32, 32)),
        ("icon_32x32@2x.png", (64, 64)),
        ("icon_128x128.png", (128, 128)),
        ("icon_128x128@2x.png", (256, 256)),
        ("icon_256x256.png", (256, 256)),
        ("icon_256x256@2x.png", (512, 512)),
        ("icon_512x512.png", (512, 512)),
        ("icon_512x512@2x.png", (1024, 1024)),
    ]:
        img.resize((w, h), Image.Resampling.LANCZOS).save(iconset / filename)

    if sys.platform == "darwin":
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(ICONS_DIR / "icon.icns")],
            check=True,
        )

    # Sync to Android res if available
    android_res = ROOT / "src-tauri" / "gen" / "android" / "app" / "src" / "main" / "res"
    if android_res.exists():
        for d in ["mipmap-hdpi", "mipmap-mdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"]:
            src_folder = ICONS_DIR / "android" / d
            dst_folder = android_res / d
            if src_folder.exists() and dst_folder.exists():
                for f in src_folder.iterdir():
                    if f.is_file():
                        shutil.copy2(f, dst_folder / f.name)

    return True


def main() -> None:
    if generate_with_tauri_icon():
        # also ensure iconset and android sync
        generate_with_pillow()
        print(f"Icons generated successfully at {ICONS_DIR}")
        return

    if generate_with_pillow():
        print(f"Icons generated via Pillow at {ICONS_DIR}")
        return

    print("Error: Could not generate icons", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
