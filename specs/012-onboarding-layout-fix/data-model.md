# Data Model: Onboarding Layout Fix

**Feature**: `012-onboarding-layout-fix` | **Date**: 2026-09-20

No new entities. No new persisted values. No backend changes. This feature reworks the **presentation** of entities defined in `specs/011-first-run-onboarding/data-model.md`; that document remains authoritative for state, storage, and transitions. What follows is the layout-level contract the reworked UI implements.

## Entity: Start page layout (presentation-only rework)

- **Structure**: `shell (fixed overlay + scroller)` → `decoration layer (clipped, non-interactive)` → `column (min-h-full)` → `header` → `content (4 stacked groups, flex-1)` → `footer (confirm + global skip)`.
- **Fields (layout-owned, not persisted)**:
  - `scrollAxis`: vertical-only. Horizontal overflow is structurally impossible (clipped decoration layer + x-clipped scroller). Vertical scroll exists only on genuine content overflow.
  - `safeTop / safeBottom`: header top padding = `max(base, env(safe-area-inset-top))`; footer bottom padding = `max(base, env(safe-area-inset-bottom))`. Zero on devices without cutouts.
  - `selectedState per group`: derived live from existing stores (theme / lang / reducedBlur / permissionStatus) — no new state.
- **Validation**:
  - Decoration layer MUST be `aria-hidden`, `pointer-events-none`, and fully inside an `overflow-hidden` clip box; it MUST NOT contain interactive elements.
  - Scroller MUST clip horizontal overflow and contain overscroll chaining (`overscroll-behavior-x: none` or equivalent).
  - Column MUST use `min-h-full` (never `h-full`) with footer in normal flow so no phantom scroll range is fabricated.
  - Every option group MUST expose `role="radiogroup"` with `role="radio"` + `aria-checked` options and an accessible label from `translate()`.
  - No user-facing string outside `translate(lang, key)`; both `fa` and `en` keys required for any new copy (prefer reusing existing keys).
- **State transitions**: none — layout has no state machine. All behavior transitions (completion record, preferences, permission) are inherited unchanged from `011-first-run-onboarding/data-model.md`.

## Unchanged entities (by reference)

| Entity | Source of truth | This feature touches |
|--------|-----------------|----------------------|
| Onboarding completion record (`ac:first-run-done`) | 011 data-model Entity 1 | Nothing (confirm/skip writers untouched) |
| User preferences (lang / theme / reducedBlur) | 011 data-model Entity 2 | Read-only preview + existing writers untouched |
| Permission grant state | 011 data-model Entity 3 | Existing grant/skip/settings flows untouched |
| App settings (simplified) | 011 data-model Entity 4 | Nothing |

## Relationships

- Layout reads store state for preview/selection display only; it never introduces a second writer for any persisted value.
- Permission state still gates library content only, never onboarding completion or layout rendering.
