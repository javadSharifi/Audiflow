# Architecture & Design Decisions

This file records durable decisions that future agents may otherwise accidentally reverse.

Use it for:
- architecture choices;
- dependency/library choices;
- state-management boundaries;
- important design patterns;
- durable trade-offs that future agents should preserve.

Do not use it for:
- routine bug fixes;
- temporary task choices;
- every small refactor;
- implementation details that are obvious from the code.

## Decision format

```markdown
## YYYY-MM-DD — <decision title>

**Decision:** <what was chosen>

**Why:** <short rationale>

**Alternatives considered:** <optional>

**Implication:** <what future agents should preserve or know>
```

## 2026-09-24 — Code Health & Circular Dependency Elimination (spec 020)

**Decision:**
1. Eliminated circular imports in frontend stores:
   - Extracted shared slice types to `src/stores/slices/types.ts` so `fileSlice.ts` and `queueSlice.ts` no longer circularly import each other.
   - Decoupled `src/stores/musicPlayer/audioEngine.ts` from importing `useMusicPlayerStore.ts` by using `StoreApi<MusicPlayerState>`.
   - Removed redundant re-export `export * from "./musicPlayer/selectors"` in `useMusicPlayerStore.ts`.
   - Verified 0 circular dependencies with `madge --circular src/`.
2. Decoupled Android Kotlin bridge:
   - Inverted dependency between `PlaybackService.kt` and `MainActivity.kt` using `PlaybackEventListener` callbacks instead of direct static invocations.
   - Introduced `PlaybackCallbackContracts.kt`.
3. Characterization test coverage:
   - Added `commands_characterization.rs` and `queue_characterization.rs` covering pure settings, queue records, and command structures.
   - Added `dictionaryParity.test.ts` verifying `en.ts` and `fa.ts` dictionary alignment.
   - Added `types.test.ts` verifying frontend contracts.
4. Decomposed complex methods:
   - Extracted `resolve_sample_rate` and `resolve_boost_filter` in `pipeline.rs`.
   - Extracted `isDirectPlayableProtocol` in `audioSource.ts`.

**Why:** Addresses structural debt and untested hotspots flagged by Repowise code health pass without introducing any behavioral regressions.

**Implication:** All 436 Vitest tests, 141 Rust unit/lib tests, and Specta type generation gates remain 100% passing.

## 2026-09-24 — Android Architecture Refactoring (Phase 5)

**Decision:**
Decomposed the monolithic `MainActivity.kt` (~1496 lines) and `PlaybackService.kt` (~1119 lines) into focused, single-responsibility components under `src-tauri/android/`:
1. `MediaUriStager`: Handles content:// and file:// URI lazy staging to `cacheDir/staged_inputs/` and fast metadata inspection (`statUri`).
2. `MediaStoreManager`: Handles MediaStore queries, output publishing to `Music/Audiflow`, and audio track deletion.
3. `ArtworkManager`: Handles embedded picture extraction (`MediaMetadataRetriever`) and cache storage under `cacheDir/artworks/`.
4. `RingtoneHelper`: Handles system default ringtone assignment and WRITE_SETTINGS permissions.
5. `ShareHelper`: Stages and serves audio files to Android system share sheet via FileProvider.
6. `AppPermissionManager`: Encapsulates runtime media, video, and notification permission requests and checks.
7. `MediaItemBuilder`: Translates track JSON definitions into Media3 `MediaItem` instances and converts `MediaItem` back to JSON.
8. `PlaybackNotificationHelper`: Manages notification channels, placeholder notifications, and closeable notification providers for Media3.
`MainActivity.kt` is reduced from 1496 lines to 650 lines (an orchestration & bridge shell) and `PlaybackService.kt` from 1119 lines to 747 lines. All companion static bridge methods on `MainActivity` and `PlaybackService` remain intact with 100% IPC compatibility.

**Why:** Reduce coupling, simplify future Android maintenance, maintain zero behavioral regressions, preserve Media3 background playback, and honor the single-active-audio-stream architecture.

**Implication:** Future Android enhancements should modify or add to the relevant dedicated manager instead of growing `MainActivity.kt`.

## 2026-09-24 — Rust Commands & Queue Modularization (Phase 4)

