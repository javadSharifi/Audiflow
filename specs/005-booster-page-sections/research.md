# Research: Booster Page Four Sections

**Date**: 2026-09-16 | **Feature**: [spec.md](./spec.md)

All unknowns resolved from the existing codebase — no external research needed. Each finding below maps to a plan decision.

## R-1: Where does page state live? (no new store needed)

- **Decision**: Reuse `useFileBoosterStore` + `useFileBooster` hook as-is; section components receive data/actions via props from the page shell.
- **Rationale**: Store already holds every section's state (`file`, `preset`, `manualGainPercent`, `format`, `preview`, `isExporting`, `exportProgress`, `exportSpeed`, `exportOutputs`, `exportError`) and `setFile`/`clearFile` already reset progress + outputs on file change (FR-010 satisfied for free).
- **Alternatives considered**: New section-level store slice — rejected, duplicates state and risks drift between sections.

## R-2: How to render share / open-folder / copy-path actions?

- **Decision**: Open folder via `openPath(dir)` from `@tauri-apps/plugin-opener` (guarded by `isAndroid()` as today); share via existing `shareAudioTrack(path)` typed helper in `src/utils/tauri.ts` (same backend command the music player uses, incl. Android FileProvider path); copy path via `navigator.clipboard.writeText` with translated confirmation.
- **Rationale**: All three mechanisms already exist and are platform-tested; reuses instead of creating new IPC (Constitution III, VI).
- **Alternatives considered**: New Rust command for reveal-in-folder — rejected, `openPath` already covers desktop and degrades gracefully on Android.

## R-3: How to compute the size comparison (output vs. original)?

- **Decision**: Original size from `file.sizeBytes` (already in store); output size via one `statMediaPaths([outputPath])` call on `completed` event (or reuse bytes if the queue event carries them); render `formatBytes` + absolute delta + smaller/larger direction with existing `src/utils/format.ts` helpers.
- **Rationale**: Single extra metadata call per completed export; no render-loop IPC; helpers already translated-locale-agnostic (numbers + units).
- **Alternatives considered**: Backend returning output size in the `completed` event — rejected, would change the IPC contract for a display-only need.

## R-4: Which new i18n keys are required?

- **Decision**: Add keys for: section numbers/titles (4), upload explainer (capabilities list), upload-first hint, progress idle/running/error texts, result labels (location, size, delta), action labels (open folder, play, share, copy path, copied confirmation), result empty-state text. Every key lands in both `src/i18n/en.ts` and `src/i18n/fa.ts`.
- **Rationale**: Constitution VIII bans hardcoded strings; Persian RTL layout is verified by rendering sections in `fa` locale.
- **Alternatives considered**: Reusing only existing keys — rejected, result/progress explainers have no current equivalent.

## R-5: How to stay within the 300-line file ceiling?

- **Decision**: Extract four section components (`sections/UploadSection.tsx`, `ConfigsSection.tsx`, `ProgressSection.tsx`, `ResultSection.tsx`) plus an optional `SectionShell` (number badge + title wrapper); `FileBoosterPage.tsx` becomes a thin composition shell (~60 lines). Reuse `PresetSelector`, `GainSlider`, `ABPreview` unchanged inside `ConfigsSection`.
- **Rationale**: Current page is 218 lines and would exceed 300 with four sections inline; split follows SRP (each section = one reason to change) per Constitution VIII.
- **Alternatives considered**: Keeping one file with inline JSX blocks — rejected, violates the hard 300-line ceiling.

## R-6: How to keep preview/export behavior identical?

- **Decision**: Move existing JSX blocks verbatim into section components; no changes to `useFileBooster` event wiring, debounce, `startExport` payload, or queue `job-event` handling. `ConfigsSection` stays mounted (not conditionally unmounted) so the preview `Audio` element lifecycle is untouched — disabled state is visual + `disabled` attrs only.
- **Rationale**: FR-012 (behavior-preserving); unmounting sections would destroy preview audio state and break the debounce/preview flow.
- **Alternatives considered**: Conditional mount per step (wizard-style) — rejected, breaks audio element continuity and contradicts the stacked-sections spec.

## Resolved NEEDS CLARIFICATION

None remain — Technical Context has no open items; all spec clarifications were resolved in the clarify session (spec.md `## Clarifications`, 2026-09-16).
