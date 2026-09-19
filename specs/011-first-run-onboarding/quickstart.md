# Quickstart: First-Run Onboarding

**Feature**: `011-first-run-onboarding` | Validates the spec end-to-end. See `contracts/onboarding-ui.md` for the page contract and `data-model.md` for storage rules.

## Prerequisites

- Desktop build (or Android emulator) with a way to clear app data.
- Commands run from the repo root.

## Scenario 1: Fresh install shows the page once

1. Clear app data (fresh state: no completion flag, no boot cache, no cached tracks).
2. Launch the app → the start page appears before the main screen, with all four sections in order.
3. Pick non-default values (English, dark, performance on), grant or skip permissions, press Confirm.
4. Restart the app 3 times → main screen appears directly every time, with English/dark/performance choices applied.

## Scenario 2: Skip keeps safe defaults

1. Clear app data, launch, press global Skip.
2. Main screen appears with Persian, system-follow theme, and platform-default performance mode.

## Scenario 3: Kill mid-onboarding keeps selections

1. Clear app data, launch, change theme/language, then kill the app without confirming.
2. Relaunch → start page shows again with the previously selected values kept; main screen is still gated.

## Scenario 4: Denied permissions never block

1. Clear app data, launch, deny (or skip) the permission section, press Confirm.
2. Main screen is usable within seconds with an empty-library state; no hang on the OS dialog dismissal.

## Scenario 5: Upgrade never re-shows the page

1. Use a pre-feature install (or simulate: boot cache / cached tracks present, completion flag absent).
2. Launch the updated app → main screen appears directly, no start page.

## Scenario 6: Settings no longer has theme or auto-open-folder

1. Open Settings via the top-bar button in both languages → no theme row, no auto-open-folder row.
2. Change language and performance mode → applies immediately and persists after restart.
3. A previously stored auto-open `true` behaves as off after update; per-result manual "open folder" still works.

## Automated checks

- Run the onboarding component tests plus the existing gate/i18n suites: `pnpm test` (narrow to the onboarding and settings specs first, then the full suite).
- Typecheck/lint/build per repo gates before merge; no `check:types` drift is expected (no IPC change).
