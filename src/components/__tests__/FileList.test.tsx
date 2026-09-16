// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FileList } from "../FileList";
import { useAppStore } from "../../stores/useAppStore";
import type { InputFile } from "../../types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tauri-apps/api/core")>();
  return { ...actual, convertFileSrc: (p: string) => p };
});
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/tauri")>();
  return {
    ...actual,
    resolveMediaPaths: vi.fn(async (paths: string[]) => paths.map((p) => ({ resolved: p }))),
    probeFiles: vi.fn(async () => []),
    waveformPeaks: vi.fn(async () => []),
  };
});

function meta(path: string, over: Partial<InputFile> = {}): InputFile {
  return {
    path,
    name: path.split("/").pop() ?? path,
    sizeBytes: 1024,
    durationSecs: 6,
    formatName: "mov,mp4",
    hasAudio: true,
    error: null,
    ...over,
  };
}

beforeEach(() => {
  cleanup();
  useAppStore.setState({ files: [], jobs: new Map(), toasts: [], lang: "en" });
});

describe("FileList", () => {
  it("renders rows for files in store", () => {
    useAppStore.setState({
      files: [meta("/a/one.mp4"), meta("/b/two.mkv")],
    });
    render(<FileList />);
    expect(screen.getByTestId("file-list")).toBeTruthy();
    expect(screen.getAllByText("one.mp4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("two.mkv").length).toBeGreaterThan(0);
    expect(screen.getAllByText("File (2)").length).toBeGreaterThan(0);
  });

  it("renders nothing when store empty", () => {
    render(<FileList />);
    expect(screen.queryByTestId("file-list")).toBeNull();
  });

  it("remove button drops the row", () => {
    useAppStore.setState({ files: [meta("/a/one.mp4")] });
    render(<FileList />);
    fireEvent.click(screen.getAllByLabelText(/Remove/)[0]);
    expect(useAppStore.getState().files.length).toBe(0);
  });

  it("desktop trim/boost controls have visible labels and 40px targets", () => {
    useAppStore.setState({ files: [meta("/a/one.mp4")] });
    const { container } = render(<FileList />);
    const trim = screen.getByTestId("trim-toggle-one.mp4");
    const boost = screen.getByTestId("boost-toggle-one.mp4");
    expect(trim.textContent).toContain("Trim");
    expect(boost.textContent).toContain("Boost");
    expect(trim.className).toContain("h-10");
    expect(boost.className).toContain("h-10");
    void container;
  });

  it("shows trim/boost helper line with emphasized terms", () => {
    useAppStore.setState({ files: [meta("/a/one.mp4")] });
    render(<FileList />);
    const hint = screen.getByTestId("trim-boost-hint");
    expect(hint.querySelectorAll("strong").length).toBe(2);
  });

  it("mobile trim icon opens a modal with the editor and closes it", () => {
    useAppStore.setState({ files: [meta("/a/one.mp4")] });
    render(<FileList />);
    // No inline editor on the card before opening.
    expect(screen.queryByTestId("trim-editor-one.mp4")).toBeNull();
    fireEvent.click(screen.getByTestId("trim-toggle-mobile-one.mp4"));
    expect(screen.getByTestId("mobile-edit-modal-trim")).toBeTruthy();
    expect(screen.getByTestId("trim-editor-one.mp4")).toBeTruthy();
    fireEvent.click(screen.getByTestId("mobile-edit-modal-close"));
    expect(screen.queryByTestId("mobile-edit-modal-trim")).toBeNull();
  });

  it("mobile trim icon is highlighted once a trim exists", () => {
    useAppStore.setState({
      files: [meta("/a/one.mp4", { trimStartSecs: 1, trimEndSecs: 3 })],
    });
    render(<FileList />);
    const btn = screen.getByTestId("trim-toggle-mobile-one.mp4");
    expect(btn.className).toContain("border-orange-500/40");
    expect(screen.getByTestId("trim-chip-mobile-one.mp4").textContent).toContain("00:01.0");
  });

  it("trim editor has no stepper buttons", () => {
    useAppStore.setState({ files: [meta("/a/one.mp4")] });
    render(<FileList />);
    fireEvent.click(screen.getByTestId("trim-toggle-mobile-one.mp4"));
    expect(screen.queryByLabelText(/Decrease by 1 second|Increase by 1 second/)).toBeNull();
  });
});
