// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppDragDrop } from "../useAppDragDrop";

type DragDropHandler = (event: { payload: { type: string; paths?: string[] } }) => void;

let registeredHandler: DragDropHandler | null = null;
const unlistenMock = vi.fn();
const onDragDropEventMock = vi.fn((handler: DragDropHandler) => {
  registeredHandler = handler;
  return Promise.resolve(unlistenMock);
});

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: onDragDropEventMock,
  })),
}));

describe("useAppDragDrop", () => {
  const onPlayerDrop = vi.fn();
  const onConverterDrop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandler = null;
  });

  it("registers and cleans up onDragDropEvent listener", async () => {
    const { unmount } = renderHook(() =>
      useAppDragDrop({
        activeTool: "player",
        onPlayerDrop,
        onConverterDrop,
      }),
    );

    expect(onDragDropEventMock).toHaveBeenCalledTimes(1);
    await act(async () => {});

    unmount();
    expect(unlistenMock).toHaveBeenCalledTimes(1);
  });

  it("updates isDraggingOver on enter and leave events", async () => {
    const { result } = renderHook(() =>
      useAppDragDrop({
        activeTool: "player",
        onPlayerDrop,
        onConverterDrop,
      }),
    );

    expect(result.current.isDraggingOver).toBe(false);

    act(() => {
      registeredHandler?.({ payload: { type: "enter" } });
    });
    expect(result.current.isDraggingOver).toBe(true);

    act(() => {
      registeredHandler?.({ payload: { type: "leave" } });
    });
    expect(result.current.isDraggingOver).toBe(false);
  });

  it("routes drop to onPlayerDrop when activeTool is player", async () => {
    const { result } = renderHook(() =>
      useAppDragDrop({
        activeTool: "player",
        onPlayerDrop,
        onConverterDrop,
      }),
    );

    act(() => {
      registeredHandler?.({ payload: { type: "enter" } });
    });
    expect(result.current.isDraggingOver).toBe(true);

    act(() => {
      registeredHandler?.({
        payload: { type: "drop", paths: ["/path/to/song.mp3", "/path/to/album"] },
      });
    });

    expect(result.current.isDraggingOver).toBe(false);
    expect(onPlayerDrop).toHaveBeenCalledWith(["/path/to/song.mp3", "/path/to/album"]);
    expect(onConverterDrop).not.toHaveBeenCalled();
  });

  it("routes drop to onConverterDrop when activeTool is converter", async () => {
    renderHook(() =>
      useAppDragDrop({
        activeTool: "converter",
        onPlayerDrop,
        onConverterDrop,
      }),
    );

    act(() => {
      registeredHandler?.({
        payload: { type: "drop", paths: ["/path/to/video.mp4"] },
      });
    });

    expect(onConverterDrop).toHaveBeenCalledWith(["/path/to/video.mp4"]);
    expect(onPlayerDrop).not.toHaveBeenCalled();
  });
});
