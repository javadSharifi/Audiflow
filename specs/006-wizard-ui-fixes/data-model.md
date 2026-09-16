# Data Model: Wizard UI Fixes

No new persisted entities. All values derive from existing store shapes at render time.

## ResultRow (derived, read-only)

Built in `WizardResultList` from `useAppStore(s => s.jobs)` + one `statMediaPaths()` call.

| Field | Source | Notes |
|-------|--------|-------|
| `outputPath` | `QueueItem.outputs[]` across `status === "completed"` jobs | identity = full path; deduped |
| `name` | basename of `outputPath` | display |
| `format` | file extension uppercased | display; `isLossy`-style mapping unnecessary |
| `sizeBytes` | `statMediaPaths` result by path | omitted when unreadable (FR: row still renders) |
| `folder` | `outputPath` minus basename | grouped: one banner per distinct folder |
| `error` (error rows) | `QueueItem.error` for `status === "failed"` jobs | name + error, no size/format |

Relationships: N rows ↔ 1 folder banner (grouped by distinct folder; common case = 1 banner).

## InputFile lifecycle (state transition change)

`present (steps 1–3) → cleared on entering step 4` via existing `clearFiles()` action. `QueueItem` records are NOT cleared (result list depends on them); `clearFinishedJobs()` still runs only on restart.

## Validation rules

- Success row requires `outputPath`; size optional.
- Error row requires failed `QueueItem` with `sourcePath`; `error` text optional (fallback key).
- Empty outputs + no failures → empty-state message (existing `converterResultEmpty` key).
