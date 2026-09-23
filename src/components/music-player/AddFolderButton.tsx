import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { isMacOS } from "../../utils/platform";
import { useAddFolderPick } from "./useAddFolderPick";
import { FolderPlus } from "lucide-react";

export function AddFolderButton(): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const loading = useMusicPlayerStore((s) => s.loading);
  const { pickAndAdd } = useAddFolderPick();

  // mac-only (spec P2): other platforms never see the button; their layout
  // stays structurally unchanged.
  if (!isMacOS()) return null;

  return (
    <button
      type="button"
      onClick={() => void pickAndAdd()}
      disabled={loading}
      title={translate(lang, "addFolderTitle")}
      aria-label={translate(lang, "addFolderTitle")}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/[0.08] bg-white/80 text-zinc-600 hover:bg-zinc-50 dark:border-white/[0.08] dark:bg-zinc-800/80 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
    >
      <FolderPlus className="h-4 w-4" />
    </button>
  );
}
