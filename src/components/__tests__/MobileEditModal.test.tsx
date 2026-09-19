// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MobileEditModal } from "../MobileEditModal";
import { useAppStore } from "../../stores/useAppStore";
import type { InputFile } from "../../types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tauri-apps/api/core")>();
  return { ...actual, convertFileSrc: (p: string) => p };
});
vi.mock("../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/tauri")>();
  return {
    ...actual,
    resolveMediaPaths: vi.fn(async (paths: string[]) => paths.map((p) => ({ resolved: p }))),
    probeFiles: vi.fn(async () => []),
    waveformPeaks: vi.fn(async () => []),
  };
});

function testFile(over: Partial<InputFile> = {}): InputFile {
  return {
    path: "/path/to/test.mp3",
    name: "test.mp3",
    sizeBytes: 1024,
    durationSecs: 60,
    formatName: "mp3",
    hasAudio: true,
    error: null,
    ...over,
  };
}

beforeEach(() => {
  cleanup();
  useAppStore.setState({ lang: "fa" });
});

describe("MobileEditModal", () => {
  it("renders with z-[80] to sit above bottom navigation dock (z-[55])", () => {
    const file = testFile();
    const onClose = vi.fn();
    render(<MobileEditModal file={file} mode="trim" onClose={onClose} />);

    const modalDialog = screen.getByTestId("mobile-edit-modal-trim");
    expect(modalDialog).toBeTruthy();

    const backdrop = modalDialog.parentElement;
    expect(backdrop).toBeTruthy();
    expect(backdrop?.className).toContain("z-[80]");
    expect(backdrop?.className).not.toContain("z-50");
  });

  it("calls onClose when close button is clicked or escape is pressed", () => {
    const file = testFile();
    const onClose = vi.fn();
    render(<MobileEditModal file={file} mode="trim" onClose={onClose} />);

    fireEvent.click(screen.getByTestId("mobile-edit-modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
