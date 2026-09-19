# Project Rules

This file is used only when the project does not contain a `speckit/` folder.

Rules should be durable, concise, and written as clear statements.

## Project rules

<!-- Add dated durable rules below. -->

<!-- Example:
- 2026-09-16 — Reuse existing shared UI components before creating duplicates.
-->

- 2026-09-19 — `pnpm lint` must pass with zero errors/warnings before finishing any frontend task.
- 2026-09-19 — Never leave an empty `catch {}`: add `/* best-effort: ignore */` or log the error.
- 2026-09-19 — Never use `as any` for i18n keys: type key carriers as `TranslationKey` (e.g. `PresetInfo.labelKey`); use `as unknown as {...}` for foreign globals like `window.__TAURI_INTERNALS__`.
- 2026-09-19 — Never write to a ref during render; sync it inside `useEffect` instead.
- 2026-09-19 — Every `useEffect` dependency must be listed; if selective deps are deliberate, justify with `// eslint-disable-next-line react-hooks/exhaustive-deps -- <reason>`.
- 2026-09-19 — `setState` inside an effect body is allowed only for intentional sync (reset-on-key, debounce, guarded navigation) and requires `// eslint-disable-next-line react-hooks/set-state-in-effect -- <reason>` on the flagged line.
- 2026-09-19 — Component files must only export components (and types): move shared hooks/constants to their own modules instead of re-exporting from UI files.
