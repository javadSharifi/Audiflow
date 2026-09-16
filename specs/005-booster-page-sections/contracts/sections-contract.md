# Contract: Booster Page Sections (UI contract)

**Feature**: [spec.md](../spec.md) | **Date**: 2026-09-16

UI-only feature: no HTTP/IPC contract changes. This contract defines the section composition, ordering, gating, and props so section components stay decoupled and independently testable.

## Section order & identity

The page renders exactly four sections, top to bottom, each with a visible step number and translated title:

1. `UploadSection` — file upload
2. `ConfigsSection` — output settings
3. `ProgressSection` — export progress
4. `ResultSection` — output & sharing

On narrow screens they stack 1 → 2 → 3 → 4; wide screens may place them side-by-side in the same order. Order MUST NOT change between locales (RTL mirrors layout, not sequence).

## Props (all sections are controlled; page shell owns the hook)

```text
UploadSection   : { file, isExporting, onPick, onClear }
ConfigsSection  : { file, preset, manualGainPercent, format, preview, activeAudition,
                    isPlaying, currentTime, isPreviewGenerating, previewError, isExporting,
                    onPreset, onGain, onFormat, onAudition, onTogglePlay, onSeek, onExport }
ProgressSection : { isExporting, progress, speed, error }
ResultSection   : { file, outputs, outputSizeBytes, error, isExporting,
                    onOpenFolder, onPlay, onShare, onCopyPath }
```

Sections MUST NOT call the store, hook, or IPC directly — all data flows through props (keeps them testable with static fixtures).

## Gating rules

| Condition | Upload | Configs | Progress | Result |
|-----------|--------|---------|----------|--------|
| `file == null` | active (picker enabled) | disabled + upload-first hint | idle hint | empty state |
| `file != null`, idle | file summary + change/remove | enabled | idle hint | empty state (or last result if file unchanged) |
| `isExporting` | locked (pick/clear disabled) | locked | running (live bar) | previous result hidden or marked stale |
| `completed` | unlocked | enabled | terminal 100% (or returns to idle) | latest result shown |
| `failed` | unlocked | enabled | error message | empty state (no partial file shown) |
| file changed/removed | reset to no-file UI | disabled + hint | idle hint | cleared |

## Text contract (i18n keys, en + fa required)

Each section exposes its copy through `translate(lang, key)` — no literals. Required key groups:

- `booster.section{1..4}.title` — numbered section titles
- `booster.upload.explainer` — capability list shown below the upload card
- `booster.upload.hintFirst` — upload-first hint reused by disabled sections
- `booster.progress.idle / .running / .error`
- `booster.result.empty / .location / .size / .deltaSmaller / .deltaLarger / .deltaSame`
- `booster.result.openFolder / .play / .share / .copyPath / .copied`

## Test hooks

Each section root carries `data-testid="booster-section-{upload|configs|progress|result}"`; states expose `data-state="idle|disabled|running|error|empty|done"` for Vitest assertions (see [quickstart.md](../quickstart.md)).
