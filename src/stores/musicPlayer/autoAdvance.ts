import type { AudioTrackInfo } from "../../types";

export type AdvanceRepeatMode = "off" | "all" | "one";

export type AdvanceOutcome =
  | { kind: "play"; track: AudioTrackInfo }
  | { kind: "repeatOne" }
  | { kind: "stop" };

export interface AdvanceGuard {
  arm(): number;
  isCurrent(gen: number): boolean;
}

export function createAdvanceGuard(): AdvanceGuard {
  let generation = 0;
  return {
    arm() {
      generation += 1;
      return generation;
    },
    isCurrent(gen) {
      return gen === generation;
    },
  };
}

export function trackKey(track: AudioTrackInfo): string {
  return track.id || track.uri || track.path || "";
}

export function isSameTrack(
  a: AudioTrackInfo | null,
  b: AudioTrackInfo | null,
): boolean {
  if (!a || !b) return false;
  return (
    (!!a.id && a.id === b.id) ||
    (!!a.uri && a.uri === b.uri) ||
    (!!a.path && a.path === b.path)
  );
}

export function findTrackIndex(
  list: AudioTrackInfo[],
  track: AudioTrackInfo | null,
): number {
  if (!track) return -1;
  return list.findIndex((t) => isSameTrack(t, track));
}

export interface ResolveNextArgs {
  list: AudioTrackInfo[];
  currentTrack: AudioTrackInfo | null;
  repeatMode: AdvanceRepeatMode;
  shuffleMode: boolean;
  excludeKeys?: ReadonlySet<string>;
  random?: () => number;
}

export function resolveNextTrack(args: ResolveNextArgs): AdvanceOutcome {
  const { list, currentTrack, repeatMode, shuffleMode } = args;
  const excludeKeys = args.excludeKeys ?? new Set<string>();
  const random = args.random ?? Math.random;

  const playable = list.filter((t) => !excludeKeys.has(trackKey(t)));
  if (playable.length === 0) return { kind: "stop" };

  if (repeatMode === "one" && currentTrack && !excludeKeys.has(trackKey(currentTrack))) {
    return { kind: "repeatOne" };
  }

  if (shuffleMode) {
    const others = playable.filter((t) => !isSameTrack(t, currentTrack));
    const pool = others.length > 0 ? others : playable;
    return { kind: "play", track: pool[Math.floor(random() * pool.length)] };
  }

  const currentIndex = findTrackIndex(list, currentTrack);
  for (let i = currentIndex + 1; i < list.length; i++) {
    if (!excludeKeys.has(trackKey(list[i]))) return { kind: "play", track: list[i] };
  }
  if (repeatMode === "all") {
    for (let i = 0; i <= currentIndex; i++) {
      if (!excludeKeys.has(trackKey(list[i]))) return { kind: "play", track: list[i] };
    }
  }
  return { kind: "stop" };
}

const unplayableKeys = new Set<string>();

export function noteUnplayable(key: string): void {
  if (key) unplayableKeys.add(key);
}

export function clearUnplayable(key: string): void {
  unplayableKeys.delete(key);
}

export function isUnplayable(key: string): boolean {
  return unplayableKeys.has(key);
}

export function clearAllUnplayable(): void {
  unplayableKeys.clear();
}

/** Live read-only view of the session skip-set for queue resolution. */
export function snapshotUnplayableKeys(): ReadonlySet<string> {
  return unplayableKeys;
}
