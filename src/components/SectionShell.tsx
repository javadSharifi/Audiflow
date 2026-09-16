import React from "react";
import { translate, type Lang } from "../i18n";

interface SectionShellProps {
  step: number;
  titleKey: Parameters<typeof translate>[1];
  lang: Lang;
  testId: string;
  state: string;
  children: React.ReactNode;
}

export function SectionShell({ step, titleKey, lang, testId, state, children }: SectionShellProps): React.JSX.Element {
  return (
    <section
      data-testid={testId}
      data-state={state}
      aria-label={`${step}. ${translate(lang, titleKey)}`}
      className="flex flex-col gap-4 rounded-3xl border border-black/[0.08] bg-white/85 p-5 shadow-sm backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/85"
    >
      <header className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-xs font-black text-white shadow-md shadow-orange-500/25">
          {step}
        </span>
        <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
          {translate(lang, titleKey)}
        </h2>
      </header>
      {children}
    </section>
  );
}
