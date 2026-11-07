// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const isAndroidMock = vi.fn(() => true);
vi.mock("../../utils/platform", () => ({ isAndroid: () => isAndroidMock() }));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "1.6.3") }));

import { useGithubUpdate } from "../useGithubUpdate";

afterEach(() => {
  vi.unstubAllGlobals();
  try { localStorage.clear(); } catch { /* jsdom may be unavailable */ }
  isAndroidMock.mockReturnValue(true);
});

describe("useGithubUpdate on Android", () => {
  it("never checks GitHub and never offers an APK update", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useGithubUpdate());
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.latest).toBeNull();
  });
});
