// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProgressSection } from "../sections/ProgressSection";

describe("ProgressSection", () => {
  beforeEach(() => {
    cleanup();
  });

  it("shows idle hint before any export", () => {
    render(<ProgressSection lang="en" isExporting={false} progress={null} speed={null} error={null} />);

    const section = screen.getByTestId("booster-section-progress");
    expect(section.getAttribute("data-state")).toBe("idle");
    expect(screen.getByText("Export progress will appear here.")).toBeDefined();
  });

  it("shows live progress bar while exporting", () => {
    render(<ProgressSection lang="en" isExporting progress={42} speed="3.1x" error={null} />);

    const section = screen.getByTestId("booster-section-progress");
    expect(section.getAttribute("data-state")).toBe("running");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("42% (3.1x)")).toBeDefined();
  });

  it("shows plain-language error on failure", () => {
    render(<ProgressSection lang="en" isExporting={false} progress={null} speed={null} error="Export failed: disk full" />);

    const section = screen.getByTestId("booster-section-progress");
    expect(section.getAttribute("data-state")).toBe("error");
    expect(screen.getByText(/disk full/)).toBeDefined();
  });
});