**Decision:**
1. Split the monolithic ~1185-line `src-tauri/src/commands/mod.rs` into 7 focused domain submodules:
   - `android`: Android staging, permissions, app settings, cold-start file queue, and exit handlers.
   - `audio`: Probe files metadata inspection, waveform peak analysis, volume detection, and A/B boost preview.
   - `library`: Music library scan triggers, cache stats, track deletion/ringtone/share, and path/artwork resolution.
   - `player`: Android Media3 player controls and stream volume management (19 IPC commands).
   - `queue`: Conversion and sound boost enqueueing, job cancellation, and queue snapshot/clear.
   - `system`: Free disk space queries (`disk_free`), settings load/save, and frontend logger bridge.
   - `transcribe`: Gemini API key keychain management, transcription jobs, queue inspection, and export.
   All command functions are re-exported in `commands/mod.rs` (`pub use ...`) to preserve zero IPC breaking changes.
2. Refactored `src-tauri/src/queue/`:
   - Extracted job definitions to `queue/job.rs` (`JobRecord`, `JobKind`, `QueuedJob`, `BatchJobItem`).
   - Extracted worker loop and binary resolution to `queue/worker.rs`.
   - Replaced duplicated job creation and cancellation loops in `QueueManager::enqueue` and `QueueManager::enqueue_boost` with a unified `enqueue_batch` method in `queue/mod.rs`.
3. Enforced <= 300 lines ceiling across all Rust files in `commands/` and `queue/`.

**Why:** Maintain architectural cleanliness, adhere strictly to the project-wide 300-line limit per file, eliminate repetitive job setup code, and enable isolated testing without mutating any frontend-backend contract.

**Implication:** Future backend commands should be added to their respective domain module under `src-tauri/src/commands/` rather than expanding a single monolithic file.

## 2026-09-23 — Unified audio path resolution and context-aware drag-and-drop playback (spec 019)

**Decision:** (1) Desktop drag-and-drop routing is context-aware via `useAppDragDrop`: dropping onto the Music Player tab triggers immediate playback of dropped audio files and folders, while dropping onto the Converter tab routes to converter batching without player interruption. (2) All audio path resolution (files, folders, recursive traversal, MIME/extension filtering) funnels through a single typed Rust command `resolve_audio_paths` (`music_library::resolver.rs`), keeping track ordering natural (alphanumeric) and execution fast (<50ms). (3) Visual drop feedback is rendered via `PlayerDropOverlay` when dragging over the window in player mode. (4) Linux desktop packaging entry in `packaging/arch/PKGBUILD` includes `%U` and audio MIME types so OS file managers pass paths directly to Audiflow.

**Why:** Addresses OS-level "Open with" context menu and file-manager drag & drop playback across macOS, Windows, and Linux without breaking conversion workflows or violating the 300-line ceiling in `App.tsx` and `music_library/mod.rs`.

**Implication:** Future agents extending file ingestion or OS open handlers must route paths through `resolve_audio_paths` and use `useAppDragDrop` rather than direct unvalidated file drops.

## 2026-09-23 — Mac add-folder flow uses batched store action (spec 018)

**Decision:** The user-picked folder flow goes through `useMusicPlayerStore.addCustomFolders(paths)` — a batched variant that dedupes, persists once via `persistCustomFolders`, and triggers exactly one `scanLibrary` — not the per-folder `addCustomFolder` loop. Pick outcomes are classified in `useAddFolderPick` and surfaced via `useAppStore.pushToast` (one toast max per pick; cancel and all-duplicate picks are silent). The button renders only when `isMacOS()`.

**Why:** Per-folder `addCustomFolder` persists and rescans for every folder (N× full disk walks), breaking SC-001 for multi-pick. One toast per pick (never per folder) was locked with the user during /speckit.clarify. mac-only render honors the platform-access rationale (picker grants access; other platforms need no entry point).

**Implication:** Future agents adding pick-based library expansion must reuse `addCustomFolders` (or the existing FirstRunFoldersGate batch pattern) — never call `addCustomFolder` per picked path. Non-macOS users must stay structurally untouched (FR-002).

## 2026-09-21 — 100% Rebrand to Audiflow / com.audiflow.app

