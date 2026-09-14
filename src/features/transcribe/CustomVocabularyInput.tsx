import { useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";

export function CustomVocabularyInput(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const terms = useTranscribeStore((s) => s.customVocab);
  const add = useTranscribeStore((s) => s.addVocabTerm);
  const remove = useTranscribeStore((s) => s.removeVocabTerm);
  const diarization = useTranscribeStore((s) => s.diarization);
  const timestamps = useTranscribeStore((s) => s.timestamps);
  const [draft, setDraft] = useState("");
  const disabled = diarization || timestamps;

  const commit = () => {
    if (!draft.trim() || disabled) return;
    add(draft);
    setDraft("");
  };

  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? "opacity-40" : ""}`}>
      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
        {translate(lang, "txVocab" as never)}{" "}
        <span className="font-normal text-zinc-400" dir="ltr">
          {terms.length}/100
        </span>
      </span>
      {disabled ? (
        <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          {translate(lang, "txVocabDisabledHint" as never)}
        </p>
      ) : (
        <>
          <div className="flex gap-1.5">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
              }}
              placeholder={translate(lang, "txVocabPlaceholder" as never)}
              className="min-w-0 flex-1 rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-orange-500 dark:border-white/10 dark:bg-zinc-800"
            />
            <button
              type="button"
              onClick={commit}
              disabled={draft.trim().length === 0}
              className="shrink-0 rounded-xl bg-zinc-900 px-3.5 text-xs font-bold text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              +
            </button>
          </div>
          {terms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {terms.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-700 dark:text-orange-300"
                >
                  <span dir="auto">{t}</span>
                  <button type="button" onClick={() => remove(t)} aria-label="remove" className="opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
