# Quickstart: Booster Page Four Sections

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contract**: [contracts/sections-contract.md](./contracts/sections-contract.md)

Validation guide — proves the regrouped page works end-to-end. No implementation code here; see `tasks.md` (Phase 2) for build steps.

## Prerequisites

- App builds and runs: `pnpm install` → `pnpm tauri dev` (or existing dev flow)
- A sample audio file (e.g., MP3) available for upload
- Tests runner: `pnpm test` (Vitest); type gate: `pnpm build` (TS check)

## Scenario 1 — Four sections render in order with correct empty states

1. Open the sound-booster page with no file selected.
2. **Expect**: four numbered sections 1 → 2 → 3 → 4 (`data-testid="booster-section-upload|configs|progress|result"`).
3. **Expect**: section 1 shows upload card + capability explainer below it; section 2 disabled with upload-first hint; section 3 idle hint; section 4 empty state.
4. Switch language EN ↔ FA. **Expect**: all titles/hints translated, RTL layout correct in FA.

## Scenario 2 — Upload gates configs (FR-003, FR-005)

1. Upload a sample file in section 1. **Expect**: name, size, duration + change/remove buttons appear in section 1.
2. **Expect**: section 2 enables (preset grid, format picker, preview, export button).

## Scenario 3 — Export flows through progress to result (FR-006–FR-009)

1. Pick a preset + format, start export from section 2.
2. **Expect**: section 2 locks; section 3 shows live `Progress bar` with percent (+ speed where available).
3. On completion: **Expect** section 4 shows file name, save location, output size, and smaller/larger delta vs. original; open/play/share/copy-path all work (open-folder hidden on Android, path copyable).
4. Run a second export. **Expect**: section 3 restarts; section 4 shows only the newest result.

## Scenario 4 — Failure and file-change invalidation

1. Trigger a failed export (e.g., remove source mid-export or use a corrupt file). **Expect**: section 3 error in plain language; no partial file in section 4; sections 1–2 usable.
2. Change/remove the file after a completed export. **Expect**: sections 3–4 reset (no stale result).

## Automated checks

- `pnpm test src/features/sound-booster/` — existing + new `BoosterSections.test.tsx` pass (ordering, gating, empty/idle/error states via `data-state`).
- `pnpm build` — TS strict clean; no file in the feature exceeds 300 lines.
- `grep -rn` for raw user-facing literals in new section files returns nothing (i18n discipline).
- Manual walkthrough of SC-001–SC-004 (3-minute first-run, locate-file recall, 1→2→3→4 order).
