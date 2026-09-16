// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ConfigsSection } from "../sections/ConfigsSection";
import { useAppStore } from "../../../../stores/useAppStore";
import type { ComponentProps } from "react";

const baseProps: ComponentProps<typeof ConfigsSection> = {
  lang: "en",
  file: { path: "/music/demo.mp3", name: "demo.mp3", sizeBytes: 1000, durationSecs: 60 },
  preset: "smart",
  manualGainPercent: 100,
  format: "mp3",
  preview: null,
  activeAudition: "boosted",
  isPlaying: false,
  currentTime: 0,
  isPreviewGenerating: false,
  previewError: null,
  isExporting: false,
  onPreset: () => {},
  onGain: () => {},
  onFormat: () => {},
  onAudition: () => {},
  onTogglePlay: () => {},
  onSeek: () => {},
  onExport: () => {},
};

describe("ConfigsSection", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ lang: "en" });
  });

  it("shows upload-first hint and disables controls when no file", () => {
    render(<ConfigsSection {...baseProps} file={null} />);

    const section = screen.getByTestId("booster-section-configs");
    expect(section.getAttribute("data-state")).toBe("disabled");
    expect(screen.getByText("Upload a file above to unlock settings.")).toBeDefined();
  });

  it("enables preset, format and export controls when a file is selected", () => {
    const onExport = vi.fn();
    render(<ConfigsSection {...baseProps} onExport={onExport} />);

    const section = screen.getByTestId("booster-section-configs");
    expect(section.getAttribute("data-state")).toBe("ready");
    expect(screen.getByText("Smart Boost")).toBeDefined();
    expect(screen.getByText("Boost & Export Audio")).toBeDefined();
  });

  it("locks controls while exporting", () => {
    render(<ConfigsSection {...baseProps} isExporting />);

    const section = screen.getByTestId("booster-section-configs");
    expect(section.getAttribute("data-state")).toBe("locked");
    expect((screen.getByRole("button", { name: /Processing/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
