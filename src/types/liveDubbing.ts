export type DubbingSessionState =
  | "idle"
  | "starting"
  | "capturing"
  | "translating"
  | "speaking"
  | "paused"
  | "error";

export type VoicePersona = "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";

export interface LanguageProfile {
  code: string;
  nameEn: string;
  nameFa: string;
  flagEmoji: string;
  isRtl?: boolean;
}

export interface AudioDuckingConfig {
  enabled: boolean;
  duckingPercent: number;
  attackRampMs: number;
  releaseRampMs: number;
}

export interface FloatingOverlayConfig {
  enabled: boolean;
  snapToEdge: boolean;
  hapticFeedback: boolean;
  showHalo: boolean;
}

export interface LiveDubbingStatus {
  state: DubbingSessionState;
  targetLanguage: string;
  voicePersona: string;
  duckingPercent: number;
  isOverlayActive: boolean;
  latencyMs: number;
  bytesStreamed: number;
  errorMessage: string | null;
}
