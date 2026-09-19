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

## 2026-09-19 — Transcribe Studio frontend removed (Gemini unusable in Iran)

**Decision:** Deleted `src/features/transcribe/` (15 files) + its `tauri.ts` facade (`GeminiApiError`, `geminiKindOf`, key/queue/usage/transcript wrappers) + orphaned `types/index.ts` re-exports (`Transcription*`, `TranscribeSettings`, `UsageStats`, `ObservedQuota`, `WordInfo`, `GeminiErrorKind`, `BoosterJobSpec`, `TranscriptionEvent`). Rust backend (`processing/transcribe/`, `transcribe_queue.rs`, `secrets.rs`), `generated.ts` mirrors, and `i18n` transcribe keys intentionally kept.

**Why:** Gemini cloud transcription has no practical use for Iran-based users right now; the UI was unreachable from `App` anyway.

**Alternatives considered:** Keeping the hidden tree (rejected — dead code rots; restore is one `git show` away).

**Implication:** Restore via git history (`git log --all --oneline -- src/features/transcribe`) if re-enabled; re-add the `tauri.ts` facade + type re-exports from the same commit. Do not reintroduce piecemeal.

## 2026-09-19 — playingKey selector pattern + whole-second store clock for library perf

**Decision:** (1) `useMusicPlayerStore` carries a derived `playingKey: string` (`track.id || uri || path`, `""` when idle) maintained alongside every `currentTrack` mutation; row/card components subscribe to `playingKey` + per-row boolean selectors (`isLiked`, `isSelected`) instead of whole Sets or the `currentTrack` object. (2) All `currentTime` store writes are quantized to whole seconds (`Math.floor` deltas) in `audioEngine.ts` (`timeupdate`, smooth ticker, native poll adoption). (3) Artwork cache: LRU 500 in memory + bounded localStorage manifest (`player-artwork-manifest-v1`, 1500) with negative caching; desktop disk cache lives in the OS cache dir (`directories` crate), not temp.

**Why:** Tab switches re-rendered every visible row on any like/seek/rescan (whole-Set/currentTrack subscriptions) and covers were re-extracted per session (temp purge) and per tab revisit (LRU-100). Whole-second writes match what the UI actually renders (MM:SS).

**Alternatives considered:** TanStack Query-style server cache (rejected — no server; local-first); context-splitting the store (heavier than derived-key pattern); TTL auto-refresh (rejected — launch/foreground scan + explicit rescan suffice).

**Amended 2026-09-19 (research-driven, Namida/Android-guidance):** Covers are extracted as 256×256 thumbnails (never source resolution — Namida's full-size cache hit 2 GB on user libraries); legacy >512KB cache files are lazily re-extracted downscaled. After each scan, `scheduleArtworkPrefetch` warms covers for the first ~50 tracks during browser idle time (deduped per track ref, skips cached). Non-first-paint views (`NowPlayingView`, `BoosterView`, permission/first-run gates) are `React.lazy` chunks — initial bundle −39 kB (594.8 → 555.8 kB). Rescans are incremental via a durable scan memo (`scan_memo.v1.json`, keyed by path+size+mtime): unchanged files reuse the previous record verbatim; deletions eject immediately; `scan_result_cache_stats` IPC exposes walk-vs-reuse stats. Boot phases are benchmarked via `utils/bootPerf.ts` (marks at module/splash/settings/permission/scan) so future cold-start tuning measures before it cuts.

## 2026-09-16 — Circular theme reveal via View Transitions API

**Decision:** Light/Dark switching animates as a ~300ms `clip-path: circle()` expanding
from the toggle click point (`document.startViewTransition` + `src/utils/themeTransition.ts`);
instant fallback where the API is missing; no `prefers-reduced-motion` opt-out (explicit user choice).

**Why:** GPU-cheap single-property animation with minimal lag feel on mobile; store stays
source of truth while `applyResolvedTheme` paints synchronously for snapshot capture.

**Alternatives considered:** Custom overlay-div circle (heavier, rejected); fade fallback (rejected for lag).

**Implication:** Keep reveal logic in `themeTransition.ts`; both `HeaderBar` toggles must stay
wrapped. Reconsider the reduced-motion opt-out if a11y requirements tighten.

## 2026-09-19 — Unified First-Run Onboarding with Silent Grandfathering and Settings Simplification

**Decision:**
1. A unified single-page `OnboardingGate` replaces legacy fragmented gates (`FirstRunFoldersGate`, `PermissionGate`) during first launch.
2. Silent grandfathering: Existing users with evidence of prior use (`ac:ui-prefs`, `ac:reduced-blur`, or cached tracks) never see the onboarding screen on upgrade (`checkAndGrandfatherFirstRun()`).
3. Single confirm and single global skip buttons; safe defaults on skip (fa, system theme, mobile reducedBlur=true/desktop false).
4. `autoOpenOutputFolder` removed from Settings UI and coerced to `false` on settings load with self-healing persistence; `queue-idle` auto-open listener removed.
5. HeaderBar settings dialog removes theme switcher (quick toggle remains in header) and auto-open row.

**Why:**
Multiple intrusive modal gates on app startup harmed UX. Consolidating into a single, skippable start page allows users to set essentials (permissions, theme, language, performance) at once with immediate live preview. Existing users should not be disrupted upon app update. Removing unused `autoOpenOutputFolder` eliminates unwanted OS file manager popups.

**Implication:**
`ac:first-run-done` is written only via user confirm/skip or silent grandfathering. Future preferences should not add ad-hoc launch blocking modals.

When a later decision supersedes an earlier one, preserve the historical entry and add a short note such as:

`Superseded by: <date/title>`
