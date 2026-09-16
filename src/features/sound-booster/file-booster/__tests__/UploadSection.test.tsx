// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UploadSection } from "../sections/UploadSection";

const demoFile = {
  path: "/music/demo.mp3",
  name: "demo.mp3",
  sizeBytes: 4_194_304,
  durationSecs: 185,
};

describe("UploadSection", () => {
  beforeEach(() => {
    cleanup();
  });

  it("shows upload control and capability explainer below it when no file", () => {
    render(<UploadSection lang="en" file={null} isExporting={false} onPick={() => {}} onClear={() => {}} />);

    const section = screen.getByTestId("booster-section-upload");
    expect(section.getAttribute("data-state")).toBe("empty");
    expect(screen.getByText("Choose Audio or Video File to Boost")).toBeDefined();
    expect(
      screen.getByText("Boost loudness, compare before/after, pick a format and export — everything runs offline on your device."),
    ).toBeDefined();
  });

  it("shows file summary with change/remove actions when a file is selected", () => {
    const onPick = vi.fn();
    const onClear = vi.fn();
    render(<UploadSection lang="en" file={demoFile} isExporting={false} onPick={onPick} onClear={onClear} />);

    const section = screen.getByTestId("booster-section-upload");
    expect(section.getAttribute("data-state")).toBe("ready");
    expect(screen.getByText("demo.mp3")).toBeDefined();
    fireEvent.click(screen.getByText("Change File"));
    expect(onPick).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTitle("Remove"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("locks pick/clear actions while exporting", () => {
    render(<UploadSection lang="en" file={demoFile} isExporting onPick={() => {}} onClear={() => {}} />);

    expect((screen.getByText("Change File") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle("Remove") as HTMLButtonElement).disabled).toBe(true);
  });
});
