import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { Palette, Sun, Moon, Laptop } from "lucide-react";

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
    { key: "light", labelKey: "onboardingThemeLight", icon: Sun },
    { key: "dark", labelKey: "onboardingThemeDark", icon: Moon },
    { key: "system", labelKey: "onboardingThemeSystem", icon: Laptop },
  ];

  return (
    <div className="flex flex-col gap-1.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-zinc-900/80 p-2.5 sm:p-4 shadow-sm transition-colors">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-orange-500/10 text-orange-500 dark:bg-orange-500/20">
          <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div>
          <h2 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "onboardingSectionTheme")}
          </h2>
          <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400">
            {translate(lang, "onboardingSectionThemeDesc")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 pt-1 sm:pt-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = currentTheme === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelectTheme(opt.key)}
              aria-pressed={isSelected}
              className={`flex flex-col items-center justify-center gap-1 sm:gap-2 rounded-lg sm:rounded-xl border p-2 sm:p-3 text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                isSelected
                  ? "border-orange-500 bg-orange-500/10 text-orange-600 shadow-sm dark:border-orange-500 dark:bg-orange-500/20 dark:text-orange-400"
                  : "border-black/[0.06] bg-white/70 text-zinc-700 hover:bg-white active:scale-[0.98] dark:border-white/[0.06] dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{translate(lang, opt.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
