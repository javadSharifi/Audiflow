import { create } from "zustand";
import type {
  GeminiErrorKind,
  TranscriptionMode,
  TranscriptionResult,
  TranscriptionStatus,
  UsageStats,
} from "../../../types";

export interface TranscribeFile {
  path: string;
  name: string;
  sizeBytes: number;
  durationSecs: number;
}

export type ExportFormat = "txt" | "srt" | "vtt";

interface TranscribeState {
  file: TranscribeFile | null;
  /** null = not checked yet (shows nothing until init resolves). */
  hasKey: boolean | null;
  verifying: boolean;
  keyErrorKind: GeminiErrorKind | null;
  keyErrorMessage: string | null;
  keyJustSaved: boolean;

  /** "" = auto-detect. */
  language: string;
  mode: TranscriptionMode;
  diarization: boolean;
  timestamps: boolean;
  fastMode: boolean;
  customVocab: string[];

  consentAccepted: boolean;
  showConsent: boolean;

  jobId: string | null;
  jobStatus: TranscriptionStatus | null;
  jobPercent: number | null;
  jobErrorKind: GeminiErrorKind | null;
  jobErrorMessage: string | null;
  jobTechnical: string | null;
  result: TranscriptionResult | null;

  usage: UsageStats | null;

  exporting: ExportFormat | null;
  exportedPath: string | null;
  exportError: string | null;
}

interface TranscribeActions {
  setFile: (file: TranscribeFile | null) => void;
  setHasKey: (v: boolean) => void;
  setVerifying: (v: boolean) => void;
  setKeyError: (kind: GeminiErrorKind | null, msg: string | null) => void;
  setKeyJustSaved: (v: boolean) => void;
  setLanguage: (v: string) => void;
  setMode: (v: TranscriptionMode) => void;
  setDiarization: (v: boolean) => void;
  setTimestamps: (v: boolean) => void;
  setFastMode: (v: boolean) => void;
  addVocabTerm: (term: string) => void;
  removeVocabTerm: (term: string) => void;
  setConsentAccepted: (v: boolean) => void;
  setShowConsent: (v: boolean) => void;
  setJobProgress: (status: TranscriptionStatus, percent: number | null) => void;
  setJobFailed: (kind: GeminiErrorKind | null, msg: string | null, technical: string | null) => void;
  setJobId: (id: string | null) => void;
  setResult: (r: TranscriptionResult | null) => void;
  setUsage: (u: UsageStats | null) => void;
  setExporting: (f: ExportFormat | null) => void;
  setExported: (path: string | null) => void;
  setExportError: (msg: string | null) => void;
  resetJob: () => void;
}

const initialJob = {
  jobId: null as string | null,
  jobStatus: null as TranscriptionStatus | null,
  jobPercent: null as number | null,
  jobErrorKind: null as GeminiErrorKind | null,
  jobErrorMessage: null as string | null,
  jobTechnical: null as string | null,
  result: null as TranscriptionResult | null,
  exporting: null as ExportFormat | null,
  exportedPath: null as string | null,
  exportError: null as string | null,
};

export const useTranscribeStore = create<TranscribeState & TranscribeActions>((set) => ({
  file: null,
  hasKey: null,
  verifying: false,
  keyErrorKind: null,
  keyErrorMessage: null,
  keyJustSaved: false,

  language: "fa-IR",
  mode: "verbatim",
  diarization: false,
  timestamps: false,
  fastMode: false,
  customVocab: [],

  consentAccepted: false,
  showConsent: false,

  ...initialJob,
  usage: null,

  setFile: (file) => set({ file, ...initialJob }),
  setHasKey: (hasKey) => set({ hasKey }),
  setVerifying: (verifying) => set({ verifying }),
  setKeyError: (keyErrorKind, keyErrorMessage) => set({ keyErrorKind, keyErrorMessage }),
  setKeyJustSaved: (keyJustSaved) => set({ keyJustSaved }),
  setLanguage: (language) => set({ language }),
  setMode: (mode) => set({ mode }),
  // Fast mode is incompatible with detailed outputs: enabling either side
  // forces fast mode off (UI also grays the toggle out).
  setDiarization: (diarization) =>
    set((s) => ({ diarization, fastMode: diarization ? false : s.fastMode })),
  setTimestamps: (timestamps) =>
    set((s) => ({ timestamps, fastMode: timestamps ? false : s.fastMode })),
  setFastMode: (fastMode) => set({ fastMode }),
  addVocabTerm: (term) =>
    set((s) => {
      const t = term.trim();
      if (!t || t.length > 100 || s.customVocab.includes(t) || s.customVocab.length >= 100) return {};
      return { customVocab: [...s.customVocab, t] };
    }),
  removeVocabTerm: (term) => set((s) => ({ customVocab: s.customVocab.filter((t) => t !== term) })),
  setConsentAccepted: (consentAccepted) => set({ consentAccepted }),
  setShowConsent: (showConsent) => set({ showConsent }),
  setJobProgress: (jobStatus, jobPercent) => set({ jobStatus, jobPercent }),
  setJobFailed: (jobErrorKind, jobErrorMessage, jobTechnical) =>
    set({ jobStatus: "failed", jobErrorKind, jobErrorMessage, jobTechnical, jobPercent: null }),
  setJobId: (jobId) => set({ jobId }),
  setResult: (result) => set({ result }),
  setUsage: (usage) => set({ usage }),
  setExporting: (exporting) => set({ exporting }),
  setExported: (exportedPath) => set({ exportedPath, exporting: null, exportError: null }),
  setExportError: (exportError) => set({ exportError, exporting: null }),
  resetJob: () => set({ ...initialJob }),
}));
