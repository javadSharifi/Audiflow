# Contract: Modal Layering & Trim Playback Controls

## 1. UI Layering & Stacking Contract

| Component | Layer Class | Role | Description |
|-----------|-------------|------|-------------|
| `MusicPlayerNav` | `z-[55]` | Navigation Dock | Floating pill at the bottom of the screen. |
| `MobileEditModal` | `z-[80]` (upgraded from `z-50`) | Bottom-sheet Editor | Sits above navigation dock and covers screen backdrop. |
| `NowPlayingView` | `z-[70]` | Fullscreen Player | Beneath edit sheets. |
| `Toasts` | `z-[100]` | Toast Notifications | System alerts that sit above all modals. |

## 2. Audio Snippet Calculation Contract

Given an audio duration $D \ge 5.05$, a selection start $S \ge 0$, and a selection end $E \le D$ (where $E > S$):

### First 5 Seconds Preview:
$$\text{from} = S$$
$$\text{to} = \min(S + 5.0, E)$$

### Last 5 Seconds Preview:
$$\text{from} = \max(E - 5.0, S)$$
$$\text{to} = E$$

### Visibility Condition:
$$\text{ShowButtons} \iff D \ge 5.05$$

## 3. i18n Localization Contract

| Key | Persian (`fa.ts`) | English (`en.ts`) | Description |
|-----|-------------------|-------------------|-------------|
| `trimCutFirst5` | `"۵ ثانیه اول"` | `"First 5s"` | Button text for auditioning start |
| `trimCutLast5` | `"۵ ثانیه آخر"` | `"Last 5s"` | Button text for auditioning end |
| `trimCutFirst5Tip` | `"پیش‌نمایش ۵ ثانیه اول بازه انتخاب‌شده"` | `"Preview first 5s of selection"` | Tooltip for first 5s button |
| `trimCutLast5Tip` | `"پیش‌نمایش ۵ ثانیه آخر بازه انتخاب‌شده"` | `"Preview last 5s of selection"` | Tooltip for last 5s button |
| `trimWaveformHint` | `"برای شنیدن روی بخش نارنجی بزن"` | `"Tap the orange section to listen"` | Sub-waveform compact guide |
