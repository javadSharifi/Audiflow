// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../useAppStore";
import * as api from "../../utils/liveDubbingTauri";

vi.mock("../../utils/liveDubbingTauri", () => ({
  startLiveDubbing: vi.fn().mockResolvedValue("Dubbing started"),
  stopLiveDubbing: vi.fn().mockResolvedValue(undefined),
  toggleLiveDubbingPause: vi.fn().mockResolvedValue(true),
  setDuckingLevel: vi.fn().mockResolvedValue(undefined),
  setFloatingOverlayEnabled: vi.fn().mockResolvedValue(undefined),
  getLiveDubbingStatus: vi.fn().mockResolvedValue({
    state: "idle",
    targetLanguage: "fa",
    voicePersona: "Aoede",
    duckingPercent: 70,
    isOverlayActive: true,
    latencyMs: 0,
    bytesStreamed: 0,
    errorMessage: null,
  }),
  verifyGeminiApiKey: vi.fn().mockResolvedValue(true),
  saveLiveDubbingKey: vi.fn().mockResolvedValue(undefined),
}));

describe("liveDubbingOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      dubbingState: "idle",
      targetLanguage: "fa",
      voicePersona: "Aoede",
      duckingPercent: 70,
      isOverlayActive: true,
      apiKey: "AIzaValidTestKey",
      isKeyValid: true,
      errorMessage: null,
    });
  });

  it("initializes overlay active state as true by default", () => {
    expect(useAppStore.getState().isOverlayActive).toBe(true);
  });

  it("calls IPC and updates store when overlay is toggled off", () => {
    useAppStore.getState().setIsOverlayActive(false);
    expect(useAppStore.getState().isOverlayActive).toBe(false);
    expect(api.setFloatingOverlayEnabled).toHaveBeenCalledWith(false);
  });

  it("calls IPC and updates store when overlay is toggled back on", () => {
    useAppStore.getState().setIsOverlayActive(false);
    useAppStore.getState().setIsOverlayActive(true);
    expect(useAppStore.getState().isOverlayActive).toBe(true);
    expect(api.setFloatingOverlayEnabled).toHaveBeenLastCalledWith(true);
  });

  it("passes overlay state to startLiveDubbing command", async () => {
    useAppStore.getState().setIsOverlayActive(false);
    await useAppStore.getState().startDubbing();
    expect(api.startLiveDubbing).toHaveBeenCalledWith("fa", "Aoede", 70, false);

    useAppStore.getState().setIsOverlayActive(true);
    await useAppStore.getState().startDubbing();
    expect(api.startLiveDubbing).toHaveBeenCalledWith("fa", "Aoede", 70, true);
  });

  it("handles IPC rejection gracefully when toggling overlay", () => {
    vi.mocked(api.setFloatingOverlayEnabled).mockRejectedValueOnce(
      new Error("Platform overlay unsupported")
    );
    // Should not throw or crash the app state
    expect(() => {
      useAppStore.getState().setIsOverlayActive(false);
    }).not.toThrow();
    expect(useAppStore.getState().isOverlayActive).toBe(false);
  });
});
