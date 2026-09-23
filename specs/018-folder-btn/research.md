# Phase 0 Research: macOS Add-Folder Button

**Feature**: `018-folder-btn` | **Date**: 2026-09-23 | **Status**: Complete — no NEEDS CLARIFICATION items

## R1: Where does the button live, and how is platform visibility decided?

**Decision**: Render the button inside the existing search/sort/rescan row of `TrackListView.tsx` (lines 159–193), gated by `isMacOS()`.

**Evidence**:
- `TrackListView.tsx:159-193` is the shared row for Songs and Liked views (`SongsView.tsx` / `LikedView.tsx` both render `TrackListView`). Placing the button there covers FR-001 with one change. The spec's Assumptions section states the Liked view follows the same platform rule — sharing the row gives that for free.
- `TrackListView` already imports `isAndroid` from `../../utils/platform`; adding `isMacOS` is the established pattern.
- `platform.ts` derives `isMacOS` from the user agent (`/macintosh|mac os x/i`) — same signal already used for the Android-conditional notification-permission path in this component, so platform gating in JSX is consistent with existing conventions.

**Alternatives rejected**:
- *SongsView-only placement* — duplicates a second conditional row and the Liked view would drift from the spec's assumption.
- *MusicPlayerNav-level placement* — wrong granularity; the spec explicitly says "next to the search field".
- *Tauri OS plugin (`os` plugin) instead of user agent* — new plugin dependency + capability for zero benefit; user-agent check is already repo convention for platform branches.

## R2: How is the pick performed?

**Decision**: Reuse `pickDirectories()` from `src/utils/dialog.ts` unchanged.

**Evidence**:
- `pickDirectories()` calls `open({ directory: true, multiple: true })` from `@tauri-apps/plugin-dialog` and is fail-soft: cancellation (`null`) and backend errors both resolve to `[]`.
- The gallery grant originates from the user's own picker action — the plugin resolves the security-scoped bookmark under the hood, so no extra prompt appears (FR-003, FR-009, SC-002 are satisfied by the mechanism, not by new code).
- FirstRunFoldersGate and onboarding `PermissionSection` already use this exact utility.

**Alternatives rejected**:
- *Single-select picker* — multi-select lets a user pick a common parent once (sanctioned user choice per FR-009); no reason to restrict.
- *New Rust `pick_folder` command* — new IPC surface + `generate:types` for existing plugin capability; violates reuse.

**Cancel handling**: `pickDirectories()` returning `[]` is ambiguous between "cancelled" and "os error", but both require the same UI outcome: nothing changes, no error (FR-007 scenario 4). The flow treats empty result as silent no-op. (This matches FirstRunFoldersGate behavior.)

## R3: How do picked folders enter the scan? (N+1 pitfall)

**Decision**: Add a **batched** store action `addCustomFolders(paths: string[])` to `useMusicPlayerStore` that dedupes against `customFolders`, persists once via `persistCustomFolders`, and triggers exactly **one** `scanLibrary(next)`.

**Evidence**:
- Existing `addCustomFolder(path)` (`useMusicPlayerStore.ts:422-427`) = persist + set + `scanLibrary(next)` per call. Picking 3 folders with it causes 3 sequential full scans (N+1 disk walks) — breaks SC-001 for multi-pick.
- `FirstRunFoldersGate.tsx` already solved this: it batches via `persistCustomFolders(next)` + a single `onDone` scan. The new flow mirrors that proven pattern.
- `scanLibrary(customDirs?)` (`:315`) guards `if (get().loading) return;` and falls back to persisted `customFolders` when no args — so the batched action keeps the scan source consistent for background rescans and app restarts (FR-005, P3).

**Alternatives rejected**:
- *Call `addCustomFolder` in a loop* — N full scans; the last one wins but earlier runs waste disk walks and delay tracks appearing.
- *Component-local state + persist outside store* — violates layering (persistence belongs in the store slice domain) and duplicates dedupe logic that `addCustomFolder` already owns.
- *Folding picks into `scanLibrary` args only (transient, no persist)* — breaks FR-005/P3 persistence; restarts would lose the folder.

## R4: Per-pick outcome detection & surfacing (locked in /speckit.clarify)

**Decision**: Classify outcomes in the new `useAddFolderPick` hook and surface via the existing toast system (`useAppStore.pushToast(kind, text)`), as the user chose option "A" during clarification. Re-picks of already-tracked folders are skipped silently with no separate toast per duplicate.

**Outcome mapping**:

| Condition (after `pickDirectories()` returns paths) | Outcome | Toast |
|---|---|---|
| `paths.length === 0` | cancelled | none (FR-007: no error, no change) |
| every path already in `customFolders` | skipped (existing behavior) | none (clarification lock: no separate toast per duplicate) |
| ≥1 new path accepted | added | one `info` toast: N folder(s) added (singular/plural keys) |
| scan result gained 0 tracks from the pick | empty | one `warning` toast "no music found" (spec scenario 1.3) |

- Track-gain comparison: compare `tracks.length` before/after the triggered scan (the store already replaces `tracks` wholesale). 0 delta with an accepted pick ⇒ "no music found in the folder".
- "Unavailable/denied folder" (unplugged drive, revoked grant) is not separately detected in the frontend — `scanAudioFiles` fail-soft returns `[]` and the rest of the library loads; user can re-pick. Covered by generic empty handling and store-level empty-guard for background scans.

**Evidence**:
- `toastSlice.ts:5-22`: `pushToast(kind, text)` with `kind = "error" | "info" | "warning"`, auto-dismiss ~6000ms; `Toasts.tsx` renders them — exactly one integration point needed for FR-007.
- Buttons live in MusicPlayer domain toasts are on `useAppStore` — the hook reads `useAppStore.getState().pushToast`, matching how other cross-slice calls avoid subscribe-coupling.

**Alternatives rejected**:
- *Inline banner next to the row* — new persistent UI element for a transient outcome; spec clarification locked toasts.
- *Window alert / native dialog per outcome* — no repo precedent, blocks the UI, can't be translated-styled consistently.

## R5: Scan-in-progress behavior

**Decision**: Disable the button while `loading` is true (`disabled={loading}`), exactly like the rescan button beside it (spec scenario 1.5). No queueing.

**Evidence**:
- `scanLibrary` early-returns when `loading` — a queued pick would silently persist folders without scanning until some later rescan, a confusing half-state. Disabling keeps "press → scan runs" an invariant.
- Rescan button (`TrackListView.tsx:183-192`) uses the same `disabled={loading}` + spinner pattern; visual consistency.

## R6: i18n keys needed (en + fa, RTL)

**Decision** (final key set, `addFolder*` family):

- `addFolderTitle` — button `title`/`aria-label` ("Add music folder…")
- `addFolderAddedOne` — "1 folder added to your library"
- `addFolderAddedMany` — "{count} folders added to your library"
- `addFolderNoMusic` — "No songs found in the selected folder"

**Evidence**: `en.ts`/`fa.ts` are flat dictionaries resolved via `translate(lang, key)`; the rescan/sort row already resolves labels this way (`rescanLibrary`, `searchClear`). New strings MUST exist in both files (Principle VIII; fa.ts preserves RTL layout).
