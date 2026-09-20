# Research: Onboarding Layout Fix

**Feature**: `012-onboarding-layout-fix` | **Date**: 2026-09-20

All unknowns resolved. No NEEDS CLARIFICATION remains.

## R1: What causes the horizontal scroll?

- **Decision**: Root cause is the two decorative gradient blobs in `OnboardingGate.tsx` (`-top-24 -start-24` / `-bottom-24 -end-24`, each `h-72 w-72`) living directly inside the `overflow-y-auto` scroller with no x-clipping. An `overflow-y: auto` container computes its scrollable overflow from out-of-bounds children in **both** axes, so the 6rem negative start/end offsets create a horizontal scroll range (worse in RTL where `-start-24` pushes the blob past the left edge — exactly the user's "از سمت چپ اسکرول می‌خوره" symptom). The page-level `overflow-x: hidden` on `html/body` (`src/index.css`) does not apply inside the fixed overlay's own scroller.
- **Rationale**: Verified by reading the component; no other child exceeds viewport width (content column is `max-w-lg w-full`, grids are `grid-cols-2/3` inside padded cards).
- **Alternatives considered**: Adding `overflow-x-hidden` to the scroller alone — rejected as sole fix because absolutely-positioned blobs would still be cut asymmetrically and could still shift layout under pinch/zoom; the chosen fix combines a clipped decoration layer (`absolute inset-0 overflow-hidden pointer-events-none`) with `overflow-x: hidden/clip` on the scroller as defense-in-depth.
- **Fix**: Move both blobs into a dedicated `absolute inset-0 overflow-hidden` wrapper; reposition blobs with `inset-inline-start/end` inside that clipped layer (or center them); add `overflow-x-hidden` + `overscroll-contain` to the scroller.

## R2: What causes the unwanted vertical scroll?

- **Decision**: The inner column uses `h-full ... justify-between` with a `my-auto` middle block inside an `overflow-y-auto` scroller. `h-full` of an auto-height scroller plus `justify-between`/`my-auto` distributes phantom free space that the scroll-overflow calculation counts as real content, producing a scrollable page even when content fits. A prior fix (BUGFIXES.md 2026-09-19) compacted paddings to dodge this instead of fixing the layout model, so it regressed perceptibly.
- **Rationale**: Standard flexbox-in-scroller behavior; `min-h-full` (not `h-full`) lets the column be at least viewport-tall without fabricating overflow, and normal flow (no `my-auto` spacers) means scroll appears only on genuine overflow.
- **Alternatives considered**: Sticky footer (`sticky bottom-0`) — rejected: on short viewports it can cover the last card without compensating padding, and it complicates safe-area-bottom handling. Chosen: footer in normal flow at the end of a `min-h-full` column; when content fits, actions rest naturally at the bottom via `flex-1` on the content block (`margin-top: auto` equivalent without scroll side effects).
- **Fix**: Column becomes `min-h-full ... flex-col`; content block `flex-1`; remove `h-full`, `justify-between` on the scroller child, and `my-auto`.

## R3: How to keep the logo clear of the notch/camera?

- **Decision**: `index.html` already sets `viewport-fit=cover`, so `env(safe-area-inset-top)` is live on notch devices. The gate currently uses `pt-1` on mobile with no safe-area compensation, so on edge-to-edge Android the `fixed inset-0` sheet starts under the status/camera area.
- **Rationale**: `viewport-fit=cover` + `env()` padding is the platform-standard mechanism; no native/Kotlin change needed, no new dependency.
- **Alternatives considered**: Hardcoded larger `pt-*` — rejected: wastes space on notch-less devices and still wrong on devices with larger cutouts. Chosen: `pt-[max(<base>,env(safe-area-inset-top))]` on the header (and symmetric `pb-[max(<base>,env(safe-area-inset-bottom))]` on the footer), which degrades to the base padding where `env()` is zero/unsupported.
- **Fix**: Safe-area-aware top padding on the header block, safe-area-aware bottom padding on the footer actions.

## R4: How far does the visual polish go without breaking constraints?

- **Decision**: Polish reuses existing tokens only — Tailwind v4 utilities already in use (`orange-500/amber-500`, `zinc`, `rounded-2xl`, `dark:` variants, `lucide-react` icons, bundled IRANSans) — arranged per the reference mock's hierarchy (centered brand header → 4 separated cards with icon + title + options → gradient primary CTA + ghost skip). No CDN, no new font, no new package, no new persisted value, no backend/IPC touch. Light appearance kept (mock's dark styling adapted through existing `dark:` variants). Option groups migrate from `aria-pressed` toggles to `role="radiogroup"` + `role="radio"` + `aria-checked` (matching the reference mock and FR-011); existing tests asserting visible text/buttons keep passing, tests touching `aria-pressed` get updated.
- **Rationale**: Constitution I (offline), VIII (no hardcoded strings — all copy stays behind `translate()`; file-size ceiling — edits stay inside the 5 existing files, each well under 300 lines), and minimal-change principle all point to restyle-in-place over new components.
- **Alternatives considered**: Extracting a shared `OnboardingCard`/`OptionButton` abstraction — rejected for this feature: 4 sections × small markup duplication does not justify a new abstraction layer now, and each section's content (permission flows vs. choice grids) differs enough that a shared component would accumulate conditional props (a new reason-to-change magnet). Revisit only if a third consumer appears.
- **Fix**: Shell rework in `OnboardingGate.tsx` + class/role polish inside the 4 existing section files; zero new source files.

## R5: How is this verified?

- **Decision**: Extend the existing 5 Vitest suites (`src/components/onboarding/__tests__/`) with assertions on: (a) scroller carries x-clipping + decoration layer is clipped and pointer-transparent; (b) header/footer expose safe-area-aware padding; (c) each choice group exposes `radiogroup`/`radio` roles with correct `aria-checked`; (d) all existing behavior tests (confirm/skip writes flag, i18n strings, permission flows) keep passing. Manual device checks (360×800 fa/en swipe test, notched-emulator first paint, 320px + largest font) documented in `quickstart.md`.
- **Rationale**: jsdom cannot measure real overflow, so automated tests assert the structural contract (classes/roles) while human swipe/paint checks cover SC-001/SC-002/SC-006.
- **Alternatives considered**: Playwright-style visual regression — rejected: no such harness exists in this repo and adding one exceeds the minimal-change scope.
