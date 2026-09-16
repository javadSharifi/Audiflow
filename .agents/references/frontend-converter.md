# Reference — frontend-converter

Domain: Converter shell + queue UI + converter stores. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src/App.tsx` | Root shell composing converter/player views, boot gate, drag-drop + Android back; exports `App`, `StartBar`; deps stores, `api`, `openWith`. |
| `src/__tests__/AndroidBack.test.tsx` | Vitest for Android hardware-back cooperation flow. |
| `src/components/DropZone.tsx` | Click/drag file-ingest card with probing state; exports `DropZone`; deps `useAppStore`, `pickVideos`. |
| `src/components/FileList.tsx` | Converter file table + minimal mobile cards (icon-only trim/boost 44px buttons, trim icon orange-tinted when trim exists, editors in `MobileEditModal` bottom-sheet); exports `FileList`; deps `TrimEditor`, `FileBoosterInline`, `format`. |
| `src/components/HeaderBar.tsx` | Top brand/tool-switch bar with theme/lang + settings + GitHub update button (ping badge, only when newer release); theme toggle wraps `revealThemeChange`; exports `HeaderBar`; deps `useAppStore`, `getVersion`, `useGithubUpdate`, `UpdateModal`. |
| `src/components/JobsPanel.tsx` | Conversion queue list with progress/cancel + tech details; exports `JobsPanel`; deps `useAppStore`, `translate`. |
| `src/components/ModernSlider.tsx` | Reusable styled range slider; exports `ModernSlider`, `ModernSliderProps`; React only. |
| `src/components/OptionsPanel.tsx` | Output format/quality/split/silence/folder form + estimates; exports `OptionsPanel`; deps stores, `estimate`/`format`. |
| `src/components/Toasts.tsx` | Auto-dismiss toast stack; exports `Toasts`; deps `useAppStore` toasts. |
| `src/components/TrimEditor.tsx` | Canvas waveform trim editor (compact play button, 44px handle hit-areas + keyboard-arrow nudges, از/تا typed inputs without steppers, small duration text, live-region feedback); exports `TrimEditor`; deps `api.waveformPeaks`, `format`. |
| `src/components/converter-wizard/WizardStepper.tsx` | Wizard 1-4 progress (mobile: current step badge + full label only; `sm:`+ full 4-step row with truncate); exports `WizardStepper`, `WizardStep`; deps `translate`. |
| `src/components/__tests__/FileList.test.tsx` | Vitest for converter file list rendering/actions. |
| `src/components/__tests__/HeaderBar.test.tsx` | Vitest for header bar theme/lang/tool switching + update-button visibility/dialog. |
| `src/components/UpdateModal.tsx` | Celebratory new-version dialog (gradient hero, version pills, notes, download CTA via `openExternalUrl`); exports `UpdateModal`. |
| `src/hooks/useGithubUpdate.ts` | Polls GitHub latest release on mount + every 24h with localStorage cache, fail-soft; exports `useGithubUpdate`. |
| `src/hooks/useDebouncedDeferred.ts` | Debounce + `useDeferredValue` (0ms in tests); exports `useDebouncedDeferred`. |
| `src/hooks/useNativeDragDrop.ts` | Forwards Tauri webview drop paths; exports `useNativeDragDrop`. |
| `src/hooks/useTheme.ts` | Theme/direction side-effects for `<html>`; exports `resolveTheme`, `applyResolvedTheme`, `useTheme`, `useDirection`. |
| `src/main.tsx` | React StrictMode entry + mobile pinch/ctrl-zoom guards; mounts `App`; deps `App`, `index.css`. |
| `src/stores/slices/fileSlice.ts` | Files/probing + `addPaths`/`removeFile`/`setTrim`; deps `api.statMediaPaths`. |
| `src/stores/slices/queueSlice.ts` | Jobs Map + `startQueue`/`cancelJob`/`initEventListeners`; deps Tauri `event`, `api`. |
| `src/stores/slices/settingsSlice.ts` | Options/lang/theme/`activeTool` + persistence; deps `api`, `bootPrefs`. |
| `src/stores/slices/toastSlice.ts` | Ephemeral toasts with 6s auto-dismiss; exports `createToastSlice`. |
| `src/stores/useAppStore.ts` | Combined Zustand converter store; exports `useAppStore`, `statusLabelKey`; deps 4 slices. |

