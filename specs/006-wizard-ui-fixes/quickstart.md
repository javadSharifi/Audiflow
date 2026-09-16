# Quickstart: Wizard UI Fixes validation

## Prerequisites

- `pnpm install` done; desktop run via `pnpm tauri dev` (or use the installed test build).

## Validate (5 min, no code reading)

1. **Tests**: `pnpm test` — expect 43+ files green, including new `converter-wizard` + `WizardResultList` suites.
2. **Types**: `pnpm build` — `tsc --noEmit` + vite bundle clean.
3. **Upload step**: add 1 file → no capability cards; trim/boost controls show text labels ≥40px; helper line visible under list; Next button is compact (nav scale).
4. **Configs step**: Back (ghost) + Convert (gradient) side by side, both fully above the bottom nav at 360px width.
5. **Convert 2 files** (one valid, optionally one that fails) → progress ring → result step lists every output with name/format/size, failed file as error row, folder banner on top, no share/copy/open/preview controls.
6. **Result step**: input file list is empty; Restart returns to a clean upload step.
7. **RTL**: switch to فارسی — labels, banner, and helper line render right-aligned with correct translations.

## Expected outcomes

- See contracts/ui-contract.md testids for automated assertions.
- All 6 user items verified end-to-end without opening devtools.
