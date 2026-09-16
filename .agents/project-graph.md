# Project Graph — Initial Build

## When to read this document

- The user explicitly asks to build the project graph (`build project graph`, `map the project`, `project graph`, or equivalent).
- `PROJECT_GRAPH.md` does not exist yet at the repo root and needs to be created from scratch.
- For day-to-day incremental updates after `PROJECT_GRAPH.md` exists, use `.agents/dev-context-sync.md` instead.

## Purpose

Produce a compact, navigable map of the codebase so future agents can find the right file for a task without re-exploring the whole repository.

This is a navigation index, not source-code documentation.

---

## Output contract

One root-level file is produced during initial graph build:

- `PROJECT_GRAPH.md`

No handoff/status file is produced in this workflow — deliberately. Task status and
continuity live in the conversation, not in a memory file.

### `PROJECT_GRAPH.md` allowed content

- Architecture overview (2–4 sentences)
- Folder structure table
- File-by-file tables when small enough
- Reference index when domain split is required
- Task → File map
- Module dependency map
- Dependency boundaries
- Critical areas
- Hidden `project-graph-meta` block

### `PROJECT_GRAPH.md` forbidden content

- Current status prose
- Recent changes list
- Open TODOs
- Full implementation documentation
- Large code snippets

That content belongs in the source code.

---

## Step 1 — Get the definitive file list

For Git repositories:

```bash
git ls-files | grep -Ev '(^|/)(node_modules|dist|build|target|\.git|coverage)(/|$)' > /tmp/pg_files.txt
wc -l /tmp/pg_files.txt
```

Treat this output as the source of truth for tracked files included in the graph.

If the repository is not a Git repo, use an equivalent `find` command and save/count the result first.

Untracked files are intentionally excluded from the initial graph when `git ls-files` is used. They can be indexed in a later incremental update once they become tracked, or explicitly handled by the user.

Never build the file table from an eyeballed directory listing or a partial file view.

---

## Step 2 — Choose single-file or domain-split mode

This is mandatory.

- File count ≤ 120 **and** expected file-by-file tables stay under roughly 450 lines → single-file mode.
- File count > 120 **or** more than ~6 clearly separate top-level source domains → domain-split mode.

### Domain-split mode

Create one `.agents/references/<domain>.md` per domain.

Each domain reference contains:
- only that domain's file-by-file table;
- its own metadata block.

`PROJECT_GRAPH.md` contains:
- architecture overview;
- folder structure;
- task → file map;
- dependency map;
- dependency boundaries;
- critical areas;
- reference index.

Never dump a large project's complete file tables into one huge `PROJECT_GRAPH.md`.

---

## Step 2b — Scope: per-file rows only for hand-written sources (mandatory)

Per-file table rows and `project-graph-meta` hashes are reserved for files an agent
would actually navigate to or edit. Everything else folds into one group row per
family (or is omitted entirely). This keeps the graph portable: copying these rules
to another project must produce a lean graph there too, not a dump of generated files.

### Always collapse to a group row (never per-file)

- Generated output: build artifacts, codegen snapshots, generated platform projects,
  generated icons/resources (e.g. `**/gen/**`, `*.generated.*`, schema snapshots).
- Binary / opaque assets: images, icons, fonts, audio, archives, `.jar`, `.pyc`
  (e.g. `*.png`, `*.ico`, `*.ttf`, `*.woff2`, `*__pycache__/*`).
