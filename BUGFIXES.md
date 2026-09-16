# Bug fix log

Keep every row concise. Bug, Root Cause, and Fix should each fit on one line.

| Date | Bug | Root Cause | Fix | Files |
| ---- | --- | ---------- | --- | ----- |
| 2026-09-16 | Song end sometimes never advances; corrupt file or queue end froze player on stale "playing" | Single `ended` listener with no fallback/guard; failures only cleared `isPlaying`; silent early-return at queue end | Guarded redundant end detection (ended+watchdog, single-fire token), `resolveNextTrack` with explicit stop, session skip-set + notice for unplayable files | `musicPlayer/autoAdvance.ts` (new), `audioEngine.ts`, `useMusicPlayerStore.ts`, `i18n/en.ts`, `i18n/fa.ts` |
