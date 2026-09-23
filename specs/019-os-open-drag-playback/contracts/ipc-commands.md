# IPC Command Contract: `resolve_audio_paths`

**Feature**: `specs/019-os-open-drag-playback`  
**Date**: 2026-09-23  

## 1. Rust Command Definition

```rust
/// Resolve a list of file or directory paths into parsed AudioTrackInfo records.
/// Recursively scans directories up to depth 5 for supported audio formats.
/// Non-audio files are safely skipped.
/// Preserves natural alphanumeric track ordering.
#[tauri::command]
#[specta::specta]
pub async fn resolve_audio_paths(
    paths: Vec<String>,
) -> Vec<crate::music_library::AudioTrackInfo> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::music_library::resolve_paths(paths)
    })
    .await
    .unwrap_or_default()
}
```

### Registration:
- Added to `specta_builder()` in `src-tauri/src/lib.rs`.
- Exposed through TypeScript code generation via `pnpm generate:types`.

---

## 2. TypeScript IPC Facade (`src/utils/tauri.ts`)

```typescript
/**
 * Resolves a list of file or directory paths into parsed AudioTrackInfo records.
 * Traverses folders recursively, skips unsupported files, and returns playable tracks.
 */
export async function resolveAudioPaths(paths: string[]): Promise<AudioTrackInfo[]> {
  return commands.resolveAudioPaths(paths);
}
```

---

## 3. Frontend Drag-and-Drop Hook Contract (`src/hooks/useAppDragDrop.ts`)

```typescript
export interface UseAppDragDropOptions {
  activeTool: "player" | "converter" | "booster";
  onPlayerDrop: (paths: string[]) => void;
  onConverterDrop: (paths: string[]) => void;
}

export interface UseAppDragDropResult {
  isDraggingOver: boolean;
}

export function useAppDragDrop(options: UseAppDragDropOptions): UseAppDragDropResult;
```