**Decision:** Complete migration of technical identifiers to Audiflow:
- Android package / namespace / applicationId migrated from `com.audioconverter.app` to `com.audiflow.app`.
- JNI function and class references migrated to `Java_com_audiflow_app_MainActivity_initNativePaths` and `com/audiflow/app/MainActivity`.
- Output MediaStore collection changed to `Music/Audiflow`.
- Package, binary, crate, and lib names unified to `audiflow`.
- Release bundles and artifact filenames updated to `Audiflow-*`.
- Update repository target updated to `javadSharifi/audiflow`.

**Why:** User requested a 100% deep technical rebrand so no old internal identifiers remain.

**Implication:** Any Android devices with the previous APK must perform a fresh install rather than in-place update due to the applicationId change.

## 2026-09-21 — Android release signing anchored to local project secrets

**Decision:** The persistent Android release signing keystore is stored locally at `secrets/release.keystore` (ignored by git alongside `secrets/`, `*.keystore`, `.env.android`). `scripts/build-android-local.sh` resolves `secrets/release.keystore` by default, falls back to `~/.android/release.keystore`, and handles relative paths. A template `.env.android.example` provides explicit override documentation.

**Why:** Avoids losing the signing certificate across machines/OS reinstalls, prevents Play Protect and Android OS signature mismatch upgrade failures, and guarantees identical signing parameters between local builds and CI (via `ANDROID_KEYSTORE_BASE64`).

**Implication:** Never delete or commit `secrets/release.keystore`. Any future APK build distributed to users must share this certificate fingerprint (`SHA256: 53:12:96:8C:39:52:FA:B2:27:FF:E6:C2:3A:8A:B6:B9:9B:5D:2D:3C:7D:CE:E6:FF:D0:D1:4D:A1:1A:1E:CF:DE`).

## 2026-09-19 — Transcribe Studio frontend removed (Gemini unusable in Iran)

**Decision:** Deleted `src/features/transcribe/` (15 files) + its `tauri.ts` facade (`GeminiApiError`, `geminiKindOf`, key/queue/usage/transcript wrappers) + orphaned `types/index.ts` re-exports (`Transcription*`, `TranscribeSettings`, `UsageStats`, `ObservedQuota`, `WordInfo`, `GeminiErrorKind`, `BoosterJobSpec`, `TranscriptionEvent`). Rust backend (`processing/transcribe/`, `transcribe_queue.rs`, `secrets.rs`), `generated.ts` mirrors, and `i18n` transcribe keys intentionally kept.

**Why:** Gemini cloud transcription has no practical use for Iran-based users right now; the UI was unreachable from `App` anyway.

**Alternatives considered:** Keeping the hidden tree (rejected — dead code rots; restore is one `git show` away).

**Implication:** Restore via git history (`git log --all --oneline -- src/features/transcribe`) if re-enabled; re-add the `tauri.ts` facade + type re-exports from the same commit. Do not reintroduce piecemeal.

## 2026-09-19 — playingKey selector pattern + whole-second store clock for library perf

**Decision:** (1) `useMusicPlayerStore` carries a derived `playingKey: string` (`track.id || uri || path`, `""` when idle) maintained alongside every `currentTrack` mutation; row/card components subscribe to `playingKey` + per-row boolean selectors (`isLiked`, `isSelected`) instead of whole Sets or the `currentTrack` object. (2) All `currentTime` store writes are quantized to whole seconds (`Math.floor` deltas) in `audioEngine.ts` (`timeupdate`, smooth ticker, native poll adoption). (3) Artwork cache: LRU 500 in memory + bounded localStorage manifest (`player-artwork-manifest-v1`, 1500) with negative caching; desktop disk cache lives in the OS cache dir (`directories` crate), not temp.

**Why:** Tab switches re-rendered every visible row on any like/seek/rescan (whole-Set/currentTrack subscriptions) and covers were re-extracted per session (temp purge) and per tab revisit (LRU-100). Whole-second writes match what the UI actually renders (MM:SS).

**Alternatives considered:** TanStack Query-style server cache (rejected — no server; local-first); context-splitting the store (heavier than derived-key pattern); TTL auto-refresh (rejected — launch/foreground scan + explicit rescan suffice).

