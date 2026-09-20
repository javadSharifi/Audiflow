import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { Globe, Check } from "lucide-react";

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
    badgeKey: "onboardingLangFaBadge" | "onboardingLangEnBadge";
  }[] = [
    { key: "fa", labelKey: "onboardingLangFa", badgeKey: "onboardingLangFaBadge" },
    { key: "en", labelKey: "onboardingLangEn", badgeKey: "onboardingLangEnBadge" },
  ];

  return (
    <section
      className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#0F1523]/75 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.09),inset_0_-1px_1px_0_rgba(0,0,0,0.4)] space-y-3 transition-colors"
      data-purpose="language-selection"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 dark:text-orange-400 shrink-0">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
            {translate(currentLang, "onboardingSectionLanguage")}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          {translate(currentLang, "onboardingLangBilingual")}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={translate(currentLang, "onboardingSectionLanguage")}
        className="grid grid-cols-2 gap-2.5"
      >
        {options.map((opt) => {
          const isSelected = currentLang === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelectLanguage(opt.key)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all focus:outline-none cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/70 text-orange-600 dark:text-orange-300 shadow-[0_0_20px_-2px_rgba(249,115,22,0.35)] font-bold"
                  : "bg-slate-100/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs sm:text-sm ${isSelected ? "font-bold text-slate-900 dark:text-white" : "font-medium tracking-wide"}`}
                >
                  {translate(currentLang, opt.labelKey)}
                </span>
              </div>
              {isSelected ? (
                <span className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shrink-0 shadow-sm">
                  <Check className="w-3 h-3 stroke-[2.8]" />
                </span>
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-400 dark:border-slate-600 shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
