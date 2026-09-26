import { useState, useEffect } from "react";
import type React from "react";
import { Play, Square, Pause, Radio, ChevronRight, Activity } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { registerDubbingPauseHook } from "../../stores/slices/liveDubbingSlice";
import { translate } from "../../i18n";
import { SUPPORTED_LANGUAGES } from "./languages";
import { DuckingSlider } from "./DuckingSlider";
import { FloatingOverlayToggle } from "./FloatingOverlayToggle";
import { VoicePersonaSelect } from "./VoicePersonaSelect";
import { ApiKeyCard } from "./ApiKeyCard";
import { LanguagePickerModal } from "./LanguagePickerModal";

export function LiveDubbingPanel(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const dubbingState = useAppStore((s) => s.dubbingState);
  const targetLanguage = useAppStore((s) => s.targetLanguage);
  const latencyMs = useAppStore((s) => s.latencyMs);
  const errorMessage = useAppStore((s) => s.errorMessage);
  const startDubbing = useAppStore((s) => s.startDubbing);
  const stopDubbing = useAppStore((s) => s.stopDubbing);
  const togglePause = useAppStore((s) => s.togglePause);

  const [isLangModalOpen, setIsLangModalOpen] = useState(false);

  useEffect(() => {
    registerDubbingPauseHook(() => {
      const player = useMusicPlayerStore.getState();
      if (player.isPlaying) {
        player.pauseTrack();
      }
    });
    return () => registerDubbingPauseHook(null);
  }, []);

  const currentLang = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage) ?? SUPPORTED_LANGUAGES[0];
  const isActive = dubbingState !== "idle" && dubbingState !== "error";

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-4 py-6 md:px-8 max-w-4xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "liveDubbingTitle")}
          </h2>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {translate(lang, "liveDubbingSubtitle")}
        </p>
      </div>

      {/* Hero Visualizer Card */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-teal-50/20 p-6 shadow-sm dark:border-zinc-800/80 dark:from-zinc-900 dark:via-zinc-950 dark:to-teal-950/20">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className={`relative flex h-24 w-24 items-center justify-center rounded-full transition-all duration-500 ${
            isActive
              ? "bg-teal-500/20 shadow-[0_0_40px_rgba(20,184,166,0.35)] dark:bg-teal-500/30"
              : "bg-zinc-100 dark:bg-zinc-800"
          }`}>
            <Radio className={`h-10 w-10 transition-colors ${
              isActive ? "text-teal-500 animate-pulse" : "text-zinc-400"
            }`} />
          </div>

          <div className="mt-4 flex flex-col items-center gap-1">
            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {dubbingState === "idle" && translate(lang, "liveDubbingStatusIdle")}
              {dubbingState === "capturing" && translate(lang, "liveDubbingStatusCapturing")}
              {dubbingState === "translating" && translate(lang, "liveDubbingStatusTranslating")}
              {dubbingState === "speaking" && translate(lang, "liveDubbingStatusSpeaking")}
              {dubbingState === "paused" && translate(lang, "liveDubbingStatusPaused")}
              {dubbingState === "error" && (errorMessage || "Connection error")}
            </span>

            {isActive && latencyMs > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400">
                <Activity className="h-3 w-3" />
                <span>{translate(lang, "liveDubbingLatency")}: ~{latencyMs}ms</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="mt-6 flex items-center gap-3">
            {!isActive ? (
              <button
                type="button"
                onClick={startDubbing}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/20 hover:bg-teal-600 transition"
              >
                <Play className="h-4 w-4 fill-current" />
                {translate(lang, "liveDubbingStart")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={togglePause}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  <Pause className="h-4 w-4" />
                  {dubbingState === "paused"
                    ? translate(lang, "liveDubbingResume")
                    : translate(lang, "liveDubbingPause")}
                </button>
                <button
                  type="button"
                  onClick={stopDubbing}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-600 transition"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  {translate(lang, "liveDubbingStop")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Target Language Selector Card */}
      <div className="rounded-xl border border-zinc-200 bg-white/60 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "liveDubbingTargetLanguage")}
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              78 supported world languages
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLangModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-bold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <span className="text-base">{currentLang.flagEmoji}</span>
            <span>{lang === "fa" ? currentLang.nameFa : currentLang.nameEn}</span>
            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <VoicePersonaSelect />
        <DuckingSlider />
      </div>

      <FloatingOverlayToggle />

      <ApiKeyCard />

      <LanguagePickerModal
        isOpen={isLangModalOpen}
        onClose={() => setIsLangModalOpen(false)}
      />
    </div>
  );
}
