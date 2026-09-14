import { useState, useMemo, useRef, useCallback } from "react";
import { useMusicPlayerStore } from "../../stores/useMusicPlayerStore";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { boosterDbForPercent } from "../../stores/musicPlayer/audioEngine";
import {
  Flame,
  VolumeX,
  ShieldAlert,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";

// Helper functions for SVG Arc calculation
function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const rad = (angleInDegrees - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${arcSweep} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function BoosterView(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const volumeGainPercent = useMusicPlayerStore((s) => s.volumeGainPercent);
  const setVolumeGainPercent = useMusicPlayerStore((s) => s.setVolumeGainPercent);

  // Remember the last configured boost level (default 200%)
  const [lastTargetBoost, setLastTargetBoost] = useState<number>(() => {
    return volumeGainPercent > 100 ? volumeGainPercent : 200;
  });

  // State for high-boost (> 200%) confirmation modal
  const [isHighBoostUnlocked, setIsHighBoostUnlocked] = useState<boolean>(() => {
    return volumeGainPercent > 200;
  });
  const [showHighBoostModal, setShowHighBoostModal] = useState<boolean>(false);
  const [pendingHighBoostVal, setPendingHighBoostVal] = useState<number | null>(null);

  const isEnabled = volumeGainPercent > 100;
  const dbValue = useMemo(() => {
    return boosterDbForPercent(volumeGainPercent).toFixed(1);
  }, [volumeGainPercent]);

  // Request volume change with >200% safety gate
  const requestVolumeChange = useCallback(
    (newVal: number) => {
      const clamped = Math.max(100, Math.min(400, newVal));
      if (clamped > 200 && !isHighBoostUnlocked) {
        // Stop at 200% and prompt user with warning dialog
        setVolumeGainPercent(200);
        setPendingHighBoostVal(clamped);
        setShowHighBoostModal(true);
        return;
      }
      if (clamped > 100) {
        setLastTargetBoost(clamped);
      }
      setVolumeGainPercent(clamped);
    },
    [isHighBoostUnlocked, setVolumeGainPercent],
  );

  // Confirm high boost in modal
  const handleConfirmHighBoost = () => {
    setIsHighBoostUnlocked(true);
    setShowHighBoostModal(false);
    const target = pendingHighBoostVal ?? 250;
    setLastTargetBoost(target);
    setVolumeGainPercent(target);
    setPendingHighBoostVal(null);
  };

  // Cancel high boost modal
  const handleCancelHighBoost = () => {
    setShowHighBoostModal(false);
    setPendingHighBoostVal(null);
    setVolumeGainPercent(200);
  };

  // Master switch toggle
  const handleToggleSwitch = () => {
    if (isEnabled) {
      setVolumeGainPercent(100);
    } else {
      const target = Math.max(125, isHighBoostUnlocked ? lastTargetBoost : Math.min(200, lastTargetBoost));
      setVolumeGainPercent(target);
    }
  };

  // Arc calculations
  // Arc sweeps 270 degrees: from -135 deg (bottom-left) to +135 deg (bottom-right)
  const dialRadius = 78;
  const arcLength = 367.57; // 2 * Math.PI * 78 * (270 / 360)
  const fullArcPath = useMemo(() => describeArc(125, 125, dialRadius, -135, 135), [dialRadius]);
  const percentFraction = Math.max(0, Math.min(1, (volumeGainPercent - 100) / 300));
  const currentAngleDeg = -135 + percentFraction * 270;
  const strokeOffset = arcLength * (1 - percentFraction);

  // Percentage calibration markers around the dial (100% to 400% every 50%)
  const percentMarkers = useMemo(() => {
    const values = [100, 150, 200, 250, 300, 350, 400];
    const faDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return values.map((val) => {
      const frac = (val - 100) / 300;
      const angle = -135 + frac * 270;
      const tickInner = polarToCartesian(125, 125, dialRadius + 7, angle);
      const tickOuter = polarToCartesian(125, 125, dialRadius + 12, angle);
      const labelPos = polarToCartesian(125, 125, dialRadius + 25, angle);
      const label =
        lang === "fa"
          ? `${val.toString().replace(/\d/g, (d) => faDigits[parseInt(d, 10)])}٪`
          : `${val}%`;
      return { val, angle, tickInner, tickOuter, labelPos, label };
    });
  }, [lang, dialRadius]);

  // Rotary Dial Pointer / Touch Tracking in Polar Coordinates
  const dialContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [isDraggingDial, setIsDraggingDial] = useState(false);
  const lastAngleRef = useRef<number>(currentAngleDeg);

  const handlePointerMath = useCallback(
    (clientX: number, clientY: number) => {
      if (!dialContainerRef.current) return;
      const rect = dialContainerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;

      // Distance from center - ignore jitter right in the dead center
      const dist = Math.hypot(dx, dy);
      if (dist < 15) return;

      // Angle in degrees where 12 o'clock is 0 deg, clockwise is positive
      let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (deg > 180) deg -= 360;

      // The active sweep is from -135 deg (100%) to +135 deg (400%).
      // The dead zone is at the bottom: between -180..-135 and +135..+180.
      // Prevent flipping across the bottom 6 o'clock line:
      const last = lastAngleRef.current;
      if (last > 60 && deg < -60) {
        // Was on the high boost side and crossed into negative angles at the bottom -> clamp to max (+135 deg)
        deg = 135;
      } else if (last < -60 && deg > 60) {
        // Was on the low boost side and crossed into positive angles at the bottom -> clamp to min (-135 deg)
        deg = -135;
      } else if (deg > 135) {
        deg = 135;
      } else if (deg < -135) {
        deg = -135;
      }

      lastAngleRef.current = deg;

      const fraction = Math.max(0, Math.min(1, (deg - (-135)) / 270));
      const targetVal = Math.round((100 + fraction * 300) / 5) * 5;
      requestVolumeChange(targetVal);
    },
    [requestVolumeChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    setIsDraggingDial(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    lastAngleRef.current = currentAngleDeg;
    handlePointerMath(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    handlePointerMath(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      setIsDraggingDial(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Dynamic theme colors
  const boostTheme = useMemo(() => {
    if (volumeGainPercent <= 100) {
      return {
        accent: "#10b981",
        glow: "rgba(16, 185, 129, 0.2)",
        stroke: "url(#boostGreenGrad)",
        badgeBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    }
    if (volumeGainPercent <= 175) {
      return {
        accent: "#f59e0b",
        glow: "rgba(245, 158, 11, 0.25)",
        stroke: "url(#boostAmberGrad)",
        badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
    }
    if (volumeGainPercent <= 250) {
      return {
        accent: "#f97316",
        glow: "rgba(249, 115, 22, 0.3)",
        stroke: "url(#boostOrangeGrad)",
        badgeBg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      };
    }
    return {
      accent: "#ef4444",
      glow: "rgba(239, 68, 68, 0.4)",
      stroke: "url(#boostRedGrad)",
      badgeBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    };
  }, [volumeGainPercent]);

  return (
    <div className="flex flex-col flex-1 w-full h-full overflow-y-auto px-3 sm:px-4 pt-2 pb-32 select-none">
      <div className="w-full max-w-md mx-auto flex flex-col gap-3.5">
        {/* ================================================================= */}
        {/* 1. GLOBAL SOUND BOOSTER HEADER CARD                               */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between p-4 rounded-3xl bg-white/90 dark:bg-zinc-900/90 border border-black/10 dark:border-white/10 shadow-sm backdrop-blur-xl transition-all">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 ${
                isEnabled
                  ? "bg-gradient-to-tr from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
              }`}
            >
              {isEnabled ? (
                <Flame className="h-5 w-5 animate-pulse" strokeWidth={2.4} />
              ) : (
                <VolumeX className="h-5 w-5" strokeWidth={2} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-zinc-100 truncate">
                  {translate(lang, "boosterTitle")}
                </h1>
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full transition-colors ${
                    isEnabled
                      ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"
                      : "bg-zinc-400"
                  }`}
                />
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {isEnabled
                  ? translate(lang, "boosterEnabled")
                  : translate(lang, "boosterDisabled")}
              </span>
            </div>
          </div>

          {/* Master Switch Toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label="Toggle Sound Booster"
            onClick={handleToggleSwitch}
            className={`relative inline-flex h-8 w-15 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-out focus:outline-none ${
              isEnabled
                ? "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 shadow-md shadow-orange-500/30"
                : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`pointer-events-none inline-flex items-center justify-center h-7 w-7 transform rounded-full bg-white shadow-md transition duration-300 ease-out ${
                isEnabled ? "translate-x-7" : "translate-x-0"
              }`}
            >
              {isEnabled ? (
                <Flame className="h-3.5 w-3.5 text-orange-500" />
              ) : (
                <VolumeX className="h-3.5 w-3.5 text-zinc-400" />
              )}
            </span>
          </button>
        </div>

        {/* ================================================================= */}
        {/* 2. ROTARY DIAL & CENTRAL HUD CARD                                 */}
        {/* ================================================================= */}
        <div className="relative flex flex-col items-center justify-center p-5 rounded-3xl bg-gradient-to-b from-white via-zinc-50/90 to-zinc-100/70 dark:from-zinc-900 dark:via-zinc-950/90 dark:to-black border border-black/10 dark:border-white/10 shadow-sm overflow-hidden">
          {/* Dynamic Glow (radial fade — no square box edges) */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full pointer-events-none transition-opacity duration-500"
            style={{
              opacity: isEnabled ? 0.3 : 0,
              background: isEnabled
                ? `radial-gradient(circle, ${boostTheme.accent}59 0%, ${boostTheme.accent}26 40%, transparent 70%)`
                : "transparent",
            }}
          />

          {/* Interactive Rotary Dial Container - Explicit LTR and centered */}
          <div
            ref={dialContainerRef}
            dir="ltr"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-68 h-68 mx-auto flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
            title="برای تغییر، دایره را بچرخانید یا لمس کنید"
          >
            {/* SVG Arc Gauge & Percentage Markers */}
            <svg className="w-full h-full pointer-events-none" viewBox="0 0 250 250">
              <defs>
                <linearGradient id="boostGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
                <linearGradient id="boostAmberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <linearGradient id="boostOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                <linearGradient id="boostRedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>

              {/* Background Arc Track (Fixed path) */}
              <path
                d={fullArcPath}
                fill="none"
                stroke="currentColor"
                strokeWidth="11"
                strokeLinecap="round"
                className="text-zinc-200/80 dark:text-zinc-800/80"
              />

              {/* Progress Arc - Exactly matches background path with stroke-dashoffset */}
              <path
                d={fullArcPath}
                fill="none"
                stroke={boostTheme.stroke}
                strokeWidth="11"
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${arcLength}`}
                strokeDashoffset={strokeOffset}
                style={{
                  opacity: percentFraction <= 0.005 ? 0 : 1,
                  transition: isDraggingDial
                    ? "none"
                    : "stroke-dashoffset 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />

              {/* Percentage Calibration Markers around Arc */}
              {percentMarkers.map((m) => {
                const isReached = volumeGainPercent >= m.val;
                return (
                  <g key={m.val}>
                    {/* Tick Mark Line */}
                    <line
                      x1={m.tickInner.x}
                      y1={m.tickInner.y}
                      x2={m.tickOuter.x}
                      y2={m.tickOuter.y}
                      stroke={isReached && isEnabled ? boostTheme.accent : "currentColor"}
                      strokeWidth={isReached && isEnabled ? "2.2" : "1.5"}
                      strokeLinecap="round"
                      className={
                        isReached && isEnabled
                          ? "opacity-100"
                          : "text-zinc-300 dark:text-zinc-700 opacity-60"
                      }
                    />
                    {/* Percentage Label */}
                    <text
                      x={m.labelPos.x}
                      y={m.labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className={`text-[9.5px] select-none transition-colors duration-150 ${
                        isReached && isEnabled
                          ? "font-bold text-zinc-800 dark:text-zinc-100"
                          : "font-medium text-zinc-400 dark:text-zinc-500"
                      }`}
                      fill={isReached && isEnabled ? boostTheme.accent : "currentColor"}
                    >
                      {m.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Rotary Knob Center Core - Absolutely centered inside container */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-zinc-100 dark:from-zinc-800 dark:to-zinc-950 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_10px_25px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.1),0_10px_25px_rgba(0,0,0,0.5)] border border-black/10 dark:border-white/10 pointer-events-none"
              style={{
                boxShadow: isEnabled ? `0 0 24px ${boostTheme.glow}` : undefined,
              }}
            >
              {/* Outer Pointer Indicator Notch (Rotates in 100% lockstep with progress arc) */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  transform: `rotate(${currentAngleDeg}deg)`,
                  transition: isDraggingDial
                    ? "none"
                    : "transform 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <div
                  className="absolute top-1 left-1/2 -translate-x-1/2 w-2.5 h-3.5 rounded-full shadow-md transition-colors"
                  style={{ backgroundColor: boostTheme.accent }}
                />
              </div>

              {/* Central Values HUD */}
              <div className="flex flex-col items-center justify-center text-center px-2 pointer-events-none">
                <span className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-baseline">
                  {volumeGainPercent}
                  <span className="text-lg font-bold ml-0.5 text-zinc-400 dark:text-zinc-500">%</span>
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 mt-1 rounded-full border transition-all ${boostTheme.badgeBg}`}
                >
                  {isEnabled
                    ? translate(lang, "boosterGainDb", { db: dbValue })
                    : translate(lang, "boosterNormal")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. ADJUST SOUND BOOST LEVEL SLIDER CARD                           */}
        {/* ================================================================= */}
        <div className="flex flex-col gap-2 p-4 rounded-3xl bg-white/90 dark:bg-zinc-900/90 border border-black/10 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-800 dark:text-zinc-200">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />
              <span>{translate(lang, "boosterSliderLabel")}</span>
            </div>
            <span className="text-orange-500 font-extrabold">{volumeGainPercent}%</span>
          </div>

          {/* Strict LTR Range Slider */}
          <div dir="ltr" className="relative flex items-center w-full py-2">
            <input
              type="range"
              role="slider"
              min="100"
              max="400"
              step="5"
              value={volumeGainPercent}
              aria-label={translate(lang, "boosterSliderLabel")}
              onChange={(e) => requestVolumeChange(parseInt(e.target.value, 10))}
              className="w-full h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-orange-500 transition-all focus:outline-none"
            />
          </div>

          <div dir="ltr" className="flex justify-between text-[10px] text-zinc-500 font-medium px-1">
            <span>100% ({translate(lang, "boosterPresetNormal")})</span>
            <span>200%</span>
            <span>300%</span>
            <span>400% ({translate(lang, "boosterPresetMax")})</span>
          </div>
        </div>

        {/* Safety Warning text if > 200% */}
        {volumeGainPercent > 200 && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 animate-in fade-in duration-200">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed font-medium">
              {translate(lang, "boosterWarning")}
            </p>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 4. HIGH BOOST WARNING CONFIRMATION MODAL (> 200%)                   */}
      {/* =================================================================== */}
      {showHighBoostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/15 p-5 shadow-2xl flex flex-col gap-4 text-center animate-in zoom-in-95 duration-200">
            {/* Warning Icon Badge */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 shadow-md">
              <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />
            </div>

            {/* Text Content */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                {translate(lang, "highBoostModalTitle")}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {translate(lang, "highBoostModalDesc")}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCancelHighBoost}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors active:scale-95 cursor-pointer"
              >
                {translate(lang, "highBoostCancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmHighBoost}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/25 transition-all active:scale-95 cursor-pointer"
              >
                {translate(lang, "highBoostConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
