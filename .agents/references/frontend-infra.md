# Reference — frontend-infra

Domain: IPC facade, utils, i18n, types, styles. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src/i18n/en.ts` | English string dictionary (incl. update-notice keys); exports `en`. |
| `src/i18n/fa.ts` | Persian RTL dictionary typed to `TranslationKey` (incl. update-notice keys); exports `fa`. |
| `src/i18n/index.ts` | `translate(lang,key)` with fallback/interpolation; exports `Lang`, `translate`, `isRtl`. |
| `src/index.css` | Tailwind v4 entry + IRANSans fonts + theme/utilities + theme-reveal view-transition CSS. |
| `src/types/generated.ts` | tauri-specta OUTPUT do-not-edit; ~50 commands + IPC schemas; exports `commands`. |
| `src/types/index.ts` | Hand aliases `ConversionOptions`/`TrimSpec`/`FileMeta`/`QueueItem`; exports `isLossy`. |
| `src/utils/__tests__/artwork.test.ts` | Vitest for artwork cache resolver. |
| `src/utils/__tests__/dialog.test.ts` | Vitest for dialog picker wrappers. |
| `src/utils/__tests__/mediaSession.test.ts` | Vitest for MediaSession sync. |
| `src/utils/__tests__/openWith.test.ts` | Vitest for incoming-file routing. |
| `src/utils/androidBack.ts` | Cooperative hardware-back flag/event; exports `markBackConsumed`, `ANDROID_BACK_EVENT`. |
| `src/utils/artwork.ts` | LRU-500 + localStorage-manifest (negative) cover resolver + idle prefetch; exports `resolveArtworkSrc`, `evictArtworkCache`, `getCachedArtworkSrc`, `scheduleArtworkPrefetch`. |
| `src/utils/bootPrefs.test.ts` | Vitest for boot prefs read/write. |
| `src/utils/bootPrefs.ts` | localStorage boot lang/theme cache for `index.html`; exports `read/writeBootPrefs`. |
| `src/utils/bootPerf.ts` | Namida-style boot phase marks + summary log; exports `markBoot`, `logBootSummary`. |
| `src/utils/__tests__/bootPerf.test.ts` | Vitest for bootPerf mark/log (no-throw). |
| `src/utils/dialog.ts` | Native media/dir pickers; exports `pickVideos`, `pickDirectories`. |
| `src/utils/estimate.test.ts` | Vitest for output-size estimation. |
| `src/utils/estimate.ts` | Bitrate/size estimator mirroring Rust presets; exports `estimateKbps`, `estimateOutputBytes`. |
| `src/utils/externalUrl.ts` | System-browser opener with fallback; exports `openExternalUrl`. |
| `src/utils/format.test.ts` | Vitest for format/parse helpers. |
| `src/utils/format.ts` | Duration/timecode/bytes + parse helpers; exports `formatDuration`, `parseDurationInput`. |
| `src/utils/githubUpdate.test.ts` | Vitest for version compare + release fetch fail-soft. |
| `src/utils/githubUpdate.ts` | GitHub latest-release check (normalize/compare/fetch, fail-soft); exports `fetchLatestRelease`, `isNewerVersion`, `normalizeVersion`, `GITHUB_REPO`. |
| `src/utils/mediaSession.ts` | MediaSession metadata/actions; exports `initMediaSession`, `syncMediaSession`. |
| `src/utils/openWith.ts` | Open-with routing to player/converter; exports `handleIncomingFiles`, `isAudioPath`. |
| `src/utils/platform.ts` | UA-based OS detection; exports `isAndroid/Mobile/Desktop/...`. |
| `src/utils/tauri.ts` | SOLE typed IPC facade over `generated.ts`; exports probe/queue/waveform/disk/booster/library/player/transcribe wrappers + `formatAppError`. |
| `src/utils/themeTransition.test.ts` | Vitest for reveal radius/origin/fallback/guard. |
| `src/utils/themeTransition.ts` | Circular-reveal theme switching via View Transitions API; exports `revealThemeChange`, `revealOrigin`, `computeRevealRadius`. |
| `src/components/waveform/index.ts` | Barrel export for shared waveform UI components, hooks, and geometry helpers. |
| `src/components/waveform/types.ts` | Shared waveform types (`DragTarget`, `WaveformPeak`, `WaveformGripStyle`, `SelectionBounds`). |
| `src/components/waveform/geometry.ts` | Pure mathematical waveform calculations (`timeToPixel`, `pixelToTime`, `clampTime`, `applySelectionBound`, `hitTestHandle`). |
| `src/components/waveform/geometry.test.ts` | Unit tests for waveform geometry, clamping, bounds, and hit testing (15 tests). |
| `src/components/waveform/renderer.ts` | Pure canvas waveform renderer (DPR scaling, unselected dimming, selection gradient, capsule bars, handle grips, laser playhead). |
| `src/components/waveform/audioSource.ts` | Cross-platform preview audio URL resolution (safConvertFileSrc, Linux WebKitGTK scoped blob, sync probe). |
| `src/components/waveform/useWaveformAudio.ts` | Shared hook managing preview `<audio>` element, scrubbing, time bounds clamping, and audition playback. |
| `src/components/waveform/useWaveformInteraction.ts` | Shared hook managing pointer events, handle drag tracking, timeline scrub, and haptic feedback. |
| `src/components/waveform/useWaveformLoader.ts` | Shared hook for loading waveform peaks via IPC facade with synthetic fallback and audio src resolution. |
| `src/components/waveform/WaveformCanvas.tsx` | Reusable responsive canvas component with rAF paint loop, loading skeleton, error boundary, and teardown guards. |
| `src/components/waveform/WaveformAccessibleHandles.tsx` | Accessible invisible 44px handle buttons for screen readers and keyboard navigation. |

