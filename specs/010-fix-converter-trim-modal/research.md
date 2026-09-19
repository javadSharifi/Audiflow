# Research: Converter Modal Z-Index and Trim Editor Playback Fixes

## Problem 1: Converter Mobile Edit Modal Behind Bottom Navigation

### Context
In `src/components/FileList.tsx`, `MobileEditModal` renders via `createPortal(..., document.body)` with:
```tsx
<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
```
Meanwhile, the persistent bottom navigation in `src/components/music-player/MusicPlayerNav.tsx` has:
```tsx
<nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] w-fit ...">
```
Because `z-50` < `z-[55]`, the mobile bottom sheet modal is occluded and rendered behind the floating bottom dock.

### Decision
Elevate `MobileEditModal` container z-index to `z-[80]` (matching standard sheet layers in the app like `TrackBoosterSheet` and `TrackOptionsSheet`). Standard modals in the app use `z-[90]` and toasts use `z-[100]`.
Optionally, extract `MobileEditModal` into `src/components/MobileEditModal.tsx` to maintain Single Responsibility and reduce oversized line counts in `FileList.tsx`.

### Alternatives Considered
- *Hide `MusicPlayerNav` when modal is open*: Requires global state or prop drilling from `FileList` to `App.tsx`. Unnecessary when standard CSS stacking context via `z-[80]` solves it natively and cleanly.
- *Set z-index to arbitrary 9999*: Violates project stacking conventions (`z-[55]` nav < `z-[70]` now-playing < `z-[80]` sheets < `z-[90]` dialogs < `z-[100]` toasts).

---

## Problem 2: Trim Editor "Last 5s" (Previously 10s) Playback Stalling

### Context
In `src/components/TrimEditor.tsx`:
```tsx
const playPreviewRange = useCallback(
  (from: number, to: number) => {
    const a = audioRef.current;
    if (!a || !srcUrl) return;
    const cleanFrom = Math.max(0, Math.min(duration, from));
    const cleanTo = Math.max(cleanFrom, Math.min(duration, to));
    if (cleanTo - cleanFrom <= 0.01) return;

    previewEndRef.current = cleanTo;
    a.currentTime = cleanFrom;
    void a.play().catch(() => {});
  },
  [duration, srcUrl],
);
```
And in `onAudioTimeUpdate`:
```tsx
const onAudioTimeUpdate = useCallback(() => {
  const a = audioRef.current;
  if (!a || a.paused) return;
  const targetEnd = previewEndRef.current ?? (selEnd ?? duration);
  if (draggingRef.current == null && a.currentTime >= targetEnd) {
    a.pause();
    a.currentTime = targetEnd;
    previewEndRef.current = null;
  }
}, [duration, selEnd]);
```

### Root Cause Analysis
1. **Asynchronous Seek Race Condition**: Setting `a.currentTime = cleanFrom` invokes an asynchronous media seek. While seeking is underway (`a.seeking === true`), `a.currentTime` temporarily reports the previous playhead position (which may already be at `targetEnd` if previously played or ended).
2. **Immediate False Termination**: If `a.play()` starts while `a.currentTime` has not yet jumped to `cleanFrom`, `onAudioTimeUpdate` triggers, sees `a.currentTime >= targetEnd`, immediately pauses playback, and resets `previewEndRef.current = null`. The user hears nothing.
3. **End-of-Track Boundary**: When `cleanTo` equals the container duration, minor discrepancies between container duration and decoded audio duration can cause immediate `ended` events if the seek target is near or beyond decoded length.

### Decision
1. Introduce `previewStartRef.current = cleanFrom` alongside `previewEndRef.current = cleanTo`.
2. In `onAudioTimeUpdate`, skip boundary checks when:
   - `a.seeking` is true.
   - `a.currentTime < (previewStartRef.current ?? 0) - 0.5` (seek hasn't settled yet).
3. Reset `previewStartRef` and `previewEndRef` on `onEnded` or `onPause` where appropriate.
4. Bound `cleanTo` safely against `a.duration` if available.

---

## Problem 3: Changing Preview Snippets from 10s to 5s

### Context
User requested reducing preview duration from 10 seconds to 5 seconds.

### Decision
1. Update `previewFirst10` -> `previewFirst5` (`Math.min(start + 5, end)`).
2. Update `previewLast10` -> `previewLast5` (`Math.max(end - 5, start)`).
3. Update condition to display buttons from `duration >= 10.05` to `duration >= 5.05`.
4. Update i18n keys:
   - `trimCutFirst10` -> `trimCutFirst5`: "۵ ثانیه اول" / "First 5s"
   - `trimCutLast10` -> `trimCutLast5`: "۵ ثانیه آخر" / "Last 5s"

---

## Problem 4: Trim Editor Guide Text Layout

### Context
User clarified:
"کلن متن اون بالا رو پاک کن زیر اون نوار ی راهنمای کوچیک برای نوار بزار"

### Decision
1. In `TrimEditor.tsx`, remove the top `<p>{translate(lang, "trimTitle")}</p>`.
2. Directly beneath the waveform container (`wrapRef`), place a compact guide label:
   ```tsx
   <p className="text-center text-[11px] font-medium text-slate-500 dark:text-zinc-400">
     {translate(lang, "trimWaveformHint")}
   </p>
   ```
3. Add i18n keys to `src/i18n/fa.ts` and `src/i18n/en.ts`:
   - `fa.ts`: `trimWaveformHint: "برای شنیدن روی بخش نارنجی بزن"`
   - `en.ts`: `trimWaveformHint: "Tap the orange section to listen"`
