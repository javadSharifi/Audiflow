# Research: First-Run Onboarding

**Feature**: `011-first-run-onboarding` | **Date**: 2026-09-19

All technical unknowns were resolved from the existing codebase (no NEEDS CLARIFICATION remained after `/speckit.clarify`). Each decision below reuses an established pattern.

## Decision 1: Mount a unified onboarding gate in the existing App.tsx gate slot

- **Decision**: Add a lazily-loaded `OnboardingGate` component rendered from `App.tsx` in the same place the `FirstRunFoldersGate` / `PermissionGate` overlays render today (above `z-50` content, blocking the main screen until confirm/skip). The two legacy gates are retired from the boot path; their inner flows (media-permission request, folder picker) are reused inside the onboarding permission section.
- **Rationale**: Boot already defers the library scan while a gate is up, removes the splash only after settings settle, and lazy-loads rare-condition gates so the initial chunk stays small — all required behaviors already exist in this slot.
- **Alternatives considered**: A dedicated route/screen outside `App.tsx` (rejected: app is a single-screen shell with no router; a gate overlay matches both legacy gates and avoids new navigation machinery). Keeping the two legacy gates alongside onboarding (rejected: triple overlapping gates, contradictory show-conditions, and the permission step would appear twice).

## Decision 2: Grandfather existing installs so upgrades never re-show onboarding

- **Decision**: Show onboarding only when there is no evidence of prior use: `ac:first-run-done` unset AND no `ac:ui-prefs` boot cache AND no `ac:reduced-blur` key AND no cached library tracks. If any evidence exists but the flag is unset (e.g., Android upgraders, who never set the flag), silently mark the flag done during boot.
- **Rationale**: Desktop upgraders already carry the flag from the legacy folders gate, but Android upgraders do not (its skip was session-scoped). Evidence-checking is the only rule that satisfies the spec edge case "upgrade without data loss does not re-show onboarding" on both platforms without a version-migration table.
- **Alternatives considered**: Version-stamped completion flag with a migration (rejected: heavier, needs a stored app-version comparison and still cannot distinguish fresh-install-old-version from upgrade). Showing onboarding to all upgraders once (rejected: directly violates the spec).

## Decision 3: Apply each choice immediately, persist immediately, complete only on confirm/skip

- **Decision**: Theme, language, and performance-mode controls write through the same store actions the Settings dialog uses today (`updateSettings` + `persistSettings` for theme/language; `setReducedBlur` for performance mode), so every choice previews live and survives a mid-onboarding kill. The completion flag (`ac:first-run-done`) is written only on confirm or global skip.
- **Rationale**: This exactly produces the clarified behavior — "show again with already-selected values kept" after a kill — with zero new persistence machinery, and mirrors the `HeaderBar.patch` pattern (update + persist in one gesture).
- **Alternatives considered**: Staging choices in local component state and committing on confirm (rejected: a kill would lose selections, contradicting the clarification; also duplicates store logic).

## Decision 4: Permission section reuses existing platform flows

- **Decision**: Android section drives the existing media-permission store flow (`permissionStatus` / `requestMediaPermission`, with the permanently-denied → open-OS-settings path); desktop section drives the existing folder-picker + custom-folders persistence flow. Both expose skip, and neither blocks confirm.
- **Rationale**: Constitution Principle VI (permission discipline, no `RECORD_AUDIO`, scoped-storage respect) is already encoded in these flows; reusing them inherits the review guarantees instead of re-litigating them.
- **Alternatives considered**: A new unified permission abstraction (rejected: the platforms genuinely differ — runtime grant vs. folder selection — and an abstraction would hide OS-specific failure modes).

## Decision 5: Settings cleanup is frontend-only; force auto-open off with self-healing coercion

- **Decision**: Delete the theme row and auto-open-folder row from the `HeaderBar` settings dialog, remove the now-dead `queue-idle` auto-open branch in `App.tsx`, and coerce `autoOpenOutputFolder` to `false` inside `loadSettings` (persisting the correction when it was `true`). No Rust or IPC-schema change.
- **Rationale**: The setting already defaults to `false` backend-side; coercion on load follows the existing precedent for Android `custom_folder` coercion in the same slice, keeps the Specta contract untouched (no `generate:types` / `check:types` churn per Constitution III), and makes the clarified "force off for everyone" migration self-healing on first launch after update.
- **Alternatives considered**: Backend migration in `settings.rs` (rejected: touches the IPC-adjacent contract for a pure UI removal; larger blast radius). Preserving hidden per-user values (rejected: contradicts the clarification).

## Decision 6: Split the UI into small section files; all copy via i18n keys

- **Decision**: New code lives in `src/components/onboarding/` as a thin shell (`OnboardingGate.tsx`) plus one file per section (permission / theme / language / performance), each well under the 300-line ceiling, reusing existing icons, `translate()`, and dialog styling. Every new string gets an `en` + `fa` key before merge.
- **Rationale**: Constitution VIII (300-line ceiling, single responsibility, no hardcoded text) and RTL discipline; section files keep the shell readable and let tests target one section at a time, following the existing `__tests__` colocated pattern.
- **Alternatives considered**: One monolithic onboarding file (rejected: would approach/overrun the ceiling once four sections plus copy land). Hardcoded bilingual strings (rejected: prohibited by the constitution).
