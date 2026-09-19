import type { StateCreator } from "zustand";
import type { AppSettings, ConversionOptions, AppTool } from "../../types";
import type { Lang } from "../../i18n";
import type { ToastSlice } from "./toastSlice";
import { isAndroid } from "../../utils/platform";
import { writeBootPrefs } from "../../utils/bootPrefs";
import * as api from "../../utils/tauri";

function getInitialActiveTool(): AppTool {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("active-tool");
      if (stored === "player" || stored === "converter") {
        return stored;
      }
    }
  } catch { /* best-effort: ignore */ }
  return "player";
}

function getInitialReducedBlur(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("ac:reduced-blur");
      if (stored !== null) {
        return stored === "1";
      }
    }
  } catch { /* best-effort: ignore */ }
  return isAndroid();
}

export interface SettingsSlice {
  settings: AppSettings | null;
  options: ConversionOptions;
  lang: Lang;
  theme: "light" | "dark" | "system";
  activeTool: AppTool;
  reducedBlur: boolean;

  setActiveTool: (tool: AppTool) => void;
  setReducedBlur: (enabled: boolean) => void;
  updateOptions: (patch: Partial<ConversionOptions>) => void;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  persistSettings: () => Promise<void>;
}

export const defaultOptions: ConversionOptions = {
  format: "mp3",
  quality: "medium",
  customBitrateKbps: null,
  sampleRateHz: 44100,
  channels: 2,
  splitEnabled: false,
  splitDurationSecs: 3600,
  removeSilence: false,
  silenceThresholdDb: -30,
  silenceMinDurationSecs: 2,
  outputMode: "same_as_source",
  customOutputDir: null,
  boostEnabled: false,
  boostPreset: "smart",
  boostManualGainPercent: 100,
};

export const createSettingsSlice: StateCreator<
  SettingsSlice & ToastSlice,
  [],
  [],
  SettingsSlice
> = (set, get) => ({
  settings: null,
  options: defaultOptions,
  lang: "fa",
  theme: "system",
  activeTool: getInitialActiveTool(),
  reducedBlur: getInitialReducedBlur(),

  setActiveTool(tool) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("active-tool", tool);
      }
    } catch { /* best-effort: ignore */ }
    set({ activeTool: tool });
  },

  setReducedBlur(enabled) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("ac:reduced-blur", enabled ? "1" : "0");
      }
    } catch { /* best-effort: ignore */ }
    set({ reducedBlur: enabled });
  },

  updateOptions(patch) {
    set((s) => ({ options: { ...s.options, ...patch } }));
  },

  async loadSettings() {
    const settings = await api.getSettings();
    // SAF folder picks are not writable via plain paths on Android; the
    // backend maps all output modes onto its user-visible output root.
    const outputMode =
      isAndroid() && settings.defaultOutputMode === "custom_folder"
        ? "same_as_source"
        : settings.defaultOutputMode;

    // Constraint per data-model.md:
    // "auto-open-output-folder coerced to false on settings load, with the correction persisted when a stored true is found (one-time self-healing migration)"
    let coercedSettings = settings;
    if (settings.autoOpenOutputFolder) {
      coercedSettings = { ...settings, autoOpenOutputFolder: false };
      void api.saveSettings(coercedSettings).catch(() => {});
    }

    // Mirror to the sync boot cache so the next cold start paints the
    // correct dir/theme before React even mounts (no LTR flash).
    writeBootPrefs({ language: coercedSettings.language, theme: coercedSettings.theme });
    set({
      settings: coercedSettings,
      lang: coercedSettings.language,
      theme: coercedSettings.theme,
      options: {
        ...get().options,
        format: settings.defaultFormat,
        quality: settings.defaultQuality,
        removeSilence: settings.removeSilenceDefault,
        silenceThresholdDb: settings.silenceThresholdDb,
        silenceMinDurationSecs: settings.silenceMinDurationSecs,
        outputMode,
        customOutputDir: isAndroid() ? null : settings.defaultOutputDir,
      },
    });
  },

  updateSettings(patch) {
    set((s) => {
      if (!s.settings) return {};
      const next = { ...s.settings, ...patch };
      // Android: custom_folder not writable via plain paths — coerce to safe mode
      if (isAndroid() && next.defaultOutputMode === "custom_folder") {
        next.defaultOutputMode = "same_as_source";
        next.defaultOutputDir = null;
      }
      // keep options in sync when output mode changes (updater stays pure)
      if (patch.defaultOutputMode) {
        const outputMode =
          isAndroid() && patch.defaultOutputMode === "custom_folder"
            ? "same_as_source"
            : patch.defaultOutputMode;
        return {
          settings: next,
          options: {
            ...s.options,
            outputMode,
            customOutputDir: isAndroid() ? null : next.defaultOutputDir,
          },
        };
      }
      return { settings: next };
    });
    if (patch.language) set({ lang: patch.language as Lang });
    if (patch.theme) set({ theme: patch.theme as SettingsSlice["theme"] });
    if (patch.language || patch.theme) {
      const s = get();
      writeBootPrefs({
        language: (patch.language as Lang) ?? s.lang,
        theme: (patch.theme as SettingsSlice["theme"]) ?? s.theme,
      });
    }
  },

  async persistSettings() {
    const { settings } = get();
    if (!settings) return;
    try {
      await api.saveSettings(settings);
    } catch {
      /* keep the in-memory state; a failed save must not crash the UI */
    }
  },
});
