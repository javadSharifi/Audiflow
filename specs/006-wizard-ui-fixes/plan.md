# Implementation Plan: Wizard UI Fixes

**Branch**: `006-wizard-ui-fixes` | **Date**: 2026-09-16 | **Spec**: specs/006-wizard-ui-fixes/spec.md

**Input**: Feature specification from `/specs/006-wizard-ui-fixes/spec.md`

## Summary

Presentation-only rework of the converter 4-step wizard: drop the upload-step capability cards, shrink wizard CTAs to bottom-nav scale (`h-[52px]`), make per-file trim/boost labeled ≥40px controls with a helper line, rebuild the result step as a full output list (name/format/size + error rows, folder banner, no action buttons/preview), keep buttons clear of the bottom nav, and auto-clear inputs when the result appears.

## Technical Context

**Language/Version**: TypeScript 5.9 strict + React 19

**Primary Dependencies**: Zustand ^5 (slices), Tailwind CSS v4, lucide-react icons, Tauri v2 shell

**Storage**: N/A (no new persisted values; inputs cleared from in-memory store only)

**Testing**: Vitest + Testing Library (`pnpm test`), `tsc --noEmit` via `pnpm build`

**Target Platform**: macOS (Tauri bundle) + Android (same wizard, 360px-min layout)

**Project Type**: desktop-app (Tauri)

**Performance Goals**: No new IPC on render paths; single batched size lookup for the result list

**Constraints**: Offline-first (no network); RTL Persian preserved; no hardcoded strings (constitution VIII); 300-line file ceiling

**Scale/Scope**: 6 files touched/added under `src/components/` + i18n keys; ~10 new tests

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- I. Local-first: PASS — no network/cloud touched.
- II. Single-pass DSP: PASS — no processing changes.
- III. IPC contract: PASS — no Rust changes; reuses typed `statMediaPaths` helper (one batched call).
- IV. Atomic files: PASS — no file writes.
- V. Test-first + CI: PASS — Vitest coverage for each FR-observable behavior; full `pnpm test` + `pnpm build` before merge.
- VI. Platform/permissions: PASS — no permissions; single-audio rule intact (preview player removed).
- VII. Secrets: PASS — none involved.
- VIII. i18n/SRP/300-line ceiling: PASS — all strings via `translate()` en+fa; result list extracted as its own component; no file exceeds ceiling.

Post-design re-check: PASS — design adds `WizardResultList.tsx` + `FileRowActions` split precisely to respect SRP/ceiling; contracts use existing typed helpers only.

## Project Structure

### Documentation (this feature)

```text
specs/006-wizard-ui-fixes/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── FileList.tsx                        # MOD: labeled ≥40px trim/boost controls + helper line
│   ├── JobsPanel.tsx                       # UNCHANGED (bare prop reused)
│   ├── ConverterResultSection.tsx          # DELETE or repurpose (replaced by WizardResultList)
│   ├── converter-wizard/
│   │   ├── ConverterWizard.tsx             # MOD: clear inputs on result; compact CTA scale
│   │   ├── WizardUploadStep.tsx            # MOD: remove capability cards; compact next
│   │   ├── WizardConfigsStep.tsx           # MOD: compact back/convert; bottom padding vs nav
│   │   ├── WizardProgressStep.tsx          # UNCHANGED (verify nav clearance)
│   │   ├── WizardResultStep.tsx            # MOD: banner + WizardResultList + restart
│   │   ├── WizardResultList.tsx            # NEW: all-outputs rows + error rows
│   │   └── __tests__/                      # NEW/MOD tests
├── i18n/
│   ├── en.ts / fa.ts                       # MOD: ~8 new keys
```

**Structure Decision**: Single-project layout; all changes under existing `src/components/` wizard + FileList, following the current slice/component organization.

## Complexity Tracking

> No constitution violations — table not applicable.
