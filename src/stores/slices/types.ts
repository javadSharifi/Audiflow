import type { InputFile, QueueItem, AppSettings, ConversionOptions, AppTool } from "../../types";
import type { Lang } from "../../i18n";

export interface ToastMessage {
  id: number;
  kind: "error" | "info" | "warning";
  text: string;
}

export interface ToastSlice {
  toasts: ToastMessage[];
  pushToast: (kind: ToastMessage["kind"], text: string) => void;
  dismissToast: (id: number) => void;
}

export interface FileSlice {
  files: InputFile[];
  probing: boolean;

  addPaths: (paths: string[]) => Promise<void>;
  removeFile: (path: string) => void;
  clearFiles: () => void;
  setTrim: (path: string, field: "trimStartSecs" | "trimEndSecs", secs: number | null) => void;
  updateFileMeta: (
    path: string,
    patch: Partial<InputFile>,
  ) => void;
}

export interface QueueSlice {
  jobs: Map<string, QueueItem>;
  starting: boolean;

  startQueue: () => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  clearFinishedJobs: () => Promise<void>;
  initEventListeners: () => Promise<() => void>;
}

export interface SettingsSlice {
  settings: AppSettings | null;
  options: ConversionOptions;
  lang: Lang;
  theme: "light" | "dark" | "system";
  activeTool: AppTool;
  reducedBlur: boolean;

  setActiveTool: (tool: AppTool) => void;
  setReducedBlur: (enabled: boolean) => void;
  updateOptions: (patch: Partial<ConversionOptions>) => void;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  persistSettings: () => Promise<void>;
}

export type ConverterAppState = FileSlice & SettingsSlice & QueueSlice & ToastSlice;
