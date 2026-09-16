#!/usr/bin/env python3
"""Generate PROJECT_GRAPH.md + .agents/references/*.md deterministically.

Portable: repo root is derived from this script's location, so the whole project
(including this file) can be copied/cloned anywhere and regenerated with:
    python3 .agents/gen_graph.py
Summaries in S{} and the CRITICAL list are project-specific; scope/collapse rules
mirror `.agents/project-graph.md` Step 2b.
"""
import subprocess, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REFDIR = os.path.join(ROOT, ".agents/references")
os.makedirs(REFDIR, exist_ok=True)

out = subprocess.run(["git", "ls-files", "-s"], cwd=ROOT, capture_output=True, text=True, check=True)
hashmap = {}
for line in out.stdout.splitlines():
    # format: <mode> <hash> <stage>\t<path>
    parts = line.split()
    h = parts[1]
    path = line.split("\t", 1)[1]
    hashmap[path] = h
print(f"files: {len(hashmap)}")

S = {
# frontend-converter
"src/App.tsx": "Root shell composing converter/player views, boot gate, drag-drop + Android back; exports `App`, `StartBar`; deps stores, `api`, `openWith`.",
"src/main.tsx": "React StrictMode entry + mobile pinch/ctrl-zoom guards; mounts `App`; deps `App`, `index.css`.",
"src/components/DropZone.tsx": "Click/drag file-ingest card with probing state; exports `DropZone`; deps `useAppStore`, `pickVideos`.",
"src/components/FileList.tsx": "Converter file table with trim/boost expanders + badges; exports `FileList`; deps `TrimEditor`, `FileBoosterInline`, `format`.",
"src/components/HeaderBar.tsx": "Top brand/tool-switch bar with theme/lang + settings; exports `HeaderBar`; deps `useAppStore`, `getVersion`.",
"src/components/JobsPanel.tsx": "Conversion queue list with progress/cancel + tech details; exports `JobsPanel`; deps `useAppStore`, `translate`.",
"src/components/ModernSlider.tsx": "Reusable styled range slider; exports `ModernSlider`, `ModernSliderProps`; React only.",
"src/components/OptionsPanel.tsx": "Output format/quality/split/silence/folder form + estimates; exports `OptionsPanel`; deps stores, `estimate`/`format`.",
"src/components/Toasts.tsx": "Auto-dismiss toast stack; exports `Toasts`; deps `useAppStore` toasts.",
"src/components/TrimEditor.tsx": "Canvas waveform trim editor with audio audition/scrub; exports `TrimEditor`; deps `api.waveformPeaks`, `format`.",
"src/components/__tests__/FileList.test.tsx": "Vitest for converter file list rendering/actions.",
"src/components/__tests__/HeaderBar.test.tsx": "Vitest for header bar theme/lang/tool switching.",
"src/stores/useAppStore.ts": "Combined Zustand converter store; exports `useAppStore`, `statusLabelKey`; deps 4 slices.",
"src/stores/slices/fileSlice.ts": "Files/probing + `addPaths`/`removeFile`/`setTrim`; deps `api.statMediaPaths`.",
"src/stores/slices/queueSlice.ts": "Jobs Map + `startQueue`/`cancelJob`/`initEventListeners`; deps Tauri `event`, `api`.",
"src/stores/slices/settingsSlice.ts": "Options/lang/theme/`activeTool` + persistence; deps `api`, `bootPrefs`.",
"src/stores/slices/toastSlice.ts": "Ephemeral toasts with 6s auto-dismiss; exports `createToastSlice`.",
"src/hooks/useTheme.ts": "Theme/direction side-effects for `<html>`; exports `resolveTheme`, `useTheme`, `useDirection`.",
"src/hooks/useNativeDragDrop.ts": "Forwards Tauri webview drop paths; exports `useNativeDragDrop`.",
"src/hooks/useDebouncedDeferred.ts": "Debounce + `useDeferredValue` (0ms in tests); exports `useDebouncedDeferred`.",
"src/__tests__/AndroidBack.test.tsx": "Vitest for Android hardware-back cooperation flow.",
# frontend-player
"src/stores/useMusicPlayerStore.ts": "Library/playback store bridging desktop/Android audio; exports `useMusicPlayerStore`; deps `audioEngine`, `persistence`, `trackUtils`.",
"src/stores/musicPlayer/audioEngine.ts": "Unified desktop HTMLAudio+WebAudio-gain / Android native bridge; exports `bindMusicStore`, `unified*`.",
"src/stores/musicPlayer/persistence.ts": "localStorage liked/folders/sort/albums/tracks-cache; exports `load*/persist*`.",
"src/stores/musicPlayer/trackUtils.ts": "Track key/liked/filter-sort helpers; exports `getTrackKey`, `filterAndSortTracks`.",
"src/stores/musicPlayer/__tests__/audioEngine.test.ts": "Vitest for unified audio engine play/pause/seek.",
"src/stores/musicPlayer/__tests__/shareTrack.test.ts": "Vitest for track share/export helpers.",
"src/components/music-player/MusicPlayerView.tsx": "Tab container with `KeepAlivePane`s + Android-back; exports `MusicPlayerView`.",
"src/components/music-player/MusicPlayerNav.tsx": "Floating dock nav songs/album/like/boost/converter; exports `MusicPlayerNav`, `PlayerTab`.",
"src/components/music-player/TrackListView.tsx": "Searchable/sortable virtualized track list + scan/permission; exports `TrackListView`.",
"src/components/music-player/TrackRow.tsx": "Memoized track row with play/like/select + sheet; exports `TrackRow`.",
"src/components/music-player/NowPlayingView.tsx": "Fullscreen player with waveform/speed/boost/queue; exports `NowPlayingView`.",
"src/components/music-player/MiniPlayer.tsx": "Collapsed player with seekbar + controls; exports `MiniPlayer`.",
"src/components/music-player/AlbumsView.tsx": "Album search/grid + create/rename/delete; exports `AlbumsView`.",
"src/components/music-player/AlbumDetailView.tsx": "Album header + track list with rename/delete/play; exports `AlbumDetailView`.",
"src/components/music-player/AlbumCard.tsx": "Album tile with cover/play/menu; exports `AlbumCard`.",
"src/components/music-player/AlbumGridVirtualized.tsx": "Virtualized album grid (TanStack) + create card; exports `AlbumGridVirtualized`.",
"src/components/music-player/LikedView.tsx": "Liked-only wrapper around `TrackListView`; exports `LikedView`.",
"src/components/music-player/SongsView.tsx": "All-songs wrapper around `TrackListView`; exports `SongsView`.",
"src/components/music-player/BoosterView.tsx": "System volume-gain dial with >200% confirm; exports `BoosterView`.",
"src/components/music-player/TrackCover.tsx": "Artwork cover with gradient fallback + lazy extract; exports `TrackCover`.",
"src/components/music-player/TrackDetailsModal.tsx": "Track metadata modal with copy-path/open-folder; exports `TrackDetailsModal`.",
"src/components/music-player/TrackOptionsSheet.tsx": "Track action sheet (like/share/ringtone/album/delete); exports `TrackOptionsSheet`.",
"src/components/music-player/TrackSortDropdown.tsx": "Sort dropdown newest/oldest/liked/title; exports `TrackSortDropdown`.",
"src/components/music-player/WaveformSeekbar.tsx": "Seeded pseudo-waveform seekbar with drag/seek; exports `WaveformSeekbar`.",
"src/components/music-player/TrackListBanners.tsx": "Permission/notification warning banners; exports `TrackListBanners`.",
"src/components/music-player/KeepAlivePane.tsx": "Keep-alive tab wrapper preserving DOM/scroll; exports `KeepAlivePane`.",
"src/components/music-player/MultiSelectActionBar.tsx": "Bulk bar select-all/like/album/convert/delete; exports `MultiSelectActionBar`.",
"src/components/music-player/PermissionGate.tsx": "Fullscreen Android media-permission gate; exports `PermissionGate`.",
"src/components/music-player/FirstRunFoldersGate.tsx": "First-run folder picker persisting scan roots; exports `FirstRunFoldersGate`.",
"src/components/music-player/SetRingtoneModal.tsx": "Ringtone trimmer with canvas waveform; exports `SetRingtoneModal`.",
"src/components/music-player/AddToAlbumModal.tsx": "Add tracks to custom albums + create; exports `AddToAlbumModal`.",
"src/components/music-player/ConvertSongIcon.tsx": "Stroke waveform converter icon; exports `ConvertSongIcon`.",
"src/components/music-player/useTrackVirtualizer.ts": "TanStack virtualizer wrapper with jsdom fallback; exports `useTrackVirtualizer`.",
# frontend-features
"src/features/sound-booster/shared/boosterTypes.ts": "Preset catalog + file-booster state types; exports `BOOSTER_PRESETS`, `FileBoosterState`.",
"src/features/sound-booster/stores/useFileBoosterStore.ts": "Zustand file/preset/preview/export state; exports `useFileBoosterStore`.",
"src/features/sound-booster/stores/__tests__/useFileBoosterStore.test.ts": "Vitest for booster store defaults/reset.",
"src/features/sound-booster/file-booster/FileBoosterPage.tsx": "Full file-booster page picker/presets/preview/export; exports `FileBoosterPage`.",
"src/features/sound-booster/file-booster/FileBoosterInline.tsx": "Per-converter-file inline booster; exports `FileBoosterInline`.",
"src/features/sound-booster/file-booster/ABPreview.tsx": "Original/boosted A/B player + visualizer; exports `ABPreview`.",
"src/features/sound-booster/file-booster/PresetSelector.tsx": "2x2 preset grid; exports `PresetSelector`.",
"src/features/sound-booster/file-booster/GainSlider.tsx": "Manual gain slider with dB + high-boost flag; exports `GainSlider`.",
"src/features/sound-booster/file-booster/hooks/useFileBooster.ts": "Page hook pick/analyze/preview/export + events; exports `useFileBooster`.",
"src/features/sound-booster/file-booster/__tests__/PresetSelector.test.tsx": "Vitest for preset render + select.",
"src/features/transcribe/TranscribePage.tsx": "Transcribe flow key-gate/options/result/usage; exports `TranscribePage`.",
"src/features/transcribe/TranscribeConsentSheet.tsx": "Upload-consent bottom sheet; exports `TranscribeConsentSheet`.",
"src/features/transcribe/TranscriptResultView.tsx": "Transcript display + copy/export; exports `TranscriptResultView`.",
"src/features/transcribe/UsageDashboard.tsx": "Daily-minutes + quota dashboard; exports `UsageDashboard`.",
"src/features/transcribe/OnboardingCard.tsx": "Gemini API-key onboarding + verify; exports `OnboardingCard`.",
"src/features/transcribe/ErrorBanner.tsx": "Localized Gemini error banner + tech toggle; exports `ErrorBanner`.",
"src/features/transcribe/LanguageSelect.tsx": "Transcription language dropdown; exports `LanguageSelect`.",
"src/features/transcribe/ModeToggle.tsx": "Verbatim/smart segmented control; exports `ModeToggle`.",
"src/features/transcribe/FastModeToggle.tsx": "Fast-mode switch; exports `FastModeToggle`.",
"src/features/transcribe/TimestampToggle.tsx": "Word-timestamps switch; exports `TimestampToggle`.",
"src/features/transcribe/DiarizationToggle.tsx": "Speaker-diarization switch; exports `DiarizationToggle`, `Switch`.",
"src/features/transcribe/CustomVocabularyInput.tsx": "Custom vocab input capped 100 terms; exports `CustomVocabularyInput`.",
"src/features/transcribe/hooks/useTranscribe.ts": "Orchestration key/usage/pick/events/export; exports `useTranscribe`.",
"src/features/transcribe/stores/useTranscribeStore.ts": "Zustand options/job/result/usage; exports `useTranscribeStore`.",
"src/features/transcribe/stores/__tests__/useTranscribeStore.test.ts": "Vitest for fast-mode coupling/vocab cap/reset.",
# frontend-infra
"src/utils/tauri.ts": "SOLE typed IPC facade over `generated.ts`; exports probe/queue/waveform/disk/booster/library/player/transcribe wrappers + `formatAppError`.",
"src/utils/platform.ts": "UA-based OS detection; exports `isAndroid/Mobile/Desktop/...`.",
"src/utils/openWith.ts": "Open-with routing to player/converter; exports `handleIncomingFiles`, `isAudioPath`.",
"src/utils/androidBack.ts": "Cooperative hardware-back flag/event; exports `markBackConsumed`, `ANDROID_BACK_EVENT`.",
"src/utils/artwork.ts": "LRU/deduped throttled cover-art resolver; exports `resolveArtwork`.",
"src/utils/mediaSession.ts": "MediaSession metadata/actions; exports `initMediaSession`, `syncMediaSession`.",
"src/utils/bootPrefs.ts": "localStorage boot lang/theme cache for `index.html`; exports `read/writeBootPrefs`.",
"src/utils/bootPrefs.test.ts": "Vitest for boot prefs read/write.",
"src/utils/estimate.ts": "Bitrate/size estimator mirroring Rust presets; exports `estimateKbps`, `estimateOutputBytes`.",
"src/utils/estimate.test.ts": "Vitest for output-size estimation.",
"src/utils/format.ts": "Duration/timecode/bytes + parse helpers; exports `formatDuration`, `parseDurationInput`.",
"src/utils/format.test.ts": "Vitest for format/parse helpers.",
"src/utils/dialog.ts": "Native media/dir pickers; exports `pickVideos`, `pickDirectories`.",
"src/utils/__tests__/dialog.test.ts": "Vitest for dialog picker wrappers.",
"src/utils/externalUrl.ts": "System-browser opener with fallback; exports `openExternalUrl`.",
"src/utils/__tests__/artwork.test.ts": "Vitest for artwork cache resolver.",
"src/utils/__tests__/mediaSession.test.ts": "Vitest for MediaSession sync.",
"src/utils/__tests__/openWith.test.ts": "Vitest for incoming-file routing.",
"src/i18n/en.ts": "English string dictionary; exports `en`.",
"src/i18n/fa.ts": "Persian RTL dictionary typed to `TranslationKey`; exports `fa`.",
"src/i18n/index.ts": "`translate(lang,key)` with fallback/interpolation; exports `Lang`, `translate`, `isRtl`.",
"src/types/generated.ts": "tauri-specta OUTPUT do-not-edit; ~50 commands + IPC schemas; exports `commands`.",
"src/types/index.ts": "Hand aliases `ConversionOptions`/`TrimSpec`/`FileMeta`/`QueueItem`; exports `isLossy`.",
"src/index.css": "Tailwind v4 entry + IRANSans fonts + theme/utilities.",
# backend-core
"src-tauri/src/lib.rs": "App root: `specta_builder` ~50 commands, setup (settings/queues/open-file), single-instance, kill ffmpeg on exit; exports `run`.",
"src-tauri/src/main.rs": "Binary entry calling `audio_converter::run`.",
"src-tauri/src/commands/mod.rs": "All `#[tauri::command]` handlers 1000+ lines: resolve/stat/probe/start/waveform/cancel/disk/booster/library/player/transcribe; no raw ffmpeg in frontend.",
"src-tauri/src/types.rs": "Shared IPC contracts; `AudioFormat`/`QualityPreset`/`ConversionOptions`/`TrimSpec`/`JobEvent`.",
"src-tauri/src/error.rs": "Error taxonomy; `AppError` + `GeminiErrorKind::i18n_key`.",
"src-tauri/src/settings.rs": "`settings.json` load/save/validate + concurrency clamp 1..32; atomic tmp-rename.",
"src-tauri/src/secrets.rs": "OS keychain Gemini key only; `save/load/delete/require_gemini_api_key`, `mask_key`.",
"src-tauri/src/logger.rs": "File+console logger with 5MB rotation `app.log`.",
"src-tauri/src/disk.rs": "Free-space preflight + size estimate; `free_bytes`, `estimate_output_bytes`.",
"src-tauri/src/android_fs.rs": "Android Content-URI staging + MediaStore publish + JNI bridge; `ensure_local_path`.",
"src-tauri/src/queue/mod.rs": "`QueueManager`: FIFO, per-job options snapshot, CancelToken map, job-event emit, 605 lines.",
"src-tauri/src/transcribe_queue.rs": "`TranscribeQueueManager` mirroring queue lifecycle; emits `transcription-event`.",
"src-tauri/build.rs": "Tauri build hook `tauri_build::build`.",
"src-tauri/examples/export_types.rs": "Specta exporter to `src/types/generated.ts`; run via `generate:types`.",
"src-tauri/tests/e2e.rs": "Live-FFmpeg e2e: generated tone/silence video, trim/silence/unicode asserts; skips without binaries.",
"src-tauri/Cargo.toml": "Rust manifest: tauri2 + specta rc.25 + reqwest/keyring/tokio + jni/wiremock; edition 2021.",
"src-tauri/Cargo.lock": "Pinned Rust dependency tree (generated, commit for reproducible builds).",
"src-tauri/tauri.conf.json": "Audiflow config: dist `../dist`, 1100x760 window, assetProtocol, externalBin ffmpeg/ffprobe, file associations.",
"src-tauri/capabilities/default.json": "Capability for `main` window: core/event/dialog/opener.",
"src-tauri/.cargo/config.toml": "16KB max-page-size linker flags for Android SDK35/NDK-r26+.",
# backend-processing
"src-tauri/src/processing/mod.rs": "Processing module index: naming/pipeline/silence/split/sound_booster/transcribe.",
"src-tauri/src/processing/naming.rs": "Collision-safe `(1)/(2)` naming + sanitize; `unique_path`, `output_directory`.",
"src-tauri/src/processing/pipeline.rs": "Single-pass `filter_complex` builder + `run_job` (probe-plan-ffmpeg-rename); `encoder_args`; one lossy encode max.",
"src-tauri/src/processing/silence.rs": "Silence detect/remove math; `parse_silencedetect`, `kept_ranges`, `total_kept`.",
"src-tauri/src/processing/split.rs": "Split-point math on post-silence timeline; `split_windows`, `parse_duration_input`.",
"src-tauri/src/ffmpeg/mod.rs": "FFmpeg module index + hidden-console helper `create_hidden_command`.",
"src-tauri/src/ffmpeg/locate.rs": "Bundled ffmpeg/ffprobe locator: env override, exe-adjacent/binaries, Android lib*.so.",
"src-tauri/src/ffmpeg/probe.rs": "ffprobe JSON wrapper; `ProbeResult`, `probe_file`, `parse_probe_json`.",
"src-tauri/src/ffmpeg/progress.rs": "`-progress pipe:1` parser; `ProgressSnapshot`, encode floor 15%, 250ms poll.",
"src-tauri/src/ffmpeg/run.rs": "Cancellable child runner; `CancelToken`, `RunSpec::run`.",
"src-tauri/src/ffmpeg/waveform.rs": "Waveform peaks via mono 16kHz decode; `StreamingBucketer`.",
"src-tauri/src/processing/sound_booster/mod.rs": "Booster module index re-exporting analyze/boost/pipeline/presets/preview.",
"src-tauri/src/processing/sound_booster/presets.rs": "6 preset filter chains, every chain ends in `alimiter`; `build_preset_filter_chain`.",
"src-tauri/src/processing/sound_booster/boost.rs": "Booster FFmpeg argv builder; `build_boost_args`.",
"src-tauri/src/processing/sound_booster/analyze.rs": "`volumedetect` gain analysis; `VolumeAnalysis`, `analyze_volume`.",
"src-tauri/src/processing/sound_booster/preview.rs": "10-15s A/B audition clips + peaks; `generate_ab_preview`.",
"src-tauri/src/processing/sound_booster/pipeline.rs": "Offline boost job runner; `run_boost_job`.",
"src-tauri/src/processing/transcribe/mod.rs": "Transcribe orchestration: preprocess/chunk/upload/stitch; `run_transcription` (Rust-side only).",
"src-tauri/src/processing/transcribe/types.rs": "Transcribe contracts/limits; `TranscriptionRequestConfig`, `TranscriptionResult`.",
"src-tauri/src/processing/transcribe/gemini_client.rs": "Gemini Files+generateContent client; upload/transcribe/validate-key.",
"src-tauri/src/processing/transcribe/preprocess.rs": "Mono 16kHz Opus 32k compress + optional atempo 1.5x; `build_preprocess_args`.",
"src-tauri/src/processing/transcribe/stitch.rs": "Chunk merge + export render; `stitch_chunks`, `render_transcript`.",
"src-tauri/src/processing/transcribe/usage_tracker.rs": "Pacific-day local ledger `transcribe_usage.json`; `UsageStats`.",
"src-tauri/src/processing/transcribe/error_classify.rs": "HTTP to `GeminiErrorKind` mapper; `classify_gemini_error`.",
# backend-library
"src-tauri/src/music_library/mod.rs": "Library scan dispatcher; `scan_music_library`, permission status.",
"src-tauri/src/music_library/models.rs": "Library contracts; `AudioTrackInfo`, `LibraryPermissionStatus`.",
"src-tauri/src/music_library/scanner.rs": "Desktop recursive audio scanner; `scan_local_directory`, cover lookup.",
"src-tauri/src/music_library/artwork.rs": "Lazy per-track cover cache (FNV-1a); `get_track_artwork`.",
"src-tauri/src/music_library/platform/mod.rs": "Platform module index.",
"src-tauri/src/music_library/platform/android.rs": "MediaStore via JNI scan/delete; `scan_media_store`.",
"src-tauri/src/music_library/platform/linux.rs": "XDG Music dirs resolver.",
"src-tauri/src/music_library/platform/macos.rs": "Single ~/Music resolver (avoids TCC prompts).",
"src-tauri/src/music_library/platform/windows.rs": "USERPROFILE Music/Downloads/Desktop/Documents resolver.",
}

