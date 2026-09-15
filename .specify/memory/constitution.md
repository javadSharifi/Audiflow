# Audio Converter & Sound Booster Constitution

## Core Principles

### I. Local-First, Zero-Dependency Privacy

The application is a local-first, offline-capable audio processing studio and music
manager. All conversion, enhancement, trimming, splitting, and library/playback
functionality MUST work with zero internet access, zero external accounts, and zero
telemetry. The only sanctioned exception is the opt-in Transcribe Studio feature, which
explicitly calls the Gemini cloud API and must be clearly isolated as an optional,
user-initiated cloud feature — it must never be required for core conversion or
playback flows to function.

### II. Single-Pass DSP Integrity (NON-NEGOTIABLE)

Trimming (`atrim`), silence removal (`silencedetect` + `concat`), split segmentation,
channel/sample-rate conversion, and sound-boost filters MUST be compiled into a single,
unified FFmpeg `-filter_complex` execution graph per output file. Intermediate lossy
decode/re-encode passes are strictly prohibited to avoid cascading compression loss.
Every Sound Booster preset and manual gain path MUST terminate in a hard `alimiter`
stage capped at −0.5 dBFS (`alimiter=limit=0.95:...:asc=1`) to guarantee zero digital
clipping or speaker damage, regardless of the gain applied upstream.

### III. Type-Safe Rust ↔ TypeScript IPC Contract

`src/types/generated.ts` is the single source of truth for all backend IPC schemas.
Any change to a Rust command signature, struct, or enum in `src-tauri/src/` MUST be
followed by running `pnpm generate:types`. Direct, untyped `invoke()` calls from
components are prohibited — all IPC must go through typed helpers in
`src/utils/tauri.ts`. CI enforces schema sync via `pnpm check:types`
(`git diff --exit-code src/types/generated.ts`) and fails the build on drift.

### IV. Atomic, Non-Destructive File Operations

All encoding operations MUST write to temporary `.tmp`/`.part` files and atomically
rename to the final filename only on success. Output operations MUST NEVER overwrite
an existing user file; on name collision, the system appends incremental suffixes
(`(1)`, `(2)`, …). On user cancellation or app termination, all active child `ffmpeg`
processes MUST be explicitly killed (`QueueManager.cancel_all()`) and any partial
output files purged — orphaned background processes or `.part` litter are not
acceptable outcomes.

### V. Test-First & CI Gate Compliance (NON-NEGOTIABLE)

No change is considered complete until it is covered by the appropriate test layer:
Vitest + Testing Library for frontend units/components, `cargo test` for backend
unit/integration logic, and the dedicated `src-tauri/tests/e2e.rs` suite for
live-FFmpeg behaviors (trimming, silence removal, Unicode path handling). The CI
pipeline runs across a 3-OS matrix (`ubuntu-22.04`, `macos-14`, `windows-latest`) and
MUST pass type-sync verification, frontend tests, TypeScript build, and Rust tests
before any merge to `main`.

### VI. Platform Boundary & Permission Discipline

The Android audio booster and playback systems MUST NEVER request or use
`android.permission.RECORD_AUDIO`; loudness enhancement operates strictly on internal
digital playback streams via `LoudnessEnhancer` / `AudioPlaybackCapture`. Only one
audio stream may play at any time across the entire application — starting playback in
the Music Player must pause any Converter/Booster audio preview, and vice versa.
Android scoped-storage constraints (content URIs, MediaStore publishing, SAF path
limits) must be respected rather than worked around with raw filesystem assumptions.

### VII. Secrets Never Touch Plaintext Storage

Sensitive user credentials (e.g., the Gemini API key) MUST NEVER be written to
`settings.json`, frontend `localStorage`, or any other plaintext store. They are
persisted exclusively via the OS keychain (`src-tauri/src/secrets.rs` using the
`keyring` crate) or the equivalent native Android keystore path.

### VIII. Code Hygiene: i18n Discipline, Single Responsibility & File Size Limits (NON-NEGOTIABLE)

- **No hardcoded text, anywhere.** Every user-facing string MUST be resolved through
  `translate(lang, "key")` via `src/i18n`. Hardcoded English, Persian, or any other
  literal UI text — in components, toasts, validation messages, dialog copy, or error
  strings shown to the user — is prohibited. Any new user-facing string requires a
  matching key added to all supported locales before merge.
