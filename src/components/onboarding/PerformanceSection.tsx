import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { Zap, Check } from "lucide-react";

/**
 * Performance section of onboarding.
 * Constraints per data-model.md:
 * - "on | off (ac:reduced-blur (\"1\"/\"0\"))"
 * - "safe defaults on skip: performance mode on for constrained/mobile devices and off otherwise"
 */
export function PerformanceSection(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const reducedBlur = useAppStore((s) => s.reducedBlur);
  const setReducedBlur = useAppStore((s) => s.setReducedBlur);

  const options: {
    value: boolean;
    labelKey: "onboardingPerfOn" | "onboardingPerfOff";
    subKey: "onboardingPerfOnSub" | "onboardingPerfOffSub";
  }[] = [
    { value: true, labelKey: "onboardingPerfOn", subKey: "onboardingPerfOnSub" },
    { value: false, labelKey: "onboardingPerfOff", subKey: "onboardingPerfOffSub" },
  ];

  return (
    <section
      className="p-3.5 rounded-2xl bg-white/80 dark:bg-[#0F1523]/75 backdrop-blur-xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.09),inset_0_-1px_1px_0_rgba(0,0,0,0.4)] space-y-3 transition-colors"
      data-purpose="performance-mode"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-500 dark:text-orange-400 shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
            {translate(lang, "onboardingSectionPerformance")}
          </h2>
        </div>
        <span className="text-[11px] text-orange-500 dark:text-orange-400/90 font-medium">
          {translate(lang, "onboardingPerfEngine")}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={translate(lang, "onboardingSectionPerformance")}
        className="grid grid-cols-2 gap-2.5"
      >
        {options.map((opt) => {
          const isSelected = reducedBlur === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setReducedBlur(opt.value)}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-right transition-all focus:outline-none cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-r from-orange-500/20 to-amber-500/10 border border-orange-500/70 text-orange-600 dark:text-orange-300 shadow-[0_0_20px_-2px_rgba(249,115,22,0.35)]"
                  : "bg-slate-100/80 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <div className="flex flex-col">
                <span
                  className={`text-xs leading-tight ${isSelected ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300"}`}
                >
                  {translate(lang, opt.labelKey)}
                </span>
                <span
                  className={`mt-0.5 text-[10px] font-normal ${isSelected ? "text-orange-600/80 dark:text-orange-300/80" : "text-slate-500"}`}
                >
                  {translate(lang, opt.subKey)}
                </span>
              </div>
              {isSelected ? (
                <span className="w-4 h-4 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shrink-0 ml-1 shadow-sm">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </span>
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-slate-400 dark:border-slate-600 shrink-0 ml-1" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
