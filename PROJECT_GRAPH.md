# Project Graph

_Last updated: 2026-09-19_

## Architecture overview

Audiflow (audio-converter v1.5.1) is an offline-first Tauri 2 + React 19 + Rust desktop/Android app. React presentation (`src/components`, `src/features`) talks to Rust only through the typed IPC facade (`src/utils/tauri.ts` over Specta-generated `src/types/generated.ts`) into `#[tauri::command]` handlers (`src-tauri/src/commands/mod.rs`), which drive a single-pass FFmpeg `filter_complex` pipeline (`src-tauri/src/processing/pipeline.rs`: trim + silence + split + encode in one invocation, at most one lossy encode, every booster chain ending in `alimiter`). State is split: `useAppStore` (converter slices) vs `useMusicPlayerStore` (library/playback); secrets live only in the OS keychain; Android uses JNI/MediaStore bridges.

## Folder structure

| Path | Role |
| ---- | ---- |
| `src/` | React 19 SPA (Tailwind v4, Zustand 5); never invokes ffmpeg/raw `invoke` |
| `src/components/` | Converter presentation + `music-player/` library UI |
| `src/features/sound-booster/` | File booster UI + store |
| `src/stores/` | `useAppStore` converter slices + `useMusicPlayerStore` + `musicPlayer/` engine |
| `src/utils/tauri.ts` | SOLE typed IPC facade; all commands funnel here |
| `src/types/generated.ts` | Specta OUTPUT, CI-pinned; do not edit |
| `src/i18n/` | en/fa dictionaries + `translate()`; RTL discipline |
| `src-tauri/src/` | Rust backend: lib/commands/queue/processing/ffmpeg/music_library |
| `src-tauri/src/processing/` | Single-pass pipeline, naming/silence/split, booster, transcribe |
| `src-tauri/src/ffmpeg/` | locate/probe/run/progress/waveform sidecars |
| `src-tauri/src/music_library/` | Scanner + artwork + per-OS platform |
| `src-tauri/android/` + `src-tauri/gen/android/` | Kotlin sources + generated Android project |
| `src-tauri/icons/` | Generated icon sets |
| `scripts/` | ffmpeg fetch/build, android build/dev/emulator, icon gen, mac free installer (`install-mac.sh`), arch packaging orchestrator (`package-arch.sh`) |
| `packaging/` | Arch PKGBUILD + README (`packaging/arch/`), mac zip README (`packaging/macos/`); arch artifact ships via release.yml linux job (archlinux container) |
| `.github/workflows/` | ci + release pipelines (release: 3-OS matrix + android + arch-in-container + release job) |
| `.specify/` / `.opencode/` | Spec-kit constitution, templates, slash-commands |
| `specs/` | Feature specs (tracked; latest `017-arch-linux-package` — Arch Linux `.pkg.tar.zst` packaging spec, Draft) |
| `.agents/skills/` | UI/UX skill pack (guidance only) |
| `src/fonts/` + `public/` | IRANSans fonts + static assets |

## Reference index (domain-split)

| Domain | File | Files |
| ---- | ---- | ----- |
| Converter shell + queue UI + converter stores | `.agents/references/frontend-converter.md` | 35 |
| Music library / player UI + player stores | `.agents/references/frontend-player.md` | 49 |
| Sound Booster + Transcribe Studio UI | `.agents/references/frontend-features.md` | 34 |
| IPC facade, utils, i18n, types, styles | `.agents/references/frontend-infra.md` | 24 |
| Tauri app root, commands, queues, settings/secrets | `.agents/references/backend-core.md` | 20 |
| Single-pass DSP pipeline, FFmpeg, booster, transcribe engine | `.agents/references/backend-processing.md` | 24 |
| Music library scanner + artwork (per-platform) | `.agents/references/backend-library.md` | 9 |
| Android Kotlin + generated project + icons | `.agents/references/platform-android.md` | 129 |
| Scripts, CI, configs, specs, docs, skills, fonts | `.agents/references/tooling-docs-assets.md` | 134 |

## Hash scope

File tables list all 434 tracked files. `project-graph-meta` hashes cover hand-written sources only;
generated/binary assets are excluded from hashing (icons, fonts, `gen/`, skills data, images, locks):

