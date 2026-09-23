# Tasks: Arch Linux Package

**Input**: Design documents from `specs/017-arch-linux-package/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/packaging-contract.md, quickstart.md

**Tests**: Testing is structural-only per plan.md's technology decision (`bash -n`, `makepkg --printsrcinfo`, `bsdtar -tf`, quickstart scenarios; no frontend/Rust test tasks — zero app-code change, non-interference is the CI gate).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently. The packaging flow lives mostly in `scripts/package-arch.sh` (orchestrator) and `packaging/arch/PKGBUILD` (recipe); story independence is preserved by implementing in metadataIdentity → orchestrator phases → packaging contents → docs order.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project (desktop app + tooling): paths shown at repository root
- New packaging layer: `packaging/arch/` + `scripts/package-arch.sh` + `packaging/README.md`
- Zero changes to `src/`, `src-tauri/src/`, `src-tauri/tauri.conf.json` (plan constraint)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create packaging layer entry points and validation baseline.

- [x] T001 Create `packaging/` directory with packaging/arch subdir (`packaging/arch/PKGBUILD` will be created by T003 and staging validated by makepkg invocation context)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: PKGBUILD metadata identity — blocking: every packaging output names these fields; SRCINFO validation consumes them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create PKGBUILD foundational variables and metadata in packaging/arch/PKGBUILD with single source of truth bindings per R8: pkgname='audiflow', version injected from src-tauri/tauri.conf.json version field (currently 1.5.7 — parsed by the orchestrator, never hardcoded: use `PKGVER_OVERRIDE` env or a generated version fragment; makepkg requires a literal pkgver at parse time, so orchestrator exports `PKGVER_OVERRIDE=$(jq -r .version src-tauri/tauri.conf.json)` and the PKGBUILD reads it with a fail-fast guard if unset; NO silent default), pkgrel=1, arch=('x86_64'), license= fill placeholder from specs/017-arch-linux-package/research.md "Needs Clarification" — repo owner's explicit choice REQUIRED (valid Arch license identifiers: MIT, GPL-3.0-only, LicenseRef-Proprietary; makepkg warns when license is missing; summarizing: record as NEEDS CLARIFICATION comment if owner has not chosen by implementation time and surface the warning in T011 validation), description copied verbatim from src-tauri/tauri.conf.json shortDescription; depends=('webkit2gtk-4.1' 'gtk3' 'gst-plugins-base' 'gst-plugins-good' 'gst-plugins-bad' 'gst-plugins-ugly' 'gst-libav') per R6 — MUST NOT include ffmpeg/ffprobe (bundled per R2); makedepends=('rust' 'nodejs' 'pnpm') minimal per R1; build() must exist as no-op pass-through per R1; package() body stubbed with a TODO marker in this task (filled by US2)

**Checkpoint**: Foundation ready — PKGBUILD metadata identity exists; `cd packaging/arch && env PKGVER_OVERRIDE=1.5.7 makepkg --printsrcinfo` parses emitting pkgname/pkgver/pkgrel/arch/depends/makedepends per contracts/packaging-contract.md "SRCINFO structural check"

---

## Phase 3: User Story 1 - Build an installable Arch Linux package (Priority: P1) 🎯 MVP

**Goal**: A developer runs one command (`./scripts/package-arch.sh` from repo root) and produces an installable `audiflow-<version>-<pkgrel>-x86_64.pkg.tar.zst` for x86_64.

**Independent Test**: Can be fully tested by running `./scripts/package-arch.sh` on an Arch host (or in the quickstart-arch container), confirming the pattern-named `.pkg.tar.zst` artifact exists at the output path and `pacman -U` succeeds (quickstart Scenario 1).

### Implementation for User Story 1

- [x] T003 [US1] Create the packaging recipe wiring in packaging/arch/PKGBUILD: package() consumes orchestrator's prebuilt output per R1 (no in-makepkg rebuild), fail-fast output guards per packaging-contract.md "Prereq check": guard that Tauri build output exists at src-tauri/target/x86_64-unknown-linux-gnu/release/audiflow, guard that sidecar artifacts exist at src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu and src-tauri/binaries/ffprobe-x86_64-unknown-linux-gnu (matching tauri.conf.json externalBin triple naming per tauri.conf.json:38), error naming the guard that failed
- [x] T004 [US1] Create the orchestrator prereq check phase (scripts/package-arch.sh) with one-pass fail-fast per packaging-contract.md "Prereq check": Arch environment detection (ID=arch in /etc/os-release, with explicit --force-non-arch escape hatch that errors clearly per contract), toolchain probes (rustc/cargo/node/pnpm makepkg/bsdtar), Tauri Linux build deps presence probe via pacman -T (webkit2gtk-4.1, gtk3, gstreamer dev families per R6). Output: named summary of ALL missing prereqs in one pass, plain-language, no long build started
- [x] T005 [US1] Create the orchestrator build phase (scripts/package-arch.sh): canonical unchanged repo flow invoked in order: pnpm install --frozen-lockfile → pnpm fetch:ffmpeg → pnpm tauri build --target x86_64-unknown-linux-gnu (plan canonical flow; must fail fast; support --skip-build flag which reuses outcome without an output existence guard per CLI contract); MUST NOT pass output globs, MUST NOT alter release.yml, MUST NOT alter existing deb/appimage paths or sources
- [x] T006 [US1] Create the orchestrator packaging phase (scripts/package-arch.sh): run makepkg from packaging/arch consuming Tauri build output, producing audiflow-<version>-<pkgrel>-x86_64.pkg.tar.zst; guarantee: artifact path printed as last line; on Ctrl+C or failure, no partial .pkg.tar.zst left in the output dir (makepkg semantics: only the complete archive is named as the artifact; orchestrator validates the named artifact exists before printing success)
- [x] T007 [US1] Structural validation of the orchestrator (scripts/package-arch.sh): run `bash -n scripts/package-arch.sh` to validate syntax; confirm the three-phase CLI contract of contracts/packaging-contract.md holds structurally (phases present in order, --skip-build flag parsed, no sudo invocations anywhere); quickstart Scenario 5 applies
- [x] T008 [US1] Validate SRCINFO structurally (per packaging-contract.md "SRCINFO structural check"): `cd packaging/arch && env PKGVER_OVERRIDE=1.5.7 makepkg --printsrcinfo | grep -E "pkgname|pkgver|pkgrel|arch|depends|makedepends"` emits all required fields; makepkg hard-fail conditions missing pkgver/pkgname MUST surface as explicit guards, not a silent parse error

**Checkpoint**: `./scripts/package-arch.sh` produces a named `.pkg.tar.zst`; quickstart Scenarios 1 and 5 pass; User Story 1 fully testable independently (US1 independent test: packaging command succeeds and pacman -U installs)

---

## Phase 4: User Story 2 - Package contents land in standard locations (Priority: P2)

**Goal**: `packaging/arch/PKGBUILD` package() stamps exactly the contract file list into `$pkgdir`; zero files outside `/usr` subpaths.

**Independent Test**: Can be fully tested by installing the package (`pacman -U <artifact>`) and querying `pacman -Ql audiflow` (quickstart Scenario 3): binary at `/usr/lib/audiflow/audiflow`, sidecar pair next to it, launcher at `/usr/bin/audiflow`, `.desktop` under `/usr/share/applications/`, icons under `/usr/share/icons/hicolor/*/apps/`; `pacman -Ql audiflow | grep -v '^audiflow /usr'` empty.

### Implementation for User Story 2

- [x] T009 [US2] Fill package() in packaging/arch/PKGBUILD: stamp the launch stack per contracts/packaging-contract.md "Artifact Contract" file list — the R3 wrapper script /usr/bin/audiflow (0755; tiny shell that execs /usr/lib/audiflow/audiflow; wrapper content finalized per research.md R3 "concrete wrapper finalized in implementation" — execs the real ELF so current_exe().parent() = /usr/lib/audiflow per src-tauri/src/ffmpeg/locate.rs:88 next-to-exe contract), copy audiflow ELF into /usr/lib/audiflow/audiflow, copy sidecars into /usr/lib/audiflow/ffmpeg and /usr/lib/audiflow/ffprobe. All copies from guarded build-output sources per T003; all 0755 root:root
- [x] T010 [US2] Fill package() in packaging/arch/PKGBUILD: stamp desktop entry into /usr/share/applications/audiflow.desktop (0644: Name= matching src-tauri/tauri.conf.json productName; Exec=/usr/bin/audiflow referencing launcher path per contract line 44; Icon=/usr/share/icons/hicolor/128x128/apps/audiflow.png) and stamp icons into /usr/share/icons/hicolor/32x32/apps/audiflow.png, /usr/share/icons/hicolor/128x128/apps/audiflow.png, /usr/share/icons/hicolor/256x256@2x/apps/audiflow.png (contract lines 45–47: filename per icon source set) — all icon assets copied from the existing src-tauri/icons/ PNG set reused per the tauri bundle icon assets for deb/appimage (research.md R8 "reused .deb/.AppImage icon assets"; all 0644 root:root)
- [x] T011 [US2] Structural validation of package contents: build the package in the orchestrator and run bsdtar -tf <artifact> per R4: assert files at the eight contract paths per contracts/packaging-contract.md; zero files outside /usr subpaths (spec SC-004); numeric modes honored per contract line 49 on .desktop/icons (0644) and ELF/sidecars/launcher (0755); scenario 3 of quickstart.md expected file list fully present

**Checkpoint**: Installed package has zero files outside /usr subpaths; quickstart Scenario 3 passes; US2 testable independently (US2 independent test: pacman -Ql rendering per contract file list)

---

## Phase 5: User Story 3 - Reproducible packaging documented (Priority: P3)

**Goal**: A fresh contributor can go from repo clone to installed package fully from documentation; same-structure reruns; zero non-interference.

**Independent Test**: Can be fully tested by following `packaging/README.md` on a clean Arch Linux machine (or quickstart-arch container) with no other context, confirming produce-install-rerun cycles; quickstart Scenarios 4, 6, 7 pass.

### Implementation for User Story 3

- [x] T012 [P] [US3] Create packaging/README.md (packaging docs per plan.md Structure Decision): contents — prerequisites per quickstart.md (Arch real host + Path B container commands per R7), exact packaging command (`./scripts/package-arch.sh` + --skip-build flag), output artifact naming/location, version injection explanation (PKGVER_OVERRIDE from tauri.conf.json — packaging docs), license NEEDS CLARIFICATION note per research.md carried item (lines up with T002), and the release-automation statement spec FR-010 optional — release.yml modification deferred, NOT in this feature's scope (plan constraint: NO release.yml changes; docs record what is and is not automated)
- [x] T013 [US3] Final non-interference validation (spec SC-003, quickstart Scenario 6): run `pnpm test` and `cargo test --manifest-path src-tauri/Cargo.toml` — both pass with no modification; `git diff --name-only` shows packaging/ + scripts/package-arch.sh + specs/017 artifacts only (no src/, no src-tauri/src/, no src-tauri/tauri.conf.json, no release.yml, no .deb/.AppImage outputs); record validation results in this tasks.md ✓ markers per implementation strategy

**Checkpoint**: US3 testable independently (US3 independent test: documentation-only reproduction); all existing outputs (.deb/.AppImage release flow) proven unchanged

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quickstart execution evidence, shared-memory updates, final review evidence.

- [x] T014 Execute all executable quickstart.md scenarios (quickstart.md Scenarios 1–7): record pass/fail per scenario (two paths per R7: real Arch host or Path B Docker container); Scenarios 2–4 requiring install/launch run inside the same container/host environment; validate rerun with --skip-build has the same artifact structure (spec SC-002 same-structure rerun)
- [x] T015 Add BUGFIXES.md max-2-line row if any regression was found during T013/T014 (per AGENTS.md; only if one exists — record "none" in the completion report otherwise); update specs/017-arch-linux-package/tasks.md[']s task checkboxes to [x] as completion markers per implementation strategy; verify shared-memory changes match the repository state (AGENTS.md Protocol step 5): PROJECT_GRAPH.md specs row already points at 017 (set during the spec phase — verify it is still accurate, do not rebuild)
- [x] T016 Final git diff review (AGENTS.md step 3): confirm all changed files are the six packaging-layer artifacts: packaging/arch/PKGBUILD, scripts/package-arch.sh, packaging/README.md, specs/017-arch-linux-package/tasks.md, PROJECT_GRAPH.md (specs row only), BUGFIXES.md (only if T015 found a fix); confirm zero changes to src/ or src-tauri/src/ or src-tauri/tauri.conf.json or release.yml; record in the completion report

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 — no dependencies
- **Foundational (Phase 2)**: T002 — depends on T001; produces PKGBUILD metadata identity; BLOCKS all user stories
- **US1 (Phase 3)**: T003 → T004 → T005 → T006 → T007 (all depend on foundational/sequential — T003 is recipe wiring consumed by orchestrator; T004 must block T005, T005 must block T006, T007/T008 validate the resulting structure; orchestrator is one file so sequential editing)
- **US2 (Phase 4)**: T009 + T010 (both fill package() in the same file — sequential in-list; T011 validation runs executable); T009/T010 depend on US1's orchestrator (T004/T005/T006) existing
- **US3 (Phase 5)**: T012 docs independent (one file), T013 depends on all prior tasks
- **Polish (Phase 6)**: T014 → T015 → T016

### Story Dependencies

- **US1 (P1 🎯 MVP)**: blocks US2 — US2 fills the package() body consumed by US1's orchestrator output (both are in packaging/arch/PKGBUILD — one deliverable file; dependency is recipe-contents; orchestrator file dependencies are one-way referenced by file paths)
- **US2 (P2)**: depends on US1 (orchestrator build output required to validate stamped contents); blocks US3's T013 (contents must exist before non-interference validation)
- **US3 (P3)**: docs (T012) can start after foundational; final validations (T013) require US1+US2

### Parallel Opportunities

- T001/T002 sequential (directory must exist first)
- T003-T006 sequential (single-file dependency chain in scripts/package-arch.sh + wiring)
- T009/T010 sequential (both fill package() in packaging/arch/PKGBUILD, no two-agent concurrent edits)
- T012 can run in parallel with US1/US2 implementation (docs independent; [P] marker)
- T004's prereq probe list can be validated independently by pacman -T runs (no file edits)

**Sequential execution note**: This is a small packaging feature; the whole deliverable is 3 tooling artifacts + 2 shared-memory checks. Sequential one-pass execution (T001 → T016) is the realistic path; no true team-parallelizable matrix exists (all security/tunables land in two files).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup (T001)
2. Complete Phase 2 Foundational (CRITICAL, blocks all stories)
3. Complete Phase 3 US1
4. **STOP and VALIDATE**: quickstart Scenario 1 (artifact produced + pacman -U installs + Scenario 1 file list)
5. At this point the deliverable is genuinely installable — achieves the spec's core request

### Incremental Delivery

1. Setup + foundational → PKGBUILD metadata exists
2. Add US1 → orchestrator phases → artifact produced (MVP!)
3. Add US2 → contents land in standard locations → full contract file list
4. Add US3 → docs + non-interference proof → reproducible by fresh contributors
5. Polish → quickstart evidence + memory updates

### Notes

- **License placeholder**: T002 must surface the NEEDS CLARIFICATION value per research.md — repo owner's choice REQUIRED (T011 validation warns if still placeholder)
- **No sudo**: orchestrator must never invoke sudo (packaging-contract.md "Non-interference guarantee"); pacman -U remains the user's action
- **300-line ceiling** (Constitution VIII): scripts/package-arch.sh stays under 300 lines by splitting phases across functions
- Forward markers: T003[']s guards consume build-output artifacts produced by T005[']s flow — a cold `--skip-build` run without a prior build MUST fail with a plain-language guard message naming the missing build output (this is the US1 fail-fast independent test, quickstart Scenario 5)
- Verify tests fail before implementing is not applicable (structural, not TDD per plan.md Testing decision)
- Commit after each logical group
- Stop at checkpoints to validate stories independently
