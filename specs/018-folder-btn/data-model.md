# Phase 1 Data Model: macOS Add-Folder Button

**Feature**: `018-folder-btn` | **Date**: 2026-09-23

## Domain Entities

### Library Folder *(existing — reused unchanged)*

A user-granted directory source for the music scan. No new type is introduced; the
persisted custom-folders mechanism remains the source of truth.

| Field | Type | Storage | Notes |
|---|---|---|---|
| path | `string` (absolute) | `localStorage["ac:custom-folders"]` via `persistCustomFolders` | Key identity for dedupe |

**State transitions** (existing, unchanged):

```text
[pick] → dedupe vs customFolders → new? ──yes→ persist + include in scan
                                   └─no→ skip (silent, existing behavior)
[restart] → loadCustomFolders → startup scan consumes them (no re-pick, no prompt)
[folder unavailable/revoked] → scan yields nothing for it; rest of library unaffected
```

### Pick Outcome *(new — internal to the pick hook; not persisted)*

Result of one add-folder action.

| Field | Type | Values |
|---|---|---|
| status | `"cancelled" \| "skipped" \| "added" \| "empty"` | One per action |
| addedFolders | `string[]` | Newly accepted paths (empty unless `added`) |
| addedFoldersCount | `number` | Drives singular/plural toast key |

**Mapping to UI** (FR-007; clarification lock "toast system, no per-duplicate toasts"):

| status | pushToast | Toast key(s) |
|---|---|---|
| `cancelled` | *(none)* | — |
| `skipped` | *(none)* | — |
| `added` (N=1) | `info` | `addFolderAddedOne` |
| `added` (N>1) | `info` | `addFolderAddedMany` (`{count}`) |
| `empty` | `warning` | `addFolderNoMusic` |

`empty` classification: ≥1 folder accepted AND `tracks.length` delta across the
triggered scan is 0. The hook snapshots `useMusicPlayerStore.getState().tracks.length`
before invoking the scan and compares after resolution.

## Store Changes

### `useMusicPlayerStore` — new batched action

```ts
addCustomFolders: (paths: string[]) => Promise<number>;
// resolves with count of newly accepted (deduped) folders
```

Behavior (mirrors `addCustomFolder`, batched):

1. `const fresh = paths.filter(p => !get().customFolders.includes(p))` — dedupe (FR-006, clarification lock)
2. `if (fresh.length === 0) return 0;`
3. `const next = [...get().customFolders, ...fresh]`; `persistCustomFolders(next)`; `set({ customFolders: next })`
4. `await get().scanLibrary(next)` — exactly one scan (N+1 avoided, SC-001)
5. return `fresh.length`

Existing primitives stay untouched: `customFolders: string[]`, `addCustomFolder`,
`removeCustomFolder`, `scanLibrary`, `loading`, `hasScanned`.

## Component Contract

### `AddFolderButton` *(new component)*

- Props: none. Reads `loading` from `useMusicPlayerStore` (disable while scanning
  — spec scenario 1.5, FR-005-style guard parity with rescan button).
- Renders `null` unless `isMacOS()` (FR-002 — evaluated at render, so non-macOS
  builds are structurally unchanged).
- Icon: lucide `FolderPlus`; `title`/`aria-label` = `translate(lang, "addFolderTitle")` (FR-010, Principle VIII).
- `onClick` → `useAddFolderPick().pickAndAdd()`.

### `useAddFolderPick` *(new hook)*

Single responsibility: classify one pick action and report via toasts. Sequence:

```text
picking? guard → pickDirectories()
  → []              ⇒ outcome cancelled (silent)
  → all duplicates  ⇒ outcome skipped (silent)   [locked in clarify]
  → addCustomFolders(fresh) (batched, one scan)
      → tracks delta 0 ⇒ toast warning addFolderNoMusic
      → tracks delta>0 ⇒ toast info addFolderAddedOne/Many
```

Re-entrancy: local `picking` ref prevents double-tap races between click and
dialog open (complements the store-level `loading` guard).

## i18n Keys (en.ts + fa.ts, both required)

| Key | Values | Interpolation |
|---|---|---|
| `addFolderTitle` | en: "Add music folder…" / fa: "افزودن پوشه موسیقی…" | — |
| `addFolderAddedOne` | en: "1 folder added to your library" / fa: "۱ پوشه به کتابخانه اضافه شد" | — |
| `addFolderAddedMany` | en: "{count} folders added to your library" / fa: "{count} پوشه به کتابخانه اضافه شد" | `{count}` |
| `addFolderNoMusic` | en: "No songs found in the selected folder" / fa: "در پوشه انتخاب‌شده آهنگی پیدا نشد" | — |

All interpolation uses the existing `.replace("{count}", …)` convention
(`TrackListView.tsx:206` pattern). Persian keys preserve RTL layout.

## Invariants / Rules

1. **No new persisted value** — only the existing `ac:custom-folders` entry grows (Rule: Storage & Serialization matrix, Principle V workflow item 5).
2. **No untyped `invoke()`** — the flow ends at the typed `api.scanAudioFiles` helper (Principle III).
3. **Success toast count invariant** — exactly one toast per pick action, at most (clarification lock; never N toasts for N picks).
4. **Platform invariant** — `AddFolderButton` returns `null` on non-macOS; non-macOS users are structurally untouched (FR-002, SC-004).
