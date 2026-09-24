# Phase 0 Research: Android Media Rescan & Indexing Sync

## Problem Statement & Root Cause Analysis

When a user copies audio files to an Android device (via USB OTG flash drive, computer MTP connection, third-party file manager, or browser download), the files reside directly on the filesystem (e.g. `/storage/emulated/0/Music`, `/storage/emulated/0/Download`, or USB OTG mount points).

Android manages media collections through the system-level `MediaStore` content provider. Raw filesystem additions do not automatically or immediately register into `MediaStore.Audio.Media.EXTERNAL_CONTENT_URI` until:
1. The device reboots and runs a full media scan, or
2. An application explicitly issues a scan request using Android's native `MediaScannerConnection`, or
3. Another music player or media app triggers a filesystem crawl and media scan.

In Audiflow's previous implementation:
1. `MediaStoreManager.queryMediaStoreMusic(context)` directly issued a ContentResolver query on `MediaStore.Audio.Media.EXTERNAL_CONTENT_URI` without triggering any sync or media scan.
2. The query filter strictly required `${MediaStore.Audio.Media.IS_MUSIC} != 0`. On several OEM Android builds (such as MIUI/Xiaomi, Transsion, and older Samsung roms), files newly copied to generic folders or lacking ID3 genre tags are left with `IS_MUSIC == 0` or null until an external player updates them.
3. Therefore, tapping reload in Audiflow repeatedly queried the stale `MediaStore` index, returning 0 new tracks until the user opened another player that triggered `MediaScannerConnection`.

## Research Questions & Decisions

### Decision 1: How to trigger Android MediaStore indexing for new files
- **Decision**: Use `android.media.MediaScannerConnection.scanFile(...)` across standard audio directories (`Music`, `Download`, and available secondary/OTG external storage volumes).
- **Rationale**:
  - `MediaScannerConnection.scanFile` is the official, battery-efficient, scoped-storage-compliant Android API since API 8.
  - It handles metadata extraction (ID3 tags, Vorbis comments, FLAC headers), artwork association, duration calculation, and `MediaStore` row creation natively.
  - It runs via the Android system media daemon (`android.process.media`), ensuring consistency with system media services.
- **Alternatives Considered**:
  - *Direct filesystem scan in Rust only*: On Android 10+ (scoped storage), raw filesystem reads across `/storage/emulated/0` are heavily restricted or can produce unplayable URIs. Bypassing `MediaStore` violates Constitution Principle VI ("Android scoped-storage constraints must be respected").
  - *Broadcasting `Intent.ACTION_MEDIA_SCANNER_SCAN_FILE`*: Deprecated in modern Android versions for directories; `MediaScannerConnection.scanFile` is the supported standard.

### Decision 2: Directory Crawling & File Filtering Scope
- **Decision**: Perform a shallow-to-medium depth file walk (up to 4 directory levels deep) scanning for supported audio extensions (`.mp3`, `.m4a`, `.aac`, `.flac`, `.wav`, `.ogg`, `.opus`) in:
  1. `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC)`
  2. `Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)`
  3. Context external storage directories (`context.getExternalFilesDirs(null)` parent volumes) to discover OTG USB drives and SD cards (`/storage/XXXX-XXXX/`).
- **Rationale**:
  - Restricting the walk to known music/download directories and external mount roots avoids traversing irrelevant system or app-private caches (e.g. `Android/data`).
  - Checking file extensions before submitting to `MediaScannerConnection` avoids saturating the system scanner with non-audio files.
- **Alternatives Considered**:
  - *Scanning entire `/storage/emulated/0/` root*: Too slow and incurs unnecessary battery and disk I/O cost when scanning hundreds of thousands of unrelated files.

### Decision 3: Query Filter Resiliency (`IS_MUSIC` OEM Workaround)
- **Decision**: Broaden the query selection in `MediaStoreManager`:
  ```kotlin
  val selection = "(${MediaStore.Audio.Media.IS_MUSIC} != 0 OR ${MediaStore.Audio.Media.MIME_TYPE} LIKE 'audio/%') AND ${MediaStore.Audio.Media.SIZE} > 0"
  ```
- **Rationale**:
  - Guarantees that audio files copied via flash drive that lack complete genre metadata or where OEM scanners leave `IS_MUSIC = 0` are not skipped.
  - Filtering by `SIZE > 0` and non-null audio MIME type ensures corrupted or empty 0-byte placeholders are excluded.
- **Alternatives Considered**:
  - *Leaving `${MediaStore.Audio.Media.IS_MUSIC} != 0`*: Causes dropped tracks on certain OEM ROMs when files are placed in Downloads or OTG roots.

### Decision 4: Concurrency & Synchronization
- **Decision**: Trigger the media scan asynchronously with a `CountDownLatch` or batch latching (capped at 2500ms timeout) during a manual rescan, followed immediately by the `MediaStore` query.
- **Rationale**:
  - `MediaScannerConnection.scanFile` operates asynchronously with a completion callback (`OnScanCompletedListener`).
  - For typical batches (e.g., 50–200 tracks), scanning finishes in 200–500ms.
  - A 2.5-second safety timeout ensures that if the system media daemon is slow, the query still executes without locking the app.
  - Background execution on Rust's `spawn_blocking` pool keeps the UI thread and audio playback completely smooth.

### Decision 5: Architecture & Modular Design (SRP & 300-Line Ceiling)
- **Decision**: Implement the directory scanning and `MediaScannerConnection` synchronization in a dedicated Kotlin class: `MediaScanSynchronizer.kt`.
- **Rationale**:
  - Adheres strictly to Constitution Principle VIII (Single Responsibility Principle & 300-line ceiling).
  - Keeps `MediaStoreManager.kt` (currently 221 lines) from expanding over the 300-line ceiling.
  - `MediaStoreManager` delegates rescan/indexing requests to `MediaScanSynchronizer`.
