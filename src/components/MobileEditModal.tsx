import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { translate } from "../i18n";
import { TrimEditor } from "./TrimEditor";
import { FileBoosterInline } from "../features/sound-booster/file-booster/FileBoosterInline";
import type { InputFile } from "../types";

export interface MobileEditModalProps {
  file: InputFile;
  mode: "trim" | "boost";
  onClose: () => void;
}

/** Bottom-sheet modal (mobile) hosting the trim / boost editor for one file. */
export function MobileEditModal({
  file,
  mode,
  onClose,
}: MobileEditModalProps): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const title = mode === "trim" ? translate(lang, "trimEdit") : translate(lang, "fileBoosterTitle");

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title} ${file.name}`}
        onClick={(e) => e.stopPropagation()}
        data-testid={`mobile-edit-modal-${mode}`}
        className="glass-panel max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-4 pb-6 sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-800 dark:text-[#F8FAFC]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label={translate(lang, "close")}
            data-testid="mobile-edit-modal-close"
            className="flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-800 focus-visible:outline-2 focus-visible:outline-orange-500 dark:text-[#CBD5E1] dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
        {mode === "trim" ? (
          <TrimEditor key={`trim-modal-${file.path}`} file={file} />
        ) : (
          <FileBoosterInline key={`boost-modal-${file.path}`} file={file} />
        )}
      </div>
    </div>,
    document.body,
  );
}
