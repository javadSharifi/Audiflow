# Reference — backend-core

Domain: Tauri app root, commands, queues, settings/secrets. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src-tauri/.cargo/config.toml` | 16KB max-page-size linker flags for Android SDK35/NDK-r26+. |
| `src-tauri/Cargo.lock` | Pinned Rust dependency tree (generated, commit for reproducible builds). |
| `src-tauri/Cargo.toml` | Rust manifest: tauri2 + specta rc.25 + reqwest/keyring/tokio + jni/wiremock; edition 2021. |
| `src-tauri/build.rs` | Tauri build hook `tauri_build::build`. |
| `src-tauri/capabilities/default.json` | Capability for `main` window: core/event/dialog/opener. |
| `src-tauri/examples/export_types.rs` | Specta exporter to `src/types/generated.ts`; run via `generate:types`. |
| `src-tauri/src/android_fs.rs` | Android Content-URI staging + MediaStore publish + JNI bridge; `ensure_local_path`. |
| `src-tauri/src/commands/mod.rs` | All `#[tauri::command]` handlers 1000+ lines: resolve/stat/probe/start/waveform/cancel/disk/booster/library/player/transcribe; no raw ffmpeg in frontend. |
| `src-tauri/src/disk.rs` | Free-space preflight + size estimate; `free_bytes`, `estimate_output_bytes`. |
| `src-tauri/src/error.rs` | Error taxonomy; `AppError` + `GeminiErrorKind::i18n_key`. |
| `src-tauri/src/lib.rs` | App root: `specta_builder` ~50 commands, setup (settings/queues/open-file), single-instance, kill ffmpeg on exit; exports `run`. |
| `src-tauri/src/logger.rs` | File+console logger with 5MB rotation `app.log`. |
| `src-tauri/src/main.rs` | Binary entry calling `audio_converter::run`. |
| `src-tauri/src/queue/mod.rs` | `QueueManager`: FIFO, per-job options snapshot, CancelToken map, job-event emit, 605 lines. |
| `src-tauri/src/secrets.rs` | OS keychain Gemini key only; `save/load/delete/require_gemini_api_key`, `mask_key`. |
| `src-tauri/src/settings.rs` | `settings.json` load/save/validate + concurrency clamp 1..32; atomic tmp-rename. |
| `src-tauri/src/transcribe_queue.rs` | `TranscribeQueueManager` mirroring queue lifecycle; emits `transcription-event`. |
| `src-tauri/src/types.rs` | Shared IPC contracts; `AudioFormat`/`QualityPreset`/`ConversionOptions`/`TrimSpec`/`JobEvent`. |
| `src-tauri/tauri.conf.json` | Audiflow config: dist `../dist`, 1100x760 window, assetProtocol, externalBin ffmpeg/ffprobe, file associations. |
| `src-tauri/tests/e2e.rs` | Live-FFmpeg e2e: generated tone/silence video, trim/silence/unicode asserts; skips without binaries. |

