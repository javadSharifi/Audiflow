import { useRef } from "react";
import { pickDirectories } from "../../utils/dialog";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";

/**
 * One pick action: native picker → dedupe/batched store action (single scan)
 * → outcome classification → at most one toast (clarification lock: cancel
 * and already-tracked re-picks stay silent; never one toast per duplicate).
 */
export function useAddFolderPick(): { pickAndAdd: () => Promise<void> } {
  const picking = useRef(false);

  const pickAndAdd = async (): Promise<void> => {
    if (picking.current) return;
    picking.current = true;
    try {
      const paths = await pickDirectories();
      if (paths.length === 0) return; // cancelled or picker failed — silent no-op
      const state = useMusicPlayerStore.getState();
      const known = new Set(state.customFolders);
      const fresh = paths.filter((p) => !known.has(p));
      if (fresh.length === 0) return; // all already tracked — silent skip
      const tracksBefore = state.tracks.length;
      await state.addCustomFolders(paths);
      const after = useMusicPlayerStore.getState().tracks.length;
      const app = useAppStore.getState();
      if (after > tracksBefore) {
        const text =
          fresh.length === 1
            ? translate(app.lang, "addFolderAddedOne")
            : translate(app.lang, "addFolderAddedMany").replace("{count}", String(fresh.length));
        app.pushToast("info", text);
      } else {
        app.pushToast("warning", translate(app.lang, "addFolderNoMusic"));
      }
    } finally {
      picking.current = false;
    }
  };

  return { pickAndAdd };
}
