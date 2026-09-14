import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { useTranscribeStore } from "./stores/useTranscribeStore";

const LANGS = ["fa-IR", "en-US", "ar-SA", "tr-TR", "fr-FR", "de-DE", "es-ES", "ru-RU", "zh-CN", "hi-IN", "ur-PK"];

export function LanguageSelect(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const value = useTranscribeStore((s) => s.language);
  const setLanguage = useTranscribeStore((s) => s.setLanguage);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
        {translate(lang, "txLanguage" as never)}
      </span>
      <select
        value={value}
        onChange={(e) => setLanguage(e.target.value)}
        className="w-full rounded-xl border border-black/10 bg-zinc-50 px-3 py-2 text-xs outline-none focus:border-orange-500 dark:border-white/10 dark:bg-zinc-800"
      >
        <option value="">{translate(lang, "txLanguageAuto" as never)}</option>
        {LANGS.map((c) => (
          <option key={c} value={c} dir="ltr">
            {c}
          </option>
        ))}
      </select>
    </label>
  );
}