**Amended 2026-09-19 (research-driven, Namida/Android-guidance):** Covers are extracted as 256×256 thumbnails (never source resolution — Namida's full-size cache hit 2 GB on user libraries); legacy >512KB cache files are lazily re-extracted downscaled. After each scan, `scheduleArtworkPrefetch` warms covers for the first ~50 tracks during browser idle time (deduped per track ref, skips cached). Non-first-paint views (`NowPlayingView`, `BoosterView`, permission/first-run gates) are `React.lazy` chunks — initial bundle −39 kB (594.8 → 555.8 kB). Rescans are incremental via a durable scan memo (`scan_memo.v1.json`, keyed by path+size+mtime): unchanged files reuse the previous record verbatim; deletions eject immediately; `scan_result_cache_stats` IPC exposes walk-vs-reuse stats. Boot phases are benchmarked via `utils/bootPerf.ts` (marks at module/splash/settings/permission/scan) so future cold-start tuning measures before it cuts.

## 2026-09-16 — Circular theme reveal via View Transitions API

**Decision:** Light/Dark switching animates as a ~300ms `clip-path: circle()` expanding
from the toggle click point (`document.startViewTransition` + `src/utils/themeTransition.ts`);
instant fallback where the API is missing; no `prefers-reduced-motion` opt-out (explicit user choice).

**Why:** GPU-cheap single-property animation with minimal lag feel on mobile; store stays
source of truth while `applyResolvedTheme` paints synchronously for snapshot capture.

**Alternatives considered:** Custom overlay-div circle (heavier, rejected); fade fallback (rejected for lag).

**Implication:** Keep reveal logic in `themeTransition.ts`; both `HeaderBar` toggles must stay
wrapped. Reconsider the reduced-motion opt-out if a11y requirements tighten.

## 2026-09-19 — Unified First-Run Onboarding with Silent Grandfathering and Settings Simplification

**Decision:**
1. A unified single-page `OnboardingGate` replaces legacy fragmented gates (`FirstRunFoldersGate`, `PermissionGate`) during first launch.
2. Silent grandfathering: Existing users with evidence of prior use (`ac:ui-prefs`, `ac:reduced-blur`, or cached tracks) never see the onboarding screen on upgrade (`checkAndGrandfatherFirstRun()`).
3. Single confirm and single global skip buttons; safe defaults on skip (fa, system theme, mobile reducedBlur=true/desktop false).
4. `autoOpenOutputFolder` removed from Settings UI and coerced to `false` on settings load with self-healing persistence; `queue-idle` auto-open listener removed.
5. HeaderBar settings dialog removes theme switcher (quick toggle remains in header) and auto-open row.

**Why:**
Multiple intrusive modal gates on app startup harmed UX. Consolidating into a single, skippable start page allows users to set essentials (permissions, theme, language, performance) at once with immediate live preview. Existing users should not be disrupted upon app update. Removing unused `autoOpenOutputFolder` eliminates unwanted OS file manager popups.

**Implication:**
`ac:first-run-done` is written only via user confirm/skip or silent grandfathering. Future preferences should not add ad-hoc launch blocking modals.

## 2026-09-22 — Free macOS distribution via install zip (no paid notarization)

**Decision:** macOS releases ship `Audiflow_*_macos-arm64-install.zip` (DMG + `scripts/install-mac.sh` + `packaging/macos/README.txt` side by side, built in `release.yml`); users run `bash install-mac.sh` from the unzipped folder — no paths needed (auto-finds `./Audiflow*.dmg` beside itself, then Downloads/Desktop).

**Why:** No paid Apple Developer notarization ($99/yr); ad-hoc DMG alone triggers Gatekeeper "damaged" error.

**Implication:** Keep the zip step in `release.yml` and the macOS notes in both READMEs in sync; if a paid cert is ever added, remove the workaround.

## 2026-09-22 — Debian rename transition: audiflow Conflicts/Replaces audio-converter

**Decision:** `bundle.linux.deb` in `tauri.conf.json` declares `conflicts: ["audio-converter"]` + `replaces: ["audio-converter"]` (key names verified against the official Tauri v2 `DebConfig` reference).

**Why:** The 2026-09-21 rebrand renamed the deb package, but machines with the legacy `audio-converter` .deb still own `/usr/bin/ffprobe` + `/usr/bin/ffmpeg`, so dpkg aborts the new install with an overwrite error. The Conflicts/Replaces pair is the standard Debian rename-transition mechanism: apt removes the legacy package while installing the new one.

**Implication:** Keep these entries until the legacy package is long extinct; do not drop them in a cleanup without checking install-base impact. Complement to the 2026-09-21 rebrand entry above.

When a later decision supersedes an earlier one, preserve the historical entry and add a short note such as:

`Superseded by: <date/title>`

## 2026-09-22 — Linux desktop audio served via fetch→blob, not raw asset://

**Decision:** On desktop Linux only (`isLinux()`), `resolveAudioSource` fetches the `asset://` audio bytes and hands the `<audio>` element a `blob:` URL (`musicPlayer/linuxAssetAudio.ts`); macOS/Windows/Android paths are untouched. One blob URL is live at a time (revoked on next resolve/stop); fetch failure falls back to the asset URL so the existing skip+notice path behaves as before.

**Why:** WebKitGTK's GStreamer media backend cannot load media from custom URI schemes (upstream WebKit bug 146351, still present in 2.52.x): every track stalled at readyState 0 — 0:00, no play, no error, all formats — while GStreamer itself (gst-play) and system audio were fine. `fetch()` reads the same custom scheme without issue and the media backend accepts `blob:` URLs; this is the workaround other Tauri projects use.

**Implication:** Whole file bytes sit in RAM during Linux playback (acceptable for songs; revisit via MediaSource/chunked serving if multi-100MB files become a problem). If upstream WebKit ever fixes 146351, this module can be retired behind the same `isLinux()` gate.

## 2026-09-22 — Linux hardening batch (deb deps, scoped preview blobs, desktop integration)

**Decision:** (1) `.deb` declares explicit `depends` (webkit 4.1 + gtk3 + GStreamer base/good/bad/ugly/libav) — verified against `tauri-bundler` `debian.rs` that `Depends:` is written verbatim from config, so the list must be complete. (2) Preview/audition elements (trim, booster A/B, ringtone) use owned `resolveScopedBlobAudioSrc` handles, never the player singleton — resolving a preview must not revoke a playing background track. (3) In-app updater prefers `.deb` on Linux; READMEs recommend `.deb` (AppImage needs `libfuse2`, gone on Ubuntu 24.04+). (4) `WEBKIT_DISABLE_DMABUF_RENDERER=1` is set at startup only on NVIDIA hardware when the user hasn't set it (tauri#9394). (5) Converter ingest normalizes `file://` (%U, pickers, drops) to plain paths with a dependency-free `%XX` decoder. (6) `fileAssociations` uses concrete freedesktop MIME lists, not `audio/*`.

**Why:** Audit of every Linux-only failure mode after the WebKit-146351 playback fix: codec-less minimal installs, three preview paths with the same stall, wrong updater artifact, portal-less pickers (fail-soft), NVIDIA/Wayland blank window, Secret-Service-less keychain (actionable hint), `%U` URIs dying inside ffmpeg jobs, invalid wildcard MIME types.

**Implication:** The explicit `depends` list must be maintained — adding a system library linkage without updating it re-creates the "installs fine, crashes at runtime" class. Large-file RAM (whole-file fetch→blob) intentionally left as documented: MSE/chunked serving needs real Linux verification before touching core playback.

## 2026-09-23 — Arch package in release automation (containerized makepkg on Ubuntu runner)

**Decision:** The `linux-x64` matrix job in `release.yml` produces the Arch artifact right after the Tauri build: `docker run archlinux:base` mounts the workspace, installs base-devel/rust/nodejs/pnpm/jq + webkit2gtk-4.1/gtk3/gst plugin sets, then runs `./scripts/package-arch.sh --skip-build` as a non-root `builder` user (makepkg refuses root) consuming the job's own ELF + sidecars. The runner is ubuntu-22.04, NOT Arch — the container is deliberate; sequential-in-job beats a separate needs:-job because the build output is local. Upload path adds `packaging/arch/*.pkg.tar.zst`; release collect adds `*.pkg.tar.zst`. Artifact name = orchestrator's `audiflow-<ver>-1-x86_64.pkg.tar.zst` (no CI rename).

**Why:** extends the existing local packaging flow to releases with zero new jobs; PKGBUILD consumes prebuilt output (research R1), no in-container rebuild.

**Implication:** PKGBUILD source paths use makepkg-canonical `$startdir/../..` (repo root) — `$srcdir` location varies with BUILDIR and must not be used for repo paths. `license=()` remains unset (no LICENSE choice yet; makepkg warns). Container adds ~1–2 min (pacman install) to linux-x64.

## 2026-09-24 — Android test foundation: JUnit4 + Mockito without Robolectric

**Decision:** Phase 6 Android test foundation uses plain JUnit4 with `org.mockito:mockito-core:5.11.0` to stub `Context.cacheDir`. Robolectric was evaluated and rejected.

**Why:** The logic extracted in Phase 5 is grouped into three testability tiers:
1. Pure Kotlin (no Android dependency): `mimeFor`, `safeName` regex, dedup naming, `safeCoverUrl`, URI/mediaId fallbacks — testable with plain JUnit4, zero extra deps.
2. I/O logic using only `Context.cacheDir`: `artworkCacheFileFor`, `cleanupStagingDirectory` — Mockito stubs the single `Context` method; no Android runtime needed.
3. ContentResolver/Media3 methods: `statUri`, `resolveUriToLocalPath`, `mediaItemToTrackJson`, `buildMediaItem` — excluded from unit tests (require instrumentation or real Android runtime); Robolectric would add ~40 MB of deps to test these, which is disproportionate for methods that primarily coordinate I/O.

`android { testOptions { unitTests { isReturnDefaultValues = true } } }` is set in `build.gradle.kts` to prevent android.jar stubs from throwing during JVM unit test class loading.

**Alternatives considered:** Robolectric (rejected — large dependency for minimal gain on the targeted methods), FakeContext abstract stub (rejected — requires implementing all of Context's abstract methods).

**Implication:** 51 Android unit tests run via `./gradlew :app:testArmDebugUnitTest -x rustBuildArmDebug`. Methods depending on ContentResolver/MediaStore remain untested at unit level; instrumentation tests would be the correct venue if device-level coverage is needed in future.

## 2026-09-24 — delete_audio_track: audio-extension defensive guard

**Decision:** Added extension-based validation to `delete_audio_track` in `src-tauri/src/music_library/mod.rs`. The command now rejects any path whose file extension is not in the canonical `AUDIO_EXTENSIONS` set (the same list used by the scanner: `mp3 m4a flac wav aac ogg opus wma aiff alac weba`).

**Threat model:** Audiflow is a local-only application with no remote HTTP server. The realistic threat is not remote exploitation but defensive hardening against:
1. Logic bugs in frontend code accidentally sending wrong file paths
2. XSS in the embedded WebView reaching the IPC layer (Tauri's WebKit sandbox limits this, but defence-in-depth is appropriate)

The validation fires before any `fs::remove_file` call. `content://` Android URIs are unchanged (MediaStore-scoped by the OS). The guard is case-insensitive (`to_ascii_lowercase`).

**What is NOT restricted:** The command deliberately does NOT restrict which directory audio may live in. External drives, Downloads, custom folders, and any user-accessible path are all fine — only the file extension is validated. This preserves all legitimate library use cases.

**ffmpeg_path_override:** Not touched. A local user choosing an executable does not constitute privilege escalation. The previous audit's rejection of this "finding" stands.

**CSP / assetProtocol:** Not touched. `scope: ["**"]` is necessary for audio on arbitrary local paths (external drives, etc.). No safe narrowing was identified. Documented separately in this entry rather than forced into code changes.

**Alternatives considered:** Directory allowlist (rejected — breaks external drives and custom folders), symlink canonicalization (rejected — breaks some valid external-drive paths on macOS), no validation (status quo — insufficient defence in depth).

**Implication:** 20 new Rust unit tests cover the guard (valid audio, non-audio, no extension, file:// URI, percent-encoded URI, nonexistent path, path traversal, uppercase extension). Total Rust tests: 141 lib + 9 e2e = 150.