def domain_of(p: str) -> str:
    if p.startswith("src/App") or p.startswith("src/main.tsx") \
       or p.startswith("src/components/DropZone") or p.startswith("src/components/FileList") \
       or p.startswith("src/components/HeaderBar") or p.startswith("src/components/JobsPanel") \
       or p.startswith("src/components/ModernSlider") or p.startswith("src/components/OptionsPanel") \
       or p.startswith("src/components/Toasts") or p.startswith("src/components/TrimEditor") \
       or p.startswith("src/components/__tests__") or p.startswith("src/stores/useAppStore") \
       or p.startswith("src/stores/slices/") or p.startswith("src/hooks/") \
       or p.startswith("src/__tests__/"):
        return "frontend-converter"
    if p.startswith("src/components/music-player/") or p.startswith("src/stores/useMusicPlayerStore") \
       or p.startswith("src/stores/musicPlayer/"):
        return "frontend-player"
    if p.startswith("src/features/"):
        return "frontend-features"
    if p.startswith("src/utils/") or p.startswith("src/i18n/") or p.startswith("src/types/") \
       or p == "src/index.css":
        return "frontend-infra"
    if p.startswith("src-tauri/src/music_library/"):
        return "backend-library"
    if p.startswith("src-tauri/src/processing/") or p.startswith("src-tauri/src/ffmpeg/"):
        return "backend-processing"
    if p.startswith("src-tauri/src/") or p.startswith("src-tauri/examples/") or p.startswith("src-tauri/tests/") or p in ("src-tauri/Cargo.toml","src-tauri/Cargo.lock",
        "src-tauri/tauri.conf.json","src-tauri/capabilities/default.json",
        "src-tauri/.cargo/config.toml","src-tauri/build.rs"):
        return "backend-core"
    if p.startswith("src-tauri/android/") or p.startswith("src-tauri/gen/") or p.startswith("src-tauri/icons/"):
        return "platform-android"
    return "tooling-docs-assets"