- Vendored / third-party guidance packs: skill data, vendored datasets, template packs
  (keep the pack's entry doc as a per-file row, collapse its data files).
- Lockfiles (`pnpm-lock.yaml`, `Cargo.lock`, …): one row max, never hashed
  (they change on every dependency bump and add zero navigation value).
- Byte-identical duplicates: keep one per-file row for the source of truth, collapse
  the copies into a group row pointing at it.

### Omit entirely

- Interpreter/compiler bytecode and caches (`__pycache__`, `*.pyc`, `.DS_Store`).

### Deleted-but-tracked files

If `git ls-files` lists files deleted in the workdir, do not give them per-file rows:
collapse to one group row noting the deletion. Never silently resurrect them as
active code in summaries or the task map.

### Freshness is pointer-based, not hash-based

There are no per-file hashes. Freshness is determined by diffing the recorded sync
pointer against the current state (see Step 7 / Step 9). Document the pointer in
`PROJECT_GRAPH.md` under a `Sync pointer` section so any agent can reproduce the
check in any project.

If the project keeps `.agents/gen_graph.py`, prefer running it (`python3
.agents/gen_graph.py` from the repo root): it implements this scope, the pointer,
the critical list, and the drift section deterministically. Keep its summaries and
scope rules in sync with this document when behavior changes.

---

## Step 3 — Write compact summaries

For every indexed file, write a 1–2 line summary containing:

- what it is;
- why it matters;
- important export/class/function when useful;
- key dependency when useful.

For files over ~1000 lines, inspect the top, imports, and relevant signatures instead of reading the whole file unless the task requires it.

Do not copy implementation bodies.

---

## Step 4 — Build the Task → File map

Use the actual structure discovered in the repository.

Prefer:

| If you want to... | Start here | Also inspect | Usually avoid |
| --- | --- | --- | --- |
| Add an endpoint | `src/api/routes/` | service/validation | unrelated UI |
| Fix player behavior | `src/player/` | audio service/tests | unrelated features |

This is a navigation aid, not a generic framework description.

---

## Step 5 — Add dependency boundaries

Document important architectural direction, for example:

```markdown
## Dependency boundaries

- UI may depend on hooks/services.
- Hooks may depend on services.
- Services may depend on API clients.
- Shared modules must not depend on feature modules.
- Low-level utilities must not import UI.
```

Use only boundaries that match the actual project.

---

## Step 6 — Add critical areas

Keep this compact. Do not add a Risk column to every file row.

Example:

```markdown
## Critical areas

- Authentication / authorization
- Payments / money movement
- Audio engine / background playback
- Database migrations
```

Only list genuinely high-impact areas for the project.

---
## Step 7 — Record the sync pointer (no per-file hashes)

Do not store per-file hashes. Record one sync pointer in `PROJECT_GRAPH.md`:

```markdown
## Sync pointer

- commit: <full SHA of HEAD at build time>
- branch: <current branch>
- date: <YYYY-MM-DD>
- workdir_clean_at_sync: <true|false>
```

Rules:

- The commit must be the exact HEAD the graph was built from (`git rev-parse HEAD`).
  Never use branch names as the pointer — branches move.
- If the workdir is dirty at build time, set `workdir_clean_at_sync: false`; the next
  sync must then include the workdir diff, not just committed changes.
- Additionally record blob hashes for ~10 critical files only (files where staleness
  is expensive: core pipeline, IPC boundary, secrets, queue). Get them via
  `git ls-files -s -- <paths>`. Everything else is covered by the pointer diff.
- For non-Git repositories this mechanism does not apply — fall back to a dated
  full re-verify and say so in the final report.

---

## Step 8 — Skipped (no handoff file)

This workflow produces no `HANDOFF.md`. Do not create one. Task status and
continuity live in the conversation and the user's tracker, not in a memory file.

---

## Step 9 — Pointer validity check

```bash
git merge-base --is-ancestor <synced_commit> HEAD && echo POINTER_VALID || echo FULL_REVERIFY
```

- `POINTER_VALID` → incremental syncs since the build are reliable.
- `FULL_REVERIFY` (branch switch, rebase, shallow clone) → do not attempt an
  incremental update; re-verify the affected domains fully and record a new pointer.

---

## Step 10 — Final integrity checks

Before declaring the build complete:

- [ ] File list came from the definitive command output.
- [ ] Domain split is used when required.
- [ ] Sync pointer (commit/branch/date/clean-flag) is recorded and exact.
- [ ] Critical-file blob hashes are real (`git ls-files -s`).
- [ ] POINTER_VALID passes at build time.
- [ ] `PROJECT_GRAPH.md` contains no current-status/recent-change prose.
- [ ] Critical areas are compact.
- [ ] No large code blocks were copied into memory.
- [ ] The repository remains the source of truth.
