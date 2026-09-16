# Data Model: Booster Page Four Sections

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-16

UI-only feature — no new persisted entities, no backend schema changes. All entities below already exist in `useFileBoosterStore` (`src/features/sound-booster/stores/useFileBoosterStore.ts`); this document records the section-view mapping and the one derived value.

## 1. Booster job input (existing)

- **Source**: store `file: { path, name, sizeBytes, durationSecs } | null`
- **Shown in**: Section 1 (Upload) — name, `formatBytes(sizeBytes)`, `formatDuration(durationSecs)`; change/remove actions call `pickFile` / `clearFile`.
- **Validation**: `null` ⇒ sections 2–4 render disabled/idle/empty states (FR-005, FR-006-idle, FR-009).
- **Lifecycle**: `setFile` / `clearFile` already reset `preview`, `exportProgress`, `exportOutputs`, `exportError` ⇒ FR-010 (stale invalidation) holds without new code.

## 2. Output settings (existing)

- **Source**: store `preset`, `manualGainPercent`, `format` (+ `quality`, `outputMode`, `customOutputDir` pass-through, not displayed per spec).
- **Shown in**: Section 2 (Configs) — `PresetSelector`, conditional `GainSlider` (preset `manual` only), format picker, `ABPreview`, export trigger.
- **Validation**: controls `disabled` when `file == null` (with upload-first hint) or `isExporting` (locked); export trigger requires `file != null && !isExporting`.
- **Lifecycle**: preset/gain changes flow through the existing 200 ms debounced `requestPreview`; untouched.

## 3. Export progress (existing, surfaced in its own section)

- **Source**: store `isExporting`, `exportProgress: number | null`, `exportSpeed: string | null`, `exportError: string | null`.
- **Shown in**: Section 3 (Progress) — three mutually exclusive states:
  | State | Condition | Content |
  |-------|-----------|---------|
  | idle | `!isExporting && exportProgress == null && exportError == null` | hint text (what will appear here) |
  | running | `isExporting` | percent bar (`Progress bar`), speed/state text |
  | error | `exportError != null` | plain-language error; sections 1–2 remain usable |
- **Validation**: percent clamped 0–100 for bar width; `null` progress renders 0% (existing behavior preserved).
- **Lifecycle**: driven by queue `job-event` for the active job id; `completed` sets progress 100 + outputs (hands off to section 4); `failed` sets `exportError` (+ `isExporting=false` via setter).

## 4. Boost result summary (existing + one derived value)

- **Source**: store `exportOutputs: string[]` (latest export = `exportOutputs[0]`; only latest shown per clarification), `exportError`.
- **Derived**: `outputSizeBytes` — fetched once per completed export via `statMediaPaths`; `sizeDelta = outputSizeBytes - file.sizeBytes` with direction label (smaller/larger/same) rendered via `formatBytes`.
- **Shown in**: Section 4 (Result) — output file name (basename of path), saved location (directory portion / full path), output size, delta vs. original; empty state before first export; actions: open folder (`openPath`, non-Android), play result, share (`shareAudioTrack`), copy path (clipboard + translated confirmation).
- **Validation**: empty state when `exportOutputs` is empty; error in section 3 suppresses stale result display (outputs cleared on `startExport`).
- **Lifecycle**: replaced on each new completed export; cleared on file change (store already does this).

## Relationships

```text
job input (1) ──configures──▶ output settings (2) ──starts──▶ export progress (3) ──completes──▶ result summary (4)
     │                                │                              │                                    │
     └──────── file change resets 2, 3, 4 (existing store behavior) ─┴────────────────────────────────────┘
```

## What is NOT changing

Store shape, IPC commands/events, DSP pipeline, preset catalog, gain limits, preview flow, atomic-write/naming backend semantics — all out of scope (spec FR-012).
