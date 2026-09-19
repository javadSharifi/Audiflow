// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrimEditor } from "../TrimEditor";
import { useAppStore } from "../../stores/useAppStore";
import type { InputFile } from "../../types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tauri-apps/api/core")>();
  return { ...actual, convertFileSrc: (p: string) => `asset://${p}` };
});
vi.mock("../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/tauri")>();
  return {
    ...actual,
    resolveMediaPaths: vi.fn(async (paths: string[]) => paths.map((p) => ({ resolved: p }))),
    probeFiles: vi.fn(async () => []),
    waveformPeaks: vi.fn(async () => [[-0.5, 0.5]]),
  };
});

function testFile(over: Partial<InputFile> = {}): InputFile {
  return {
    path: "/test/audio.mp3",
    name: "audio.mp3",
    sizeBytes: 1024 * 1024,
    durationSecs: 60,
    formatName: "mp3",
    hasAudio: true,
    error: null,
    ...over,
  };
}

beforeEach(() => {
  cleanup();
  useAppStore.setState({ lang: "fa", files: [] });
  // Mock HTMLMediaElement methods in jsdom
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});

describe("TrimEditor", () => {
  it("shows 5-second snippet preview buttons for tracks >= 5.05s", async () => {
    const file = testFile({ durationSecs: 10 });
    render(<TrimEditor file={file} />);

    // In Persian: "۵ ثانیه اول" and "۵ ثانیه آخر"
    expect(await screen.findByText("۵ ثانیه اول")).toBeTruthy();
    expect(screen.getByText("۵ ثانیه آخر")).toBeTruthy();
    expect(screen.queryByText("۱۰ ثانیه اول")).toBeNull();
    expect(screen.queryByText("۱۰ ثانیه آخر")).toBeNull();
  });

  it("hides snippet preview buttons for tracks < 5.05s", () => {
    const file = testFile({ durationSecs: 4 });
    render(<TrimEditor file={file} />);

    expect(screen.queryByText("۵ ثانیه اول")).toBeNull();
    expect(screen.queryByText("۵ ثانیه آخر")).toBeNull();
    expect(screen.queryByText("۱۰ ثانیه اول")).toBeNull();
  });

  it("does not render top guide text and renders sub-waveform hint", () => {
    const file = testFile({ durationSecs: 30 });
    render(<TrimEditor file={file} />);

    // Old top text should not be present
    expect(
      screen.queryByText("برای شنیدن، روی بخش نارنجی بزن. برای برش، دستگیره‌ها را بکش.")
    ).toBeNull();

    // New sub-waveform guide must be present
    expect(screen.getByText("برای شنیدن روی بخش نارنجی بزن")).toBeTruthy();
  });

  it("clicking Last 5s seeks to (duration - 5) and starts playback", async () => {
    const file = testFile({ durationSecs: 60 });
    const { container } = render(<TrimEditor file={file} />);

    const audio = container.querySelector("audio") as HTMLAudioElement;
    expect(audio).toBeTruthy();

    const last5Btn = await screen.findByText("۵ ثانیه آخر");
    fireEvent.click(last5Btn);

    expect(audio.currentTime).toBe(55);
    expect(audio.play).toHaveBeenCalled();
  });

  it("does not prematurely pause on timeupdate when audio is still seeking or before cleanFrom", async () => {
    const file = testFile({ durationSecs: 60 });
    const { container } = render(<TrimEditor file={file} />);

    const audio = container.querySelector("audio") as HTMLAudioElement;
    expect(audio).toBeTruthy();

    const last5Btn = await screen.findByText("۵ ثانیه آخر");
    fireEvent.click(last5Btn);

    // Simulate playback started (paused = false)
    Object.defineProperty(audio, "paused", { value: false, configurable: true });

    // Simulate timeupdate firing while seeking is true
    Object.defineProperty(audio, "seeking", { value: true, writable: true, configurable: true });
    Object.defineProperty(audio, "currentTime", { value: 60, writable: true, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(audio.pause).not.toHaveBeenCalled();

    // Simulate timeupdate firing while currentTime is not yet at targetStart (e.g. 10)
    Object.defineProperty(audio, "seeking", { value: false, writable: true, configurable: true });
    Object.defineProperty(audio, "currentTime", { value: 10, writable: true, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(audio.pause).not.toHaveBeenCalled();

    // Simulate timeupdate firing when currentTime settles at targetStart (55)
    Object.defineProperty(audio, "currentTime", { value: 55, writable: true, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(audio.pause).not.toHaveBeenCalled();

    // Now currentTime reaches targetEnd (60)
    Object.defineProperty(audio, "currentTime", { value: 60, writable: true, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(audio.pause).toHaveBeenCalled();
  });

  it("plays cleanly when clicking Last 5s while audio is already at the end of the track", async () => {
    const file = testFile({ durationSecs: 60 });
    const { container } = render(<TrimEditor file={file} />);

    const audio = container.querySelector("audio") as HTMLAudioElement;
    expect(audio).toBeTruthy();

    // Audio is currently at the end of track (60s)
    Object.defineProperty(audio, "currentTime", { value: 60, writable: true, configurable: true });
    Object.defineProperty(audio, "paused", { value: true, configurable: true });

    const last5Btn = await screen.findByText("۵ ثانیه آخر");
    fireEvent.click(last5Btn);

    // Verify currentTime was set to 55 and play called
    expect(audio.currentTime).toBe(55);
    expect(audio.play).toHaveBeenCalled();

    // Simulate playhead entering range at 55
    Object.defineProperty(audio, "paused", { value: false, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(audio.pause).not.toHaveBeenCalled();

    // Now reaching 60 causes pause
    Object.defineProperty(audio, "currentTime", { value: 60, writable: true, configurable: true });
    fireEvent.timeUpdate(audio);
    expect(audio.pause).toHaveBeenCalled();
  });
});
