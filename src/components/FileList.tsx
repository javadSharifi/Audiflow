import { useState } from "react";
import { Scissors, Volume2, Music, Trash2, Plus, X, Zap } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { translate } from "../i18n";
import { formatBytes, formatDuration, formatTimecode } from "../utils/format";
import { pickVideos, isAudioPath } from "../utils/dialog";
import { TrimEditor } from "./TrimEditor";
import { FileBoosterInline } from "../features/sound-booster/file-booster/FileBoosterInline";
import { MobileEditModal } from "./MobileEditModal";
import type { InputFile } from "../types";

function boostBadgeLabel(file: InputFile, lang: "en" | "fa"): string {
  if (!file.boostEnabled) return "";
  if (file.boostPreset === "manual") {
    return `${file.boostManualGainPercent ?? 100}%`;
  }
  switch (file.boostPreset) {
    case "smart":
      return lang === "fa" ? "تقویت هوشمند" : "Smart Boost";
    case "music":
      return lang === "fa" ? "موسیقی" : "Music";
    case "extreme":
      return lang === "fa" ? "حداکثر صدا" : "Max Boost";
    default:
      return lang === "fa" ? "تقویت صدا" : "Boost";
  }
}

function FileRow({
  file,
  expandedMode,
  onToggleTrim,
  onToggleBoost,
}: {
  file: InputFile;
  expandedMode: "trim" | "boost" | null;
  onToggleTrim: () => void;
  onToggleBoost: () => void;
}): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const removeFile = useAppStore((s) => s.removeFile);
  const isAudio = file.kind === "audio" || isAudioPath(file.path);
  const boostLabel = boostBadgeLabel(file, lang);

  return (
    <>
      <tr className="border-b border-black/[0.04] transition-colors hover:bg-black/[0.02] dark:border-white/[0.04] dark:hover:bg-white/[0.02]">
        <td className="max-w-[260px] truncate px-3 py-2.5" title={file.path}>
          <div className="inline-flex items-center gap-1.5 me-2 align-middle">
            {/* Trim Button */}
            <button
              onClick={onToggleTrim}
              data-testid={`trim-toggle-${file.name}`}
              className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 align-middle text-[11px] font-bold transition-all duration-200 ${
                expandedMode === "trim"
                  ? "border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/30"
                  : "border-black/10 bg-white/60 text-zinc-600 hover:border-orange-400 hover:text-orange-500 dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-300"
              }`}
              aria-label={`${translate(lang, "trimEdit")} ${file.name}`}
              aria-expanded={expandedMode === "trim"}
              title={translate(lang, "trimTitle")}
            >
              <Scissors className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span>{translate(lang, "trimShort")}</span>
            </button>

            {/* Sound Booster Button */}
            <button
              onClick={onToggleBoost}
              data-testid={`boost-toggle-${file.name}`}
              className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 align-middle text-[11px] font-bold transition-all duration-200 ${
                expandedMode === "boost"
                  ? "border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/30"
                  : file.boostEnabled
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:border-orange-500/40 dark:bg-orange-500/20 dark:text-orange-400"
                    : "border-black/10 bg-white/60 text-zinc-600 hover:border-orange-400 hover:text-orange-500 dark:border-white/10 dark:bg-zinc-800/60 dark:text-zinc-300"
              }`}
              aria-label={`${translate(lang, "fileBoosterTitle")} ${file.name}`}
              aria-expanded={expandedMode === "boost"}
              title={translate(lang, "fileBoosterTitle")}
            >
              <Volume2 className="h-3.5 w-3.5" strokeWidth={2.2} />
              <span>{translate(lang, "boostBtnShort")}</span>
            </button>
          </div>

          {isAudio && (
            <span className="me-1 inline-flex items-center rounded bg-orange-500/10 p-1 align-middle text-orange-600 dark:text-orange-400" title="Audio">
              <Music className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          )}
          <span className="align-middle font-medium text-zinc-800 dark:text-zinc-200">{file.name}</span>
          {file.error && (
            <span className="block text-xs font-medium text-red-500">{file.error}</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">{formatBytes(file.sizeBytes)}</td>
        <td className="px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {file.hasAudio ? formatDuration(file.durationSecs) : "—"}
        </td>
        <td className="px-3 py-2.5">
          <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {file.formatName.split(",")[0]}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {(file.trimStartSecs != null || file.trimEndSecs != null) && (
              <span
                data-testid={`trim-chip-${file.name}`}
                className="rounded-full border border-orange-500/40 bg-transparent px-2 py-0.5 text-[10px] font-semibold tabular-nums text-orange-600 dark:text-orange-300"
              >
                ✂ {formatTimecode(file.trimStartSecs ?? 0)} – {formatTimecode(file.trimEndSecs ?? file.durationSecs)}
              </span>
            )}
            {file.boostEnabled && (
              <span
                data-testid={`boost-chip-${file.name}`}
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/25 dark:text-amber-300"
              >
                <Zap className="h-2.5 w-2.5" />
                <span>{boostLabel}</span>
              </span>
            )}
            {!file.trimStartSecs && !file.trimEndSecs && !file.boostEnabled && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-end">
          <button
            onClick={() => removeFile(file.path)}
            className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-orange-500"
            aria-label={`${translate(lang, "removeFile")} ${file.name}`}
            title={`${translate(lang, "removeFile")} ${file.name}`}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        </td>
      </tr>
      {/* Expanded Accordion beneath row */}
      {expandedMode === "trim" && (
        <tr className="border-b border-black/[0.04] dark:border-white/[0.04]">
          <td colSpan={6} className="px-3 pb-4 pt-1">
            <TrimEditor key={`trim-${file.path}`} file={file} />
          </td>
        </tr>
      )}
      {expandedMode === "boost" && (
        <tr className="border-b border-black/[0.04] dark:border-white/[0.04]">
          <td colSpan={6} className="px-3 pb-4 pt-1">
            <FileBoosterInline key={`boost-${file.path}`} file={file} />
          </td>
        </tr>
      )}
    </>
  );
}

function MobileFileCard({
  file,
  onOpenTrim,
  onOpenBoost,
}: {
  file: InputFile;
  onOpenTrim: () => void;
  onOpenBoost: () => void;
}): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const removeFile = useAppStore((s) => s.removeFile);
  const isAudio = file.kind === "audio" || isAudioPath(file.path);
  const boostLabel = boostBadgeLabel(file, lang);
  const [nameExpanded, setNameExpanded] = useState(false);
  const hasTrim = file.trimStartSecs != null || file.trimEndSecs != null;
  const trimLabel = hasTrim
    ? `${formatTimecode(file.trimStartSecs ?? 0)} – ${formatTimecode(file.trimEndSecs ?? file.durationSecs)}`
    : "";

  return (
    <div className="glass-card flex flex-col rounded-2xl p-4 transition-all">
      {/* ── Section: file ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800 dark:text-[#F8FAFC]">
            {isAudio && (
              <span className="inline-flex shrink-0 items-center rounded-md bg-orange-500/10 p-1 text-orange-600 dark:text-orange-400">
                <Music className="h-3 w-3" strokeWidth={2.5} />
              </span>
            )}
            <button
              type="button"
              onClick={() => setNameExpanded((v) => !v)}
              title={file.path}
              aria-label={file.name}
              aria-expanded={nameExpanded}
              className={`min-h-[44px] min-w-0 flex-1 cursor-pointer bg-transparent p-0 text-start ${
                nameExpanded ? "whitespace-normal break-all" : "truncate"
              }`}
              style={{ direction: "ltr", textAlign: "right", unicodeBidi: "plaintext" }}
            >
              <span className={nameExpanded ? undefined : "block truncate"}>{file.name}</span>
            </button>
          </div>
          {file.error && (
            <span className="mt-1 block text-xs font-medium text-red-500">{file.error}</span>
          )}
          {/* line 2: format • size • duration — high-contrast, tabular */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium tabular-nums text-slate-600 dark:text-[#CBD5E1]">
            <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-bold uppercase dark:bg-white/[0.06] dark:text-[#CBD5E1]">
              {file.formatName.split(",")[0]}
            </span>
            <span>{formatBytes(file.sizeBytes)}</span>
            <span aria-hidden="true">•</span>
            <span>{file.hasAudio ? formatDuration(file.durationSecs) : "—"}</span>
            {file.boostEnabled && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
                <Zap className="h-2.5 w-2.5" />
                <span>{boostLabel}</span>
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => removeFile(file.path)}
          className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-2 focus-visible:outline-orange-500 ms-2 -me-1 -mt-1"
          aria-label={`${translate(lang, "removeFile")} ${file.name}`}
          title={`${translate(lang, "removeFile")} ${file.name}`}
        >
          <X className="h-4 w-4" strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Section: tools — icon-only, single row, 44px ── */}
      <div className="mt-3 flex items-center gap-2 border-t border-black/[0.04] pt-3 dark:border-white/[0.04]">
        {/* Trim icon: neutral ghost, orange-tinted once a trim exists */}
        <button
          type="button"
          onClick={onOpenTrim}
          data-testid={`trim-toggle-mobile-${file.name}`}
          aria-label={`${translate(lang, "trimEdit")} ${file.name}`}
          title={translate(lang, "trimEdit")}
          className={`flex h-11 min-h-[44px] w-11 min-w-[44px] cursor-pointer items-center justify-center rounded-xl border transition-all focus-visible:outline-2 focus-visible:outline-orange-500 ${
            hasTrim
              ? "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300"
              : "border-black/10 bg-transparent text-zinc-700 hover:border-orange-400 hover:text-orange-600 dark:border-white/15 dark:text-[#CBD5E1]"
          }`}
        >
          <Scissors className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        </button>

        {/* Boost icon: same treatment — colored only when enabled */}
        <button
          type="button"
          onClick={onOpenBoost}
          data-testid={`boost-toggle-mobile-${file.name}`}
          aria-label={`${translate(lang, "fileBoosterTitle")} ${file.name}`}
          title={translate(lang, "fileBoosterTitle")}
          className={`flex h-11 min-h-[44px] w-11 min-w-[44px] cursor-pointer items-center justify-center rounded-xl border transition-all focus-visible:outline-2 focus-visible:outline-orange-500 ${
            file.boostEnabled
              ? "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300"
              : "border-black/10 bg-transparent text-slate-600 hover:border-orange-400 hover:text-orange-600 dark:border-white/15 dark:text-[#CBD5E1]"
          }`}
        >
          <Volume2 className="h-4 w-4 shrink-0" strokeWidth={2.2} />
        </button>

        {/* Tiny range readout — plain text, no pill */}
        {hasTrim && (
          <span
            data-testid={`trim-chip-mobile-${file.name}`}
            className="text-[11px] font-semibold tabular-nums text-orange-600 dark:text-orange-300"
          >
            {trimLabel}
          </span>
        )}
      </div>
    </div>
  );
}


export function TrimBoostHint({ lang }: { lang: "en" | "fa" }): React.JSX.Element {
  const parts = translate(lang, "trimBoostHint").split("*");
  return (
    <p data-testid="trim-boost-hint" className="px-1 text-center text-sm font-medium leading-relaxed text-slate-600 dark:text-[#CBD5E1]">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-bold text-orange-600 dark:text-orange-400">
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

export function FileList(): React.JSX.Element | null {
  const files = useAppStore((s) => s.files);
  const lang = useAppStore((s) => s.lang);
  const clearFiles = useAppStore((s) => s.clearFiles);
  const addPaths = useAppStore((s) => s.addPaths);

  // Tracks active expanded row (desktop table accordion): path -> "trim" | "boost"
  const [activeExpanded, setActiveExpanded] = useState<{ path: string; mode: "trim" | "boost" } | null>(null);
  // Mobile bottom-sheet modal: path + editor mode (card itself stays minimal).
  const [mobileModal, setMobileModal] = useState<{ path: string; mode: "trim" | "boost" } | null>(null);

  if (files.length === 0) return null;

  const handleToggle = (path: string, mode: "trim" | "boost") => {
    setActiveExpanded((cur) => {
      if (cur?.path === path && cur?.mode === mode) return null;
      return { path, mode };
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile Card List (< md) */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">{translate(lang, "colFile")} ({files.length})</h2>
          <button
            onClick={clearFiles}
            className="flex items-center gap-1 text-xs font-semibold text-red-500/80 hover:text-red-500"
          >
            <Trash2 className="h-3 w-3" />
            <span>{translate(lang, "clearList")}</span>
          </button>
        </div>
        {files.map((f) => (
          <MobileFileCard
            key={f.path}
            file={f}
            onOpenTrim={() => setMobileModal({ path: f.path, mode: "trim" })}
            onOpenBoost={() => setMobileModal({ path: f.path, mode: "boost" })}
          />
        ))}
      </div>
      {(() => {
        const target = mobileModal ? files.find((f) => f.path === mobileModal.path) : undefined;
        if (!target || !mobileModal) return null;
        return (
          <MobileEditModal
            file={target}
            mode={mobileModal.mode}
            onClose={() => setMobileModal(null)}
          />
        );
      })()}

      {/* Desktop Table (>= md) */}
      <div className="glass-panel hidden overflow-hidden rounded-3xl md:block">
        <div className="flex items-center justify-between border-b border-black/[0.05] bg-black/[0.02] px-4 py-3 dark:border-white/[0.05] dark:bg-white/[0.02]">
          <h2 className="text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-200">{translate(lang, "colFile")} ({files.length})</h2>
          <button
            onClick={clearFiles}
            className="flex items-center gap-1 text-xs font-semibold text-red-500/80 hover:text-red-500"
          >
            <Trash2 className="h-3 w-3" />
            <span>{translate(lang, "clearList")}</span>
          </button>
        </div>
        <table className="w-full table-fixed" data-testid="file-list">
          <thead>
            <tr className="border-b border-black/[0.04] text-start text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:border-white/[0.04] dark:text-zinc-500">
              <th className="px-3 py-2 text-start font-semibold">{translate(lang, "colFile")}</th>
              <th className="w-20 px-3 py-2 text-start font-semibold">{translate(lang, "colSize")}</th>
              <th className="w-24 px-3 py-2 text-start font-semibold">{translate(lang, "colDuration")}</th>
              <th className="w-16 px-3 py-2 text-start font-semibold">{translate(lang, "colFormat")}</th>
              <th className="w-36 px-3 py-2 text-start font-semibold">{translate(lang, "trimRange")}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <FileRow
                key={f.path}
                file={f}
                expandedMode={activeExpanded?.path === f.path ? activeExpanded.mode : null}
                onToggleTrim={() => handleToggle(f.path, "trim")}
                onToggleBoost={() => handleToggle(f.path, "boost")}
              />
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => void pickVideos().then(addPaths)}
        data-testid="add-more"
        className="glass-card flex items-center justify-center gap-2 rounded-2xl py-3 text-xs font-semibold text-zinc-700 transition-all hover:scale-[1.01] hover:border-orange-500/50 hover:text-orange-500 active:scale-[0.99] dark:text-zinc-300 md:self-start md:px-5 md:py-2.5"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        <span>{translate(lang, "addFiles")}</span>
      </button>

      <TrimBoostHint lang={lang} />
    </div>
  );
}
