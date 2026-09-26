// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../useAppStore";
import { useMusicPlayerStore } from "../useMusicPlayerStore";
import { registerDubbingPauseHook } from "../slices/liveDubbingSlice";
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

describe("liveDubbingSlice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerDubbingPauseHook(() => {
      useMusicPlayerStore.getState().pauseTrack();
    });
    useAppStore.setState({
      dubbingState: "idle",
      targetLanguage: "fa",
      voicePersona: "Aoede",
      duckingPercent: 70,
      isOverlayActive: true,
      apiKey: "",
      isKeyValid: null,
      errorMessage: null,
    });
  });

  it("clamps ducking percent between 30 and 90", () => {
    useAppStore.getState().setDuckingPercent(20);
    expect(useAppStore.getState().duckingPercent).toBe(30);

    useAppStore.getState().setDuckingPercent(100);
    expect(useAppStore.getState().duckingPercent).toBe(90);

    useAppStore.getState().setDuckingPercent(50);
    expect(useAppStore.getState().duckingPercent).toBe(50);
    expect(api.setDuckingLevel).toHaveBeenCalledWith(50);
  });

  it("toggles floating overlay setting", () => {
    useAppStore.getState().setIsOverlayActive(false);
    expect(useAppStore.getState().isOverlayActive).toBe(false);
    expect(api.setFloatingOverlayEnabled).toHaveBeenCalledWith(false);

    useAppStore.getState().setIsOverlayActive(true);
    expect(useAppStore.getState().isOverlayActive).toBe(true);
    expect(api.setFloatingOverlayEnabled).toHaveBeenCalledWith(true);
  });

  it("validates and saves API key", async () => {
    useAppStore.getState().setApiKey("AIzaSyFakeKey123");
    expect(useAppStore.getState().apiKey).toBe("AIzaSyFakeKey123");

    const isValid = await useAppStore.getState().testApiKey();
    expect(isValid).toBe(true);
    expect(useAppStore.getState().isKeyValid).toBe(true);
    expect(api.verifyGeminiApiKey).toHaveBeenCalledWith("AIzaSyFakeKey123");

    await useAppStore.getState().saveApiKey();
    expect(api.saveLiveDubbingKey).toHaveBeenCalledWith("AIzaSyFakeKey123");
  });

  it("pauses active music playback on starting live dubbing (Principle VI)", async () => {
    const pauseSpy = vi.spyOn(useMusicPlayerStore.getState(), "pauseTrack");
    useMusicPlayerStore.setState({ isPlaying: true });

    await useAppStore.getState().startDubbing();

    expect(pauseSpy).toHaveBeenCalled();
    expect(useAppStore.getState().dubbingState).toBe("capturing");
    expect(api.startLiveDubbing).toHaveBeenCalledWith("fa", "Aoede", 70, true);
  });

  it("stops dubbing and resets state to idle", async () => {
    useAppStore.setState({ dubbingState: "capturing", latencyMs: 450 });

    await useAppStore.getState().stopDubbing();

    expect(useAppStore.getState().dubbingState).toBe("idle");
    expect(useAppStore.getState().latencyMs).toBe(0);
    expect(api.stopLiveDubbing).toHaveBeenCalled();
  });
});
