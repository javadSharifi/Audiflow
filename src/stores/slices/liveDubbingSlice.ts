import type { StateCreator } from "zustand";
import type { DubbingSessionState, VoicePersona } from "../../types/liveDubbing";
import * as api from "../../utils/liveDubbingTauri";

export interface LiveDubbingSlice {
  dubbingState: DubbingSessionState;
  targetLanguage: string;
  voicePersona: VoicePersona;
  duckingPercent: number;
  isOverlayActive: boolean;
  latencyMs: number;
  apiKey: string;
  isKeyValid: boolean | null;
  isTestingKey: boolean;
  errorMessage: string | null;

  setTargetLanguage: (lang: string) => void;
  setVoicePersona: (voice: VoicePersona) => void;
  setDuckingPercent: (percent: number) => void;
  setIsOverlayActive: (active: boolean) => void;
  setApiKey: (key: string) => void;
  testApiKey: () => Promise<boolean>;
  saveApiKey: () => Promise<void>;
  startDubbing: () => Promise<void>;
  stopDubbing: () => Promise<void>;
  togglePause: () => Promise<void>;
}

export type PlaybackPauseHook = () => void;
let onStartDubbingHook: PlaybackPauseHook | null = null;

export function registerDubbingPauseHook(hook: PlaybackPauseHook | null): void {
  onStartDubbingHook = hook;
}

export const createLiveDubbingSlice: StateCreator<
  LiveDubbingSlice,
  [],
  [],
  LiveDubbingSlice
> = (set, get) => ({
  dubbingState: "idle",
  targetLanguage: "fa",
  voicePersona: "Aoede",
  duckingPercent: 70,
  isOverlayActive: true,
  latencyMs: 0,
  apiKey: "",
  isKeyValid: null,
  isTestingKey: false,
  errorMessage: null,

  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setVoicePersona: (voice) => set({ voicePersona: voice }),
  setDuckingPercent: (percent) => {
    const clamped = Math.min(90, Math.max(30, percent));
    set({ duckingPercent: clamped });
    void api.setDuckingLevel(clamped).catch(() => {});
  },
  setIsOverlayActive: (active) => {
    set({ isOverlayActive: active });
    void api.setFloatingOverlayEnabled(active).catch(() => {});
  },
  setApiKey: (key) => set({ apiKey: key, isKeyValid: null, errorMessage: null }),

  testApiKey: async () => {
    const { apiKey } = get();
    if (!apiKey.trim()) {
      set({ isKeyValid: false, errorMessage: "API key is required" });
      return false;
    }
    set({ isTestingKey: true, errorMessage: null });
    try {
      const valid = await api.verifyGeminiApiKey(apiKey);
      set({ isKeyValid: valid, isTestingKey: false });
      return valid;
    } catch (err) {
      set({
        isKeyValid: false,
        isTestingKey: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  },

  saveApiKey: async () => {
    const { apiKey } = get();
    if (!apiKey.trim()) return;
    await api.saveLiveDubbingKey(apiKey);
    set({ isKeyValid: true });
  },

  startDubbing: async () => {
    const { targetLanguage, voicePersona, duckingPercent, isOverlayActive } = get();
    // Constitution Principle VI: single active audio stream
    // Starting live dubbing must pause music player
    try {
      onStartDubbingHook?.();
    } catch { /* best-effort */ }

    set({ dubbingState: "starting", errorMessage: null });
    try {
      await api.startLiveDubbing(
        targetLanguage,
        voicePersona,
        duckingPercent,
        isOverlayActive,
      );
      set({ dubbingState: "capturing", latencyMs: 450 });
    } catch (err) {
      set({
        dubbingState: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  },

  stopDubbing: async () => {
    try {
      await api.stopLiveDubbing();
    } catch { /* best-effort */ }
    set({ dubbingState: "idle", latencyMs: 0, errorMessage: null });
  },

  togglePause: async () => {
    try {
      const isPaused = await api.toggleLiveDubbingPause();
      set({ dubbingState: isPaused ? "paused" : "capturing" });
    } catch (err) {
      set({ errorMessage: err instanceof Error ? err.message : String(err) });
    }
  },
});
