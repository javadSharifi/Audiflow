// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import { useAppStore } from "../../../stores/useAppStore";
import { FirstRunFoldersGate } from "../FirstRunFoldersGate";
import * as tauriApi from "../../../utils/tauri";
import { pickDirectories } from "../../../utils/dialog";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock("@tauri-apps/api/path", () => ({
  audioDir: vi.fn(async () => "/home/tester/Music"),
  downloadDir: vi.fn(async () => "/home/tester/Downloads"),
  desktopDir: vi.fn(async () => "/home/tester/Desktop"),
  documentDir: vi.fn(async () => "/home/tester/Documents"),
}));

vi.mock("../../../utils/dialog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../utils/dialog")>();
  return { ...actual, pickDirectories: vi.fn(async () => []) };
});

vi.mock("../../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof tauriApi>();
  return {
    ...actual,
    getMusicPermissionStatus: vi.fn(async () => "granted"),
    scanAudioFiles: vi.fn(async () => []),
    requestMediaPermissions: vi.fn(),
    openAppSettings: vi.fn(),
    hasNotificationPermission: vi.fn(async () => true),
    getTrackArtworkUrl: vi.fn(async () => null),
  };
});

const mockedPickDirectories = vi.mocked(pickDirectories);

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockedPickDirectories.mockResolvedValue([]);
  try {
    localStorage.clear();
  } catch {}
  useAppStore.setState({ lang: "en" });
  useMusicPlayerStore.setState({
    tracks: [],
    currentPlaylist: [],
    loading: false,
    hasScanned: false,
    permissionStatus: "granted",
    likedPaths: new Set(),
    customFolders: [],
  });
});

describe("FirstRunFoldersGate", () => {
  it("renders 4 default rows with Music pre-checked", async () => {
    render(<FirstRunFoldersGate onDone={() => {}} onSkip={() => {}} />);

    expect(await screen.findByText("/home/tester/Music")).toBeTruthy();
    expect(await screen.findByText("/home/tester/Downloads")).toBeTruthy();
    expect(await screen.findByText("/home/tester/Desktop")).toBeTruthy();
    expect(await screen.findByText("/home/tester/Documents")).toBeTruthy();

    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes).toHaveLength(4);
    expect(boxes.map((b) => b.checked)).toEqual([true, false, false, false]);
  });

  it("Start calls onDone with the checked dirs", async () => {
    const onDone = vi.fn();
    render(<FirstRunFoldersGate onDone={onDone} onSkip={() => {}} />);

    await screen.findByText("/home/tester/Music");
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(["/home/tester/Music"]);
  });

  it("Start includes newly checked rows", async () => {
    const onDone = vi.fn();
    render(<FirstRunFoldersGate onDone={onDone} onSkip={() => {}} />);

    await screen.findByText("/home/tester/Downloads");
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(onDone).toHaveBeenCalledWith([
      "/home/tester/Music",
      "/home/tester/Downloads",
    ]);
  });

  it("Skip calls onSkip", async () => {
    const onSkip = vi.fn();
    render(<FirstRunFoldersGate onDone={() => {}} onSkip={onSkip} />);

    await screen.findByText("/home/tester/Music");
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("Start with an empty selection is treated as skip", async () => {
    const onDone = vi.fn();
    const onSkip = vi.fn();
    render(<FirstRunFoldersGate onDone={onDone} onSkip={onSkip} />);

    await screen.findByText("/home/tester/Music");
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(onDone).not.toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("Add other folder appends picked dirs as checked rows", async () => {
    mockedPickDirectories.mockResolvedValue(["/media/usb"]);
    const onDone = vi.fn();
    render(<FirstRunFoldersGate onDone={onDone} onSkip={() => {}} />);

    await screen.findByText("/home/tester/Music");
    fireEvent.click(screen.getByRole("button", { name: "Add other folder…" }));

    expect(await screen.findByText("/media/usb")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));
    expect(onDone).toHaveBeenCalledWith(["/home/tester/Music", "/media/usb"]);
  });

  it("Add other folder dedupes already-listed dirs", async () => {
    mockedPickDirectories.mockResolvedValue(["/home/tester/Music"]);
    render(<FirstRunFoldersGate onDone={() => {}} onSkip={() => {}} />);

    await screen.findByText("/home/tester/Music");
    fireEvent.click(screen.getByRole("button", { name: "Add other folder…" }));

    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getAllByRole("checkbox")).toHaveLength(4);
  });

  it("persists the selection to custom folders for future rescans", async () => {
    const onDone = vi.fn();
    render(<FirstRunFoldersGate onDone={onDone} onSkip={() => {}} />);

    await screen.findByText("/home/tester/Music");
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(onDone).toHaveBeenCalled();
    expect(useMusicPlayerStore.getState().customFolders).toEqual([
      "/home/tester/Music",
    ]);
  });
});
