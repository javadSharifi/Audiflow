# AGENTS.md

This project maintains shared memory for AI agents so no one has to re-explore the whole codebase from scratch every time. Any agent working on this repo (Claude, Cursor, Copilot, Aider, Codex, OpenCode, or similar) should read this file and follow it.

## Shared memory files

| File | Content |
| --- | --- |
| `PROJECT_GRAPH.md` (+ `.agents/references/*.md` for large projects) | Compact architecture map: what each file is for, and where to go for each kind of task |
| `BUGFIXES.md` | Short regression/broken-behavior log |
| `DECISIONS.md` | Important architecture/design decisions and why they were made |
| `RULES.md` | Project rules/standards (only used when a `speckit/` folder is absent; otherwise rules are recorded in the spec-kit constitution) |

## General rules

1. **Before starting any task:** if `PROJECT_GRAPH.md` exists, read it first.
2. **Use progressive disclosure:** use the graph to locate the relevant domain/file before broad repository exploration.
3. **After any task that created, deleted, or meaningfully edited a file:** update `PROJECT_GRAPH.md` incrementally according to `.agents/dev-context-sync.md`.
4. **After every bug fix:** add a max-2-line row to `BUGFIXES.md` and write a regression test where feasible.
5. **When the user sets a new durable rule or standard:** record it in `RULES.md`, or in the spec-kit constitution when `speckit/` exists.
6. **When a task changes architecture, dependencies, technology choices, or an existing design decision:** record the decision in `DECISIONS.md` when appropriate.
7. **Do not rebuild shared memory files wholesale** when only a small part changed.

## Source of truth

Shared-memory files are navigation/context aids, not authoritative copies of source code.

When memory conflicts with the actual repository:
- the current repository is authoritative for implementation state;
- do not change code merely to match stale memory;
- update only the affected memory entries after the task;
- mention significant memory drift in the final report to the user.

## Agent Protocol

### Before coding

1. Read `AGENTS.md`.
2. Read `PROJECT_GRAPH.md` when it exists.
3. Read `DECISIONS.md` when the task touches architecture, dependencies, technology choices, or an existing design decision.
4. Identify the task's domain and likely files from the graph.
5. Inspect only the files required to understand and implement the task.
6. Find relevant existing tests before changing behavior.

### During coding

- Make the smallest change that correctly solves the task.
- Do not refactor unrelated code.
- Do not reformat unrelated files.
- Do not upgrade dependencies unless required by the task.
- Reuse existing components, hooks, utilities, services, types, constants, and packages before creating new ones.
- Before creating a new abstraction, search for an existing equivalent.
- Respect existing dependency boundaries and architecture.
- Do not silently change public behavior unrelated to the task.

### After coding

1. Run the narrowest relevant tests first.
2. Run typecheck/lint/build when relevant and available.
3. Inspect `git diff` and `git diff --name-only`.
4. Update shared memory incrementally.
5. Verify that shared-memory changes match the actual task and repository state.
6. Report what changed and what was actually verified.

## Minimal Change Principle

Make the smallest change that correctly solves the requested task.

Do not:
- refactor unrelated code;
- rename unrelated files;
- reformat unrelated code;
- upgrade dependencies without a task-specific reason;
- rewrite working implementations without a task-specific reason.

## Reuse Before Create

Before creating a new:
- component
- hook
- utility/helper
- service
- type
- constant
- package/module

search the repository for an existing equivalent.

Prefer extending or reusing an existing implementation over creating a duplicate.

## Verification Integrity

Never claim that an action was performed, verified, or successful unless it was actually executed and its result was observed.

This applies to:
- tests;
- builds;
- lint/typecheck;
- bug reproduction;
- file changes;
- hashes;
- migrations;
- generated artifacts;
- external commands.

If a verification step was skipped, say that it was skipped.

## Exploration Budget

Before broad repository exploration:

1. Check `PROJECT_GRAPH.md`.
2. Search for the relevant symbol/path/task.
3. Inspect the smallest set of related files that can establish the implementation path.

Broad recursive exploration is justified when:
- the graph is missing or materially stale;
- the task crosses unknown architectural boundaries;
- dependency tracing requires it;
- the relevant implementation cannot be located through the graph/search flow.

## Conflict priority

When instructions conflict, use this order unless the project constitution defines a stricter project-specific order:

1. Current explicit user instruction
2. Spec-kit constitution/rules, when `speckit/` exists
3. `AGENTS.md`
4. `DECISIONS.md`
5. `RULES.md`
6. Existing repository conventions
7. Agent preference

Never use an agent preference to override an explicit project or user requirement.

## Graph and memory boundaries

- `PROJECT_GRAPH.md` is a navigation index, not source-code documentation.
- Keep file summaries compact; do not copy implementation bodies into memory files.
- Scope rule (portable — applies when these files are copied to another project):
  per-file rows are reserved for hand-written sources an agent would
  navigate to or edit. Generated output, binary/opaque assets, vendored data packs,
  lockfiles, and byte-identical duplicates fold into one group row per family;
  bytecode/caches are omitted entirely. Freshness is pointer-based (sync commit in
  `PROJECT_GRAPH.md`, no per-file hashes) except ~10 critical files. Details live in
  `.agents/project-graph.md` (Steps 2b, 7) and `.agents/dev-context-sync.md` (Section 1).
- `BUGFIXES.md` is intentionally short.
- `DECISIONS.md` is for durable decisions and rationale, not every small implementation choice.
- `RULES.md` contains durable rules, not temporary task instructions.

## If shared memory is missing

If `PROJECT_GRAPH.md` does not exist, do not silently generate it during an ordinary coding task. Tell the user that the graph has not been built yet and that they can explicitly request `build project graph`.

## Completion report

Use a concise final report:

```text
Summary
- ...

Changed
- ...

Verification
- ...

Shared memory
- ...

Remaining / limitations
- ...
```

Never report a verification result that was not actually observed.
