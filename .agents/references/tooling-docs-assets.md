# Reference — tooling-docs-assets

Domain: Scripts, CI, configs, specs, docs, skills, fonts. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `.agents/skills/ui-ux-pro-max/SKILL.md` | UI/UX skill pack data/script (design guidance, not app runtime). |
| `.agents/skills/**/data/* (skill guidance data)` | UI/UX skill CSV data (guidance only, not app runtime). |
| `.agents/skills/**/scripts/*.py` | Skill helper scripts (guidance tooling). |
| `.env.android.example` | Template for local Android signing secrets. |
| `.gitattributes` | Repo-tracked support file. |
| `.github/workflows/ci.yml` | CI: 3-OS matrix type-check + vitest + cargo test + Specta sync gate. |
| `.github/workflows/release.yml` | Release: tag-triggered Tauri bundles macOS/Linux/Windows + Android APK + mac install zip (DMG + install-mac.sh). |
| `.gitignore` | Repo-tracked support file. |
| `.opencode/commands/* (slash-command defs)` | Speckit slash-command definitions. |
| `.specify/* (bootstrap JSON, manifests)` | Spec-kit bootstrap config (not app code). |
| `.specify/memory/constitution.md` | Spec-kit template/script/constitution asset (workflow support). |
| `.specify/scripts/bash/*` | Spec-kit workflow scripts. |
| `.specify/templates/*` | Spec-kit document templates. |
| `.specify/workflows/*` | Spec-kit workflow registry. |
| `root docs (7 files, deleted in workdir, tracked)` | Design/history docs; deleted in workdir, kept as tracked history. |
| `README.md` | Product docs: offline converter studio, dev/build/test, LGPL FFmpeg notes. |
| `app-icon.png` | Android/build/icon resource (generated or binary-adjacent; do not hand-edit logic). |
| `index.html` | HTML shell with boot-prefs theme/lang pre-paint + splash. |
| `package.json` | Node manifest v1.4.3: scripts dev/build/android/ffmpeg/types/tests; deps tauri-api/zustand/lucide. |
| `plan.md` | v1.4.2 baseline plan: single-pass DSP, Specta IPC, constitution gates. |
| `pnpm-lock.yaml` | Pinned dependency lockfile (generated). |
| `public/* (static assets)` | Static assets copied to dist. |
| `scripts/build-android-local.sh` | Build/dev helper script (ffmpeg fetch, android build/emulator, icons). |
| `scripts/build-ffmpeg-minimal.sh` | Build/dev helper script (ffmpeg fetch, android build/emulator, icons). |
| `scripts/dev-android.sh` | Build/dev helper script (ffmpeg fetch, android build/emulator, icons). |
| `scripts/fetch-ffmpeg.mjs` | Build/dev helper script (ffmpeg fetch, android build/emulator, icons). |
| `scripts/gen-icons.py` | Build/dev helper script (ffmpeg fetch, android build/emulator, icons). |
| `scripts/patch-android-project.sh` | Build/dev helper script (ffmpeg fetch, android build/emulator, icons). |
| `scripts/run-android-emulator.sh` | Build/dev helper script (ffmpeg fetch, android build/emulator, icons). |
| `scripts/install-mac.sh` | Free macOS installer: strips quarantine + ad-hoc re-signs unsigned DMG build (no paid cert). |
| `specs/** (deleted in workdir, tracked in index)` | Mobile-perf spec artifacts; deleted in workdir, kept as tracked history. |
| `src/fonts/** (IRANSans assets)` | Bundled IRANSans fonts for Persian UI. |
| `tsconfig.json` | Strict TS 5.9 config (strict/noUnusedLocals/noUnusedParameters/noFallthrough). |
| `vite.config.ts` | Vite+React+Tailwind config: :1420/:1421 HMR, es2021, no-sourcemap. |

