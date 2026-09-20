# Implementation Plan: Onboarding Layout Fix

**Branch**: `012-onboarding-layout-fix` | **Date**: 2026-09-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-onboarding-layout-fix/spec.md` — fix stray horizontal/vertical scrolling, logo under notch/camera, and polish UI/UX of the first-run start page using the provided mock as visual reference only.

## Summary

Rework the `OnboardingGate` shell layout model (`h-full`/`justify-between`/`my-auto` + unclipped absolute decorations → `min-h-full` column + clipped non-interactive decoration layer + safe-area-aware header/footer padding) and polish the 4 existing section cards in place (accent selected states, `radiogroup`/`radio` + `aria-checked` semantics). Zero new files, zero new dependencies, zero backend/IPC/storage changes; all behavior from `011-first-run-onboarding` preserved. Approach derived from [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5.9 strict (`strict`, `noUnusedLocals`, `noUnusedParameters`), React 19, JSX in `.tsx`

**Primary Dependencies**: Tailwind CSS v4 (utilities + `dark:` custom variant), `lucide-react` icons, Zustand 5 stores (`useAppStore`, `useMusicPlayerStore`), `translate()` i18n — all already in use, no new packages

**Storage**: N/A — no new persisted values; reuses `ac:first-run-done`, app settings + `ac:ui-prefs` boot cache, `ac:reduced-blur` with existing writers only

**Testing**: Vitest + Testing Library (jsdom) — extend the 5 existing suites in `src/components/onboarding/__tests__/`; `pnpm build` for the TS strict gate; manual device matrix in [quickstart.md](quickstart.md) for SC-001/SC-002/SC-006 (jsdom cannot measure real overflow/paint)

**Target Platform**: Tauri 2 app — Android edge-to-edge WebView (primary, 360×800, notched devices, `viewport-fit=cover` already set) + desktop (max-w-lg centered column)

**Project Type**: Desktop/mobile app (Tauri + React frontend-only change)

**Performance Goals**: No scroll jank from decoration layers (clipped, non-interactive, reduced under high-performance mode); first paint already shows header inside safe area (no layout shift correction pass)

**Constraints**: Offline-only (no CDN/fonts/network — reuse bundled IRANSans + lucide); no hardcoded UI strings (all copy via `translate()`, fa+en); no source file may exceed 300 lines; min viewport 320px; RTL (fa) + LTR (en); `radiogroup`/`radio` a11y roles; never request `RECORD_AUDIO`; single audio stream rule untouched

**Scale/Scope**: 5 existing files (`OnboardingGate.tsx` + 4 section components, ~400 lines total), 5 existing test suites; no new modules

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Local-First**: no network, no accounts, no telemetry; mock realized with bundled assets only. — PASS
- [x] **II. Single-Pass DSP**: no audio/FFmpeg surface touched. — PASS (N/A)
- [x] **III. Type-Safe IPC**: no Rust/command/type change; no `invoke()` added. — PASS (N/A)
- [x] **IV. Atomic file ops**: no file encoding/output touched. — PASS (N/A)
- [x] **V. Test-First & CI**: existing 5 suites extended (layout-contract + role assertions); `pnpm test` + `pnpm build` gates in quickstart; no DSP/e2e surface so `cargo test`/`e2e.rs` unaffected. — PASS
- [x] **VI. Platform/permission discipline**: permission flows reused verbatim; no `RECORD_AUDIO`; scoped-storage assumptions untouched. — PASS
- [x] **VII. Secrets**: no credentials collected or stored. — PASS (N/A)
- [x] **VIII. Hygiene**: all copy through `translate()` (fa+en, RTL preserved); SRP preserved (shell owns scroll/safe-area, sections own their option state — no shared-card abstraction introduced, see R4); every touched file stays far below the 300-line ceiling. — PASS

*Post-design re-check (Phase 1): no new entities, no new writers, no new files — all gates still PASS. No violations to justify; Complexity Tracking stays empty.*

## Project Structure

### Documentation (this feature)

```text
specs/012-onboarding-layout-fix/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── onboarding-layout.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── onboarding/
│       ├── OnboardingGate.tsx      # EDIT: shell/scroller, clipped decoration layer,
│       │                           #         safe-area header/footer, min-h-full column
│       ├── PermissionSection.tsx   # EDIT: card polish + radiogroup semantics (flows untouched)
│       ├── ThemeSection.tsx        # EDIT: card polish + radio semantics (writers untouched)
│       ├── LanguageSection.tsx     # EDIT: card polish + radio semantics (writers untouched)
│       ├── PerformanceSection.tsx  # EDIT: card polish + radio semantics (writers untouched)
│       └── __tests__/              # EXTEND: contract + role assertions (5 suites)
├── i18n/                           # READ-ONLY unless an unavoidable new key needs fa+en pair
└── index.css / index.html          # READ-ONLY reference (overflow-x clip, viewport-fit=cover)

src-tauri/                          # UNTOUCHED — no backend surface in this feature
```

**Structure Decision**: Single-project frontend-only rework in place. No new directories, components, stores, or contracts outside `specs/012-onboarding-layout-fix/contracts/` (documentation). Rejected a shared `OnboardingCard` abstraction per research R4 (minimal-change + SRP: section contents differ enough that sharing would create a conditional-props magnet).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — (none) | — | — |
