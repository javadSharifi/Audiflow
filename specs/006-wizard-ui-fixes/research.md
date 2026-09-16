# Research: Wizard UI Fixes

## Decision 1: Result list data source — derive from `jobs` store, sizes via one batched `statMediaPaths`

- **Rationale**: `ConverterResultSection` already proves the pattern (latest output + `statMediaPaths([path])` + original size lookup). Extending to all outputs = collect every `outputs[]` across completed jobs, single `statMediaPaths(allPaths)` call, one render. No store shape change, no IPC change.
- **Alternatives considered**: per-row stat calls (rejected: N IPC round-trips); persisting sizes in store (rejected: new state + sync burden for a read-once screen).

## Decision 2: CTA scale — match bottom nav `h-[52px]`, keep full-width layout

- **Rationale**: Verified `MusicPlayerNav` buttons are `h-[52px] rounded-full`. Compact height satisfies "same size as nav buttons" while full-width keeps thumb reach on mobile; the complaint was oversized height/dominance, and the fixed StartBar removal already killed the overlap source.
- **Alternatives considered**: shrink-to-content centered buttons (rejected: weaker primary-action affordance on the convert step).

## Decision 3: Trim/boost discoverability — labeled pill buttons + helper line, editors untouched

- **Rationale**: FileList has two layouts (desktop table row with `trim-toggle-*`, mobile cards with `trim-toggle-mobile-*`), both icon-only `h-6 w-6` (24px). Minimal fix honoring reuse-before-create: widen to labeled pills (icon + `trimEdit`/`boost` text, ≥40px target) in both layouts; add one helper line under the list. TrimEditor/FileBoosterInline expanders unchanged.
- **Alternatives considered**: onboarding tooltip tour (rejected: heavier, annoying on repeat use).

## Decision 4: Input auto-clear — `clearFiles()` on entering result, jobs retained

- **Rationale**: `clearFiles()` exists in fileSlice; clearing on result-entry (not on convert-start) keeps source names resolvable during progress and matches spec FR-011. Jobs map retained so the result list renders; restart clears finished jobs as today.
- **Alternatives considered**: clear on convert-start (rejected: progress step shows source names from files; also blocks "back to add more" during queue).

## Decision 5: Remove `ConverterResultSection` (replace, don't fork)

- **Rationale**: Its latest-only hero + share/copy/open/preview directly contradicts FR-006/FR-008. Forking leaves dead contradictory code; single `WizardResultList` component replaces it. Its test file is rewritten to the new contract.
- **Alternatives considered**: prop-flag to hide actions (rejected: latest-only data model can't satisfy "list all" anyway).

## Decision 6: Nav clearance — content `pb` above fixed nav + no floating bars

- **Rationale**: Overlap came from the fixed StartBar (already deleted in wizard flow). Remaining risk is content scrolling under the fixed bottom nav: wizard container keeps `pb-28`-scale clearance verified at 360px. No new fixed elements introduced.
