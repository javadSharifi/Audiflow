# Layout Contract: Onboarding Start Page

**Feature**: `012-onboarding-layout-fix` | **Date**: 2026-09-20

Frontend-only contract (no IPC, no API). Intended for the implementer and for test assertions. All class names below are illustrative of intent — equivalent utilities satisfying the stated behavior are acceptable.

## 1. Shell / scroller

- Root: `fixed inset-0 z-[95]`, fully opaque background (no translucency showing app content beneath), `overflow-y-auto overflow-x-hidden` (or `overflow-x-clip`), `overscroll-contain`.
- Content column: `mx-auto w-full max-w-lg min-h-full flex flex-col` with horizontal padding. MUST NOT use `h-full` or `justify-between` on the scroll child.
- Content block (header + 4 groups): `flex-1` so the footer rests at the bottom when content fits and flows after content when it overflows.

## 2. Decoration layer

- Single wrapper: `absolute inset-0 overflow-hidden pointer-events-none aria-hidden="true"`.
- Blobs/patterns live ONLY inside this wrapper; negative offsets MUST NOT escape it.
- Blobs use `blur-3xl` at low opacity; when high-performance mode (`reducedBlur`) is on, the layer renders in reduced form (opacity lowered / blur removed) immediately.

## 3. Header (safe-area)

- Contains: brand mark (existing gradient squircle + icon), title (`onboardingTitle`), subtitle (`onboardingSubtitle`), centered.
- Top padding: `padding-top: max(<theme base>, env(safe-area-inset-top))` so the logo clears notch/camera on first paint and keeps the base rhythm elsewhere.

## 4. Option groups (×4, order fixed)

Order: permissions → appearance → language → performance. Each group:

- Card shell: separated card (`rounded-2xl`, border, `dark:` variant), header row (icon chip + title + optional description), options region.
- Options region: `role="radiogroup"` + `aria-label` from `translate()`; each option `role="radio"` + `aria-checked` + visible selected treatment (accent border/background + check indicator).
- Grids: theme `grid-cols-3`; language and performance `grid-cols-2`; labels wrap, never clip, at 320px width and largest system font.
- Permission group additionally: grant / open-OS-settings (when permanently denied) / folder-pick (desktop) / section-skip actions per existing flows; granted state shows the existing success chip.

## 5. Footer actions

- Primary confirm (`onboardingConfirm`) — full-width gradient CTA on mobile; secondary global skip (`onboardingSkipAll`) — ghost button.
- Bottom padding: `padding-bottom: max(<theme base>, env(safe-area-inset-bottom))`.
- MUST be reachable: visible without scroll when content fits; reachable via content scroll when it overflows; never covered by the decoration layer.

## 6. Non-goals (explicitly out of contract)

- No new options, no reordering, no new copy keys unless unavoidable (reuse existing `translate()` keys).
- No change to completion-record writers, settings persistence, permission logic, or any Rust/backend surface.
- No new files, packages, fonts, or network loads.
