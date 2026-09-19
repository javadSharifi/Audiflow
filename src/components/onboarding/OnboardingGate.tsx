import React from "react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { isAndroid } from "../../utils/platform";
import { markFirstRunDone } from "../../utils/bootPrefs";
import { PermissionSection } from "./PermissionSection";
import { ThemeSection } from "./ThemeSection";
import { LanguageSection } from "./LanguageSection";
import { PerformanceSection } from "./PerformanceSection";
import { Sparkles, ArrowRight, SkipForward } from "lucide-react";

export interface OnboardingGateProps {
  onComplete: () => void;
}

/**
 * Single-page onboarding gate shell.
 * Constraints per data-model.md:
 * - "written only via confirm or global skip; never written by section-level interaction or permission grant/deny"
 * - "absent → complete (confirm/skip, or silent grandfathering on upgrade with prior-use evidence)"
 * - "Safe defaults on skip: Persian, system-follow theme, performance mode on for constrained/mobile devices and off otherwise"
 */
export function OnboardingGate({ onComplete }: OnboardingGateProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const isRtl = lang === "fa";

  const handleConfirm = () => {
    markFirstRunDone();
    onComplete();
  };

  const handleGlobalSkip = () => {
    const store = useAppStore.getState();
    // Safe defaults on skip: Persian, system-follow theme, performance mode on for mobile and off otherwise
    if (store.lang !== "fa" || store.theme !== "system") {
      store.updateSettings({ language: "fa", theme: "system" });
      void store.persistSettings();
    }
    const targetBlur = isAndroid();
    if (store.reducedBlur !== targetBlur) {
      store.setReducedBlur(targetBlur);
    }
    markFirstRunDone();
    onComplete();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={translate(lang, "onboardingTitle")}
      className="fixed inset-0 z-[95] flex flex-col bg-zinc-100 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 select-none overflow-y-auto sm:overflow-y-auto animate-in fade-in duration-200"
    >
      {/* Decorative ambient gradients contained inside the fully opaque shell */}
      <div className="pointer-events-none absolute -top-24 -start-24 h-72 w-72 rounded-full bg-orange-500/15 blur-3xl dark:bg-orange-500/10" />
      <div className="pointer-events-none absolute -bottom-24 -end-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl dark:bg-amber-500/10" />

      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col justify-between p-3 sm:p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-1 sm:gap-2.5 pt-1 pb-1 sm:pt-4 sm:pb-4">
          <div className="flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 shadow-md shadow-orange-500/25">
            <Sparkles className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
            {translate(lang, "onboardingTitle")}
          </h1>
          <p className="max-w-md text-xs sm:text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {translate(lang, "onboardingSubtitle")}
          </p>
        </div>

        {/* Four Stacked Sections */}
        <div className="flex flex-col gap-1.5 sm:gap-3 my-auto">
          <PermissionSection />
          <ThemeSection />
          <LanguageSection />
          <PerformanceSection />
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 pt-2 sm:pt-6 pb-2 sm:pb-4">
          <button
            type="button"
            onClick={handleGlobalSkip}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2.5 text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer order-2 sm:order-1"
          >
            <SkipForward className="h-3.5 w-3.5" />
            <span>{translate(lang, "onboardingSkipAll")}</span>
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:brightness-105 active:scale-[0.985] cursor-pointer order-1 sm:order-2"
          >
            <span>{translate(lang, "onboardingConfirm")}</span>
            <ArrowRight className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
export default OnboardingGate;
