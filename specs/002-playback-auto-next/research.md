# Research: Playback Auto-Next Reliability

**Feature**: [spec.md](./spec.md) | **Date**: 2026-09-16

All unknowns resolved from the completed root-cause investigation (code reads of the desktop audio engine, player store, Android playback service, plus existing Vitest suites passing 19/19). No NEEDS CLARIFICATION remains.

## Decisions

### D1: Redundant end-of-track detection

- **Decision**: Keep the native end signal as primary; add a position watchdog (progress events vs known duration, plus a timeout fallback when duration metadata is missing) that triggers the same single advance path.
- **Rationale**: Intermittent stalls correlate with files that never emit a clean end signal (corrupt tail, missing duration). One signal is a single point of failure.
- **Alternatives considered**: Relying on the native signal alone (rejected — this is the current bug); polling-only detection (rejected — higher latency, more wakeups).

### D2: Failure policy — skip, don't stick

- **Decision**: Any track that errors or whose start fails is skipped automatically; advance continues to the next playable song. If none remains, enter the explicit stopped state.
- **Rationale**: Matches the spec assumption (non-intrusive continuation) and explains the "sometimes" pattern — one bad file currently freezes the whole queue.
- **Alternatives considered**: Stop with an error dialog (rejected — interrupts listening, contradicts spec); silent infinite retry (rejected — can hang forever).

### D3: Single-fire advance guard

- **Decision**: Arm a generation token on every track start; end/watchdog/manual triggers advance only if their token matches the current one, then disarm.
- **Rationale**: Manual next pressed at the exact end moment, or watchdog + native signal racing, must produce exactly one advance (FR-007).
- **Alternatives considered**: Boolean flag (rejected — stale flags across rapid track changes); debounce timer (rejected — adds transition latency).

### D4: Explicit stopped state at queue end

- **Decision**: Reaching the end with repeat off invokes the same stop routine as a user pressing stop (playing flag cleared, position reset presentation), never an early return that leaves state stale.
- **Rationale**: Fixes the stuck "playing" indicator at end of playlist (FR-005, SC-003).
- **Alternatives considered**: Keeping the early return with a UI-side patch (rejected — fixes symptom in one view, leaves store state wrong for all consumers).

### D5: Track identity resolution aligned

- **Decision**: The "current index" lookup used by auto-advance resolves entries the same way track start does (including path-based matching), so the computed "next" is always correct.
- **Rationale**: Divergent lookups can advance from/to the wrong entry.
- **Alternatives considered**: Index-only tracking (rejected — breaks under queue reorder/shuffle).

### D6: No data-model or contract artifacts

- **Decision**: No `data-model.md` or `contracts/` for this feature — queue, position, and mode are in-memory only; no persisted schema, no IPC, no external interface changes.
- **Rationale**: Spec Key Entities are conceptual; nothing crosses a persistence or service boundary.
- **Alternatives considered**: Modeling the queue as persisted state (rejected — out of scope, changes app behavior).

### D7: Android scope is verification-only

- **Decision**: Normal Android auto-advance stays on the native queue; only the single-song-queue edge is exercised and verified, no redesign.
- **Rationale**: Per spec assumption; native queue already handles the common path.
- **Alternatives considered**: Unifying both platforms onto one advance implementation (rejected — large, risky, out of scope).
