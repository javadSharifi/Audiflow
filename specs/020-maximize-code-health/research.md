# Phase 0 Research & Technical Rationale: Maximize Code Health

## 1. Cycle Breaking Strategy (8 Import Cycles)

### Problem
Repowise flags 8 circular dependency cycles involving:
- `src/stores/musicPlayer/audioEngine.ts` ↔ slice selectors / store hooks
- `src/stores/slices/fileSlice.ts` ↔ `useAppStore.ts`
- `src-tauri/android/AudioSessionReceiver.kt` ↔ `PlaybackService.kt` ↔ `MainActivity.kt`
- `src-tauri/src/queue/mod.rs` ↔ `src-tauri/src/commands/queue.rs`
- `src-tauri/src/commands/android.rs` ↔ `src-tauri/src/android_fs.rs`

### Decision
Extract interfaces and callbacks to invert dependencies (Dependency Inversion Principle):
- For TypeScript: Ensure slices and stores emit events or accept callbacks rather than directly importing orchestrators (`audioEngine.ts` calls store actions via subscriber callbacks or clean dependency injection).
- For Kotlin Android: Use broadcast intents, listeners, or explicit interface contracts (`PlaybackControllerCallback`) so `AudioSessionReceiver` and `PlaybackService` do not depend directly on concrete `MainActivity` references.
- For Rust: Keep module hierarchy strictly one-way (`commands` call `queue` and `android_fs`; `queue` and `android_fs` never import `commands`).

### Rationale
- Completely eliminates all 8 cyclic graph edges.
- Eliminates circular initialization races and memory leaks.
- Zero change to public API surface or UI contracts.

### Alternatives Considered
- *Ignore Android cycles*: Rejected because Android Kotlin files are top contributors to the lowest health band (1.0/10).
- *Merge cyclic files into single monolith*: Rejected because constitution strictly enforces a 300-line ceiling per file.

---

## 2. Characterization Testing for Untested Hotspots

### Problem
13 hotspot files have zero test coverage reach, including:
- `src-tauri/src/commands/mod.rs` (and submodules `queue.rs`, `android.rs`, `system.rs`)
- `src-tauri/src/queue/mod.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/android_fs.rs`

### Decision
Add non-invasive characterization unit and integration tests:
1. For Rust `queue`: Test job enqueueing, cancellation, FIFO order, and queue snapshot state.
2. For Rust `commands`: Test command validation, default error responses, and helper pure functions (e.g. extension checks, path sanitation).
3. For Rust `lib`: Test Specta builder IPC type registration export verification.
4. For TypeScript stores and utilities: Add vitest suites testing dispatch states without requiring live Tauri webview bindings.

### Rationale
- Immediately turns "Untested Hotspots" into tested files in Repowise's dependency graph.
- Protects against regression during subsequent complexity reduction passes.
- Adheres to Constitution Principle V (Test-First & CI Gate Compliance).

---

## 3. Decomposing High-Complexity & Brain Methods

### Problem
Repowise flags cyclomatic complexity > 10 in:
- `pipeline.rs`: `assemble_filtergraph` or multi-stage DSP option handling
- `MusicPlayerView.tsx`: multi-branch conditional rendering and player state gates
- `audioSource.ts`: multi-format audio buffer decoding and fallback handling
- `trackUtils.ts`: multi-tag metadata normalization

### Decision
Apply "Extract Method" and "Lookup / Strategy" refactoring:
- Extract sub-filtergraph builders (`build_trim_filter`, `build_boost_filter`, `build_resample_filter`) into pure helper functions.
- In React components: Extract conditional state views into dedicated sub-components (under 300 lines ceiling).
- In TypeScript utilities: Replace nested `if/else` ladders with lookup tables and early returns.

### Rationale
- Lowers cyclomatic complexity below 10 for all flagged methods.
- Improves code readability and maintainability index.

---

## 4. Dead Code Pruning Verification

### Problem
Repowise flags 119 dead code items (4,989 lines), of which 1 line is High Confidence (`.agents/gen_graph.py`) and 118 are Medium Confidence (unused internal symbols, unused exports, unreachable test helpers).

### Decision
1. High Confidence: Prune immediately.
2. Medium Confidence: Audit each finding against:
   - Is it required for dynamic reflection / JNI / Specta IPC? (Preserve)
   - Is it a re-export for external module consumers or future public API? (Preserve if documented)
   - Is it genuine dead code left over from deleted features (like transcribe or old booster paths)? (Prune)
3. Run `pnpm test`, `cargo test`, and `pnpm build` after each removal batch.

### Rationale
- Prevents accidental breakage of dynamically invoked code (e.g. JNI or Tauri command macros) while safely reclaiming maintainability.
