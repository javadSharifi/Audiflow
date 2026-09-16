// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { WizardResultList } from "../WizardResultList";
import { useAppStore } from "../../../stores/useAppStore";
import { statMediaPaths } from "../../../utils/tauri";

vi.mock("../../../utils/tauri", () => ({
  statMediaPaths: vi.fn(),
  shareAudioTrack: vi.fn(),
  fileToAssetUrl: vi.fn(),
}));

const mockedStat = vi.mocked(statMediaPaths);

function okJob(id: string, sourcePath: string, outputs: string[]): never {
  return { id, sourcePath, status: "completed", percent: 100, speed: null, error: null, technical: null, warning: null, outputs } as never;
}
function failedJob(id: string, sourcePath: string, error: string): never {
  return { id, sourcePath, status: "failed", percent: 0, speed: null, error, technical: null, warning: null, outputs: [] } as never;
}

describe("WizardResultList", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ files: [], jobs: new Map(), toasts: [], lang: "en" });
    mockedStat.mockImplementation(async (paths: string[]) =>
      paths.map((p) => ({
        input: p,
        name: p.split("/").pop() ?? p,
        sizeBytes: p.includes("unknown-size") ? null : 2048,
        durationSecs: 60,
        error: null,
      })) as never,
    );
  });

  it("shows empty state when nothing finished", () => {
    render(<WizardResultList lang="en" />);
    expect(screen.getByText("Your converted files summary will appear here after conversion.")).toBeDefined();
  });

  it("lists every output with name, format and size plus folder banner, no actions or preview", () => {
    useAppStore.setState({
      jobs: new Map([
        ["job-1", okJob("job-1", "/music/in/a.wav", ["/music/out/a.mp3"])],
        ["job-2", okJob("job-2", "/music/in/b.wav", ["/music/out/b.mp3", "/music/out/unknown-size.mp3"])],
      ]),
    });
    const { container } = render(<WizardResultList lang="en" />);

    const list = screen.getByTestId("wizard-result-list");
    const row0 = within(list).getByTestId("result-row-0");
    within(list).getByTestId("result-row-1");
    const row2 = within(list).getByTestId("result-row-2");
    expect(row0.textContent).toContain("a.mp3");
    expect(row0.textContent).toContain("MP3");
    expect(row0.textContent).toContain("Done");
    // unreadable size renders row without size, not an error
    expect(row2.textContent).toContain("unknown-size.mp3");
    expect(screen.getByTestId("result-folder-banner").textContent).toContain("/music/out");
    expect(container.querySelector("audio")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows failed files as error rows without size", () => {
    useAppStore.setState({
      jobs: new Map([["job-9", failedJob("job-9", "/music/in/broken.wav", "decode failed")]]),
    });
    render(<WizardResultList lang="en" />);

    const err = screen.getByTestId("result-error-0");
    expect(err.textContent).toContain("broken.wav");
    expect(err.textContent).toContain("decode failed");
  });
});
