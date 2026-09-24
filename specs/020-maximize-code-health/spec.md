# Feature Specification: Maximize Code Health & Repowise Score

**Feature Branch**: `020-maximize-code-health`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "تو این میتونی ببنی ؟ http://localhost:3000/repos/bdd5b9ae4f234d1eb5717e072b125f70/code-health ؟ من میخوام نمره مو ۱۰ کنم"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Eliminate High-Risk Architectural Bottlenecks & Circular Dependencies (Priority: P1)

As a developer maintaining the codebase, I want high-risk hotspots, circular imports, and overgrown files decoupled and modularized so that changes to one subsystem do not cause cascading defects or regression in dependent components.

**Why this priority**: Repowise identifies 12 structural defects (including 8 circular import cycles and multiple complex hotspots like `audioEngine.ts`, `MainActivity.kt`, `PlaybackService.kt`, `pipeline.rs`, and `commands/mod.rs`) that pull the codebase health down to 6.9 and hotspot health down to 4.2. Resolving these structural problems eliminates the highest risk multipliers across the system.

**Independent Test**: Can be validated by re-running static dependency and circularity checks across the repository to verify 0 circular dependencies remain and high-risk hotspots transition into healthy modules.

**Acceptance Scenarios**:
1. **Given** circular dependencies between playback controllers and background service modules, **When** dependency cycle breaking is executed, **Then** all module import cycles are severed with strict unidirectional data flow.
2. **Given** overgrown hotspot files exceeding single responsibility boundaries, **When** cohesive domain slices are extracted, **Then** each extracted module handles a single concern and stays strictly within maintainability bounds.

---

### User Story 2 - Comprehensive Characterization Testing for Critical Untested Hotspots (Priority: P2)

As a maintainer and release engineer, I want automated test suites covering all critical backend and frontend hotspots that currently have zero test reach, so that refactoring and ongoing development cannot silently introduce functional bugs.

**Why this priority**: 13 high-churn hotspot files currently have zero test reach in the dependency graph (including core command dispatchers and background queue managers). Repowise penalizes untested hotspots severely.

**Independent Test**: Can be validated by executing automated test suites (`vitest` and `cargo test`) and observing that all 13 identified risky hotspots have direct test coverage verifying their core capabilities.

**Acceptance Scenarios**:
1. **Given** critical core commands and queue managers with zero test reach, **When** unit and integration characterization tests are added, **Then** all core actions, queue states, and error flows pass automated verification.
2. **Given** existing test suites, **When** all tests execute in the CI pipeline, **Then** 100% of test suites pass with zero regressions.

---

### User Story 3 - Decompose High-Complexity & Brain Methods (Priority: P3)

As a code reviewer and contributor, I want deeply nested, high-cyclomatic-complexity functions (such as DSP pipelines, media session handlers, and complex view components) simplified into clear, testable helper functions, so that reading and modifying business logic is safe and straightforward.

**Why this priority**: Over 30 methods in the codebase have excessive cyclomatic complexity or deeply nested branches (e.g. `pipeline.rs`, `MusicPlayerView.tsx`, `audioSource.ts`, `trackUtils.ts`), generating dozens of high-severity findings in code health audits.

**Independent Test**: Can be verified by cyclomatic complexity analysis showing that no single function or method exceeds complexity thresholds.

**Acceptance Scenarios**:
1. **Given** functions with branching complexity exceeding maintainable limits, **When** complex conditionals are decomposed into early exits and pure helper functions, **Then** each method has linear or minimal branching.

---

### User Story 4 - Prune Dead Code & Dormant Exports (Priority: P4)

As a repository maintainer, I want unreachable files, unused exports, and zombie internal symbols safely eliminated, so that the codebase remains lean and free of confusing orphan code.

**Why this priority**: 119 dead code findings covering ~4,980 lines add cognitive overhead and pull down maintainability ratings.

**Independent Test**: Can be verified by running dead code analysis and confirming zero unreachable non-public files or dangling exports remain, with all builds passing.

**Acceptance Scenarios**:
1. **Given** unused internal utilities and dormant symbols confirmed to have no callers, **When** dead code pruning is applied, **Then** those symbols are removed without breaking public APIs or runtime behavior.

---

### Edge Cases

- **Platform-Specific Code**: Android-specific Kotlin bridges and desktop-specific OS integration files must not be broken or stripped during cycle breaking or dead code removal.
- **Git Churn Decay Bounding**: Because 31% of the Repowise health penalty is derived from historical git commit churn (which decays only with new stable commits over time), code improvements immediately maximize the code-level factors while churn metrics steadily recover.
- **Type Generation Sync**: Any Rust command refactoring must preserve or synchronously regenerate the typed IPC contract (`src/types/generated.ts`) to avoid CI gate failures.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST eliminate all 8 identified circular dependency cycles across frontend and backend modules.
- **FR-002**: The system MUST decompose high-cyclomatic complexity methods (cyclomatic complexity > 10) across all flagged hotspot files into focused helper functions.
- **FR-003**: The system MUST provide automated characterization test coverage for all 13 critical hotspot files flagged as untested by the code health graph.
- **FR-004**: The system MUST remove verified dead code, unreachable internal helpers, and unused non-public exports without altering runtime behavior.
- **FR-005**: All modified and newly created source files MUST strictly comply with the project constitution's 300-line ceiling and Single Responsibility Principle.
- **FR-006**: All refactored audio processing pipelines MUST maintain single-pass DSP execution integrity and terminal peak limiting at −0.5 dBFS.
- **FR-007**: The full test suite (frontend tests, Rust unit/integration tests, and type checks) MUST pass cleanly after every incremental refactoring stage.

### Key Entities

- **Health Metric Factor**: The multi-dimensional score components (maintainability, complexity, test reach, duplication, and churn coupling) that comprise overall repository code health.
- **Code Hotspot**: A file combining frequent commit churn, bug-fix history, and high dependent coupling, requiring strict stabilization and test reach.
- **Refactoring Opportunity**: A structured unit of code transformation (Break Cycle, Extract Method, Extract Helper, Split File) targeting specific code smell markers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Overall Code Health score on Repowise increases from 6.9/10 into the highest attainable tier (Good/Excellent band, aiming for 9.0+ as historical churn permits).
- **SC-002**: Number of "At Risk" files in Repowise drops from 22 to 0.
- **SC-003**: Number of "Needs Work" files drops by at least 80% (from 22 to ≤ 4).
- **SC-004**: Zero circular dependency cycles remain across the repository (100% of the 8 import cycles resolved).
- **SC-005**: 100% of the 13 critical untested hotspot files are reached and verified by automated tests.
- **SC-006**: 100% of CI automated test suites and type-check gates pass with zero regressions.

## Assumptions

- Reaching an absolute mathematical 10.0 immediately is bounded by Repowise's git history churn model ("31% of this comes from change history, not from code. No edit to these files clears it."); maximizing all code-level factors (complexity, duplication, test reach, modularity) maximizes the score to the technical limit, while churn decays with future stable commits.
- Android JNI bridges and native services must maintain their interface contracts with Tauri and Kotlin.
- No user-facing functionality or audio fidelity may be degraded in pursuit of health scores.