def fallback_summary(p: str) -> str:
    if p.startswith(".agents/skills/"):
        return "UI/UX skill pack data/script (design guidance, not app runtime)."
    if p.startswith(".specify/"):
        return "Spec-kit template/script/constitution asset (workflow support)."
    if p.startswith(".opencode/commands/"):
        return "Speckit slash-command definition for planning workflow."
    if p.startswith("specs/"):
        return "Mobile-perf spec artifact (plan/spec/tasks/contracts; deleted in workdir, tracked in index)."
    if p.startswith("scripts/"):
        return "Build/dev helper script (ffmpeg fetch, android build/emulator, icons)."
    if p.startswith("src-tauri/gen/android/"):
        return "Generated Tauri Android project file (do not hand-edit; patched via `patch-android-project.sh`)."
    if p.startswith("src-tauri/gen/schemas/"):
        return "Generated Tauri schema snapshot (do not edit)."
    if p.startswith("src-tauri/icons/"):
        return "Bundled app icon variant (generated via `gen-icons.py`; do not edit)."
    if p.startswith("src/fonts/"):
        return "Bundled IRANSans font asset for Persian UI."
    if p.startswith("public/"):
        return "Static public asset copied to dist."
    if p.endswith(".png") or p.endswith(".ico") or p.endswith(".icns") or p.endswith(".xml") \
       or p.endswith(".gradle.kts") or p.endswith(".jar") or p.endswith(".bat"):
        return "Android/build/icon resource (generated or binary-adjacent; do not hand-edit logic)."
    if p.endswith(".kt"):
        return "Android Kotlin source (player/booster/MediaStore bridge; mirrors `src-tauri/android/`)."
    if p == "package.json":
        return "Node manifest v1.4.3: scripts dev/build/android/ffmpeg/types/tests; deps tauri-api/zustand/lucide."
    if p == "vite.config.ts":
        return "Vite+React+Tailwind config: :1420/:1421 HMR, es2021, no-sourcemap."
    if p == "tsconfig.json":
        return "Strict TS 5.9 config (strict/noUnusedLocals/noUnusedParameters/noFallthrough)."
    if p == "index.html":
        return "HTML shell with boot-prefs theme/lang pre-paint + splash."
    if p == "README.md":
        return "Product docs: offline converter studio, dev/build/test, LGPL FFmpeg notes."
    if p == "plan.md":
        return "v1.4.2 baseline plan: single-pass DSP, Specta IPC, constitution gates."
    if p.endswith(".md") and (p in ("AGENT_HANDOFF.md","CODE_REVIEW_REPORT.md","PROJECT_OVERVIEW_FA.md",
        "SOUND_BOOSTER_ARCHITECTURE.md","SOUND_BOOSTER_AUDIT_AND_FIXES.md","SYSTEM_BOOSTER_REMOVAL.md",
        "TRANSCRIBE_HIDDEN.md") or p.startswith("specs/")):
        return "Design/history doc (tracked in index; deleted in workdir per git status)."
    if p == ".specify/memory/constitution.md":
        return "Constitution v1.1.0: 8 principles (local-first, single-pass DSP+alimiter, Specta IPC, atomic files)."
    if p == "pnpm-lock.yaml" or p == "src-tauri/Cargo.lock":
        return "Pinned dependency lockfile (generated)."
    if p == ".github/workflows/ci.yml":
        return "CI: 3-OS matrix type-check + vitest + cargo test + Specta sync gate."
    if p == ".github/workflows/release.yml":
        return "Release: tag-triggered Tauri bundles macOS/Linux/Windows + Android APK."
    if p == ".env.android.example":
        return "Template for local Android signing secrets."
    if p.startswith("src-tauri/tests/"):
        return "Rust integration test harness."
    if p.startswith("src-tauri/examples/"):
        return "Rust example binary (Specta type exporter)."
    return "Repo-tracked support file."

