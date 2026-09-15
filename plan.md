# Implementation Plan: audio-converter v1.4.2 Baseline (Audiflow)

**Branch**: `main` | **Date**: 2026-09-15 | **Spec**: N/A (no `specs/` directory exists; input is whole-repo analysis of `audio-converter` at `cfa1f77` v1.4.2)

**Input**: Whole-codebase analysis of `/` repository root (Tauri v2 + React 19 app, `productName: Audiflow`, `identifier: com.audioconverter.app`)

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

`audio-converter` v1.4.2 (`Audiflow`) is an offline-first audio studio + music player: video-to-audio conversion with quality presets, trimming, silence removal, splitting, queue processing, 6-preset Sound Booster, library/player (desktop + Android MediaStore/Media3), and opt-in Gemini Transcribe Studio. Technical approach evidenced in-repo: single-pass FFmpeg `-filter_complex` DSP in `src-tauri/src/processing/pipeline.rs:83-216` (decode once, at most one lossy encode), Tauri Specta typed IPC (`src-tauri/src/lib.rs:73-135` → `src/types/generated.ts` via `src-tauri/examples/export_types.rs`, consumed only through `src/utils/tauri.ts`), Zustand slice stores decoupled per domain (`src/stores/useAppStore.ts`, `src/stores/useMusicPlayerStore.ts`), bundled LGPL FFmpeg/FFprobe 8.1 branch (`scripts/fetch-ffmpeg.mjs:38`, `src-tauri/binaries/`).

## Technical Context

