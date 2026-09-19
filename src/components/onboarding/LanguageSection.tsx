import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { Languages, Check } from "lucide-react";

/**
 * Language section of onboarding.
 * Constraints per data-model.md:
 * - "fa | en"
 * - "anything else falls back to safe defaults (Persian)"
 */
export function LanguageSection(): React.JSX.Element {
  const currentLang = useAppStore((s) => s.lang);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const persistSettings = useAppStore((s) => s.persistSettings);

  const handleSelectLanguage = (lang: "fa" | "en") => {
    updateSettings({ language: lang });
    void persistSettings();
  };

  const options: {
    key: "fa" | "en";
    labelKey: "onboardingLangFa" | "onboardingLangEn";
    nativeName: string;
  }[] = [
    { key: "fa", labelKey: "onboardingLangFa", nativeName: "فارسی" },
    { key: "en", labelKey: "onboardingLangEn", nativeName: "English" },
  ];

  return (
    <div className="flex flex-col gap-1.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-zinc-900/80 p-2.5 sm:p-4 shadow-sm transition-colors">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
          <Languages className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {translate(currentLang, "onboardingSectionLanguage")}
          </h2>
          <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400">
            {translate(currentLang, "onboardingSectionLanguageDesc")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5 pt-1 sm:pt-2">
        {options.map((opt) => {
          const isSelected = currentLang === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelectLanguage(opt.key)}
              aria-pressed={isSelected}
              className={`flex items-center justify-between gap-2 rounded-lg sm:rounded-xl border px-2.5 py-2 sm:p-3 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? "border-orange-500 bg-orange-500/10 text-orange-600 shadow-sm dark:border-orange-500 dark:bg-orange-500/20 dark:text-orange-400"
                  : "border-black/[0.06] bg-white/70 text-zinc-700 hover:bg-white active:scale-[0.98] dark:border-white/[0.06] dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="flex flex-col text-start">
                <span>{translate(currentLang, opt.labelKey)}</span>
              </div>
              {isSelected && <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-orange-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
