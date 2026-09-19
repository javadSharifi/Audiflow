# Interface Contract: Track Booster Sheet & Safe Speaker Protection

**Feature**: `009-nowplaying-booster-ux`
**Date**: 2026-09-19

## Component Contract: `TrackBoosterSheet`

### Props

```typescript
export interface TrackBoosterSheetProps {
  /** Controls visibility of the bottom sheet */
  isOpen: boolean;
  /** Invoked when the user requests closing the sheet */
  onClose: () => void;
}
```

### Behavior Matrix

| Action | State Before | State After | Hardware Stream Volume | UI Feedback |
| ------ | ------------ | ----------- | ---------------------- | ----------- |
| Tap "Speaker Protection" (`محافظت از اسپیکر`) | `gain > 100%` | `gain = 100%` | **Unchanged (No effect)** | Theme switches to emerald; preset 100% highlights; protection button disappears/fades |
| Tap Preset Chip (e.g. 150%) | `gain = 100%` | `gain = 150%` | Unchanged | Chip highlights in amber; audio boosts in real time; sheet stays open |
| Tap Preset Chip > 200% (e.g. 300%) | `gain = 100%`, unconfirmed | Shows confirmation dialog | Unchanged | Safety warning modal opens |
| Confirm High Boost Dialog | Modal open, target 300% | `gain = 300%`, confirmed | Unchanged | Modal closes; theme shifts to orange/rose; gain applied |
| Drag Gain Slider to 220% | `gain = 150%` | `gain = 220%` | Unchanged | Real-time percentage update; dynamic glow adjusts |
| Tap Backdrop or Close Button | Sheet open | `isOpen = false` | Unchanged | Sheet animates downward; active gain persists |

### Localization Contract

| Locale Key | English (`en`) | Persian (`fa`) |
| ---------- | -------------- | -------------- |
| `boosterProtectSpeaker` | "Protect Speaker" | "محافظت از اسپیکر" |
| `boosterNormalLevel` | "Standard (100%)" | "حالت عادی (۱۰۰٪)" |
| `boosterSheetTitle` | "Sound Booster" | "تقویت صدا (بوستر)" |
| `boosterAuditionHint` | "Tap to audition boost levels in real time" | "برای مقایسه آنی بلندی صدا ضربه بزنید" |
