/**
 * Web Audio graph for the player: each <audio> element → its own gain
 * (volume + crossfade) → shared EQ chain → speakers.
 *
 * Built lazily on first EQ use: until then the elements play directly and
 * volume goes through `element.volume`. Once an element is routed into Web
 * Audio it cannot be un-routed, so from then on gain nodes carry the volume.
 */

export const EQ_FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_RANGE_DB = 12;

export const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  vocal: [-2, -2, -1, 0, 2, 4, 4, 2, 0, -1],
  treble: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  loudness: [5, 4, 2, 0, -1, 0, 0, 2, 4, 5],
} as const satisfies Record<string, readonly number[]>;
export type EqPreset = keyof typeof EQ_PRESETS;

interface Graph {
  ctx: AudioContext;
  gains: Map<HTMLMediaElement, GainNode>;
  bands: BiquadFilterNode[];
}

let graph: Graph | null = null;

function ensureGraph(elements: HTMLMediaElement[]): Graph {
  if (!graph) {
    const ctx = new AudioContext();
    const bands = EQ_FREQS.map((f, i) => {
      const b = ctx.createBiquadFilter();
      b.type = i === 0 ? "lowshelf" : i === EQ_FREQS.length - 1 ? "highshelf" : "peaking";
      b.frequency.value = f;
      b.Q.value = 1.1;
      return b;
    });
    for (let i = 1; i < bands.length; i++) bands[i - 1].connect(bands[i]);
    bands[bands.length - 1].connect(ctx.destination);
    graph = { ctx, gains: new Map(), bands };
  }
  for (const el of elements) {
    if (graph.gains.has(el)) continue;
    const g = graph.ctx.createGain();
    g.gain.value = el.volume;
    el.volume = 1;
    graph.ctx.createMediaElementSource(el).connect(g);
    g.connect(graph.bands[0]);
    graph.gains.set(el, g);
  }
  return graph;
}

/** Apply EQ gains (dB). Builds the graph on first non-flat call. */
export function setEq(elements: HTMLMediaElement[], enabled: boolean, gainsDb: readonly number[]): void {
  const active = enabled && gainsDb.some((g) => g !== 0);
  if (!graph && !active) return; // stay on the direct path while EQ was never used
  const g = ensureGraph(elements);
  g.bands.forEach((b, i) => (b.gain.value = active ? (gainsDb[i] ?? 0) : 0));
  void g.ctx.resume();
}

/** Set an element's output level (0..1), via its gain node once routed. */
export function setElementGain(el: HTMLMediaElement, v: number): void {
  const node = graph?.gains.get(el);
  if (node) node.gain.value = v;
  else el.volume = v;
}

/** Autoplay policy can suspend the context; call on every play(). */
export function resumeGraph(): void {
  if (graph?.ctx.state === "suspended") void graph.ctx.resume();
}

/** Equal-power crossfade levels for progress p ∈ [0, 1]. */
export function crossfadeLevels(p: number): { out: number; in: number } {
  const c = Math.min(1, Math.max(0, p));
  return { out: Math.cos((c * Math.PI) / 2), in: Math.sin((c * Math.PI) / 2) };
}
