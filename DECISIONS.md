# Architecture & Design Decisions

This file records durable decisions that future agents may otherwise accidentally reverse.

Use it for:
- architecture choices;
- dependency/library choices;
- state-management boundaries;
- important design patterns;
- durable trade-offs that future agents should preserve.

Do not use it for:
- routine bug fixes;
- temporary task choices;
- every small refactor;
- implementation details that are obvious from the code.

## Decision format

```markdown
## YYYY-MM-DD — <decision title>

**Decision:** <what was chosen>

**Why:** <short rationale>

**Alternatives considered:** <optional>

**Implication:** <what future agents should preserve or know>
```

## 2026-09-16 — Circular theme reveal via View Transitions API

**Decision:** Light/Dark switching animates as a ~300ms `clip-path: circle()` expanding
from the toggle click point (`document.startViewTransition` + `src/utils/themeTransition.ts`);
instant fallback where the API is missing; no `prefers-reduced-motion` opt-out (explicit user choice).

**Why:** GPU-cheap single-property animation with minimal lag feel on mobile; store stays
source of truth while `applyResolvedTheme` paints synchronously for snapshot capture.

**Alternatives considered:** Custom overlay-div circle (heavier, rejected); fade fallback (rejected for lag).

**Implication:** Keep reveal logic in `themeTransition.ts`; both `HeaderBar` toggles must stay
wrapped. Reconsider the reduced-motion opt-out if a11y requirements tighten.

When a later decision supersedes an earlier one, preserve the historical entry and add a short note such as:

`Superseded by: <date/title>`
