import { useState } from "react";
import type React from "react";
import { Key, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAppStore } from "../../stores/useAppStore";
import { translate } from "../../i18n";

export function ApiKeyCard(): React.JSX.Element {
  const lang = useAppStore((s) => s.lang);
  const apiKey = useAppStore((s) => s.apiKey);
  const isKeyValid = useAppStore((s) => s.isKeyValid);
  const isTestingKey = useAppStore((s) => s.isTestingKey);
  const setApiKey = useAppStore((s) => s.setApiKey);
  const testApiKey = useAppStore((s) => s.testApiKey);
  const saveApiKey = useAppStore((s) => s.saveApiKey);
  const [showKey, setShowKey] = useState(false);

  const handleTestAndSave = async () => {
    const valid = await testApiKey();
    if (valid) {
      await saveApiKey();
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/60 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          <Key className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {translate(lang, "liveDubbingApiKey")}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Google AI Studio • Encrypted in OS Keychain
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={translate(lang, "liveDubbingApiKeyPlaceholder")}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-sm text-zinc-900 focus:border-teal-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2.5 top-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rtl:right-auto rtl:left-2.5"
          >
            {showKey ? "Hide" : "Show"}
          </button>
        </div>

        <button
          type="button"
          disabled={isTestingKey || !apiKey.trim()}
          onClick={handleTestAndSave}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-600 disabled:opacity-50"
        >
          {isTestingKey ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            translate(lang, "liveDubbingTestKey")
          )}
        </button>
      </div>

      {isKeyValid === true && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          <span>{translate(lang, "liveDubbingKeyValid")}</span>
        </div>
      )}

      {isKeyValid === false && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          <span>{translate(lang, "liveDubbingKeyInvalid")}</span>
        </div>
      )}
    </div>
  );
}
