import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export interface UseAppDragDropOptions {
  activeTool: "player" | "converter" | "booster";
  onPlayerDrop: (paths: string[]) => void;
  onConverterDrop: (paths: string[]) => void;
}

export interface UseAppDragDropResult {
  isDraggingOver: boolean;
}

/**
 * Context-aware native drag-and-drop hook for Audiflow.
 * Tracks drag-hover state and routes dropped filesystem paths to either
 * the Music Player or the Audio Converter based on the currently active tool.
 */
export function useAppDragDrop({
  activeTool,
  onPlayerDrop,
  onConverterDrop,
}: UseAppDragDropOptions): UseAppDragDropResult {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDraggingOver(true);
        } else if (event.payload.type === "leave") {
          setIsDraggingOver(false);
        } else if (event.payload.type === "drop") {
          setIsDraggingOver(false);
          const paths = event.payload.paths ?? [];
          if (paths.length > 0) {
            if (activeTool === "player") {
              onPlayerDrop(paths);
            } else if (activeTool === "converter") {
              onConverterDrop(paths);
            }
          }
        }
      })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => {
        // Webview event unavailable (e.g. non-Tauri or test environment)
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [activeTool, onPlayerDrop, onConverterDrop]);

  return { isDraggingOver };
}
