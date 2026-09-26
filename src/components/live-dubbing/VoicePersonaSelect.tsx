import type React from "react";
import { Mic } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import type { VoicePersona } from "../../types/liveDubbing";

const VOICES: { id: VoicePersona; label: string; desc: string }[] = [
  { id: "Aoede", label: "Aoede", desc: "Warm & Melodic (Default)" },
  { id: "Puck", label: "Puck", desc: "Energetic & Youthful" },
  { id: "Fenrir", label: "Fenrir", desc: "Deep & Authoritative" },
  { id: "Kore", label: "Kore", desc: "Gentle & Calm" },
  { id: "Charon", label: "Charon", desc: "Resonant & Professional" },
];

export function VoicePersonaSelect(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const voicePersona = useAppStore((s) => s.voicePersona);
  const setVoicePersona = useAppStore((s) => s.setVoicePersona);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/60 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400">
          <Mic className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "liveDubbingVoice")}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Google Gemini Live Speech Engine
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VOICES.map((v) => {
          const isSelected = voicePersona === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setVoicePersona(v.id)}
              className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-all ${
                isSelected
                  ? "border-teal-500 bg-teal-50/50 dark:border-teal-400 dark:bg-teal-950/20"
                  : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
              }`}
            >
              <span className={`text-xs font-bold ${isSelected ? "text-teal-600 dark:text-teal-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                {v.label}
              </span>
              <span className="text-[10px] text-zinc-400 truncate w-full">
                {v.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