DOMAINS = ["frontend-converter","frontend-player","frontend-features","frontend-infra",
           "backend-core","backend-processing","backend-library","platform-android","tooling-docs-assets"]

import fnmatch
EXCLUDE_HASH = [
    "src-tauri/gen/*", "src-tauri/icons/*", "src/fonts/*", "public/*",
    ".agents/skills/*", "*.png", "*.ico", "*.icns", "*.ttf", "*.woff", "*.woff2",
    "*.jar", "*__pycache__/*", "pnpm-lock.yaml", "src-tauri/Cargo.lock",
    # tracked-but-deleted-in-workdir docs: collapsed to group rows, not hashed
    "specs/*",
    "AGENT_HANDOFF.md", "CODE_REVIEW_REPORT.md", "PROJECT_OVERVIEW_FA.md",
    "SOUND_BOOSTER_ARCHITECTURE.md", "SOUND_BOOSTER_AUDIT_AND_FIXES.md",
    "SYSTEM_BOOSTER_REMOVAL.md", "TRANSCRIBE_HIDDEN.md",
]
def hash_in_scope(p: str) -> bool:
    return not any(fnmatch.fnmatch(p, pat) for pat in EXCLUDE_HASH)

# Table-collapse: noisy collateral folds into one group row (no per-file rows).
# Returns group label, "DROP" (omit entirely), or None (keep per-file row).
DELETED_ROOT_DOCS = {
    "AGENT_HANDOFF.md", "CODE_REVIEW_REPORT.md", "PROJECT_OVERVIEW_FA.md",
    "SOUND_BOOSTER_ARCHITECTURE.md", "SOUND_BOOSTER_AUDIT_AND_FIXES.md",
    "SYSTEM_BOOSTER_REMOVAL.md", "TRANSCRIBE_HIDDEN.md",
}
def collapse_group(p: str):
    if "__pycache__/" in p:
        return "DROP"
    if p.startswith("src-tauri/icons/"):
        if "/android/" in p or "/ios/" in p:
            return "src-tauri/icons/{android,ios}/**"
        return "src-tauri/icons/** (desktop + iconset)"
    if "/res/mipmap-" in p or "mipmap-anydpi" in p:
        return "src-tauri/gen/**/res/mipmap-* (generated launcher icons)"
    if p.startswith("src-tauri/gen/schemas/"):
        return "src-tauri/gen/schemas/* (generated snapshots)"
    if "gradle/wrapper/" in p:
        return "src-tauri/gen/**/gradle/wrapper/*"
    if p.startswith("src-tauri/gen/android/app/src/main/java/"):
        return "src-tauri/gen/**/java/** (duplicates of src-tauri/android/*)"
    if "/.agents/skills/" in p or p.startswith(".agents/skills/"):
        if "/data/" in p:
            return ".agents/skills/**/data/* (skill guidance data)"
        if p.endswith(".py"):
            return ".agents/skills/**/scripts/*.py"
        return None
    if p.startswith(".specify/templates/"):
        return ".specify/templates/*"
    if p.startswith(".specify/scripts/"):
        return ".specify/scripts/bash/*"
    if p.startswith(".specify/workflows/"):
        return ".specify/workflows/*"
    if p.startswith(".specify/") and p != ".specify/memory/constitution.md":
        return ".specify/* (bootstrap JSON, manifests)"
    if p.startswith(".opencode/commands/"):
        return ".opencode/commands/* (slash-command defs)"
    if p.startswith("specs/"):
        return "specs/** (deleted in workdir, tracked in index)"
    if p in DELETED_ROOT_DOCS:
        return "root docs (7 files, deleted in workdir, tracked)"
    if p.startswith("src/fonts/"):
        return "src/fonts/** (IRANSans assets)"
    if p.startswith("public/"):
        return "public/* (static assets)"
    return None

