# Implementation Plan: First-Run Onboarding

**Branch**: `011-first-run-onboarding` | **Date**: 2026-09-19 | **Spec**: `specs/011-first-run-onboarding/spec.md`

**Input**: Feature specification from `specs/011-first-run-onboarding/spec.md`

## Summary

Show a single one-time start page on fresh install (permissions, theme, language, high-performance mode with live preview and confirm/skip), then simplify the top-bar Settings dialog by removing the theme and auto-open-folder rows. Approach from `research.md`: a lazily-loaded unified gate in the existing `App.tsx` gate slot reusing current store/persistence flows, frontend-only with no IPC-schema change.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict: `strict`, `noUnusedLocals`, `noUnusedParameters`) + React 19; Rust edition 2021 untouched by this feature.

**Primary Dependencies**: Zustand 5 (slice pattern, `useAppStore` settings slice), Tailwind CSS v4, Tauri 2 APIs (path/dialog/opener already in use), `translate()` i18n (en/fa + RTL discipline).

**Storage**: App settings file via existing backend (theme/language/auto-open value); `localStorage`: `ac:first-run-done` (completion), `ac:ui-prefs` (boot theme/lang cache), `ac:reduced-blur` (performance mode). No new storage keys; no credentials involved.

**Testing**: Vitest + Testing Library, colocated `__tests__` pattern (existing gate tests as templates); full gate via `pnpm test` plus typecheck/lint/build. No Rust tests needed (no backend change).

**Target Platform**: Desktop (Windows/macOS/Linux) + Android; permission section branches per platform (media-permission flow vs. folder-picker flow).

**Project Type**: Desktop-app (Tauri) + mobile (Android).

**Performance Goals**: No boot-time regression (gate stays lazy-loaded); denied/skip permission path reaches a usable main screen within seconds; full start flow completable in under 2 minutes.

**Constraints**: Offline-only (no network in any step); no file over 300 lines (split shell + per-section files); no hardcoded UI strings (en+fa keys); single theme-class writer (`useTheme`); no new OS permission types; no `RECORD_AUDIO`.

**Scale/Scope**: 1 new page (4 sections), ~10 new i18n keys × 2 locales, 2 Settings rows deleted, 1 dead auto-open branch deleted, 1 load-time coercion added.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Local-first / offline** — PASS: no network in any step (FR-012); permission flows are OS-local.
- **II. Single-pass DSP** — N/A: no audio-pipeline change.
- **III. Type-safe IPC** — PASS: no Rust signature/struct change, no `generate:types` needed; all persistence via existing typed `utils/tauri` helpers.
- **IV. Atomic file ops** — N/A: no encoding-output change.
- **V. Test-first & CI** — PASS (planned): new Vitest suites for gate visibility/grandfathering/confirm/skip + Settings-row absence; existing gate/i18n suites keep passing.
- **VI. Permission discipline** — PASS: reuses the reviewed media-permission and folder-picker flows; no new permission types.
- **VII. Secrets in keychain only** — PASS: no credentials collected or stored.
- **VIII. i18n / SRP / 300-line ceiling** — PASS (planned): en+fa keys for all new copy; shell + one-file-per-section split; presentation delegates to store actions.

No violations; no Complexity Tracking entry required.

## Project Structure

### Documentation (this feature)

```text
specs/011-first-run-onboarding/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── onboarding-ui.md # Page + Settings-dialog UI contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── onboarding/
│   │   ├── OnboardingGate.tsx          # Single-page shell (lazy-loaded from App.tsx)
│   │   ├── PermissionSection.tsx       # Platform permission flows + section skip
│   │   ├── ThemeSection.tsx            # Light/dark/system with live preview
│   │   ├── LanguageSection.tsx         # fa/en with live RTL/LTR preview
│   │   ├── PerformanceSection.tsx      # High-performance on/off with live effect
│   │   └── __tests__/
│   │       ├── OnboardingGate.test.tsx
│   │       └── PermissionSection.test.tsx
│   ├── HeaderBar.tsx                   # DELETE theme + auto-open-folder rows
│   └── music-player/
│       ├── PermissionGate.tsx          # Retired from boot path (logic reused)
│       └── FirstRunFoldersGate.tsx     # Retired from boot path (logic reused)
├── stores/slices/
│   └── settingsSlice.ts                # Coerce autoOpenOutputFolder=false on load
├── i18n/
│   ├── en.ts                           # New onboarding keys
│   └── fa.ts                           # New onboarding keys (same set)
└── App.tsx                             # Unified gate wiring + grandfathering;
                                        # remove queue-idle auto-open branch

src-tauri/                              # Untouched by this feature
```

**Structure Decision**: Single-project frontend-only change following the existing component/store/i18n layout; the legacy per-platform gates stay in-tree as reference but are detached from the boot path in favor of the unified gate.

## Constitution Check (post-design re-evaluation)

Design artifacts (`research.md`, `data-model.md`, `contracts/onboarding-ui.md`, `quickstart.md`) introduce no new violations: storage for every persisted value is declared in `data-model.md` per the constitution's workflow rule; IPC contract untouched; all copy covered by the i18n rule; file split respects the size ceiling. Gate remains PASS with no new complexity to justify.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — (none) | — | — |
