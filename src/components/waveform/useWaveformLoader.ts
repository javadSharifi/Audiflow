import { useEffect, useRef, useState } from "react";
import type { WaveformPeak } from "./types";
import { safeConvertFileSrc, getPlayableAudioUrlSync } from "./audioSource";
import { isAndroid, isLinux } from "../../utils/platform";
import {
  resolveScopedBlobAudioSrc,
  type BlobAudioHandle,
} from "../../stores/musicPlayer/linuxAssetAudio";
import * as api from "../../utils/tauri";

export interface UseWaveformLoaderOptions {
  path: string;
  durationSecs: number;
  syntheticFallback?: boolean;
  onDurationProbed?: (probedDuration: number) => void;
}

export function useWaveformLoader(options: UseWaveformLoaderOptions) {
  const { path, durationSecs, syntheticFallback = false, onDurationProbed } = options;

  const onDurationProbedRef = useRef(onDurationProbed);
  useEffect(() => {
    onDurationProbedRef.current = onDurationProbed;
  }, [onDurationProbed]);

  const [peaks, setPeaks] = useState<WaveformPeak[] | null>(null);
  const [waveErr, setWaveErr] = useState(false);
  const [srcUrl, setSrcUrl] = useState<string | null>(() => getPlayableAudioUrlSync(path));
  const [probedDur, setProbedDur] = useState(0);

  const blobHandleRef = useRef<BlobAudioHandle | null>(null);
  const duration = probedDur > 0 ? probedDur : durationSecs;

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset of waveform state when a new file is loaded
    setPeaks(null);
    setWaveErr(false);
    setSrcUrl(getPlayableAudioUrlSync(path));

    const prepare = async () => {
      let localPath = path;

      if (isAndroid() && path.startsWith("content://")) {
        try {
          const res = await api.resolveMediaPaths([path]);
          const resolved = res[0]?.resolved;
          if (resolved && !resolved.startsWith("STAGE_ERROR")) {
            localPath = resolved;
          }
        } catch {
          /* ignore */
        }
      }

      if (!alive) return;

      // Android: unknown duration (SAF documents) → probe the staged file
      if (isAndroid() && durationSecs <= 0 && localPath !== path) {
        try {
          const metas = await api.probeFiles([localPath]);
          const m = metas[0];
          if (m && !m.error && (m.durationSecs ?? 0) > 0 && alive) {
            const probed = m.durationSecs ?? 0;
            setProbedDur(probed);
            onDurationProbedRef.current?.(probed);
          }
        } catch {
          /* keep 0 */
        }
      }
      if (!alive) return;

      const peakCount = Math.max(200, Math.min(1600, Math.round(duration * 35)));

      if (localPath) {
        api
          .waveformPeaks(localPath, peakCount)
          .then((p) => {
            if (!alive) return;
            if (p && p.length > 0) {
              setPeaks(p);
            } else if (syntheticFallback) {
              setPeaks(generateSyntheticPeaks(100));
            }
          })
          .catch(() => {
            if (!alive) return;
            if (syntheticFallback) {
              setPeaks(generateSyntheticPeaks(100));
            } else {
              setWaveErr(true);
            }
          });
      } else if (syntheticFallback) {
        setPeaks(generateSyntheticPeaks(100));
      }

      if (!alive) return;

      if (isAndroid() && localPath.startsWith("content://")) {
        setSrcUrl(null);
      } else {
        const assetUrl = safeConvertFileSrc(localPath);
        if (!isLinux()) {
          setSrcUrl(assetUrl);
        } else {
          const handle = await resolveScopedBlobAudioSrc(assetUrl);
          if (!alive) {
            handle?.revoke();
            return;
          }
          blobHandleRef.current?.revoke();
          blobHandleRef.current = handle;
          setSrcUrl(handle ? handle.url : assetUrl);
        }
      }
    };

    void prepare();
    return () => {
      alive = false;
      blobHandleRef.current?.revoke();
      blobHandleRef.current = null;
    };
  }, [path, durationSecs, duration, syntheticFallback]);

  return {
    peaks,
    waveErr,
    srcUrl,
    setSrcUrl,
    duration,
  };
}

function generateSyntheticPeaks(count: number): WaveformPeak[] {
  const synth: WaveformPeak[] = [];
  for (let i = 0; i < count; i++) {
    const v = 0.25 + 0.7 * Math.abs(Math.sin(i * 0.16) * Math.cos(i * 0.08));
    synth.push([-v, v]);
  }
  return synth;
}
