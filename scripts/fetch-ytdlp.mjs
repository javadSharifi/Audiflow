#!/usr/bin/env node
/**
 * Fetch official yt-dlp standalone binaries for bundling (Tauri 2 externalBin).
 *
 * Supported target triples:
 * - macOS arm64/x64: yt-dlp_macos (universal binary)
 * - Linux x64: yt-dlp
 * - Windows x64: yt-dlp.exe
 *
 * Output layout:
 *   src-tauri/binaries/yt-dlp[-{target-triple}]
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  copyFileSync,
  chmodSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import os from "node:os";

const BIN_DIR = path.resolve(import.meta.dirname, "../src-tauri/binaries");
const RELEASE_BASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

function targetTriple() {
  if (process.env.TARGET_TRIPLE) return process.env.TARGET_TRIPLE;
  const arch = os.arch() === "x64" ? "x86_64" : "aarch64";
  switch (process.platform) {
    case "darwin":
      return `${arch}-apple-darwin`;
    case "win32":
      return `${arch}-pc-windows-msvc`;
    case "linux":
      return `${arch}-unknown-linux-gnu`;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

async function download(url, dest) {
  console.log(`Downloading ${url} -> ${dest}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function main() {
  const triple = targetTriple();
  if (triple.includes("android")) {
    console.error("ERROR: Android is not a supported target for yt-dlp bundling.");
    console.error("Official standalone yt-dlp binaries are desktop-only (macOS, Windows, Linux x64).");
    process.exit(1);
  }

  mkdirSync(BIN_DIR, { recursive: true });

  let assetName;
  let exeSuffix = "";

  if (triple.includes("apple-darwin")) {
    assetName = "yt-dlp_macos";
  } else if (triple.includes("windows")) {
    assetName = "yt-dlp.exe";
    exeSuffix = ".exe";
  } else if (triple.includes("linux")) {
    assetName = triple.includes("aarch64") ? "yt-dlp_linux_aarch64" : "yt-dlp_linux";
  } else {
    throw new Error(`Unsupported target triple: ${triple}`);
  }

  const url = `${RELEASE_BASE}/${assetName}`;
  const tempDownloaded = path.join(BIN_DIR, `temp-ytdlp-download${exeSuffix}`);

  await download(url, tempDownloaded);

  try {
    chmodSync(tempDownloaded, 0o755);
  } catch {}

  // Install triple-suffixed binary (for Tauri bundle externalBin) and unsuffixed copy (for dev & test)
  for (const suffix of [triple, ""]) {
    const base = suffix ? `yt-dlp-${suffix}` : "yt-dlp";
    const dest = path.join(BIN_DIR, `${base}${exeSuffix}`);
    copyFileSync(tempDownloaded, dest);
    try {
      chmodSync(dest, 0o755);
    } catch {}
    console.log(`Installed ${dest}`);
  }

  // If targeting macOS, copy for both aarch64 and x86_64 since yt-dlp_macos is universal
  if (triple.includes("apple-darwin")) {
    for (const arch of ["aarch64", "x86_64"]) {
      const dest = path.join(BIN_DIR, `yt-dlp-${arch}-apple-darwin`);
      copyFileSync(tempDownloaded, dest);
      try {
        chmodSync(dest, 0o755);
      } catch {}
      console.log(`Installed ${dest}`);
    }
  }

  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(tempDownloaded);
  } catch {}

  console.log("yt-dlp binaries setup complete.");
}

main().catch((err) => {
  console.error("fetch-ytdlp error:", err);
  process.exit(1);
});
