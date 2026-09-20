import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { Palette, Sun, Moon, Monitor } from "lucide-react";

/**
 * Theme section of onboarding.
 * Constraints per data-model.md:
 * - "light | dark | system"
 * - "single writer: useTheme"
 * - "anything else falls back to safe defaults"
 */
export function ThemeSection(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const currentTheme = useAppStore((s) => s.theme);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const persistSettings = useAppStore((s) => s.persistSettings);

  const handleSelectTheme = (theme: "light" | "dark" | "system") => {
    updateSettings({ theme });
    void persistSettings();
  };

  const options: {
    key: "light" | "dark" | "system";
    labelKey: "onboardingThemeLight" | "onboardingThemeDark" | "onboardingThemeSystem";
    icon: typeof Sun;
  }[] = [
    { key: "dark", labelKey: "onboardingThemeDark", icon: Moon },
    { key: "light", labelKey: "onboardingThemeLight", icon: Sun },
    { key: "system", labelKey: "onboardingThemeSystem", icon: Monitor },
  ];

  return (
    <section
      className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#0F1523]/75 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.09),inset_0_-1px_1px_0_rgba(0,0,0,0.4)] space-y-3 transition-colors"
      data-purpose="theme-selection"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 dark:text-orange-400 shrink-0">
            <Palette className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
            {translate(lang, "onboardingSectionTheme")}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          {translate(lang, "onboardingThemeDynamic")}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={translate(lang, "onboardingSectionTheme")}
        className="grid grid-cols-3 gap-2 p-1 bg-slate-100/90 dark:bg-black/50 rounded-xl border border-slate-200 dark:border-white/5"
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = currentTheme === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelectTheme(opt.key)}
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg text-xs gap-1.5 transition-all cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-b from-orange-500/20 to-orange-600/10 border border-orange-500/60 text-orange-600 dark:text-orange-300 font-bold shadow-[0_0_20px_-2px_rgba(249,115,22,0.35)]"
                  : "border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] font-medium"
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? "text-orange-500 dark:text-orange-400" : "text-slate-500 dark:text-slate-400"}`} />
              <span>{translate(lang, opt.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
