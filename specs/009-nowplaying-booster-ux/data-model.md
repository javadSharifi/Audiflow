# Data Model: Track Booster UI/UX & Safe Protection

**Feature**: `009-nowplaying-booster-ux`
**Date**: 2026-09-19

## Entities & Types

### 1. `TrackBoosterProps`

Interface for the extracted `TrackBoosterSheet` presentation component:

| Prop | Type | Description |
| ---- | ---- | ----------- |
| `isOpen` | `boolean` | Whether the bottom sheet is currently open and visible. |
| `onClose` | `() => void` | Callback invoked to close the sheet (backdrop tap, close button, swipe down). |

### 2. `BoostPresetItem`

Configuration model for quick-selection pills:

```typescript
export interface BoostPresetItem {
  value: number; // 100, 150, 200, 300, 400
  label: string; // "100%", "150%", "200%", "300%", "400%"
  isExtreme?: boolean; // true for values > 200% requiring safety confirmation
}
```

Predefined preset list:
```typescript
export const TRACK_BOOST_PRESETS: readonly BoostPresetItem[] = [
  { value: 100, label: "100%" },
  { value: 150, label: "150%" },
  { value: 200, label: "200%" },
  { value: 300, label: "300%", isExtreme: true },
  { value: 400, label: "400%", isExtreme: true },
];
```

### 3. `BoostTierTheme`

Dynamic styling attributes calculated from `volumeGainPercent`:

```typescript
export interface BoostTierTheme {
  accent: string;      // Hex color for buttons, slider thumbs, text
  glow: string;        // Box-shadow / glow string
  badgeBg: string;     // Tailwind class string for the tier badge
  iconClass: string;   // Tailwind animation / color classes
}
```

Tier breakdown:
- **Normal (100%)**: Emerald (`#10b981`), `rgba(16, 185, 129, 0.2)`
- **Moderate (101%–175%)**: Amber (`#f59e0b`), `rgba(245, 158, 11, 0.25)`
- **High (176%–250%)**: Orange (`#f97316`), `rgba(249, 115, 22, 0.3)`
- **Extreme (251%–400%)**: Rose (`#ef4444`), `rgba(239, 68, 68, 0.4)`

### 4. State Management (Zustand Store Integration)

Component interacts with existing store slices:

- **State consumed**:
  - `volumeGainPercent: number` (from `useMusicPlayerStore`)
  - `lang: "en" | "fa"` (from `useAppStore`)
- **Actions dispatched**:
  - `setVolumeGainPercent(clampedVal: number)` (from `useMusicPlayerStore`)
    - Setting to `100` resets both WebAudio/native booster without altering `AudioManager.STREAM_MUSIC`.
