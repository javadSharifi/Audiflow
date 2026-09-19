import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import {
  Flame,
  ShieldCheck,
  ShieldAlert,
  X,
} from "lucide-react";
import { HighBoostSafetyModal } from "./HighBoostSafetyModal";

export interface TrackBoosterSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const TRACK_BOOST_PRESETS = [100, 150, 200, 300, 400] as const;

export function TrackBoosterSheet({ isOpen, onClose }: TrackBoosterSheetProps): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const volumeGainPercent = useMusicPlayerStore((s) => s.volumeGainPercent);
  const setVolumeGainPercent = useMusicPlayerStore((s) => s.setVolumeGainPercent);

  const [isHighBoostUnlocked, setIsHighBoostUnlocked] = useState(false);
  const [showHighBoostModal, setShowHighBoostModal] = useState(false);
  const [pendingHighBoostVal, setPendingHighBoostVal] = useState<number | null>(null);

  const [isInteracting, setIsInteracting] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsInteracting(true);
  }, []);

  const hideTooltip = useCallback((delay = 400) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setIsInteracting(false), delay);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const isEnabled = volumeGainPercent > 100;
  const fraction = Math.max(0, Math.min(1, (volumeGainPercent - 100) / 300));

  // Request volume change with safety gate (>200%)
  const requestVolumeChange = useCallback(
    (newVal: number) => {
      const clamped = Math.max(100, Math.min(400, newVal));
      if (clamped > 200 && !isHighBoostUnlocked) {
        setVolumeGainPercent(200);
        setPendingHighBoostVal(clamped);
        setShowHighBoostModal(true);
        return;
      }
      setVolumeGainPercent(clamped);
    },
    [isHighBoostUnlocked, setVolumeGainPercent],
  );

  const handleConfirmHighBoost = () => {
    setIsHighBoostUnlocked(true);
    setShowHighBoostModal(false);
    const target = pendingHighBoostVal ?? 250;
    setVolumeGainPercent(target);
    setPendingHighBoostVal(null);
  };

  const handleCancelHighBoost = () => {
    setShowHighBoostModal(false);
    setPendingHighBoostVal(null);
    setVolumeGainPercent(200);
  };

  // Safe speaker protection: strictly resets software gain without touching hardware stream volume
  const handleSafeSpeakerProtection = () => {
    setVolumeGainPercent(100);
  };

  // Dynamic visual tier colors & glow
  const tierTheme = useMemo(() => {
    if (volumeGainPercent <= 100) return { accent: "#10b981", glow: "rgba(16, 185, 129, 0.2)", activeBtnBg: "bg-emerald-500 text-white shadow-emerald-500/25", badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    if (volumeGainPercent <= 175) return { accent: "#f59e0b", glow: "rgba(245, 158, 11, 0.25)", activeBtnBg: "bg-amber-500 text-white shadow-amber-500/25", badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    if (volumeGainPercent <= 250) return { accent: "#f97316", glow: "rgba(249, 115, 22, 0.3)", activeBtnBg: "bg-orange-500 text-white shadow-orange-500/25", badgeBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" };
    return { accent: "#ef4444", glow: "rgba(239, 68, 68, 0.4)", activeBtnBg: "bg-rose-500 text-white shadow-rose-500/25", badgeBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" };
  }, [volumeGainPercent]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop tap dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Bottom Sheet Card */}
      <div
        className="relative z-10 w-full max-w-lg mx-auto rounded-t-3xl bg-white/95 dark:bg-zinc-900/95 border-t border-black/10 dark:border-white/10 shadow-2xl p-5 pb-8 flex flex-col gap-4 animate-in slide-in-from-bottom duration-250 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Indicator Bar */}
        <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto -mt-1.5 mb-0.5" />

        {/* Sheet Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition-all"
              style={{
                backgroundColor: isEnabled ? `${tierTheme.accent}20` : undefined,
                boxShadow: isEnabled ? `0 0 12px ${tierTheme.glow}` : undefined,
              }}
            >
              <Flame
                className={`h-4.5 w-4.5 ${isEnabled ? "animate-pulse" : "text-zinc-400"}`}
                style={{ color: isEnabled ? tierTheme.accent : undefined }}
                strokeWidth={2.4}
              />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                  {translate(lang, "boosterSheetTitle")}
                </h3>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border transition-all ${tierTheme.badgeBg}`}
                >
                  {isEnabled ? `${volumeGainPercent}%` : translate(lang, "boosterPresetNormal")}
                </span>
              </div>
            </div>
          </div>

          {/* Actions: Safe Speaker Protection & Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            {isEnabled && (
              <button
                type="button"
                onClick={handleSafeSpeakerProtection}
                title={translate(lang, "boosterNormalLevel")}
                aria-label={translate(lang, "boosterProtectSpeaker")}
                className="flex items-center gap-1 h-7.5 px-3 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer active:scale-95 shadow-sm border border-emerald-500/20"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>{translate(lang, "boosterProtectSpeaker")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Sound Booster"
              className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-black/[0.05] dark:bg-white/10 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors cursor-pointer active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Selection Preset Pills (Non-dismissive auditioning) */}
        <div className="grid grid-cols-5 gap-2 pt-1">
          {TRACK_BOOST_PRESETS.map((val) => {
            const isSelected = volumeGainPercent === val;
            return (
              <button
                key={val}
                type="button"
                aria-label={`${val}%`}
                onClick={() => requestVolumeChange(val)}
                className={`py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
                  isSelected
                    ? `${tierTheme.activeBtnBg} shadow-md`
                    : "bg-black/[0.04] dark:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                }`}
              >
                {val}%
              </button>
            );
          })}
        </div>

        {/* Styled Range Slider */}
        <div dir="ltr" className="flex flex-col gap-2 pt-2">
          <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span>100% ({translate(lang, "boosterPresetNormal")})</span>
            <span>400% ({translate(lang, "boosterPresetMax")})</span>
          </div>

          <div className="control relative w-full flex items-center h-8">
            <input
              id="track"
              type="range"
              role="slider"
              min="100"
              max="400"
              step="5"
              value={volumeGainPercent}
              aria-label={translate(lang, "boosterSheetTitle")}
              aria-valuemin={100}
              aria-valuemax={400}
              aria-valuenow={volumeGainPercent}
              onPointerDown={showTooltip}
              onPointerUp={() => hideTooltip(300)}
              onTouchStart={showTooltip}
              onTouchEnd={() => hideTooltip(300)}
              onMouseDown={showTooltip}
              onMouseUp={() => hideTooltip(300)}
              onBlur={() => setIsInteracting(false)}
              onChange={(e) => {
                showTooltip();
                requestVolumeChange(parseInt(e.target.value, 10));
                hideTooltip(600);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />

            {/* Floating Tooltip - shown ONLY when changing/interacting */}
            <div
              aria-hidden="true"
              className={`tooltip absolute -top-8 -translate-x-1/2 px-2.5 py-0.5 rounded-xl text-xs font-black shadow-lg transition-all duration-150 pointer-events-none z-30 flex items-center justify-center ${
                isInteracting
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-90 translate-y-1.5"
              }`}
              style={{
                left: `calc(12px + ${fraction} * (100% - 24px))`,
                backgroundColor: tierTheme.accent,
                color: "#ffffff",
                boxShadow: `0 4px 14px ${tierTheme.glow}`,
              }}
            >
              <span>{volumeGainPercent}%</span>
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45"
                style={{ backgroundColor: tierTheme.accent }}
              />
            </div>

            {/* Custom Capsule Track */}
            <div className="control__track w-full h-full rounded-full bg-zinc-200/80 dark:bg-zinc-800/80 p-1 relative overflow-hidden shadow-inner flex items-center border border-black/5 dark:border-white/5">
              <div className="control__track-slide relative w-full h-full rounded-full overflow-hidden flex items-center">
                <div
                  className={`control__fill h-full rounded-full ${isInteracting ? "transition-none" : "transition-[width] duration-150"}`}
                  style={{
                    width: `calc(10px + ${fraction} * (100% - 20px))`,
                    backgroundColor: tierTheme.accent,
                    boxShadow: `0 0 10px ${tierTheme.glow}`,
                  }}
                />
                <div
                  className={`control__indicator absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-5 rounded-full bg-white shadow-md border border-black/20 pointer-events-none z-10 ${isInteracting ? "transition-none" : "transition-[left] duration-150"}`}
                  style={{
                    left: `calc(10px + ${fraction} * (100% - 20px))`,
                  }}
                />
                <div className="control__fill flex-1 h-full bg-transparent" />
              </div>
            </div>
          </div>

          <div className="flex justify-between text-[10px] text-zinc-400 px-0.5 font-medium">
            <span>100%</span>
            <span>200%</span>
            <span>300%</span>
            <span>400%</span>
          </div>
        </div>

        {/* Safety Warning Banner if > 200% */}
        {volumeGainPercent > 200 && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 animate-in fade-in duration-200">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed font-medium">
              {translate(lang, "boosterWarning")}
            </p>
          </div>
        )}
      </div>

      {/* High Boost Safety Confirmation Modal (> 200%) */}
      <HighBoostSafetyModal
        isOpen={showHighBoostModal}
        onConfirm={handleConfirmHighBoost}
        onCancel={handleCancelHighBoost}
      />
    </div>
  );
}
