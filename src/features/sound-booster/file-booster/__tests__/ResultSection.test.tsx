// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ResultSection } from "../sections/ResultSection";
import { mimeForOutput } from "../../../../utils/format";

const doneProps = {
  lang: "en" as const,
  outputPath: "/music/out/demo-boosted.mp3",
  outputName: "demo-boosted.mp3",
  dirPath: "/music/out",
  outputSizeBytes: 2_097_152,
  originalSizeBytes: 4_194_304,
  showOpenFolder: true,
  audioUrl: null as string | null,
  onOpenFolder: () => {},
  onShare: () => {},
  onCopyPath: () => {},
};

describe("ResultSection", () => {
  beforeEach(() => {
    cleanup();
  });

  it("shows empty state before any export", () => {
    render(<ResultSection {...doneProps} outputPath={null} outputSizeBytes={null} />);

    const section = screen.getByTestId("booster-section-result");
    expect(section.getAttribute("data-state")).toBe("empty");
    expect(screen.getByText("Your boosted file summary will appear here after export.")).toBeDefined();
  });

  it("shows location, size and smaller-delta for a completed export", () => {
    render(<ResultSection {...doneProps} />);

    const section = screen.getByTestId("booster-section-result");
    expect(section.getAttribute("data-state")).toBe("done");
    expect(screen.getByText("demo-boosted.mp3")).toBeDefined();
    expect(screen.getByText("/music/out")).toBeDefined();
    expect(screen.getByText(/smaller than original/)).toBeDefined();
  });

  it("wires open/share/copy actions", () => {
    const onOpenFolder = vi.fn();
    const onShare = vi.fn();
    const onCopyPath = vi.fn();
    render(<ResultSection {...doneProps} onOpenFolder={onOpenFolder} onShare={onShare} onCopyPath={onCopyPath} />);

    fireEvent.click(screen.getByText("Open Output Folder"));
    expect(onOpenFolder).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Share"));
    expect(onShare).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Copy path"));
    expect(onCopyPath).toHaveBeenCalledOnce();
  });

  it("resolves mime types by extension", () => {
    expect(mimeForOutput("a.mp3")).toBe("audio/mpeg");
    expect(mimeForOutput("a.flac")).toBe("audio/flac");
    expect(mimeForOutput("a.unknown")).toBe("audio/mpeg");
  });
});