- **SOLID, with emphasis on Single Responsibility.** Code MUST follow SOLID design
  principles, with particular discipline around the Single Responsibility Principle
  (the "S"). Each component, hook, store slice, Rust module, or command handler
  should have exactly one reason to change. Data-fetching/IPC, business/DSP logic,
  and presentation MUST NOT be mixed in the same unit — split them into focused
  collaborators rather than growing a single responsibility-overloaded file.
- **File size ceiling.** No source file (`.ts`, `.tsx`, or `.rs`) should exceed 300
  lines. This is a hard ceiling, not a target — smaller is always preferred. When a
  file approaches the limit, it MUST be split along responsibility boundaries (e.g.,
  extract a sub-component, custom hook, store slice, or Rust submodule) rather than
  left to keep growing. Reviewers should treat an oversized file as a design smell to
  be refactored, not merely a lint warning to suppress.

## Technology & Architecture Constraints

- **Stack**: Tauri v2 (`2.x`) app shell, React 19 + TypeScript 5.9 (strict mode:
  `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`),
  Zustand ^5 (slice pattern), Tailwind CSS v4, Vite 7. Backend: Rust (edition 2021,
  MSRV 1.77), Specta/tauri-specta for typed IPC, statically bundled FFmpeg/FFprobe
  8.1.2. Android native layer: Jetpack Media3 (ExoPlayer), JNI, `LoudnessEnhancer`.
- **Layering**: Presentation components MUST stay decoupled from IPC — they read
  Zustand slices and call store actions, never call `invoke()` directly. Heavy audio
  processing MUST run off the Tauri main thread (`tokio` + worker threads). The
  Android native boundary (Kotlin `MainActivity`, scoped-storage `ContentResolver`,
  `MediaStore.Audio`) communicates with Rust only via the bidirectional JNI bridge in
  `android_fs.rs`.
- **State isolation**: The Music Player domain (`useMusicPlayerStore`) MUST remain
  fully decoupled from the conversion app store (`useAppStore`) so player state ticks
  never trigger re-renders in conversion workflows.
- **Naming conventions**: React components `PascalCase.tsx`; hooks/stores/utilities
  `camelCase.ts`; tests `ComponentName.test.tsx` / `moduleName.test.ts`; Rust modules
  `snake_case.rs`; Rust structs/enums `PascalCase` with
  `#[serde(rename_all = "camelCase")]` to keep IPC payloads aligned with TypeScript.
- **Internationalization**: Governed by Principle VIII (i18n Discipline). RTL layout
  support must be preserved for Persian in addition to the no-hardcoded-text rule.
- **Post-silence split integrity**: Split boundaries are always calculated against the
  timeline _after_ silence removal, and remainders shorter than the split window are
  preserved in the final part rather than discarded or dropped.

## Development Workflow & Quality Gates

1. Any backend contract change → run `pnpm generate:types` before opening a PR.
2. Every PR must pass the full CI matrix: dependency setup (pnpm v9, Node 22, Rust
   stable) → `pnpm fetch:ffmpeg` → `pnpm generate:types && pnpm check:types` →
   `pnpm test` → `pnpm build` (TS check) → `cargo test --manifest-path
src-tauri/Cargo.toml`.
3. New DSP or filtergraph logic must include unit coverage for filtergraph assembly,
   silence parsing, or split-timeline math, plus an e2e case if it touches live FFmpeg
   execution.
4. Any change touching Android permissions, storage, or the booster/playback session
   handling must be reviewed against Principle VI before merge.
5. Any change introducing a new persisted value (settings, cache, credentials) must
   state explicitly where it is stored and why, per the Storage & Serialization
   matrix (`settings.json`, OS keychain, `localStorage`, Android `SharedPreferences`).

## Governance

This constitution supersedes ad hoc conventions and prior undocumented practices for
this codebase. Any amendment must: (1) be captured as an update to this file, (2)
state the reason the prior rule was insufficient, and (3) note any migration impact
on existing code. All PRs and code reviews must verify compliance with the Core
Principles above, especially the NON-NEGOTIABLE items (Principles II, V, and VIII).
Added complexity that bypasses a stated principle (e.g., a multi-pass re-encode, an
untyped `invoke()` call, a plaintext-stored secret, a hardcoded UI string, or a file
left to grow past 300 lines) must be explicitly justified in the PR description or
rejected. Use `AGENT_HANDOFF.md`, `SOUND_BOOSTER_ARCHITECTURE.md`, and the technical
architecture reference for day-to-day implementation guidance; this constitution
governs when those documents are silent or in conflict.

**Version**: 1.1.0 | **Ratified**: 2026-09-15 | **Last Amended**: 2026-09-15
