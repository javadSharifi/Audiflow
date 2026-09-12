// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import { useAppStore } from "../../../stores/useAppStore";
import { PermissionGate } from "../PermissionGate";
import * as tauriApi from "../../../utils/tauri";
import * as platformApi from "../../../utils/platform";
import type { AudioTrackInfo } from "../../../types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
}));

vi.mock("../../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof tauriApi>();
  return {
    ...actual,
    getMusicPermissionStatus: vi.fn(async () => "denied"),
    scanAudioFiles: vi.fn(async () => []),
    requestMediaPermissions: vi.fn(),
    openAppSettings: vi.fn(),
    hasNotificationPermission: vi.fn(async () => true),
    getTrackArtworkUrl: vi.fn(async () => null),
  };
});

const mockedGetMusicPermissionStatus = vi.mocked(tauriApi.getMusicPermissionStatus);
const mockedScanAudioFiles = vi.mocked(tauriApi.scanAudioFiles);
const mockedRequestMediaPermissions = vi.mocked(tauriApi.requestMediaPermissions);
const mockedOpenAppSettings = vi.mocked(tauriApi.openAppSettings);

vi.mock("../../../utils/platform", async (importOriginal) => {
  const actual = await importOriginal<typeof platformApi>();
  return { ...actual, isAndroid: vi.fn(() => true) };
});

const mockTrack: AudioTrackInfo = {
  id: "track_gate_1",
  uri: "file:///music/song.mp3",
  path: "/music/song.mp3",
  name: "song.mp3",
  title: "Song",
  artist: "Artist",
  album: null,
  durationSecs: 180,
  sizeBytes: 5000000,
  createdTimestampMs: 1000,
  modifiedTimestampMs: 1000,
  format: "mp3",
  mimeType: "audio/mpeg",
  coverUrl: null,
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  try {
    sessionStorage.clear();
  } catch {}
  mockedGetMusicPermissionStatus.mockResolvedValue("denied");
  mockedScanAudioFiles.mockResolvedValue([]);
  useAppStore.setState({ lang: "en" });
  useMusicPlayerStore.setState({
    tracks: [],
    currentPlaylist: [],
    loading: false,
    hasScanned: true,
    permissionStatus: "denied",
    likedPaths: new Set(),
  });
});

describe("PermissionGate", () => {
  it("asks for access first with a grant button", () => {
    render(<PermissionGate onSkip={() => {}} />);

    expect(screen.getByText("Allow access to your music")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Grant Permission" })).toBeTruthy();
  });

  it("offers system settings when permanently denied", () => {
    useMusicPlayerStore.setState({ permissionStatus: "permanentlyDenied" });
    render(<PermissionGate onSkip={() => {}} />);

    const btn = screen.getByRole("button", { name: "Open Settings" });
    fireEvent.click(btn);
    expect(mockedOpenAppSettings).toHaveBeenCalled();
  });

  it("skip enters the app without granting", () => {
    const onSkip = vi.fn();
    render(<PermissionGate onSkip={onSkip} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue without access" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("grant picks up a delayed allow and scans without a second tap", async () => {
    // System dialog answers asynchronously: still denied on the first poll,
    // granted on the second — the old fire-and-forget flow scanned empty here.
    mockedGetMusicPermissionStatus
      .mockResolvedValueOnce("denied")
      .mockResolvedValue("granted");
    mockedScanAudioFiles.mockResolvedValue([mockTrack]);

    render(<PermissionGate onSkip={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Grant Permission" }));

    expect(mockedRequestMediaPermissions).toHaveBeenCalled();
    await waitFor(() => {
      expect(useMusicPlayerStore.getState().tracks).toHaveLength(1);
    });
    expect(useMusicPlayerStore.getState().permissionStatus).toBe("granted");
  });

  it("requestMediaPermission resolves true immediately when already granted", async () => {
    mockedGetMusicPermissionStatus.mockResolvedValue("granted");

    const granted = await useMusicPlayerStore.getState().requestMediaPermission();

    expect(granted).toBe(true);
    expect(useMusicPlayerStore.getState().permissionStatus).toBe("granted");
  });
});
