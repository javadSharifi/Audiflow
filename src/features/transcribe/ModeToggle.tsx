import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";
import type { TranscriptionMode } from "../../types";

function ModeButton({ value, active, onClick, label }: { value: TranscriptionMode; active: boolean; onClick: (v: TranscriptionMode) => void; label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
        active
          ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}

export function ModeToggle(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const mode = useTranscribeStore((s) => s.mode);
  const setMode = useTranscribeStore((s) => s.setMode);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
        {translate(lang, "txMode" as never)}
      </span>
      <div className="flex gap-1 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
        <ModeButton value="verbatim" active={mode === "verbatim"} onClick={setMode} label={translate(lang, "txModeVerbatim" as never)} />
        <ModeButton value="smart" active={mode === "smart"} onClick={setMode} label={translate(lang, "txModeSmart" as never)} />
      </div>
    </div>
  );
}
