import type {
  DownloadItem,
  DownloadRequest,
  DownloadStatus,
  MusicSearchResult,
  MusicSource,
  YtDlpInfo,
} from "./generated";

export type {
  DownloadItem,
  DownloadRequest,
  DownloadStatus,
  MusicSearchResult,
  MusicSource,
  YtDlpInfo,
};

export interface DownloadProgressEvent {
  id: string;
  percent: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSecs?: number;
  status: DownloadStatus;
  error?: string | null;
}
