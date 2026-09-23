# Quickstart: macOS Add-Folder Button — Manual Verification

**Feature**: `018-folder-btn` | **Date**: 2026-09-23

## Setup

```bash
pnpm install
pnpm fetch:ffmpeg
pnpm tauri dev        # macOS host; frontend dev with native dialog plugin
```

Prepare test folders on the Mac:

- `~/Music/quickstart-a/` with 2–3 audio files (e.g. `.mp3`)
- `~/Music/quickstart-empty/` with no audio files
- A nested duplicate: `~/Music/quickstart-a/sub/` with one of the same tracks

## Automated gates (must pass first)

```bash
pnpm lint
pnpm test                                  # Vitest; new AddFolderButton.test.tsx included
pnpm build                                 # tsc --noEmit + vite build
# IP/schema gate — unchanged this feature, must stay green:
pnpm check:types                           # git diff --exit-code src/types/generated.ts
pnpm test:rust                             # unaffected, CI matrix gate
```

## Manual scenarios (macOS host)

### 1. Core flow (spec 1.1, SC-001, SC-002)

1. Open the Music Player → Songs view.
2. Confirm a folder button (`FolderPlus` icon) sits in the row next to search, before the sort dropdown.
3. Tap it → the **native** macOS directory picker opens. No other prompt appears.
4. Pick `quickstart-a`. One info toast appears ("1 folder added to your library"); tracks appear without a restart.
5. ✅ Pass: tracks listed, only the picker was shown (never a second permission prompt), under 1 minute.

### 2. Duplicates & nesting (spec 1.2, edge cases)

1. Tap the button again and re-pick `quickstart-a` → no toast, no change.
2. Pick `quickstart-a/sub` → no double-counted tracks; counts unchanged after scan.
3. ✅ Pass: silent skip, no double-count.

### 3. Empty folder (spec 1.3)

1. Pick `quickstart-empty` → one warning toast ("No songs found in the selected folder"); library unchanged.
2. ✅ Pass: friendly indication, no crash, library intact.

### 4. Cancel (spec 1.4)

1. Tap the button and press Esc / Cancel in the picker → dialog closes, no toast, no error.
2. ✅ Pass: silent no-op.

### 5. Scan-in-progress (spec 1.5)

1. Pick a large folder; while the orange spinner shows (row button disabled), the add-folder button is likewise disabled.
2. ✅ Pass: cannot trigger a second scan mid-run.

### 6. Persistence / restart (P3, SC-003)

1. With `quickstart-a` added, quit the app (⌘Q) and relaunch.
2. After the startup scan, `quickstart-a` tracks are listed without re-picking and without prompts.
3. Optional del-file check: rename `quickstart-a` on disk, relaunch → rest of library loads, no crash, no tracks from the missing folder.
4. ✅ Pass: no re-pick, no new prompt, graceful missing-folder handling.

### 7. Platform conditionality (P2, SC-004) — structural

- Windows/Linux/Android hosts (or CI emulators): the add-folder button is **absent**; the search/sort/rescan row is pixel-identical to main.
  - On non-mac desktops the component renders `null`; on Android the same component is compiled in but renders `null` (no behavior change, no new permissions).
- macOS host: button always present next to search (both Songs and Liked views).

### 8. RTL check (FR-010)

1. Switch language to Persian (فارسی) → confirm the button label/toast text renders in Persian and the icon respects RTL spacing in the row.
2. ✅ Pass: correct text, RTL-consistent layout.

## Cleanup

Remove `quickstart-a` / `quickstart-empty` and use the existing folder-removal flow (or clear `localStorage["ac:custom-folders"]` in dev tools) to reset state.
