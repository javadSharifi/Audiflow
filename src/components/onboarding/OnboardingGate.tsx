import React, { useEffect } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { translate } from "../../i18n";
import { isAndroid } from "../../utils/platform";
import { markFirstRunDone } from "../../utils/bootPrefs";
import { PermissionSection } from "./PermissionSection";
import { ThemeSection } from "./ThemeSection";
import { LanguageSection } from "./LanguageSection";
import { PerformanceSection } from "./PerformanceSection";
import { ArrowRight, SkipForward } from "lucide-react";

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

  // Automatically prompt for music access as soon as the user enters for the first time
  useEffect(() => {
    if (!isAndroid()) return;
    const musicStore = useMusicPlayerStore.getState();
    const current = musicStore.permissionStatus;
    if (current !== "granted" && current !== "notRequired") {
      void musicStore.requestMediaPermission();
    }
  }, []);

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
      className="fixed inset-0 z-[95] flex flex-col bg-[#FAF6F0] dark:bg-[#05080E] text-slate-900 dark:text-slate-100 select-none overflow-y-auto overflow-x-hidden overscroll-contain animate-in fade-in duration-200 selection:bg-orange-500/30 selection:text-orange-200 transition-colors"
    >
      {/* Decoration layer: clipped so blobs never create scrollable overflow in either axis */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        {/* Subtle grid pattern background */}
        <div className="absolute -top-40 left-1/2 h-[460px] w-[540px] -translate-x-1/2 opacity-0" />
        <div className="absolute -bottom-36 left-1/2 h-[380px] w-[560px] -translate-x-1/2 opacity-0" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <div
        data-purpose="onboarding-column"
        className="relative z-10 mx-auto flex min-h-full w-full max-w-[440px] flex-col px-5"
      >
        <div className="w-full flex flex-col items-center flex-1">
          {/* Hero — safe-area-aware top padding */}
          <header
            data-purpose="onboarding-header"
            style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
            className="flex w-full flex-col items-center text-center mb-6"
          >
            {/* Center Emblem Container */}
            <div className="relative mb-5 flex items-center justify-center">
              {/* Soft warm glow disc behind emblem */}
              <div className="absolute -inset-2 rounded-full bg-orange-500/25 blur-xl" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-b from-[#1E2536] to-[#0D121D] p-[1.5px] border border-orange-400/40 shadow-[0_0_32px_-4px_rgba(249,115,22,0.45)] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-transparent to-amber-500/10" />
                {/* Modern Audio Waveform */}
                <div className="relative flex items-center justify-center gap-1">
                  <span className="w-1 rounded-full bg-gradient-to-t from-orange-500 to-amber-300 animate-music-bar-1" />
                  <span className="w-1 rounded-full bg-gradient-to-t from-orange-500 to-amber-300 animate-music-bar-2" />
                  <span className="w-1.5 h-8 rounded-full bg-gradient-to-t from-amber-300 to-white shadow-[0_0_8px_rgba(249,115,22,0.8)] animate-music-bar-3" />
                  <span className="w-1 rounded-full bg-gradient-to-t from-orange-500 to-amber-300 animate-music-bar-2" />
                  <span className="w-1 rounded-full bg-gradient-to-t from-orange-500 to-amber-300 animate-music-bar-1" />
                </div>
              </div>
            </div>

            {/* Typography */}
            <h1 className="text-[26px] sm:text-[28px] font-black tracking-tight text-slate-900 dark:text-white mb-2 leading-snug">
              {translate(lang, "onboardingTitleLead")}
              <span className="text-transparent bg-clip-text [-webkit-background-clip:text] [-webkit-text-fill-color:transparent] bg-gradient-to-l from-amber-400 via-orange-400 to-orange-500 inline-block">
                {translate(lang, "onboardingTitleAccent")}
              </span>
              {translate(lang, "onboardingTitleTail")}
            </h1>
            {translate(lang, "onboardingSubtitle") ? (
              <p className="text-xs sm:text-[13px] font-normal text-slate-500 dark:text-slate-400 max-w-[310px] leading-relaxed">
                {translate(lang, "onboardingSubtitle")}
              </p>
            ) : null}
          </header>

          {/* Four stacked sections */}
          <main data-purpose="onboarding-content" className="w-full space-y-3.5 flex-1">
            <PermissionSection />
            <ThemeSection />
            <LanguageSection />
            <PerformanceSection />
          </main>
        </div>

        {/* Footer actions — safe-area-aware bottom padding */}
        <footer
          data-purpose="onboarding-footer"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          className="w-full pt-6 pb-2 space-y-3 flex flex-col items-center"
        >
          {/* Primary Glowing CTA Button */}
          <button
            type="button"
            onClick={handleConfirm}
            className="relative group w-full py-4 px-6 rounded-2xl bg-gradient-to-l from-amber-400 via-orange-500 to-orange-600 text-white font-black text-sm sm:text-base shadow-[0_0_32px_-4px_rgba(249,115,22,0.45)] hover:shadow-[0_0_38px_rgba(249,115,22,0.6)] active:scale-[0.985] transition-all duration-200 flex items-center justify-center gap-2.5 focus:outline-none overflow-hidden cursor-pointer"
          >
            {/* Light reflection hover effect */}
            <div className="absolute inset-0 bg-white/15 translate-x-full group-hover:translate-x-[-120%] transition-transform duration-700 pointer-events-none" />
            <span className="tracking-wide">{translate(lang, "onboardingConfirm")}</span>
            <ArrowRight
              className={`w-5 h-5 transition-transform group-hover:-translate-x-1 ${isRtl ? "rotate-180" : ""}`}
              strokeWidth={2.5}
            />
          </button>

          {/* Minimalist Tertiary Skip Link - accessible but unobtrusive/hidden when in default fa flow */}
          <button
            type="button"
            onClick={handleGlobalSkip}
            className="sr-only flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <SkipForward className="h-3.5 w-3.5" />
            <span>{translate(lang, "onboardingSkipAll")}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
export default OnboardingGate;
