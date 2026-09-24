# Quickstart & Verification Guide: Maximize Code Health

This guide details the step-by-step commands to validate that refactorings and tests successfully improve code health without breaking behavior.

## 1. Prerequisites
- Node.js 22+ with `pnpm`
- Rust stable (1.77+) with `cargo`
- Local Repowise instance running at `http://localhost:3000`

## 2. Step-by-Step Validation Procedure

### Step 1: Pre-Refactoring Baseline Run
Verify all existing tests pass before touching code:
```bash
# Frontend test suite
pnpm test

# Rust unit and integration tests
cargo test --manifest-path src-tauri/Cargo.toml

# Specta IPC contract check
pnpm check:types
```

### Step 2: Cycle Breaking & Structural Verification
After decoupling each circular import:
1. Verify circular dependency checks:
   ```bash
   npx madge --circular src/
   ```
2. Verify TypeScript build and lint:
   ```bash
   pnpm build
   ```

### Step 3: Untested Hotspots Characterization Run
Execute the newly added characterization tests:
```bash
# Test backend command guards and queue logic
cargo test --manifest-path src-tauri/Cargo.toml --test commands_characterization

# Test store and audio engine interactions
pnpm test src/stores/musicPlayer/
```

### Step 4: Dead Code Pruning Verification
Ensure no runtime imports broke:
```bash
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

### Step 5: Repowise Health Rescan
Trigger a repository re-analysis in Repowise:
1. Open `http://localhost:3000/repos/bdd5b9ae4f234d1eb5717e072b125f70/code-health`
2. Click **Refresh** / **Re-index**
3. Verify:
   - Number of "At Risk" files drops toward 0
   - Number of Circular Dependencies drops from 8 to 0
   - Hotspot Health score rises from 4.2 toward 8.0+
   - Overall Code Health advances from 6.9 into the Good / Excellent band (9.0+)
