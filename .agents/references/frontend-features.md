# Reference — frontend-features

Domain: Sound Booster UI. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src/features/sound-booster/file-booster/ABPreview.tsx` | Original/boosted A/B player + visualizer; exports `ABPreview`. |
| `src/features/sound-booster/file-booster/FileBoosterInline.tsx` | Per-converter-file inline booster; exports `FileBoosterInline`. |
| `src/components/SectionShell.tsx` | Numbered section wrapper (badge + title + data-state); shared by booster + converter sections; exports `SectionShell`. |
| `src/components/converter-wizard/WizardResultList.tsx` | Result list: all outputs (name/format/size) + error rows + folder banner, no actions/preview; exports `WizardResultList`. |
| `src/components/converter-wizard/ConverterWizard.tsx` | Converter 4-step wizard shell (step state, guided nav, auto-advance 3→4); exports `ConverterWizard`. |
| `src/components/converter-wizard/WizardStepper.tsx` | Type-only module; exports `WizardStep` (component removed 2026-09: never rendered, test asserts absence). |
| `src/components/converter-wizard/WizardUploadStep.tsx` | Wizard step 1: DropZone/FileList + capability cards + next CTA; exports `WizardUploadStep`. |
| `src/components/converter-wizard/WizardConfigsStep.tsx` | Wizard step 2: OptionsPanel + back/convert CTAs; exports `WizardConfigsStep`, `useConvertDisabled`. |
| `src/components/converter-wizard/WizardProgressStep.tsx` | Wizard step 3: SVG percent ring + current file + JobsPanel bare; exports `WizardProgressStep`. |
| `src/components/converter-wizard/WizardResultStep.tsx` | Wizard step 4: done summary + latest hero + other outputs + restart; exports `WizardResultStep`. |
| `src/components/converter-wizard/__tests__/ConverterWizard.test.tsx` | Vitest for wizard nav/convert/auto-advance/restart. |
| `src/features/sound-booster/file-booster/sections/UploadSection.tsx` | Section 1: upload card + explainer below + file summary; exports `UploadSection`. |
| `src/features/sound-booster/file-booster/sections/ConfigsSection.tsx` | Section 2: preset/gain + format + preview + export trigger; exports `ConfigsSection`. |
| `src/features/sound-booster/file-booster/sections/ProgressSection.tsx` | Section 3: idle/running/done/error progress states; exports `ProgressSection`. |
| `src/features/sound-booster/file-booster/sections/ResultSection.tsx` | Section 4: location/size-delta + open/play/share/copy; exports `ResultSection`, `mimeForOutput`. |
| `src/features/sound-booster/file-booster/GainSlider.tsx` | Manual gain slider with dB + high-boost flag; exports `GainSlider`. |
| `src/features/sound-booster/file-booster/PresetSelector.tsx` | 2x2 preset grid; exports `PresetSelector`. |
| `src/features/sound-booster/file-booster/__tests__/PresetSelector.test.tsx` | Vitest for preset render + select. |
| `src/features/sound-booster/file-booster/__tests__/UploadSection.test.tsx` | Vitest for section 1 empty/ready/locked states. |
| `src/features/sound-booster/file-booster/__tests__/ConfigsSection.test.tsx` | Vitest for section 2 disabled/ready/locked states. |
| `src/features/sound-booster/file-booster/__tests__/ProgressSection.test.tsx` | Vitest for section 3 idle/running/error states. |
| `src/features/sound-booster/file-booster/__tests__/ResultSection.test.tsx` | Vitest for section 4 empty/done/actions + mime helper. |
| `src/features/sound-booster/shared/boosterTypes.ts` | Preset catalog + file-booster state types; exports `BOOSTER_PRESETS`, `FileBoosterState`. |
| `src/features/sound-booster/stores/__tests__/useFileBoosterStore.test.ts` | Vitest for booster store defaults/reset. |
| `src/features/sound-booster/stores/useFileBoosterStore.ts` | Zustand file/preset/preview/export state; exports `useFileBoosterStore`. |

