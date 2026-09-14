import { useCallback, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTranscribeStore } from "../stores/useTranscribeStore";
import { useAppStore } from "../../../stores/useAppStore";
import * as api from "../../../utils/tauri";
import { geminiKindOf } from "../../../utils/tauri";
import { pickVideos } from "../../../utils/dialog";
import type { TranscriptionEvent, TranscriptionRequestConfig } from "../../../types";

export function useTranscribe() {
  const store = useTranscribeStore();
  const activeJobIdRef = useRef<string | null>(null);

  // ---- init: key presence, usage, persisted defaults -------------------------
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [has, usage, settings] = await Promise.all([
          api.hasGeminiApiKey(),
          api.getUsageStats(),
          api.getSettings(),
        ]);
        if (cancelled) return;
        const s = useTranscribeStore.getState();
        s.setHasKey(has);
        s.setUsage(usage);
        const t = settings.transcribe;
        if (t) {
          if (typeof t.defaultLanguage === "string") s.setLanguage(t.defaultLanguage);
          if (t.defaultMode === "verbatim" || t.defaultMode === "smart") s.setMode(t.defaultMode);
          if (typeof t.fastModeDefault === "boolean") s.setFastMode(t.fastModeDefault);
          s.setConsentAccepted(t.consentAccepted === true);
        }
      } catch {
        if (!cancelled) useTranscribeStore.getState().setHasKey(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- transcription-event, strictly filtered by captured job id -------------
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    void listen<TranscriptionEvent>("transcription-event", (event) => {
      const ev = event.payload;
      if (!activeJobIdRef.current || ev.id !== activeJobIdRef.current) return;
      const s = useTranscribeStore.getState();
      const app = useAppStore.getState();
      if (ev.status === "completed") {
        s.setJobProgress("completed", 100);
        s.setResult(ev.result);
        activeJobIdRef.current = null;
        app.pushToast("info", "transcribeDone");
        void api.getUsageStats().then((u) => useTranscribeStore.getState().setUsage(u));
      } else if (ev.status === "failed") {
        s.setJobFailed(ev.errorKind ?? null, ev.error, ev.technical);
        activeJobIdRef.current = null;
        app.pushToast("error", "transcribeFailed");
      } else if (ev.status === "cancelled") {
        s.resetJob();
        activeJobIdRef.current = null;
      } else {
        s.setJobProgress(ev.status, ev.percent ?? null);
      }
    }).then((fn) => (unlisten = fn));
    return () => {
      unlisten?.();
    };
  }, []);

  const verifyAndSave = useCallback(async (rawKey: string) => {
    const s = useTranscribeStore.getState();
    const key = rawKey.trim();
    if (!key) return;
    s.setVerifying(true);
    s.setKeyError(null, null);
    s.setKeyJustSaved(false);
    try {
      await api.validateGeminiApiKey(key);
      await api.saveGeminiApiKey(key);
      s.setHasKey(true);
      s.setKeyJustSaved(true);
    } catch (err) {
      s.setKeyError(geminiKindOf(err), err instanceof Error ? err.message : String(err));
    } finally {
      s.setVerifying(false);
    }
  }, []);

  const clearKey = useCallback(async () => {
    try {
      await api.clearGeminiApiKey();
    } catch {}
    const s = useTranscribeStore.getState();
    s.setHasKey(false);
    s.setKeyJustSaved(false);
  }, []);

  const pickFile = useCallback(async () => {
    try {
      const paths = await pickVideos();
      if (paths.length === 0) return;
      const stats = await api.statMediaPaths([paths[0]]);
      const st = stats[0];
      if (!st) return;
      useTranscribeStore.getState().setFile({
        path: st.input,
        name: st.name,
        sizeBytes: st.sizeBytes,
        durationSecs: st.durationSecs ?? 0,
      });
    } catch (e) {
      console.error("transcribe pick failed:", e);
    }
  }, []);

  const buildConfig = useCallback((): TranscriptionRequestConfig => {
    const s = useTranscribeStore.getState();
    const detailed = s.diarization || s.timestamps;
    return {
      languageCodes: s.language === "" ? [] : [s.language],
      mode: s.mode,
      diarizationEnabled: s.diarization,
      timestampsEnabled: s.timestamps,
      customVocabulary: detailed ? [] : s.customVocab,
      fastMode: detailed ? false : s.fastMode,
    };
  }, []);

  const acceptConsent = useCallback(() => {
    const app = useAppStore.getState();
    const s = useTranscribeStore.getState();
    s.setConsentAccepted(true);
    s.setShowConsent(false);
    const settings = app.settings;
    if (settings) {
      void (async () => {
        try {
          app.updateSettings({
            transcribe: { ...settings.transcribe, consentAccepted: true },
          });
          await app.persistSettings();
        } catch {}
      })();
    }
  }, []);

  const start = useCallback(async () => {
    const s = useTranscribeStore.getState();
    if (!s.file || s.jobStatus === "preprocessing" || s.jobStatus === "uploading" || s.jobStatus === "transcribing" || s.jobStatus === "waiting") return;
    if (!s.consentAccepted) {
      s.setShowConsent(true);
      return;
    }
    s.resetJob();
    try {
      const jobId = await api.startTranscription(s.file.path, buildConfig());
      activeJobIdRef.current = jobId;
      s.setJobId(jobId);
      s.setJobProgress("waiting", 0);
    } catch (err) {
      s.setJobFailed(geminiKindOf(err), err instanceof Error ? err.message : String(err), null);
      useAppStore.getState().pushToast("error", "transcribeFailed");
    }
  }, [buildConfig]);

  const cancel = useCallback(() => {
    const s = useTranscribeStore.getState();
    if (s.jobId) void api.cancelTranscription(s.jobId);
  }, []);

  const exportAs = useCallback(async (format: "txt" | "srt" | "vtt") => {
    const s = useTranscribeStore.getState();
    if (!s.jobId || !s.result) return;
    s.setExporting(format);
    s.setExportError(null);
    try {
      const path = await api.exportTranscript(s.jobId, format);
      s.setExported(path);
      useAppStore.getState().pushToast("info", "transcribeExported");
    } catch (err) {
      s.setExportError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const copyTranscript = useCallback(async (): Promise<boolean> => {
    const text = useTranscribeStore.getState().result?.fullText;
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { ...store, verifyAndSave, clearKey, pickFile, start, cancel, exportAs, copyTranscript, acceptConsent, buildConfig };
}
