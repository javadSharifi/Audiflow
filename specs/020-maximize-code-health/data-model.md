# Phase 1 Data Model: Maximize Code Health

This document formalizes the internal state and entities involved in health tracking and refactoring boundaries.

## 1. Entities & Structural Boundaries

### CycleBreakBoundary
Represents an inverted dependency edge created to sever a circular import.

- **SourceModule**: Path of the caller module (e.g. `src/stores/musicPlayer/audioEngine.ts`).
- **TargetModule**: Path of the callee module (e.g. `src/stores/useMusicPlayerStore.ts`).
- **InversionPattern**: `CallbackInjection` | `EventListener` | `SharedTypesPackage`.
- **Validation**:
  - Neither module may import the other in the opposite direction.
  - Zero cyclical references detectable by ESLint / madge / cargo tree.

### CharacterizationTestCase
Represents an automated test unit protecting an untested hotspot.

- **TargetFile**: Hotspot under test (e.g. `src-tauri/src/commands/mod.rs`).
- **TestFile**: Destination test harness (e.g. `src-tauri/tests/commands_characterization.rs`).
- **TestedBehaviors**: Array of critical execution paths (e.g. valid arguments, boundary cases, error returns).
- **ExecutionMode**: `Unit` (pure logic) or `Integration` (harness with mock context).

### DecomposedMethod
Represents a high-complexity method partitioned into single-responsibility sub-methods.

- **ParentFile**: File containing the original complex function.
- **OriginalMethodName**: Function name with initial cyclomatic complexity > 10.
- **ExtractedHelpers**: List of extracted helper functions each with cyclomatic complexity <= 5.
- **PostRefactorComplexity**: Max cyclomatic complexity <= 8 across parent and all helpers.

### DeadCodeCandidate
Represents an audited unused symbol or export.

- **FilePath**: Source file.
- **SymbolName**: Exported or internal identifier.
- **Confidence**: `High` (unreferenced and non-reflective) or `Medium` (requires triage).
- **Resolution**: `Deleted` | `RetainedWithDocumentation` | `ScopedToPrivate`.
