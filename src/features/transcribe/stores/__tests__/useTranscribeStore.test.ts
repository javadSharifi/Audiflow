import { describe, it, expect, beforeEach } from "vitest";
import { useTranscribeStore } from "../useTranscribeStore";

beforeEach(() => {
  useTranscribeStore.setState({
    file: null,
    language: "fa-IR",
    mode: "verbatim",
    diarization: false,
    timestamps: false,
    fastMode: false,
    customVocab: [],
    jobId: null,
    jobStatus: null,
    jobPercent: null,
    result: null,
  });
});

describe("useTranscribeStore", () => {
  it("forces fast mode off when detailed outputs turn on", () => {
    const s = useTranscribeStore.getState();
    s.setFastMode(true);
    expect(useTranscribeStore.getState().fastMode).toBe(true);
    s.setDiarization(true);
    expect(useTranscribeStore.getState().fastMode).toBe(false);
    s.setFastMode(true);
    s.setTimestamps(true);
    expect(useTranscribeStore.getState().fastMode).toBe(false);
  });

  it("caps vocabulary at 100 unique terms", () => {
    const s = useTranscribeStore.getState();
    for (let i = 0; i < 105; i++) s.addVocabTerm(`term-${i}`);
    expect(useTranscribeStore.getState().customVocab.length).toBe(100);
    s.addVocabTerm("term-0");
    expect(useTranscribeStore.getState().customVocab.length).toBe(100);
    s.removeVocabTerm("term-0");
    expect(useTranscribeStore.getState().customVocab.length).toBe(99);
  });

  it("resetJob clears job state but keeps options", () => {
    const s = useTranscribeStore.getState();
    s.setLanguage("en-US");
    s.setJobId("tx-1");
    s.setJobProgress("uploading", 42);
    s.resetJob();
    const after = useTranscribeStore.getState();
    expect(after.jobId).toBeNull();
    expect(after.result).toBeNull();
    expect(after.language).toBe("en-US");
  });
});
