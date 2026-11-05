import type { StateCreator } from "zustand";
import type { ToastSlice } from "./toastSlice";
import type { BoosterEngine } from "../../types/generated";
import * as api from "../../utils/tauri";

export interface BoosterSlice {
  boosterEnabled: boolean;
  boosterLevel: number;        // 0-100 UI scale
  boosterEngine: BoosterEngine;
  boosterLoading: boolean;
  enableBooster: (level?: number) => Promise<void>;
  disableBooster: () => Promise<void>;
  setBoosterLevel: (level: number) => Promise<void>;
  syncBoosterStatus: () => Promise<void>;
}

export const createBoosterSlice: StateCreator<
  BoosterSlice & ToastSlice,
  [],
  [],
  BoosterSlice
> = (set, get) => ({
  boosterEnabled: false,
  boosterLevel: 50,
  boosterEngine: "none" as BoosterEngine,
  boosterLoading: false,

  async enableBooster(level) {
    const targetLevel = level ?? get().boosterLevel;
    set({ boosterLoading: true });
    try {
      const status = await api.startVolumeBooster(targetLevel);
      set({
        boosterEnabled: status.enabled,
        boosterLevel: status.level,
        boosterEngine: status.engine,
      });
    } catch (e) {
      get().pushToast("error", String(e));
    } finally {
      set({ boosterLoading: false });
    }
  },

  async disableBooster() {
    set({ boosterLoading: true });
    try {
      await api.stopVolumeBooster();
      set({ boosterEnabled: false, boosterEngine: "none" as BoosterEngine });
    } catch (e) {
      get().pushToast("error", String(e));
    } finally {
      set({ boosterLoading: false });
    }
  },

  async setBoosterLevel(level) {
    try {
      const status = await api.setBoosterLevel(level);
      set({
        boosterEnabled: status.enabled,
        boosterLevel: status.level,
        boosterEngine: status.engine,
      });
    } catch (e) {
      get().pushToast("error", String(e));
    }
  },

  async syncBoosterStatus() {
    try {
      const status = await api.getBoosterStatus();
      set({
        boosterEnabled: status.enabled,
        boosterLevel: status.level,
        boosterEngine: status.engine,
      });
    } catch {
      // Silently fail — status sync is best-effort
    }
  },
});
