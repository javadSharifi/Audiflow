import { invoke } from "@tauri-apps/api/core";
import type { LiveDubbingStatus } from "../types/liveDubbing";

export async function startLiveDubbing(
  targetLanguage: string,
  voicePersona: string,
  duckingPercent: number,
  enableOverlay: boolean,
): Promise<string> {
  return await invoke<string>("start_live_dubbing", {
    targetLanguage,
    voicePersona,
    duckingPercent,
    enableOverlay,
  });
}

export async function stopLiveDubbing(): Promise<void> {
  return await invoke<void>("stop_live_dubbing");
}

export async function toggleLiveDubbingPause(): Promise<boolean> {
  return await invoke<boolean>("toggle_live_dubbing_pause");
}

export async function setDuckingLevel(levelPercent: number): Promise<void> {
  return await invoke<void>("set_ducking_level", {
    levelPercent,
  });
}

export async function setFloatingOverlayEnabled(enabled: boolean): Promise<void> {
  return await invoke<void>("set_floating_overlay_enabled", {
    enabled,
  });
}

export async function getLiveDubbingStatus(): Promise<LiveDubbingStatus> {
  return await invoke<LiveDubbingStatus>("get_live_dubbing_status");
}

export async function verifyGeminiApiKey(key: string): Promise<boolean> {
  return await invoke<boolean>("verify_gemini_api_key", {
    key,
  });
}

export async function saveLiveDubbingKey(key: string): Promise<void> {
  return await invoke<void>("save_live_dubbing_key", {
    key,
  });
}
