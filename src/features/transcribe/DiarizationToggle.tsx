import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";

export function Switch({ on, onChange, label, hint, disabled, disabledHint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string; disabled?: boolean; disabledHint?: string }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      onClick={() => onChange(!on)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1.5 text-start ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
    >
      <span>
        <span className="block text-xs font-semibold">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">{hint}</span>
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-orange-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "start-5" : "start-0.5"}`}
        />
      </span>
    </button>
  );
}

export function DiarizationToggle(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const on = useTranscribeStore((s) => s.diarization);
  const set = useTranscribeStore((s) => s.setDiarization);
  return (
    <Switch on={on} onChange={set} label={translate(lang, "txDiarization" as never)} hint={translate(lang, "txDiarizationHint" as never)} />
  );
}
