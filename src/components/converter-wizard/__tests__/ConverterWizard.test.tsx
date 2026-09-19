// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ConverterWizard } from "../ConverterWizard";
import { useAppStore } from "../../../stores/useAppStore";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../utils/tauri", () => ({
  statMediaPaths: vi.fn().mockResolvedValue([{ input: "/music/out/converted.mp3", name: "converted.mp3", sizeBytes: 1024, durationSecs: 10, error: null }]),
  fileToAssetUrl: vi.fn().mockResolvedValue("asset://localhost/converted.mp3"),
  shareAudioTrack: vi.fn().mockResolvedValue(undefined),
  deleteStagedInput: vi.fn().mockResolvedValue(undefined),
}));

const demoFile = {
  path: "/music/in/source.mp3",
  name: "source.mp3",
  sizeBytes: 2048,
  durationSecs: 120,
  formatName: "mp3",
  hasAudio: true,
  error: null,
};

function job(overrides: Record<string, unknown> = {}): never {
  return {
    id: "job-1",
    sourcePath: "/music/in/source.mp3",
    status: "processing",
    percent: 42,
    speed: null,
    error: null,
    technical: null,
    warning: null,
    outputs: [],
    ...overrides,
  } as never;
}

describe("ConverterWizard", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ files: [], jobs: new Map(), toasts: [], lang: "en" });
  });

  it("starts on upload step with next disabled when empty", () => {
    render(<ConverterWizard />);

    expect(screen.queryByTestId("wizard-stepper")).toBeNull();
    expect(screen.getByTestId("wizard-step-1")).toBeDefined();
    expect(screen.getByTestId("dropzone")).toBeDefined();
    expect((screen.getByTestId("wizard-next") as HTMLButtonElement).disabled).toBe(true);
    // No capability cards; next uses nav-button scale.
    expect(screen.queryByLabelText("capabilities")).toBeNull();
    expect(screen.getByTestId("wizard-next").className).toContain("h-[52px]");
  });

  it("advances to configs and back", () => {
    useAppStore.setState({ files: [demoFile] });
    render(<ConverterWizard />);

    fireEvent.click(screen.getByTestId("wizard-next"));
    expect(screen.getByTestId("wizard-step-2")).toBeDefined();
    expect(screen.getByTestId("wizard-convert")).toBeDefined();
    // Config CTAs use nav-button scale too.
    expect(screen.getByTestId("wizard-convert").className).toContain("h-[52px]");
    expect(screen.getByTestId("wizard-back").className).toContain("h-[52px]");

    fireEvent.click(screen.getByTestId("wizard-back"));
    expect(screen.getByTestId("wizard-step-1")).toBeDefined();
  });

  it("convert jumps to progress and auto-advances to result when queue settles", async () => {
    useAppStore.setState({
      files: [demoFile],
      startQueue: (async () => {
        useAppStore.setState({ jobs: new Map([["job-1", job()]]) });
      }) as never,
    });
    render(<ConverterWizard />);

    fireEvent.click(screen.getByTestId("wizard-next"));
    fireEvent.click(screen.getByTestId("wizard-convert"));
    expect(screen.getByTestId("wizard-step-3")).toBeDefined();
    expect(screen.getByTestId("wizard-progress-ring")).toBeDefined();

    useAppStore.setState({
      jobs: new Map([["job-1", job({ status: "completed", percent: 100, outputs: ["/music/out/converted.mp3"] })]]),
    });
    await waitFor(() => expect(screen.getByTestId("wizard-step-4")).toBeDefined());
    expect(screen.getByTestId("wizard-restart")).toBeDefined();
    // Inputs auto-clear on arrival; job records stay for the result list.
    expect(useAppStore.getState().files.length).toBe(0);
    expect(useAppStore.getState().jobs.size).toBe(1);
  });

  it("restart clears files and returns to upload", () => {
    useAppStore.setState({
      files: [demoFile],
      jobs: new Map([["job-1", job({ status: "completed", percent: 100, outputs: ["/music/out/converted.mp3"] })]]),
      clearFiles: (() => useAppStore.setState({ files: [] })) as never,
      clearFinishedJobs: (async () => { useAppStore.setState({ jobs: new Map() }); }) as never,
    });
    render(<ConverterWizard />);

    // jump to result via UI: next -> convert is async; go directly by completing flow
    fireEvent.click(screen.getByTestId("wizard-next"));
    // simulate settled queue while on step 3 is complex here; use stepper-independent path:
    // convert with already-settled jobs lands on 3 then effect moves to 4
    useAppStore.setState({ startQueue: (async () => {}) as never });
    fireEvent.click(screen.getByTestId("wizard-convert"));
    expect(screen.getByTestId("wizard-step-4")).toBeDefined();

    fireEvent.click(screen.getByTestId("wizard-restart"));
    expect(screen.getByTestId("wizard-step-1")).toBeDefined();
    expect(useAppStore.getState().files.length).toBe(0);
  });
});
