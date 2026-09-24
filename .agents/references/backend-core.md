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
| `src-tauri/src/commands/mod.rs` | Re-exports all IPC command modules (android, audio, library, player, queue, system, transcribe). |
| `src-tauri/src/commands/android.rs` | Android staging, permissions, app settings, cold-start file queue, and exit handlers. |
| `src-tauri/src/commands/audio.rs` | Audio analysis IPC: ffprobe metadata inspection, waveform peak decoding, volume detection, and A/B preview. |
| `src-tauri/src/commands/library.rs` | Music library scanner triggers, cache stats, track deletion/ringtone/share, and path/artwork resolution. |
| `src-tauri/src/commands/player.rs` | Native Android Media3 player controls and stream volume management (19 IPC commands). |
| `src-tauri/src/commands/queue.rs` | Audio conversion and sound boost enqueueing, job cancellation, and queue inspection. |
| `src-tauri/src/commands/system.rs` | Disk space query (`disk_free`), application settings load/save, and frontend logger bridge. |
| `src-tauri/src/commands/transcribe.rs` | Gemini cloud transcription API key management, transcription jobs, queue inspection, and export. |
| `src-tauri/src/disk.rs` | Free-space preflight + size estimate; `free_bytes`, `estimate_output_bytes`. |
| `src-tauri/src/error.rs` | Error taxonomy; `AppError` + `GeminiErrorKind::i18n_key`. |
| `src-tauri/src/lib.rs` | App root: `specta_builder` ~50 commands, setup (settings/queues/open-file), single-instance, kill ffmpeg on exit; exports `run`. |
| `src-tauri/src/logger.rs` | File+console logger with 5MB rotation `app.log`. |
| `src-tauri/src/main.rs` | Binary entry calling `audio_converter::run`. |
| `src-tauri/src/queue/mod.rs` | `QueueManager`: FIFO manager, batch enqueueing (`enqueue_batch`), CancelToken map, and job events. |
| `src-tauri/src/queue/job.rs` | Queue domain structs: `JobRecord`, `JobKind`, `QueuedJob`, and `BatchJobItem`. |
| `src-tauri/src/queue/worker.rs` | Background conversion and sound boost worker loops, binary path resolution, and cancel handling. |
| `src-tauri/src/secrets.rs` | OS keychain Gemini key only; `save/load/delete/require_gemini_api_key`, `mask_key`. |
| `src-tauri/src/settings.rs` | `settings.json` load/save/validate + concurrency clamp 1..32; atomic tmp-rename. |
| `src-tauri/src/transcribe_queue.rs` | `TranscribeQueueManager` mirroring queue lifecycle; emits `transcription-event`. |
| `src-tauri/src/types.rs` | Shared IPC contracts; `AudioFormat`/`QualityPreset`/`ConversionOptions`/`TrimSpec`/`JobEvent`. |
| `src-tauri/tauri.conf.json` | Audiflow config: dist `../dist`, 1100x760 window, assetProtocol, externalBin ffmpeg/ffprobe, file associations. |
| `src-tauri/tests/e2e.rs` | Live-FFmpeg e2e: generated tone/silence video, trim/silence/unicode asserts; skips without binaries. |