GROUP_SUMMARY = {
    "src-tauri/icons/** (desktop + iconset)": "Desktop icon set via `gen-icons.py` (do not edit).",
    "src-tauri/icons/{android,ios}/**": "Mobile icon variants (generated, do not edit).",
    "src-tauri/gen/**/res/mipmap-* (generated launcher icons)": "Generated launcher densities (do not edit).",
    "src-tauri/gen/schemas/* (generated snapshots)": "Generated Tauri schema snapshots (do not edit).",
    "src-tauri/gen/**/gradle/wrapper/*": "Gradle wrapper binaries (do not edit).",
    "src-tauri/gen/**/java/** (duplicates of src-tauri/android/*)": "Byte-identical copies of `src-tauri/android/*.kt`; edit the source side only.",
    ".agents/skills/**/data/* (skill guidance data)": "UI/UX skill CSV data (guidance only, not app runtime).",
    ".agents/skills/**/scripts/*.py": "Skill helper scripts (guidance tooling).",
    ".specify/templates/*": "Spec-kit document templates.",
    ".specify/scripts/bash/*": "Spec-kit workflow scripts.",
    ".specify/workflows/*": "Spec-kit workflow registry.",
    ".specify/* (bootstrap JSON, manifests)": "Spec-kit bootstrap config (not app code).",
    ".opencode/commands/* (slash-command defs)": "Speckit slash-command definitions.",
    "specs/** (deleted in workdir, tracked in index)": "Mobile-perf spec artifacts; deleted in workdir, kept as tracked history.",
    "root docs (7 files, deleted in workdir, tracked)": "Design/history docs; deleted in workdir, kept as tracked history.",
    "src/fonts/** (IRANSans assets)": "Bundled IRANSans fonts for Persian UI.",
    "public/* (static assets)": "Static assets copied to dist.",
}
TITLES = {
"frontend-converter": "Converter shell + queue UI + converter stores",
"frontend-player": "Music library / player UI + player stores",
"frontend-features": "Sound Booster + Transcribe Studio UI",
"frontend-infra": "IPC facade, utils, i18n, types, styles",
"backend-core": "Tauri app root, commands, queues, settings/secrets",
"backend-processing": "Single-pass DSP pipeline, FFmpeg, booster, transcribe engine",
"backend-library": "Music library scanner + artwork (per-platform)",
"platform-android": "Android Kotlin + generated project + icons",
"tooling-docs-assets": "Scripts, CI, configs, specs, docs, skills, fonts",
}

