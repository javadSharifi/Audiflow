import { useState, useMemo } from "react";
import type React from "react";
import { Search, X, Check, Globe } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";
import { SUPPORTED_LANGUAGES } from "./languages";

interface LanguagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LanguagePickerModal({ isOpen, onClose }: LanguagePickerModalProps): React.JSX.Element | null {
  const lang = useAppStore((s) => s.lang);
  const targetLanguage = useAppStore((s) => s.targetLanguage);
  const setTargetLanguage = useAppStore((s) => s.setTargetLanguage);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.nameEn.toLowerCase().includes(q) ||
        l.nameFa.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Globe className="h-5 w-5 text-teal-500" />
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {translate(lang, "liveDubbingTargetLanguage")} (78)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-zinc-100 p-3 dark:border-zinc-800/60">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 rtl:left-auto rtl:right-3" />
            <input
              type="text"
              data-testid="language-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={translate(lang, "liveDubbingSearchLanguage")}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-4 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 rtl:pl-4 rtl:pr-9"
              autoFocus
            />
          </div>
        </div>

        {/* Language List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {filtered.map((item) => {
              const isSelected = targetLanguage === item.code;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setTargetLanguage(item.code);
                    onClose();
                  }}
                  className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSelected
                      ? "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-xl">{item.flagEmoji}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {lang === "fa" ? item.nameFa : item.nameEn}
                      </span>
                      <span className="text-[10px] text-zinc-400 uppercase">
                        {item.code}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-teal-500" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
