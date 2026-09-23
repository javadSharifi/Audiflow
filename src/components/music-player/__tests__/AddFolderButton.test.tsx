// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import { useAppStore } from "../../../stores/useAppStore";
import { AddFolderButton } from "../AddFolderButton";
import { pickDirectories } from "../../../utils/dialog";
import * as tauriApi from "../../../utils/tauri";

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
    hasNotificationPermission: vi.fn(async () => true),
    getTrackArtworkUrl: vi.fn(async () => null),
  };
});

const mockedPickDirectories = vi.mocked(pickDirectories);
const mockedScanAudioFiles = vi.mocked(tauriApi.scanAudioFiles);

// US3 persistence assertions read the persisted entry — repo convention:
// in-memory storage mock (jsdom exposes a broken localStorage getter), same
// as perfCaching.test.ts / addCustomFolders.test.ts. persistence.ts still
// exercises its real write path (JSON under "player-custom-folders").
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();
vi.stubGlobal("localStorage", storageMock);

const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const originalUA = navigator.userAgent;

function setUA(value: string): void {
  Object.defineProperty(navigator, "userAgent", { value, configurable: true });
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockedPickDirectories.mockResolvedValue([]);
  mockedScanAudioFiles.mockResolvedValue([]);
  try {
    localStorage.clear();
  } catch { /* best-effort: ignore */ }
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

afterEach(() => {
  setUA(originalUA);
});

function spyPushToast() {
  const spy = vi.fn();
  useAppStore.setState({ pushToast: spy as unknown as (kind: "error" | "info" | "warning", text: string) => void });
  return spy;
}

describe("AddFolderButton (US1: pick flow)", () => {
  it("renders a button labelled addFolderTitle on macOS", () => {
    setUA(MAC_UA);
    render(<AddFolderButton />);

    const btn = screen.getByRole("button", { name: "Add music folder…" });
    expect(btn).toBeTruthy();
  });

  it("cancel (picker returns []) calls nothing and emits no toast", async () => {
    setUA(MAC_UA);
    const pushToast = spyPushToast();
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(mockedPickDirectories).toHaveBeenCalledTimes(1);
    expect(useMusicPlayerStore.getState().customFolders).toEqual([]);
    expect(mockedScanAudioFiles).not.toHaveBeenCalled();
    expect(pushToast).not.toHaveBeenCalled();
  });

  it("pick already fully tracked is silent: no action, no toast", async () => {
    setUA(MAC_UA);
    mockedPickDirectories.mockResolvedValue(["/d"]);
    useMusicPlayerStore.setState({ customFolders: ["/d"] });
    const pushToast = spyPushToast();
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(mockedScanAudioFiles).not.toHaveBeenCalled();
    expect(pushToast).not.toHaveBeenCalled();
    expect(useMusicPlayerStore.getState().customFolders).toEqual(["/d"]);
  });

  it("accept + track delta shows singular added toast", async () => {
    setUA(MAC_UA);
    mockedPickDirectories.mockResolvedValue(["/d"]);
    mockedScanAudioFiles.mockResolvedValue([
      { path: "/d/t1.mp3", title: "T1", durationSecs: 1 },
      { path: "/d/t2.mp3", title: "T2", durationSecs: 1 },
    ] as unknown as Awaited<ReturnType<typeof tauriApi.scanAudioFiles>>);
    const pushToast = spyPushToast();
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(useMusicPlayerStore.getState().customFolders).toEqual(["/d"]);
    expect(pushToast).toHaveBeenCalledTimes(1);
    expect(pushToast).toHaveBeenCalledWith("info", "1 folder added to your library");
  });

  it("accept + plural count shows count toast from resolved action", async () => {
    setUA(MAC_UA);
    mockedPickDirectories.mockResolvedValue(["/d", "/e"]);
    mockedScanAudioFiles.mockResolvedValue([
      { path: "/d/t1.mp3", title: "T1", durationSecs: 1 },
      { path: "/e/t2.mp3", title: "T2", durationSecs: 1 },
    ] as unknown as Awaited<ReturnType<typeof tauriApi.scanAudioFiles>>);
    const pushToast = spyPushToast();
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(pushToast).toHaveBeenCalledTimes(1);
    expect(pushToast).toHaveBeenCalledWith("info", "2 folders added to your library");
  });

  it("accept + zero track delta shows warning addFolderNoMusic toast", async () => {
    setUA(MAC_UA);
    mockedPickDirectories.mockResolvedValue(["/d"]);
    mockedScanAudioFiles.mockResolvedValue([]);
    const pushToast = spyPushToast();
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(pushToast).toHaveBeenCalledTimes(1);
    expect(pushToast).toHaveBeenCalledWith("warning", "No songs found in the selected folder");
    expect(useMusicPlayerStore.getState().customFolders).toEqual(["/d"]);
  });

  it("scan-in-progress: disabled and click is a no-op", () => {
    setUA(MAC_UA);
    useMusicPlayerStore.setState({ loading: true });
    render(<AddFolderButton />);

    const btn = screen.getByRole("button", { name: "Add music folder…" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(mockedPickDirectories).not.toHaveBeenCalled();
  });

  it("re-entrancy: second click during pick does not open a second dialog", async () => {
    setUA(MAC_UA);
    let resolvePick: ((v: string[]) => void) | undefined;
    mockedPickDirectories.mockImplementation(
      () => new Promise((resolve) => { resolvePick = resolve; }),
    );
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    resolvePick?.(["/d"]);
    await new Promise((r) => setTimeout(r, 30));

    expect(mockedPickDirectories).toHaveBeenCalledTimes(1);
  });
});

describe("AddFolderButton (US2: mac-only visibility)", () => {
  it("renders on macOS", () => {
    setUA(MAC_UA);
    render(<AddFolderButton />);

    expect(screen.getByRole("button", { name: "Add music folder…" })).toBeTruthy();
  });

  it("renders nothing on Android", () => {
    setUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36");
    render(<AddFolderButton />);

    expect(screen.queryByRole("button", { name: "Add music folder…" })).toBeNull();
  });

  it("renders nothing on Windows", () => {
    setUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
    render(<AddFolderButton />);

    expect(screen.queryByRole("button", { name: "Add music folder…" })).toBeNull();
  });

  it("renders nothing on Linux", () => {
    setUA("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
    render(<AddFolderButton />);

    expect(screen.queryByRole("button", { name: "Add music folder…" })).toBeNull();
  });

  it("renders nothing on non-macOS even while a scan is running", () => {
    setUA("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
    useMusicPlayerStore.setState({ loading: true });
    render(<AddFolderButton />);

    expect(screen.queryByRole("button", { name: "Add music folder…" })).toBeNull();
  });
});

describe("AddFolderButton (US3: added folder persists)", () => {
  it("accepted pick writes the folder to the persisted custom-folders entry", async () => {
    setUA(MAC_UA);
    mockedPickDirectories.mockResolvedValue(["/d"]);
    mockedScanAudioFiles.mockResolvedValue([
      { path: "/d/t1.mp3", title: "T1", durationSecs: 1 },
    ] as unknown as Awaited<ReturnType<typeof tauriApi.scanAudioFiles>>);
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    await new Promise((r) => setTimeout(r, 20));

    // Real-behavior assertion: persistence.ts writes this exact key even in
    // component tests — the same entry the startup scan reads after restart.
    expect(JSON.parse(localStorage.getItem("player-custom-folders") ?? "[]")).toEqual(["/d"]);
  });

  it("cancelled pick leaves the persisted custom-folders entry untouched", async () => {
    setUA(MAC_UA);
    localStorage.setItem("player-custom-folders", JSON.stringify(["/seed"]));
    mockedPickDirectories.mockResolvedValue([]);
    render(<AddFolderButton />);

    fireEvent.click(screen.getByRole("button", { name: "Add music folder…" }));
    await new Promise((r) => setTimeout(r, 20));

    expect(JSON.parse(localStorage.getItem("player-custom-folders") ?? "[]")).toEqual(["/seed"]);
  });
});
