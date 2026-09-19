import { useEffect, useMemo, useState } from "react";
import { Check, FolderOpen, TriangleAlert } from "lucide-react";
import { translate, type Lang } from "../../i18n";
import { useAppStore } from "../../stores/useAppStore";
import { formatBytes } from "../../utils/format";
import { statMediaPaths } from "../../utils/tauri";

interface SuccessRow {
  kind: "ok";
  outputPath: string;
  name: string;
  format: string;
  folder: string;
  sizeBytes: number | null;
}

interface ErrorRow {
  kind: "error";
  key: string;
  name: string;
  error: string | null;
}

function dirOf(path: string): string {
  return path.replace(/[\\/][^\\/]+$/, "");
}

export function WizardResultList({ lang }: { lang: Lang }): React.JSX.Element {
  const jobs = useAppStore((s) => s.jobs);
  const [sizes, setSizes] = useState<Record<string, number | null>>({});

  const { okOutputs, errorRows, folders } = useMemo(() => {
    const list = Array.from(jobs.values());
    const outs = [...new Set(list.filter((j) => j.status === "completed").flatMap((j) => j.outputs))];
    const errs: ErrorRow[] = list
      .filter((j) => j.status === "failed")
      .map((j) => ({
        kind: "error" as const,
        key: j.id,
        name: j.sourcePath.split(/[\\/]/).pop() ?? j.sourcePath,
        error: j.error,
      }));
    const ok: SuccessRow[] = outs.map((o) => {
      const name = o.split(/[\\/]/).pop() ?? o;
      const ext = name.includes(".") ? (name.split(".").pop() ?? "").toUpperCase() : "";
      return { kind: "ok" as const, outputPath: o, name, format: ext, folder: dirOf(o), sizeBytes: null };
    });
    return { okOutputs: ok, errorRows: errs, folders: [...new Set(ok.map((o) => o.folder))] };
  }, [jobs]);

  useEffect(() => {
    const paths = okOutputs.map((o) => o.outputPath);
    if (paths.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when there is nothing to stat
      setSizes({});
      return;
    }
    let cancelled = false;
    void statMediaPaths(paths)
      .then((stats) => {
        if (cancelled) return;
        const map: Record<string, number | null> = {};
        for (const s of stats) map[s.input] = s.sizeBytes;
        setSizes(map);
      })
      .catch(() => {
        if (!cancelled) setSizes({});
      });
    return () => {
      cancelled = true;
    };
  }, [jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (okOutputs.length === 0 && errorRows.length === 0) {
    return (
      <p className="py-4 text-center text-xs font-medium text-zinc-400 dark:text-zinc-500" data-testid="wizard-result-list">
        {translate(lang, "converterResultEmpty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="wizard-result-list">
      {folders.map((folder) => (
        <div
          key={folder}
          data-testid="result-folder-banner"
          className="glass-card flex items-start gap-2.5 rounded-3xl p-3.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <FolderOpen className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
              {translate(lang, "resultFolderGuidance")}
            </span>
            <span className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100" title={folder}>
              {folder}
            </span>
          </span>
        </div>
      ))}

      <ul className="flex flex-col gap-2">
        {okOutputs.map((row, i) => {
          const size = sizes[row.outputPath] ?? null;
          return (
            <li
              key={row.outputPath}
              data-testid={`result-row-${i}`}
              className="glass-card flex items-center gap-2.5 rounded-3xl p-3.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100" title={row.outputPath}>
                  {row.name}
                </span>
                <span className="text-[11px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                  {translate(lang, "resultDoneMessage")}
                  {row.format ? ` · ${row.format}` : ""}
                  {size != null ? ` · ${formatBytes(size)}` : ""}
                </span>
              </span>
            </li>
          );
        })}
        {errorRows.map((row, i) => (
          <li
            key={row.key}
            data-testid={`result-error-${i}`}
            className="glass-card flex items-center gap-2.5 rounded-3xl border-red-500/20 p-3.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
              <TriangleAlert className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">
                {row.name}
              </span>
              <span className="truncate text-[11px] font-medium text-red-500" title={row.error ?? undefined}>
                {translate(lang, "resultFailedLabel")}
                {row.error ? ` · ${row.error}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