- `src-tauri/gen/*`
- `src-tauri/icons/*`
- `src/fonts/*`
- `public/*`
- `.agents/skills/*`
- `*.png`
- `*.ico`
- `*.icns`
- `*.ttf`
- `*.woff`
- `*.woff2`
- `*.jar`
- `*__pycache__/*`
- `pnpm-lock.yaml`
- `src-tauri/Cargo.lock`
- `specs/*`
- `AGENT_HANDOFF.md`
- `CODE_REVIEW_REPORT.md`
- `PROJECT_OVERVIEW_FA.md`
- `SOUND_BOOSTER_ARCHITECTURE.md`
- `SOUND_BOOSTER_AUDIT_AND_FIXES.md`
- `SYSTEM_BOOSTER_REMOVAL.md`
- `TRANSCRIBE_HIDDEN.md`

Integrity check is pointer-based (no per-file hashes):

```bash
git merge-base --is-ancestor <synced_commit> HEAD && echo POINTER_VALID || echo FULL_REVERIFY
git diff --name-only <synced_commit> HEAD  # committed changes since sync
git status --short  # workdir changes since sync
```

## Sync pointer

- commit: d617fb1
- branch: main
- date: 2026-09-16
- workdir_clean_at_sync: false (2 unstaged entries: shared-memory only; next sync must include workdir diff)

Workdir driftsince sync (2026-09-20, spec 012 implemented): onboarding layout rework —
`src/components/onboarding/OnboardingGate.tsx` (clipped decor layer + x-hidden scroller +
min-h-full column + safe-area header/footer), `ThemeSection.tsx` / `LanguageSection.tsx` /
`PerformanceSection.tsx` (radiogroup a11y migration); corresponding `__tests__` (17→22 tests).
Mock-faithful restyle (2026-09-20): `OnboardingGate.tsx` (hero EQ emblem w/ ripple, mock bg
layers, gradient CTA + shine, max-w-[440px]), all 4 sections (glass cards, required/emerald/exotic
badges, check-dot pills, dark+light), `src/index.css` (+`onboard-ripple`), `src/i18n/*.ts`
(+lead/accent/tail title, badge, section-tag, sublabel keys). APK rebuilt + installed on
Pixel_6_API_34.

Critical files (blob hashes at sync commit; re-verify these explicitly on each sync):

- `src-tauri/src/processing/pipeline.rs` `9145b41ce6184dd6ff66ad3a1916d95a94148a48`
- `src-tauri/src/commands/mod.rs` `6041dac354c41e8adaac4e590fc3b33a752638a9`
- `src/types/generated.ts` `405a591fca8791a8a755466ff8ea5e7028409773`
- `src-tauri/src/secrets.rs` `ce0223cff57ca6112bffc2586d6b14833b8f7823`
- `src-tauri/src/lib.rs` `17a0656a85d66536d29db07743966d7f4b6cc144`
- `src-tauri/src/queue/mod.rs` `44fc75643cef02dac32579dda0b41df08dc8c30d`
- `src/utils/tauri.ts` `c24a909ebc355deda0d8e21be4971c05ef459f63`
- `src-tauri/src/settings.rs` `6c4c7804d3abbecef0e1b8c1394db4464cded276`
- `src-tauri/src/processing/sound_booster/presets.rs` `1f0d497f1b2bc523c098a6460f61d887d551e813`
- `src-tauri/src/types.rs` `44e4dbaf18ac6d9cae3d3fb0c4acc895b159d8e6`

## Known workdir drift

At generation time the workdir differed from the sync commit in 39 entries (all committed in d617fb1).
As of the d617fb1 sync the workdir differs only in shared-memory files below.
Rows above describe the sync-commit state unless marked untracked; treat every
path below as overriding the table (modified) or voiding it (deleted).
Refresh this section on every sync from live `git status --short`.

```text
M .agents/references/frontend-converter.md
M BUGFIXES.md
M PROJECT_GRAPH.md
```

Table scope: noisy collateral (icons, fonts, `gen/` outputs, skill data, lockfiles,
deleted-but-tracked docs) folds into one group row per family instead of per-file rows;
`__pycache__` bytecode is omitted entirely. Per-file rows + hashes are reserved for
hand-written sources an agent would actually navigate to or edit.

## Task → File map

