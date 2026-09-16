# Daily Sync (`dev-context-sync`)

## When to read this document

- After any coding task that created, deleted, or meaningfully edited at least one file — to incrementally refresh `PROJECT_GRAPH.md`.
- Any time a reported bug gets fixed.
- Any time the user states a new durable rule or standard for the project.
- When a task changes a durable architecture/design decision and `DECISIONS.md` should be updated.
- Not for the initial build of `PROJECT_GRAPH.md` — use `.agents/project-graph.md` instead.

## Purpose

Keep the project's shared memory fresh during everyday work, without the user having to ask each time, and without triggering a full rebuild for a small change.

---

## Step 0 — Always check for `speckit`

Before running any `speckit-add` command:

```bash
test -d speckit && echo SPECKIT_ON || echo SPECKIT_OFF
```

- `SPECKIT_ON` → spec-kit constitution/checklist may be used according to project instructions.
- `SPECKIT_OFF` → do not run `speckit-add`; use the local fallback files below.
- Re-run the check when needed because the folder may be added later.

---

## Section 1 — Keep the project graph fresh (incremental only, never a rebuild)

**Trigger:** after any task where at least one file was created, deleted, or meaningfully edited.

### Procedure

1. Check whether `PROJECT_GRAPH.md` exists at the repo root.
   - **Missing** → do not build it automatically during an ordinary task. Tell the user once that the graph does not exist yet and they can request `build project graph`.
   - **Exists** → read its `Sync pointer` section and continue.
2. Validate the pointer:
   `git merge-base --is-ancestor <synced_commit> HEAD`
   - **Fails** (branch switch, rebase, shallow clone) → stop. Do not incrementally
     update; note `FULL_REVERIFY` in the final report and re-verify the affected domains.
   - **Passes** → continue.
3. Derive the changed set (no per-file hash bookkeeping):
   - committed changes: `git diff --name-only <synced_commit> HEAD`;
   - workdir changes: `git status --short` (covers unstaged + untracked).
   - Union of both is the authoritative touched set — trust it over memory.
4. Find where each touched file is indexed:
   - Single-file mode: row is in `PROJECT_GRAPH.md`.
   - Domain-split mode: use the `Reference index` to locate `.agents/references/<domain>.md`.
5. For each touched file:
   - **New file** → add a row to the correct table (or fold into a group row if it
     matches a collapsed family).
   - **Modified file** → update only that file's summary if behavior/navigation changed.
   - **Deleted file** → remove its row (or note the deletion on the group row).
   - **Renamed file** → move the row; preserve the summary.
   - **Unchanged file** → do not touch it.
6. Re-verify the ~10 critical files listed under `Sync pointer`: if any changed,
   confirm its row still describes reality.
7. Advance the pointer **only when the workdir is clean** (`git status --short` empty):
   update commit/branch/date in `PROJECT_GRAPH.md`. If dirty, keep the old pointer so
   the next diff stays conservative and nothing is silently skipped.
8. If a touched file belongs to a previously unknown domain, create `.agents/references/<domain>.md` and add the domain to the `Reference index`.
9. If the graph is materially stale relative to the current repository, update only the affected entries during this task and note the drift in the final report. Do not silently perform a full rebuild.

### Graph Drift rule

If `PROJECT_GRAPH.md` conflicts with the actual repository:

1. Treat the actual repository as authoritative for implementation.
2. Do not change implementation just to match stale memory.
3. Update only the affected graph entries after the task.
4. Mention significant drift in the final report to the user.
5. Do not use stale graph information as evidence that a file/function still exists.

### Scope rule (inherited from the graph build)

Incremental updates respect the same scope as `.agents/project-graph.md` Step 2b —
this rule travels with these files to any project:

- Touched files that are **in scope** (hand-written sources): update their row/hash
  as usual.
- Touched files that belong to a **collapsed group** (generated output, binary
  assets, lockfiles, vendored data): do not create per-file rows. Update the group
  row's summary only if the change matters for navigation; otherwise touch nothing.
