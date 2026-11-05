export interface LyricWord {
  time: number;
  text: string;
}

export interface LyricLine {
  /** Seconds; null for unsynced (plain) lyrics. */
  time: number | null;
  text: string;
  /** Enhanced LRC word timings (`<mm:ss.xx>word`), when present. */
  words?: LyricWord[];
}

const TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const WORD_TAG = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/g;

const toSecs = (m: string, s: string) => Number(m) * 60 + Number(s.replace(":", "."));

/** Split an Enhanced LRC body into timed words (text before the first tag is dropped). */
function parseWords(body: string, offset: number): LyricWord[] | undefined {
  const tags = [...body.matchAll(WORD_TAG)];
  if (tags.length === 0) return undefined;
  const words: LyricWord[] = [];
  tags.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < tags.length ? (tags[i + 1].index ?? body.length) : body.length;
    const text = body.slice(start, end);
    if (text.trim()) words.push({ time: Math.max(0, toSecs(m[1], m[2]) - offset), text });
  });
  return words.length ? words : undefined;
}

/**
 * Parse LRC text. Handles multiple timestamps per line and `[offset:±ms]`.
 * Text without any timestamps comes back as unsynced lines (time = null).
 */
export function parseLrc(raw: string): LyricLine[] {
  const offsetMatch = raw.match(/\[offset:\s*([+-]?\d+)\]/i);
  // LRC offset: positive = lyrics shown earlier.
  const offset = offsetMatch ? Number(offsetMatch[1]) / 1000 : 0;
  const synced: LyricLine[] = [];
  const plain: LyricLine[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const stamps = [...line.matchAll(TIME_TAG)];
    const body = line.replace(TIME_TAG, "");
    const text = body.replace(WORD_TAG, "").replace(/\s+/g, " ").trim();
    if (stamps.length === 0) {
      // Skip metadata tags like [ar:...], [ti:...]
      if (text && !/^\[[a-z]+:.*\]$/i.test(text)) plain.push({ time: null, text });
      continue;
    }
    const words = parseWords(body, offset);
    for (const m of stamps) {
      const t = toSecs(m[1], m[2]) - offset;
      synced.push(words ? { time: Math.max(0, t), text, words } : { time: Math.max(0, t), text });
    }
  }

  if (synced.length === 0) return plain;
  return synced.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
}

/** Index of the line active at `t`, or -1 before the first line / when unsynced. */
export function activeLineIndex(lines: LyricLine[], t: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const lt = lines[i].time;
    if (lt === null) return -1;
    if (lt <= t) idx = i;
    else break;
  }
  return idx;
}

/** LRCLIB lookup (free, no key). Sends only artist, title and duration. */
export async function fetchOnlineLyrics(
  artist: string,
  title: string,
  durationSecs: number,
): Promise<string | null> {
  const q = new URLSearchParams({ artist_name: artist, track_name: title });
  if (durationSecs > 0) q.set("duration", String(Math.round(durationSecs)));
  const res = await fetch(`https://lrclib.net/api/get?${q}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`);
  const body = (await res.json()) as { syncedLyrics?: string | null; plainLyrics?: string | null };
  return body.syncedLyrics || body.plainLyrics || null;
}