buckets = {d: [] for d in DOMAINS}
for path in sorted(hashmap):
    buckets[domain_of(path)].append(path)

# Untracked-but-real sources: indexed with an explicit marker (no hash).
UNTRACKED_EXTRA = {
    "src/components/music-player/__tests__/SheetPositioning.test.tsx":
        "Regression tests for sheet/modal portal positioning + z-index (TrackRow, details, add-to-album); Android-mocked.",
}
for _p, _s in UNTRACKED_EXTRA.items():
    S[_p] = _s + " (untracked, not in git index)"
    buckets[domain_of(_p)].append(_p)
    buckets[domain_of(_p)].sort()

import subprocess as _sp
_drift = _sp.run(["git", "status", "--short"], cwd=ROOT, capture_output=True, text=True).stdout.strip().splitlines()
_drift = [l for l in _drift if l.strip()]

for d in DOMAINS:
    print(f"{d}: {len(buckets[d])}")

total = sum(len(v) for v in buckets.values())
assert total == len(hashmap) + len(UNTRACKED_EXTRA), total

for d in DOMAINS:
    files = buckets[d]
    lines = []
    lines.append(f"# Reference — {d}")
    lines.append("")
    lines.append(f"Domain: {TITLES[d]}. Part of `PROJECT_GRAPH.md` domain-split map.")
    lines.append("")
    lines.append("## Files")
    lines.append("")
    lines.append("| File | Summary |")
    lines.append("| ---- | ------- |")
    seen_groups = []
    for p in files:
        g = collapse_group(p)
        if g == "DROP":
            continue
        if g is not None:
            if g not in seen_groups:
                seen_groups.append(g)
                lines.append(f"| `{g}` | {GROUP_SUMMARY[g]} |")
            continue
        s = S.get(p) or fallback_summary(p)
        lines.append(f"| `{p}` | {s} |")
    lines.append("")
    lines.append("")
    with open(os.path.join(REFDIR, d + ".md"), "w") as f:
        f.write("\n".join(lines))
    print("wrote", d)

