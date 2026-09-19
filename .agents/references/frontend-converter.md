# Reference — frontend-converter

Domain: Converter shell + queue UI + converter stores. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src/App.tsx` | Root shell composing converter/player views, boot gate, drag-drop + Android back; exports `App`, `StartBar`; deps stores, `api`, `openWith`. |
| `src/__tests__/AndroidBack.test.tsx` | Vitest for Android hardware-back cooperation flow. |
| `src/components/DropZone.tsx` | Click/drag file-ingest card with probing state; exports `DropZone`; deps `useAppStore`, `pickVideos`. |
| `src/components/FileList.tsx` | Converter file table + minimal mobile cards (icon-only trim/boost 44px buttons, trim icon orange-tinted when trim exists, opens `MobileEditModal`); exports `FileList`; deps `TrimEditor`, `FileBoosterInline`, `format`, `MobileEditModal`. |
| `src/components/MobileEditModal.tsx` | Bottom-sheet modal for mobile trim/boost editing with `z-[80]` stacking context; exports `MobileEditModal`; deps `TrimEditor`, `FileBoosterInline`. |
| `src/components/HeaderBar.tsx` | Top brand/tool-switch bar with theme/lang + settings + GitHub update button (ping badge, only when newer release); theme toggle wraps `revealThemeChange`; exports `HeaderBar`; deps `useAppStore`, `getVersion`, `useGithubUpdate`, `UpdateModal`. |
| `src/components/JobsPanel.tsx` | Conversion queue list with progress/cancel + tech details; exports `JobsPanel`; deps `useAppStore`, `translate`. |
| `src/components/ModernSlider.tsx` | Reusable styled range slider; exports `ModernSlider`, `ModernSliderProps`; React only. |
| `src/components/OptionsPanel.tsx` | Output format/quality/split/silence/folder form + estimates; exports `OptionsPanel`; deps stores, `estimate`/`format`. |
| `src/components/Toasts.tsx` | Auto-dismiss toast stack; exports `Toasts`; deps `useAppStore` toasts. |
| `src/components/TrimEditor.tsx` | Canvas waveform trim editor (5s quick preview buttons, seek latency guard, subtle sub-waveform hint, 44px handles, از/تا typed inputs without steppers); exports `TrimEditor`; deps `api.waveformPeaks`, `format`. |
| `src/components/converter-wizard/WizardStepper.tsx` | Type-only module; exports `WizardStep` (component removed 2026-09: never rendered). |
| `src/components/__tests__/FileList.test.tsx` | Vitest for converter file list rendering/actions. |
| `src/components/__tests__/MobileEditModal.test.tsx` | Vitest for mobile edit modal `z-[80]` stacking and dismissal. |
| `src/components/__tests__/TrimEditor.test.tsx` | Vitest for 5s preview snippets, seek race guard, and sub-waveform guide. |
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
| `src/components/onboarding/OnboardingGate.tsx` | First-run onboarding gate shell with live preview, confirmation, and skip; exports `OnboardingGate`. |
| `src/components/onboarding/PermissionSection.tsx` | Storage/media permission or music folder setup card; exports `PermissionSection`. |
| `src/components/onboarding/ThemeSection.tsx` | Interactive theme selector with instant preview; exports `ThemeSection`. |
| `src/components/onboarding/LanguageSection.tsx` | Persian/English language selector with instant flip; exports `LanguageSection`. |
| `src/components/onboarding/PerformanceSection.tsx` | Reduced blur performance toggle card; exports `PerformanceSection`. |
| `src/components/onboarding/__tests__/OnboardingGate.test.tsx` | Vitest for onboarding gate flow and persistence. |
| `src/components/onboarding/__tests__/PermissionSection.test.tsx` | Vitest for permission status/actions. |
| `src/components/onboarding/__tests__/ThemeSection.test.tsx` | Vitest for theme card selection and theme reveal. |
| `src/components/onboarding/__tests__/LanguageSection.test.tsx` | Vitest for language card selection and RTL flip. |
| `src/components/onboarding/__tests__/PerformanceSection.test.tsx` | Vitest for reduced blur toggle and platform defaults. |
| `src/stores/slices/settingsSlice.test.ts` | Vitest for settings load migration and autoOpenOutputFolder coercion. |
| `src/stores/slices/toastSlice.ts` | Ephemeral toasts with 6s auto-dismiss; exports `createToastSlice`. |
| `src/stores/useAppStore.ts` | Combined Zustand converter store; exports `useAppStore`, `statusLabelKey`; deps 4 slices. |