**Language/Version**: Rust edition 2021, `rust-version = 1.77` (`src-tauri/Cargo.toml:6`); TypeScript `^5.9.3` strict (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` in `tsconfig.json:14-17`); React `^19.2.0` + `react-dom ^19.2.0`; Vite `^7.1.10` (`target: es2021` in `vite.config.ts:15`); Node 22 + pnpm 9 per `.github/workflows/ci.yml:34-41`.

**Primary Dependencies**: Frontend (`package.json:23-44`): `@tauri-apps/api ^2.9.0`, `@tauri-apps/plugin-dialog ^2.4.0`, `@tauri-apps/plugin-opener ^2.5.0`, `zustand ^5.0.8`, `lucide-react ^1.38.0`; dev: `tailwindcss ^4.1.14` + `@tailwindcss/vite ^4.1.14`, `@tauri-apps/cli ^2.9.6`, `@vitejs/plugin-react ^5.1.0`, `vitest ^3.2.4`, `@testing-library/react ^16.3.2`, `@testing-library/dom ^10.4.1`, `jsdom ^30.0.1`. Backend (`src-tauri/Cargo.toml:20-51`): `tauri 2` (`protocol-asset`), `tauri-plugin-dialog 2`, `tauri-plugin-opener 2`, `tauri-plugin-single-instance 2` (non-Android/iOS only), `serde 1` + `serde_json 1`, `specta 2.0.0-rc.25` + `specta-typescript 0.0.12` + `tauri-specta 2.0.0-rc.25` (`typescript` feature), `reqwest 0.12` (`json`, `multipart`, `rustls-tls`), `keyring 3`, `tokio 1` (`time`, `macros`, `rt`); `wiremock 0.6` dev; `libc 0.2` (unix), `windows-sys 0.60` + `windows 0.60` (windows), `jni 0.21` (android); build: `tauri-build 2` (`src-tauri/build.rs`). DSP binaries: FFmpeg/FFprobe 8.1 branch, LGPL (`scripts/fetch-ffmpeg.mjs:38` `ffmpeg-n8.1-latest-win64-lgpl-8.1.zip`, `scripts/build-ffmpeg-minimal.sh`, `src-tauri/binaries/ffmpeg*`, `ffprobe*`).

**Storage**: `settings.json` at Tauri `app_data_dir` (`src-tauri/src/settings.rs:127`, init in `src-tauri/src/lib.rs:183-187`; atomic `.json.tmp` → rename in `settings.rs:156-163`); `logs/app.log` with 5 MB rotation to `app.log.old` (`src-tauri/src/logger.rs:5,33-62`); `transcribe_usage.json` (45-day Pacific-time map, `src-tauri/src/processing/transcribe/usage_tracker.rs:16-18,103`); Gemini API key ONLY in OS keychain via `keyring` (`SERVICE com.audioconverter.app`, `ACCOUNT gemini-api-key`, `src-tauri/src/secrets.rs:8-14`), never in `settings.json`/`localStorage`; frontend `localStorage ac:ui-prefs` boot theme/lang cache (`src/utils/bootPrefs.ts:11`, `index.html:16-35`) + `sessionStorage ac:perm-gate-skipped` / `ac:boot-lang` (`src/App.tsx:103,332`); Android staged inputs via `android_fs.rs:ensure_local_path` + `delete_staged_input` (`src-tauri/src/lib.rs:76`), track artwork disk cache resolved by `get_track_artwork` (`src/utils/tauri.ts:216-229`).

**Testing**: `pnpm test` = `vitest run` (jsdom; e.g. `src/utils/format.test.ts`, `estimate.test.ts`, `bootPrefs.test.ts`, `src/components/__tests__/`, `src/__tests__/AndroidBack.test.tsx`); `pnpm test:rust` = `cargo test --manifest-path src-tauri/Cargo.toml` (unit tests in `processing/pipeline.rs`, `sound_booster/presets.rs:82-99`, `boost.rs:102`, `types.rs:300-320`, `settings.rs:178+`, `ffmpeg/locate.rs:125-148`); `src-tauri/tests/e2e.rs:1-448` live-FFmpeg suite (generated tone/silence video → bundled binary → playable-output asserts, skips without binaries); contract gate `pnpm generate:types` (`cargo run --example export_types`) + `pnpm check:types` (`git diff --exit-code src/types/generated.ts`); `pnpm build` = `tsc --noEmit && vite build`.

**Target Platform**: Tauri v2 `bundle.targets: all`, `frontendDist: ../dist`, window 1100×760 (min 860×600) (`src-tauri/tauri.conf.json:7-12,14-24,34-38`); Desktop macOS/Windows/Linux (3-OS CI matrix `ubuntu-22.04`, `macos-14`, `windows-latest` in `.github/workflows/ci.yml:21-24`; Windows NSIS `lzma` + `embedBootstrapper` in `tauri.conf.json:39-45`; file associations mp3/flac/wav/m4a/aac/ogg/opus/aiff/alac/wma/weba + mp4/mkv/avi/mov/webm/flv/wmv in `tauri.conf.json:49-64`); Android (`src-tauri/android/`, `src-tauri/gen/`, JNI `lib.rs:15-65`, `android_fs.rs`, Media3 ExoPlayer bridge `commands::*android_player*` in `lib.rs:100-118`, `scripts/build-android-local.sh`, `dev-android.sh`, `run-android-emulator.sh`; artifact `AudioConverter-SoundBooster.apk`); dev server `http://localhost:1420` + HMR 1421 (`vite.config.ts:10-21`, `tauri.conf.json:8-9`).

**Project Type**: Tauri v2 desktop + Android hybrid: Rust backend DSP/queue/library service + React 19 SPA frontend. Domains: converter (probe → queue → single-pass encode), Sound Booster (presets + A/B preview + volume analysis), music library/player (scanner + artwork + Media3/desktop audio), Transcribe Studio (opt-in Gemini cloud). State: `useAppStore` (converter: `fileSlice`, `settingsSlice`, `queueSlice`, `toastSlice`) isolated from `useMusicPlayerStore` (`musicPlayer/` + `audioEngine.ts`).

**Performance Goals**: Decode source exactly once, at most one lossy encode per output (`pipeline.rs:74-78`); input seeking `-ss` before `-i`, `-to` after `-i` rebased via `TrimSpec::effective_to` (`pipeline.rs:80-82`, `types.rs:136-147`); progress poll 250 ms, encode-phase floor 15% (`pipeline.rs:16-18`); concurrency `default = clamp(max_parallel/2,1..4)`, hard clamp 1..32 (`settings.rs:167-176`); probe parallelism bounded worker pool (`lib.rs` `probe_files` doc in `generated.ts:36-41`); waveform decode audio-stream-only into bucketed min/max (`generated.ts:47-51`); Opus sample-rate fallback to 48 kHz (`pipeline.rs:117-125`); disk preflight with 8 MB safety headroom (`pipeline.rs:17`); frontend boot splash + 8 s failsafe, cached-tracks-first scan (`src/App.tsx:242-303`); pinch/ctrl-wheel zoom disabled on mobile WebViews (`src/main.tsx:6-31`).

**Constraints**: Single unified `-filter_complex` per output; no intermediate lossy re-encode (`processing/pipeline.rs`, `processing/silence.rs`, `processing/split.rs`, `processing/naming.rs`); every booster graph ends in `alimiter` (`processing/sound_booster/presets.rs:35-36`, `boost.rs`, `pipeline.rs:133-153`); atomic `.tmp`/`.part` write + rename, never overwrite (incremental `(1)`, `(2)` suffixes via `processing/naming.rs`), kill ffmpeg children on cancel/exit (`lib.rs:233-238`, `queue::QueueManager::cancel_all`); IPC only via `src/utils/tauri.ts` typed wrappers over `src/types/generated.ts` (no raw `invoke` in components); secrets keychain-only; i18n via `translate(lang,key)` (`src/i18n/en.ts`, `fa.ts`) with RTL discipline; file ceiling 300 lines/source file; TS strict + Specta sync CI gate; Android: no `RECORD_AUDIO` (LoudnessEnhancer/playback-capture only), single active audio stream (player vs preview mutual pause), scoped-storage/ContentResolver/MediaStore compliance; Gemini calls Rust-side only with explicit consent flag (`transcribe.consent_accepted` in `settings.rs:58`).

**Scale/Scope**: Monorepo ~2 surfaces: `src/` (App shell `App.tsx:84-408`, `main.tsx`, `index.css`; `components/` incl. `DropZone.tsx`, `FileList.tsx`, `OptionsPanel.tsx`, `JobsPanel.tsx`, `TrimEditor.tsx`, `Toasts.tsx`, `HeaderBar.tsx`, `music-player/`; `features/sound-booster/`, `features/transcribe/`; `stores/` + `stores/slices/` + `stores/musicPlayer/`; `hooks/useTheme.ts`, `useNativeDragDrop.ts`; `utils/tauri.ts`, `platform.ts`, `openWith.ts`, `androidBack.ts`, `artwork.ts`, `mediaSession.ts`, `bootPrefs.ts`, `estimate.ts`, `format.ts`, `dialog.ts`, `externalUrl.ts`; `types/index.ts` + `types/generated.ts` 473 lines, ~50 commands; `i18n/` en/fa) and `src-tauri/src/` (14 modules: `lib.rs`, `main.rs`, `commands/mod.rs` 1028 lines, `types.rs`, `error.rs`, `settings.rs`, `secrets.rs`, `logger.rs`, `disk.rs`, `android_fs.rs`, `queue/mod.rs` 605 lines, `transcribe_queue.rs`, `ffmpeg/` 6 files, `processing/` + `sound_booster/` 6 files + `transcribe/`, `music_library/` 5 files). Boundaries: frontend never touches `invoke`/`ffmpeg` directly; backend never renders; Android Kotlin↔Rust only via `android_fs.rs` JNI bridge; cloud code isolated to `processing/transcribe/` + `transcribe_queue.rs` + `secrets.rs`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Source: `.specify/memory/constitution.md` v1.1.0 (ratified 2026-09-15; 8 principles) mapped onto the 5 requested gates:

1. Incremental Evolution → PASS (with note). No standalone "incremental" clause in constitution; closest enforceable gates are Governance (amendments versioned in-constitution) + Workflow items 2–5 (CI matrix, per-change type-sync/DSP/Android/secrets review) + Principle IV atomic non-destructive ops (`settings.rs:156-163`, `naming.rs` suffixing, `cancel_all` purge). No greenfield rewrite pattern observed; `SOUND_BOOSTER_ARCHITECTURE.md`, `SOUND_BOOSTER_AUDIT_AND_FIXES.md`, `SYSTEM_BOOSTER_REMOVAL.md` evidence incremental evolution in practice.
2. Absolute IPC Type-Safety via Tauri Specta → PASS. `specta_builder()` collects ~50 commands (`lib.rs:73-135`); `generated.ts` header "single source of truth"; `export_types` example + `pnpm generate:types`/`check:types` (`package.json:13-14`); all frontend calls funnel through `src/utils/tauri.ts` (583 lines, typed wrappers + `formatAppError` + `GeminiApiError`); CI verifies sync on Linux (`ci.yml:66-71`). Direct untyped `invoke` prohibited by Principle III.
3. Single-Pass FFmpeg DSP → PASS. `build_conversion_args` compiles trim (`-ss`/`-to`), `atrim`/`concat` silence segments, split parts, resample/channel, boost chain into one `-filter_complex` + one encode (`pipeline.rs:83-216`); `encoder_args` single codec selection (`pipeline.rs:48-72`); post-silence split timeline + remainder-preserved final part per constitution; e2e covers trim/silence/unicode (`tests/e2e.rs`).
4. Mandatory alimiter −0.5 dBFS → PASS WITH NUMERIC NOTE. Every preset chain terminates in `alimiter` (`presets.rs:30-31,37-74`; enforced by `test_all_presets_include_alimiter` in `presets.rs:82-99` and `boost.rs:102` assert). Actual constants: `DEFAULT_LIMITER = alimiter=limit=0.95:attack=5:release=50:asc=1` (≈ −0.45 dBFS, the constitution's "−0.5 dBFS (limit=0.95)" shorthand) and `STRICT_LIMITER = alimiter=limit=0.98:attack=2:release=20:asc=1` (≈ −0.17 dBFS, Extreme preset only, `presets.rs:64-67`). No preset omits the limiter; finding is documentation precision, not a DSP violation.
5. Privacy-First / Local-Only execution → PASS. Core convert/enhance/trim/split/library/playback require zero network/accounts/telemetry (Principle I); bundled sidecar resolution order env-override → exe-adjacent/`binaries` (desktop) / `lib*.so` (Android) in `ffmpeg/locate.rs:11-119`; only sanctioned network path is user-initiated Transcribe Studio (`reqwest` in `processing/transcribe/`, consent flag `settings.rs:58`, keychain-only key `secrets.rs`, local `transcribe_usage.json`, classified `GeminiErrorKind` in `error.rs:29-44`). No telemetry/remote DSP detected.

Re-check trigger (Phase 1): any new command/struct, filtergraph branch, persisted value, permission, or user-facing string must re-run gates III/II/VIII + `generate:types`/`check:types` before merge.

## Project Structure

### Documentation (this feature)

```text
specs/audio-converter-baseline/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Note: `specs/` does not exist yet in-repo (verified 2026-09-15); this `plan.md` is written at repository root as `plan.md` and is the authoritative copy to move under `specs/audio-converter-baseline/` when the folder is created. Existing adjacent docs: `.specify/memory/constitution.md`, `.specify/templates/plan-template.md`, `AGENT_HANDOFF.md`, `SOUND_BOOSTER_ARCHITECTURE.md`, `SOUND_BOOSTER_AUDIT_AND_FIXES.md`, `SYSTEM_BOOSTER_REMOVAL.md`, `TRANSCRIBE_HIDDEN.md`, `PROJECT_OVERVIEW_FA.md`, `CODE_REVIEW_REPORT.md`.

### Source Code (repository root)

```text
audio-converter/ (Audiflow v1.4.2, Tauri v2 + React 19 + Rust 1.77)
├── index.html                  # Boot-splash + blocking ac:ui-prefs theme/lang script, #root
├── vite.config.ts              # React + Tailwind v4 plugins, :1420/:1421 HMR, TAURI_DEV_HOST, es2021
├── tsconfig.json               # Strict TS 5.9 (strict/noUnusedLocals/noUnusedParameters/noFallthrough)
├── package.json                # Scripts: dev/build/preview, fetch:ffmpeg, generate:types/check:types, test/test:rust, android/*
├── src/                        # FRONTEND (React 19 SPA, Tailwind v4, Zustand 5; never invokes ffmpeg/raw invoke)
│   ├── main.tsx                # StrictMode root, disables pinch/ctrl-zoom in mobile WebViews
│   ├── App.tsx                 # Converter/player shell, boot gate, open-files/share listeners, StartBar
│   ├── index.css               # Tailwind v4 entry
│   ├── components/             # Converter presentation: DropZone, FileList, OptionsPanel, JobsPanel,
│   │                           # TrimEditor, ModernSlider, HeaderBar, Toasts, music-player/*, __tests__/
│   ├── features/sound-booster/ # Booster UI: file-booster/, shared/, stores/
│   ├── features/transcribe/    # Transcribe Studio UI: TranscribePage, ConsentSheet, ErrorBanner,
│   │                           # TranscriptResultView, UsageDashboard, hooks/, stores/, toggles/inputs
│   ├── stores/useAppStore.ts   # Converter root (fileSlice + settingsSlice + queueSlice + toastSlice)
│   ├── stores/useMusicPlayerStore.ts # Player domain (isolated from converter to avoid re-renders)
│   ├── stores/slices/          # fileSlice, queueSlice (job-event listeners), settingsSlice, toastSlice
│   ├── stores/musicPlayer/     # Player slices: audioEngine, persistence, trackUtils, __tests__
│   ├── hooks/useTheme.ts       # Single-writer theme class; useNativeDragDrop.ts window drop
│   ├── utils/tauri.ts          # SOLE typed IPC façade over generated.ts (probe/queue/waveform/disk/
│   │                           # booster/analyze/library/Media3 player/transcribe/key helpers)
│   ├── utils/platform.ts       # isAndroid(); openWith.ts; androidBack.ts; artwork.ts; mediaSession.ts
│   ├── utils/bootPrefs.ts      # localStorage ac:ui-prefs sync cache (+ estimate.ts/format.ts/dialog.ts/externalUrl.ts)
│   ├── types/generated.ts      # TAURI-SPECTA OUTPUT (do not edit; ~50 commands + all IPC schemas)
│   ├── types/index.ts          # Hand aliases: ConversionOptions/TrimSpec/FileMeta/QueueItem/AppSettings/InputFile
│   ├── i18n/en.ts + fa.ts + index.ts # translate(lang,key) dictionaries (no hardcoded UI strings)
│   └── __tests__/ + **/*.test.ts(x) # Vitest: AndroidBack, bootPrefs, estimate, format, component tests
├── src-tauri/                  # BACKEND (Rust 2021; heavy work off Tauri main thread via tokio/workers)
│   ├── Cargo.toml              # tauri 2 + plugins, specta/tauri-specta rc.25, reqwest/keyring/tokio, jni/wiremock
│   ├── tauri.conf.json         # Audiflow, com.audioconverter.app, dist ../dist, assetProtocol, externalBin
│   ├── capabilities/default.json # core/event/dialog/opener permissions for window main
│   ├── build.rs                # tauri_build
│   ├── examples/export_types.rs # Specta exporter → ../src/types/generated.ts
│   ├── binaries/               # Bundled ffmpeg/ffprobe (+ per-triple + android libs + build-minimal/*)
│   ├── android/ + gen/         # Android project + generated bindings; MainActivity ↔ Rust JNI bridge
│   └── src/
│       ├── lib.rs              # specta_builder (~50 commands), setup (settings/queues/open-file queue),
│       │                       # single-instance, RunEvent::Opened, kill ffmpeg on Exit
│       ├── main.rs             # Entry → lib::run()
│       ├── commands/mod.rs     # All #[tauri::command] handlers (1028 lines: resolve/stat/probe/start/
│       │                       # waveform/cancel/queue/disk/settings/volume/AB-preview/boost/scan/library/
│       │                       # Media3 player/volume/booster-gain/ringtone/share/open-files/artwork/
│       │                       # notifications/exit/gemini-key/transcribe/usage/export)
│       ├── types.rs            # AudioFormat/QualityPreset/OutputMode/ConversionOptions/TrimSpec/JobEvent
│       ├── error.rs            # AppError + GeminiErrorKind (classified i18n keys)
│       ├── queue/mod.rs        # QueueManager: FIFO, per-job options snapshot, CancelToken map, job-event emit
│       ├── transcribe_queue.rs # TranscribeQueueManager (mirrors queue lifecycle for Gemini jobs)
│       ├── processing/pipeline.rs # Single-pass filter_complex builder + run_job (probe→plan→ffmpeg→rename)
│       ├── processing/naming.rs # Collision-safe (1)/(2) naming; silence.rs detect/parse; split.rs timeline
│       ├── processing/sound_booster/ # presets.rs (6 presets + DEFAULT/STRICT alimiter), boost.rs,
│       │                       # analyze.rs (peak/mean/suggested gain), preview.rs (A/B snippet), pipeline.rs
│       ├── processing/transcribe/ # Gemini client/types/usage_tracker (cloud-isolated, Rust-side only)
│       ├── ffmpeg/locate.rs    # FFMPEG_PATH override → exe-adjacent/binaries (desktop) / lib*.so (Android)
│       ├── ffmpeg/probe.rs + run.rs (CancelToken/RunSpec) + progress.rs + waveform.rs
│       ├── music_library/      # scanner.rs + platform/ (MediaStore/desktop dirs) + models.rs + artwork.rs
│       ├── settings.rs         # settings.json load/save/validate + concurrency 1..32
│       ├── secrets.rs          # keyring-only Gemini key (save/load/has/delete + mask_key)
│       ├── android_fs.rs       # Content-URI staging, statUri bridge, JNI VM/class cache
│       ├── disk.rs + logger.rs # disk_free preflight; logs/app.log rotation
│       └── tests/e2e.rs (src-tauri/tests/) # Live-FFmpeg e2e (tone/silence fixtures, trim/silence/unicode)
├── scripts/                    # fetch-ffmpeg.mjs (pinned n8.1 LGPL + sha256) + build-ffmpeg-minimal.sh +
│                               # build-android-local.sh + dev-android.sh + run-android-emulator.sh + gen-icons.py
├── dist/ + public/             # Vite output (frontendDist) + static assets (icon.png)
└── .github/workflows/ci.yml + release.yml # 3-OS gate: install → fetch:ffmpeg → generate/check:types →
                                            # vitest → tsc+vite build → cargo test
```

**Structure Decision**: Documented structure is the actual Tauri v2 split already enforced in-repo: thin React presentation (`src/components/`, `src/features/`) → Zustand slice stores (`src/stores/`) → single typed IPC façade (`src/utils/tauri.ts` + `src/types/generated.ts`) → Rust command handlers (`src-tauri/src/commands/mod.rs`) → domain services (`processing/`, `queue/`, `music_library/`, `ffmpeg/`, `settings/secrets/disk/logger`). Frontend/backend boundary is `src/types/generated.ts` (Specta output, CI-pinned); platform boundary is `android_fs.rs` JNI + `utils/platform.ts`/`androidBack.ts`; cloud boundary is `processing/transcribe/` + `transcribe_queue.rs` (opt-in only). No restructuring proposed — future features add slices under `src/stores/slices/` or `src/features/<domain>/` and submodules under `src-tauri/src/<domain>/` per the 300-line ceiling, never new top-level IPC bypasses.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| None | No constitution gate is bypassed by this baseline plan: single-pass DSP, terminal `alimiter`, Specta-synced IPC, keychain-only secrets, atomic file ops, and offline-first execution are all evidenced in the paths cited above | N/A |