- New files that match a collapsed family: fold into the existing group row.
- A file moving between in-scope and collapsed (e.g. newly generated): remove the
  per-file row and fold it into the group, or vice versa.

Checklist addition:

- [ ] No per-file row was created for a collapsed-family file.

---

### Self-check

Pointer still valid (`merge-base --is-ancestor` passes) or `FULL_REVERIFY` noted.
Critical-file rows re-verified. Pointer advanced only if workdir is clean.

Checklist:

- [ ] Only rows for files in the diff/status set changed.
- [ ] No unrelated sections were rewritten.

---

## Section 2 — Log bug fixes (`BUGFIXES.md`)

**Trigger:** a user-reported or otherwise confirmed bug was fixed.

### Required flow

1. Reproduce the bug.
2. Identify the likely root cause.
3. Locate or create a regression test when feasible.
4. Confirm the regression test fails before the fix when feasible.
5. Apply the fix.
6. Re-run the regression test; it must pass.
7. Run closely related tests when practical.
8. Append one short row to `BUGFIXES.md`.

If the bug cannot reasonably be reproduced or automated, state the limitation in the Fix cell.

### File format

Create `BUGFIXES.md` if missing:

```markdown
# Bug fix log

Each row should stay concise. Keep Bug, Root Cause, and Fix to one line each.

| Date | Bug | Root Cause | Fix | Files |
| ---- | --- | ---------- | --- | ----- |
```

Example:

```markdown
| 2026-09-16 | Login failed with uppercase email | Comparison was case-sensitive | Normalize email before comparison | `src/api/auth.ts` |
```

If no automated regression test is practical, write `no automated test` in the Fix cell.

### Optional spec-kit integration

If `SPECKIT_ON`, use the project-approved checklist mechanism after the regression test exists. Do not let a generated checklist replace the actual test file or `BUGFIXES.md` entry.

---

## Section 3 — Record a new rule or standard

**Trigger:** the user states a durable rule for the project or agent behavior.

A one-off request is not a rule.

### Procedure

1. Summarize the rule as one clear, unambiguous sentence.
2. `SPECKIT_ON` → record it in the project constitution using the project's spec-kit workflow.
3. `SPECKIT_OFF` → append a dated bullet under `## Project rules` in `RULES.md`; create the file if missing.
4. Confirm in one line where it was recorded.

---

## Section 4 — Record an architecture/design decision

**Trigger:** the task introduces or changes a durable architecture, dependency, library, pattern, or design decision that future agents could reasonably revisit.

Use `DECISIONS.md` for the decision and rationale.

Do not record:
- trivial implementation details;
- temporary task choices;
- routine bug fixes;
- every small refactor.

### Suggested format

```markdown
## YYYY-MM-DD — <decision title>

**Decision:** <what was chosen>

**Why:** <short rationale>

**Alternatives considered:** <optional>

**Implication:** <what future agents should preserve or know>
```

Keep decisions concise. If a later decision supersedes an earlier one, mark the older decision as superseded rather than rewriting its historical record.

---

## Section 5 — Context efficiency

Shared memory exists to reduce exploration, not to become a second copy of the codebase.

Keep summaries compact:
- no function bodies;
- no large code blocks;
- no duplicated documentation;
- no temporary task logs in memory files;
- no implementation detail that does not help navigation or future decisions.

Prefer:

`Purpose + important export + key dependency`

over:

`complete explanation of how the file works`.

---

## Summary of files this document touches

| File | When | Section |
| --- | --- | --- |
| `PROJECT_GRAPH.md` (+ `.agents/references/*.md`) | incrementally after tasks that touched indexed files | 1 |
| `BUGFIXES.md` | after every confirmed bug fix | 2 |
| `RULES.md` | when `speckit` is absent and a new durable rule is set | 3 |
| `DECISIONS.md` | when a durable architecture/design decision is introduced or changed | 4 |
| spec-kit constitution/checklists | when `speckit` exists | 2 & 3 |
