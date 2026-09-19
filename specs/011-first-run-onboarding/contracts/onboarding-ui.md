# UI Contract: First-Run Onboarding

**Feature**: `011-first-run-onboarding` | **Date**: 2026-09-19

## Onboarding page (shown once, before the main screen)

Single scrollable page, four stacked sections in fixed order, every string available in Persian and English with correct RTL/LTR:

1. **Permissions** — explains why access is needed; actions: grant (platform flow), open OS settings (only when permanently denied), skip section. Grant/deny/skip never blocks confirm.
2. **Theme** — options: light, dark, system-follow; selection previews immediately across the whole page.
3. **Language** — options: Persian, English; selection immediately re-renders all labels and flips layout direction.
4. **High-performance mode** — on/off; takes effect immediately (heavy visual effects reduced when on).

Page-level actions: **Confirm/Finish** (marks onboarding complete, enters app) and **Skip** (keeps safe defaults, marks complete, enters app).

## Settings dialog (top-bar button) after the change

- **Removed rows**: theme switcher, auto-open-output-folder toggle. Neither appears in either language.
- **Retained rows**: language, performance mode, concurrency, and all other existing preferences — unchanged behavior.
- **Unchanged outside the dialog**: the top-bar quick theme toggle remains the only later theme control.

## Copy keys (new i18n keys required in both locales)

Onboarding title, section titles/descriptions (4), permission grant/skip/open-settings labels, theme option labels (3), language option labels (2), performance-mode on/off labels, confirm/finish label, global skip label. Exact key names are an implementation detail; both dictionaries must contain the same set.

## Out of contract

Backend IPC schema (untouched — no new commands, no struct changes), settings-file format (only the stored auto-open value is coerced to `false`), secret storage (no credentials involved).
