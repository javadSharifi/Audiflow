# Reference — backend-processing

Domain: Single-pass DSP pipeline, FFmpeg, booster, transcribe engine. Part of `PROJECT_GRAPH.md` domain-split map.

## Files

| File | Summary |
| ---- | ------- |
| `src-tauri/src/ffmpeg/locate.rs` | Bundled ffmpeg/ffprobe locator: env override, exe-adjacent/binaries, Android lib*.so. |
| `src-tauri/src/ffmpeg/mod.rs` | FFmpeg module index + hidden-console helper `create_hidden_command`. |
| `src-tauri/src/ffmpeg/probe.rs` | ffprobe JSON wrapper; `ProbeResult`, `probe_file`, `parse_probe_json`. |
| `src-tauri/src/ffmpeg/progress.rs` | `-progress pipe:1` parser; `ProgressSnapshot`, encode floor 15%, 250ms poll. |
| `src-tauri/src/ffmpeg/run.rs` | Cancellable child runner; `CancelToken`, `RunSpec::run`. |
| `src-tauri/src/ffmpeg/waveform.rs` | Waveform peaks via mono 16kHz decode; `StreamingBucketer`. |
| `src-tauri/src/processing/mod.rs` | Processing module index: naming/pipeline/silence/split/sound_booster/transcribe. |
| `src-tauri/src/processing/naming.rs` | Collision-safe `(1)/(2)` naming + sanitize; `unique_path`, `output_directory`. |
| `src-tauri/src/processing/pipeline.rs` | Single-pass `filter_complex` builder + `run_job` (probe-plan-ffmpeg-rename); `encoder_args`; one lossy encode max. |
| `src-tauri/src/processing/silence.rs` | Silence detect/remove math; `parse_silencedetect`, `kept_ranges`, `total_kept`. |
| `src-tauri/src/processing/sound_booster/analyze.rs` | `volumedetect` gain analysis; `VolumeAnalysis`, `analyze_volume`. |
| `src-tauri/src/processing/sound_booster/boost.rs` | Booster FFmpeg argv builder; `build_boost_args`. |
| `src-tauri/src/processing/sound_booster/mod.rs` | Booster module index re-exporting analyze/boost/pipeline/presets/preview. |
| `src-tauri/src/processing/sound_booster/pipeline.rs` | Offline boost job runner; `run_boost_job`. |
| `src-tauri/src/processing/sound_booster/presets.rs` | 6 preset filter chains, every chain ends in `alimiter`; `build_preset_filter_chain`. |
| `src-tauri/src/processing/sound_booster/preview.rs` | 10-15s A/B audition clips + peaks; `generate_ab_preview`. |
| `src-tauri/src/processing/split.rs` | Split-point math on post-silence timeline; `split_windows`, `parse_duration_input`. |
| `src-tauri/src/processing/transcribe/error_classify.rs` | HTTP to `GeminiErrorKind` mapper; `classify_gemini_error`. |
| `src-tauri/src/processing/transcribe/gemini_client.rs` | Gemini Files+generateContent client; upload/transcribe/validate-key. |
| `src-tauri/src/processing/transcribe/mod.rs` | Transcribe orchestration: preprocess/chunk/upload/stitch; `run_transcription` (Rust-side only). |
| `src-tauri/src/processing/transcribe/preprocess.rs` | Mono 16kHz Opus 32k compress + optional atempo 1.5x; `build_preprocess_args`. |
| `src-tauri/src/processing/transcribe/stitch.rs` | Chunk merge + export render; `stitch_chunks`, `render_transcript`. |
| `src-tauri/src/processing/transcribe/types.rs` | Transcribe contracts/limits; `TranscriptionRequestConfig`, `TranscriptionResult`. |
| `src-tauri/src/processing/transcribe/usage_tracker.rs` | Pacific-day local ledger `transcribe_usage.json`; `UsageStats`. |

