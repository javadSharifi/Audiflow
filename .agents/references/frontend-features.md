# Reference — frontend-features

Domain: Sound Booster + Transcribe Studio UI. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src/features/sound-booster/file-booster/ABPreview.tsx` | Original/boosted A/B player + visualizer; exports `ABPreview`. |
| `src/features/sound-booster/file-booster/FileBoosterInline.tsx` | Per-converter-file inline booster; exports `FileBoosterInline`. |
| `src/features/sound-booster/file-booster/FileBoosterPage.tsx` | Full file-booster page picker/presets/preview/export; exports `FileBoosterPage`. |
| `src/features/sound-booster/file-booster/GainSlider.tsx` | Manual gain slider with dB + high-boost flag; exports `GainSlider`. |
| `src/features/sound-booster/file-booster/PresetSelector.tsx` | 2x2 preset grid; exports `PresetSelector`. |
| `src/features/sound-booster/file-booster/__tests__/PresetSelector.test.tsx` | Vitest for preset render + select. |
| `src/features/sound-booster/file-booster/hooks/useFileBooster.ts` | Page hook pick/analyze/preview/export + events; exports `useFileBooster`. |
| `src/features/sound-booster/shared/boosterTypes.ts` | Preset catalog + file-booster state types; exports `BOOSTER_PRESETS`, `FileBoosterState`. |
| `src/features/sound-booster/stores/__tests__/useFileBoosterStore.test.ts` | Vitest for booster store defaults/reset. |
| `src/features/sound-booster/stores/useFileBoosterStore.ts` | Zustand file/preset/preview/export state; exports `useFileBoosterStore`. |
| `src/features/transcribe/CustomVocabularyInput.tsx` | Custom vocab input capped 100 terms; exports `CustomVocabularyInput`. |
| `src/features/transcribe/DiarizationToggle.tsx` | Speaker-diarization switch; exports `DiarizationToggle`, `Switch`. |
| `src/features/transcribe/ErrorBanner.tsx` | Localized Gemini error banner + tech toggle; exports `ErrorBanner`. |
| `src/features/transcribe/FastModeToggle.tsx` | Fast-mode switch; exports `FastModeToggle`. |
| `src/features/transcribe/LanguageSelect.tsx` | Transcription language dropdown; exports `LanguageSelect`. |
| `src/features/transcribe/ModeToggle.tsx` | Verbatim/smart segmented control; exports `ModeToggle`. |
| `src/features/transcribe/OnboardingCard.tsx` | Gemini API-key onboarding + verify; exports `OnboardingCard`. |
| `src/features/transcribe/TimestampToggle.tsx` | Word-timestamps switch; exports `TimestampToggle`. |
| `src/features/transcribe/TranscribeConsentSheet.tsx` | Upload-consent bottom sheet; exports `TranscribeConsentSheet`. |
| `src/features/transcribe/TranscribePage.tsx` | Transcribe flow key-gate/options/result/usage; exports `TranscribePage`. |
| `src/features/transcribe/TranscriptResultView.tsx` | Transcript display + copy/export; exports `TranscriptResultView`. |
| `src/features/transcribe/UsageDashboard.tsx` | Daily-minutes + quota dashboard; exports `UsageDashboard`. |
| `src/features/transcribe/hooks/useTranscribe.ts` | Orchestration key/usage/pick/events/export; exports `useTranscribe`. |
| `src/features/transcribe/stores/__tests__/useTranscribeStore.test.ts` | Vitest for fast-mode coupling/vocab cap/reset. |
| `src/features/transcribe/stores/useTranscribeStore.ts` | Zustand options/job/result/usage; exports `useTranscribeStore`. |

