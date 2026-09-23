// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMusicPlayerStore } from "../../useMusicPlayerStore";
import * as persistenceApi from "../persistence";
import * as tauriApi from "../../../utils/tauri";
import type { AudioTrackInfo } from "../../../types";

vi.mock("../persistence", async (importOriginal) => {
  const actual = await importOriginal<typeof persistenceApi>();
  return {
    ...actual,
    persistCustomFolders: vi.fn(),
    persistCachedTracks: vi.fn(),
  };
});

vi.mock("../../../utils/tauri", async (importOriginal) => {
  const actual = await importOriginal<typeof tauriApi>();
  return {
    ...actual,
    scanAudioFiles: vi.fn(async () => [] as AudioTrackInfo[]),
    getMusicPermissionStatus: vi.fn(async () => "granted" as const),
  };
});

const mockedPersistCustomFolders = vi.mocked(persistenceApi.persistCustomFolders);
const mockedScanAudioFiles = vi.mocked(tauriApi.scanAudioFiles);

// In-memory localStorage mock — repo convention (jsdom exposes a broken
// localStorage getter), same as perfCaching.test.ts / bootPrefs.test.ts.
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

function makeTrack(id: string): AudioTrackInfo {
  return {
    id,
    uri: `file:///music/${id}.mp3`,
    path: `/music/${id}.mp3`,
    name: `${id}.mp3`,
    title: id,
    artist: "Artist",
    album: null,
    durationSecs: 180,
    sizeBytes: 5000000,
    createdTimestampMs: 1000,
    modifiedTimestampMs: 1000,
    format: "mp3",
    mimeType: "audio/mpeg",
    coverUrl: null,
  } as unknown as AudioTrackInfo;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedScanAudioFiles.mockResolvedValue([]);
  localStorage.clear();
  useMusicPlayerStore.setState({
    tracks: [],
    currentPlaylist: [],
    loading: false,
    hasScanned: false,
    permissionStatus: "granted",
    likedPaths: new Set(),
    customFolders: [],
    customAlbums: [],
  });
});

afterEach(() => {
  localStorage.clear();
});

describe("addCustomFolders (US3: batched, persisted, single scan)", () => {
  it("mixed pick persists the merged list ONCE and triggers exactly one scan", async () => {
    useMusicPlayerStore.setState({ customFolders: ["/music/known"] });
    mockedScanAudioFiles.mockResolvedValue([makeTrack("t1"), makeTrack("t2")]);

    const added = await useMusicPlayerStore.getState().addCustomFolders([
      "/music/new",
      "/music/known",
    ]);

    expect(added).toBe(1);
    expect(mockedPersistCustomFolders).toHaveBeenCalledTimes(1);
    expect(mockedPersistCustomFolders).toHaveBeenCalledWith(["/music/known", "/music/new"]);
    expect(useMusicPlayerStore.getState().customFolders).toEqual(["/music/known", "/music/new"]);
    expect(mockedScanAudioFiles).toHaveBeenCalledTimes(1);
    expect(mockedScanAudioFiles).toHaveBeenCalledWith(["/music/known", "/music/new"]);
  });

  it("all-duplicate pick persists nothing, scans nothing, resolves 0", async () => {
    useMusicPlayerStore.setState({ customFolders: ["/music/known"] });

    const added = await useMusicPlayerStore
      .getState()
      .addCustomFolders(["/music/known"]);

    expect(added).toBe(0);
    expect(mockedPersistCustomFolders).not.toHaveBeenCalled();
    expect(mockedScanAudioFiles).not.toHaveBeenCalled();
    expect(useMusicPlayerStore.getState().customFolders).toEqual(["/music/known"]);
  });

  it("seed contract: a later default scanLibrary() consumes the persisted customFolders", async () => {
    mockedScanAudioFiles.mockResolvedValue([makeTrack("seed")]);

    await useMusicPlayerStore.getState().addCustomFolders(["/music/seed"]);
    mockedScanAudioFiles.mockClear();
    mockedScanAudioFiles.mockResolvedValue([makeTrack("seed")]);

    await useMusicPlayerStore.getState().scanLibrary();

    expect(mockedScanAudioFiles).toHaveBeenCalledTimes(1);
    expect(mockedScanAudioFiles).toHaveBeenCalledWith(["/music/seed"]);
  });
});