| If you want to... | Start here | Also inspect | Usually avoid |
| --- | --- | --- | --- |
| First-run onboarding | `src/components/onboarding/OnboardingGate.tsx` | `OnboardingGate.tsx`, `PermissionSection.tsx`, `ThemeSection.tsx`, `LanguageSection.tsx`, `PerformanceSection.tsx`, `utils/bootPrefs.ts` | player internals |
| Convert/trim/split/silence behavior | `src-tauri/src/processing/pipeline.rs` | `processing/silence.rs`, `processing/split.rs`, `processing/naming.rs`, `ffmpeg/` | player UI |
| Queue progress/cancel | `src-tauri/src/queue/mod.rs` | `src/stores/slices/queueSlice.ts`, `src/components/JobsPanel.tsx` | transcribe queue |
| Converter UI/options | `src/components/converter-wizard/ConverterWizard.tsx` (4-step wizard: upload/configs/progress/result) | `converter-wizard/Wizard*Step.tsx`, `OptionsPanel.tsx`, `FileList.tsx`, `JobsPanel.tsx` (bare), `ConverterResultSection.tsx` | Rust internals |
| Waveform trimmer | `src/components/TrimEditor.tsx` | `src-tauri/src/ffmpeg/waveform.rs` | icons |
| Player/library/scan | `src/components/music-player/TrackListView.tsx` | `src-tauri/src/music_library/`, `src/stores/musicPlayer/` | converter DSP |
| Playback engine | `src/stores/musicPlayer/audioEngine.ts` | `utils/mediaSession.ts`, `utils/artwork.ts` | transcribe |
| File booster | `src/features/sound-booster/` | `src-tauri/src/processing/sound_booster/` | converter DSP |
| Add IPC command | `src-tauri/src/commands/mod.rs` | `src-tauri/src/lib.rs` specta_builder, `examples/export_types.rs`, `src/types/generated.ts`, `src/utils/tauri.ts` | direct `invoke` in components |
| Settings/secrets | `src-tauri/src/settings.rs`, `src-tauri/src/secrets.rs` | `src/stores/slices/settingsSlice.ts`, `utils/bootPrefs.ts` | fonts |
| Android build/run | `scripts/build-android-local.sh`, `scripts/dev-android.sh`, `scripts/patch-android-project.sh` | `src-tauri/android/`, `utils/platform.ts`, `utils/androidBack.ts` | desktop bundling |
| Icons/assets | `scripts/gen-icons.py`, `src-tauri/icons/` | `public/` | Rust logic |
| CI/release | `.github/workflows/ci.yml` | `check:types` gate, `fetch-ffmpeg.mjs` | app code |

## Module dependency map

```text
components/* + features/*  -->  stores/*  -->  utils/tauri.ts  -->  types/generated.ts
                                                          -->  commands/mod.rs  -->  queue / processing / music_library / ffmpeg
processing/pipeline.rs  -->  naming + silence + split + ffmpeg/{locate,probe,run,progress} + sound_booster/*
processing/transcribe/* -->  gemini_client + preprocess + stitch + usage_tracker + secrets.rs (keychain)
music_library/*  -->  platform/{android,linux,macos,windows} + artwork
android Kotlin (PlaybackService/BoostEngine/...)  <-->  android_fs.rs (JNI)  <-->  commands/*android_player*
```

## Dependency boundaries

- UI (`components`, `features`) may depend on stores and `utils/tauri.ts`; never on raw `invoke` or ffmpeg.
- Stores may depend on `utils/tauri.ts` and `types`; converter store (`useAppStore`) and player store (`useMusicPlayerStore`) stay isolated.
- `src/utils/tauri.ts` is the only frontend module importing `types/generated.ts` for invocation.
- `generated.ts` is Specta output: never hand-edit; regenerate via `generate:types`, gated by `check:types` in CI.
- Backend `commands/` may depend on `queue`, `processing`, `music_library`, `ffmpeg`, `settings`/`secrets`/`disk`/`logger`.
- `processing/` submodules never depend on `commands/`; DSP stays UI-agnostic.
- Cloud code is isolated to `processing/transcribe/` + `transcribe_queue.rs` + `secrets.rs`; core convert/enhance/library require no network.
- Android Kotlin talks to Rust only via `android_fs.rs` JNI bridge; frontend detects platform via `utils/platform.ts`.
- Generated code (`gen/`, `icons/`, `generated.ts`, lockfiles) is never hand-edited.

## Critical areas

- Single-pass FFmpeg DSP (`processing/pipeline.rs`): one filter graph, at most one lossy encode; post-silence split timeline.
- Mandatory terminal `alimiter` in every booster chain (`sound_booster/presets.rs`).
- IPC type-safety: Specta builder ↔ `generated.ts` ↔ `tauri.ts` (CI `check:types` gate).
- Secrets: Gemini key in OS keychain only (`secrets.rs`); never in settings/localStorage.
- Atomic non-destructive writes: `.tmp`/`.part` + rename, `(1)/(2)` suffixes (`naming.rs`), kill ffmpeg children on cancel/exit.
- Android scoped storage/MediaStore + single active audio stream (player vs preview mutual pause).
- Disk-space preflight with safety headroom (`disk.rs`, `pipeline.rs`).