pg = []
pg.append("# Project Graph")
pg.append("")
pg.append("_Last updated: 2026-09-16_")
pg.append("")
pg.append("## Architecture overview")
pg.append("")
pg.append("Audiflow (audio-converter v1.4.3) is an offline-first Tauri 2 + React 19 + Rust desktop/Android app. "
"React presentation (`src/components`, `src/features`) talks to Rust only through the typed IPC facade "
"(`src/utils/tauri.ts` over Specta-generated `src/types/generated.ts`) into `#[tauri::command]` handlers "
"(`src-tauri/src/commands/mod.rs`), which drive a single-pass FFmpeg `filter_complex` pipeline "
"(`src-tauri/src/processing/pipeline.rs`: trim + silence + split + encode in one invocation, at most one lossy encode, "
"every booster chain ending in `alimiter`). State is split: `useAppStore` (converter slices) vs `useMusicPlayerStore` "
"(library/playback); secrets live only in the OS keychain; Android uses JNI/MediaStore bridges.")
pg.append("")
pg.append("## Folder structure")
pg.append("")
pg.append("| Path | Role |")
pg.append("| ---- | ---- |")
pg.append("| `src/` | React 19 SPA (Tailwind v4, Zustand 5); never invokes ffmpeg/raw `invoke` |")
pg.append("| `src/components/` | Converter presentation + `music-player/` library UI |")
pg.append("| `src/features/sound-booster/` | File booster UI + store |")
pg.append("| `src/features/transcribe/` | Transcribe Studio UI (opt-in Gemini) + store |")
pg.append("| `src/stores/` | `useAppStore` converter slices + `useMusicPlayerStore` + `musicPlayer/` engine |")
pg.append("| `src/utils/tauri.ts` | SOLE typed IPC facade; all commands funnel here |")
pg.append("| `src/types/generated.ts` | Specta OUTPUT, CI-pinned; do not edit |")
pg.append("| `src/i18n/` | en/fa dictionaries + `translate()`; RTL discipline |")
pg.append("| `src-tauri/src/` | Rust backend: lib/commands/queue/processing/ffmpeg/music_library |")
pg.append("| `src-tauri/src/processing/` | Single-pass pipeline, naming/silence/split, booster, transcribe |")
pg.append("| `src-tauri/src/ffmpeg/` | locate/probe/run/progress/waveform sidecars |")
pg.append("| `src-tauri/src/music_library/` | Scanner + artwork + per-OS platform |")
pg.append("| `src-tauri/android/` + `src-tauri/gen/android/` | Kotlin sources + generated Android project |")
pg.append("| `src-tauri/icons/` | Generated icon sets |")
pg.append("| `scripts/` | ffmpeg fetch/build, android build/dev/emulator, icon gen |")
pg.append("| `.github/workflows/` | ci + release pipelines |")
pg.append("| `.specify/` / `.opencode/` | Spec-kit constitution, templates, slash-commands |")
pg.append("| `specs/` | Feature specs (tracked; deleted in workdir) |")
pg.append("| `.agents/skills/` | UI/UX skill pack (guidance only) |")
pg.append("| `src/fonts/` + `public/` | IRANSans fonts + static assets |")
pg.append("")
pg.append("## Reference index (domain-split)")
pg.append("")
pg.append("| Domain | File | Files |")
pg.append("| ---- | ---- | ----- |")
for d in DOMAINS:
    pg.append(f"| {TITLES[d]} | `.agents/references/{d}.md` | {len(buckets[d])} |")
pg.append("")
pg.append("## Hash scope")
pg.append("")
pg.append("File tables list all 434 tracked files. `project-graph-meta` hashes cover hand-written sources only;")
pg.append("generated/binary assets are excluded from hashing (icons, fonts, `gen/`, skills data, images, locks):")
pg.append("")
for pat in EXCLUDE_HASH:
    pg.append(f"- `{pat}`")
pg.append("")
pg.append("Integrity check is pointer-based (no per-file hashes):")
pg.append("")
pg.append("```bash")
pg.append("git merge-base --is-ancestor <synced_commit> HEAD && echo POINTER_VALID || echo FULL_REVERIFY")
pg.append("git diff --name-only <synced_commit> HEAD  # committed changes since sync")
pg.append("git status --short  # workdir changes since sync")
pg.append("```")
pg.append("")
pg.append("## Sync pointer")
pg.append("")
pg.append("- commit: f9bc6768be18df90227cadfd6251c872fd92b9e5")
pg.append("- branch: main")
pg.append("- date: 2026-09-16")
pg.append("- workdir_clean_at_sync: false (38 unstaged entries present; next sync must include workdir diff)")
pg.append("")
pg.append("Critical files (blob hashes at sync commit; re-verify these explicitly on each sync):")
pg.append("")
for _cp in [
    "src-tauri/src/processing/pipeline.rs",
    "src-tauri/src/commands/mod.rs",
    "src/types/generated.ts",
    "src-tauri/src/secrets.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/src/queue/mod.rs",
    "src/utils/tauri.ts",
    "src-tauri/src/settings.rs",
    "src-tauri/src/processing/sound_booster/presets.rs",
    "src-tauri/src/types.rs",
]:
    pg.append(f"- `{_cp}` `{hashmap[_cp]}`")
pg.append("")
pg.append("## Known workdir drift")
pg.append("")
if _drift:
    pg.append(f"At generation time the workdir differed from the sync commit in {len(_drift)} entries.")
    pg.append("Rows above describe the sync-commit state unless marked untracked; treat every")
    pg.append("path below as overriding the table (modified) or voiding it (deleted).")
    pg.append("Refresh this section on every sync from live `git status --short`.")
    pg.append("")
    pg.append("```text")
    for _dl in _drift:
        pg.append(_dl)
    pg.append("```")
else:
    pg.append("Workdir was clean at generation time — tables match the workdir.")
pg.append("")
pg.append("Table scope: noisy collateral (icons, fonts, `gen/` outputs, skill data, lockfiles,")
pg.append("deleted-but-tracked docs) folds into one group row per family instead of per-file rows;")
pg.append("`__pycache__` bytecode is omitted entirely. Per-file rows + hashes are reserved for")
pg.append("hand-written sources an agent would actually navigate to or edit.")
pg.append("")
pg.append("## Task → File map")
pg.append("")
pg.append("| If you want to... | Start here | Also inspect | Usually avoid |")
pg.append("| --- | --- | --- | --- |")
pg.append("| Convert/trim/split/silence behavior | `src-tauri/src/processing/pipeline.rs` | `processing/silence.rs`, `processing/split.rs`, `processing/naming.rs`, `ffmpeg/` | player UI |")
pg.append("| Queue progress/cancel | `src-tauri/src/queue/mod.rs` | `src/stores/slices/queueSlice.ts`, `src/components/JobsPanel.tsx` | transcribe queue |")
pg.append("| Converter UI/options | `src/components/OptionsPanel.tsx`, `src/components/FileList.tsx` | `src/stores/slices/fileSlice.ts`, `settingsSlice.ts`, `utils/estimate.ts` | Rust internals |")
pg.append("| Waveform trimmer | `src/components/TrimEditor.tsx` | `src-tauri/src/ffmpeg/waveform.rs` | icons |")
pg.append("| Player/library/scan | `src/components/music-player/TrackListView.tsx` | `src-tauri/src/music_library/`, `src/stores/musicPlayer/` | converter DSP |")
pg.append("| Playback engine | `src/stores/musicPlayer/audioEngine.ts` | `utils/mediaSession.ts`, `utils/artwork.ts` | transcribe |")
pg.append("| File booster | `src/features/sound-booster/` | `src-tauri/src/processing/sound_booster/` | transcribe |")
pg.append("| Transcribe Studio | `src/features/transcribe/` | `src-tauri/src/processing/transcribe/`, `transcribe_queue.rs`, `secrets.rs` | DSP presets |")
pg.append("| Add IPC command | `src-tauri/src/commands/mod.rs` | `src-tauri/src/lib.rs` specta_builder, `examples/export_types.rs`, `src/types/generated.ts`, `src/utils/tauri.ts` | direct `invoke` in components |")
pg.append("| Settings/secrets | `src-tauri/src/settings.rs`, `src-tauri/src/secrets.rs` | `src/stores/slices/settingsSlice.ts`, `utils/bootPrefs.ts` | fonts |")
pg.append("| Android build/run | `scripts/build-android-local.sh`, `scripts/dev-android.sh` | `src-tauri/android/`, `utils/platform.ts`, `utils/androidBack.ts` | desktop bundling |")
pg.append("| Icons/assets | `scripts/gen-icons.py`, `src-tauri/icons/` | `public/` | Rust logic |")
pg.append("| CI/release | `.github/workflows/ci.yml` | `check:types` gate, `fetch-ffmpeg.mjs` | app code |")
pg.append("")
pg.append("## Module dependency map")
pg.append("")
pg.append("```text")
pg.append("components/* + features/*  -->  stores/*  -->  utils/tauri.ts  -->  types/generated.ts")
pg.append("                                                          -->  commands/mod.rs  -->  queue / processing / music_library / ffmpeg")
pg.append("processing/pipeline.rs  -->  naming + silence + split + ffmpeg/{locate,probe,run,progress} + sound_booster/*")
pg.append("processing/transcribe/* -->  gemini_client + preprocess + stitch + usage_tracker + secrets.rs (keychain)")
pg.append("music_library/*  -->  platform/{android,linux,macos,windows} + artwork")
pg.append("android Kotlin (PlaybackService/BoostEngine/...)  <-->  android_fs.rs (JNI)  <-->  commands/*android_player*")
pg.append("```")
pg.append("")
pg.append("## Dependency boundaries")
pg.append("")
pg.append("- UI (`components`, `features`) may depend on stores and `utils/tauri.ts`; never on raw `invoke` or ffmpeg.")
pg.append("- Stores may depend on `utils/tauri.ts` and `types`; converter store (`useAppStore`) and player store (`useMusicPlayerStore`) stay isolated.")
pg.append("- `src/utils/tauri.ts` is the only frontend module importing `types/generated.ts` for invocation.")
pg.append("- `generated.ts` is Specta output: never hand-edit; regenerate via `generate:types`, gated by `check:types` in CI.")
pg.append("- Backend `commands/` may depend on `queue`, `processing`, `music_library`, `ffmpeg`, `settings`/`secrets`/`disk`/`logger`.")
pg.append("- `processing/` submodules never depend on `commands/`; DSP stays UI-agnostic.")
pg.append("- Cloud code is isolated to `processing/transcribe/` + `transcribe_queue.rs` + `secrets.rs`; core convert/enhance/library require no network.")
pg.append("- Android Kotlin talks to Rust only via `android_fs.rs` JNI bridge; frontend detects platform via `utils/platform.ts`.")
pg.append("- Generated code (`gen/`, `icons/`, `generated.ts`, lockfiles) is never hand-edited.")
pg.append("")
pg.append("## Critical areas")
pg.append("")
pg.append("- Single-pass FFmpeg DSP (`processing/pipeline.rs`): one filter graph, at most one lossy encode; post-silence split timeline.")
pg.append("- Mandatory terminal `alimiter` in every booster chain (`sound_booster/presets.rs`).")
pg.append("- IPC type-safety: Specta builder ↔ `generated.ts` ↔ `tauri.ts` (CI `check:types` gate).")
pg.append("- Secrets: Gemini key in OS keychain only (`secrets.rs`); never in settings/localStorage.")
pg.append("- Atomic non-destructive writes: `.tmp`/`.part` + rename, `(1)/(2)` suffixes (`naming.rs`), kill ffmpeg children on cancel/exit.")
pg.append("- Android scoped storage/MediaStore + single active audio stream (player vs preview mutual pause).")
pg.append("- Disk-space preflight with safety headroom (`disk.rs`, `pipeline.rs`).")
pg.append("")
with open(os.path.join(ROOT, "PROJECT_GRAPH.md"), "w") as f:
    f.write("\n".join(pg) + "\n")
print("wrote PROJECT_GRAPH.md")
