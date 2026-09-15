# Contract: Performance Settings & Graphics Adaptation

**Interface**: `PerformanceSettings`
**Feature**: `001-mobile-performance-optimization`
**Consumers**: `useAppStore.ts`, `SettingsModal.tsx`, CSS root classes

---

## 1. Store Slice Extension

```typescript
export interface PerformanceSlice {
  /** When true, backdrop blurs are disabled and replaced with solid/semi-opaque styles */
  reducedBlur: boolean;
  setReducedBlur: (enabled: boolean) => void;
}
```

## 2. Storage & Default Strategy

```typescript
// Initial state determination
export function getInitialReducedBlur(): boolean {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("ac:reduced-blur");
      if (stored !== null) return stored === "1";
    }
  } catch {}
  // Default: true on mobile (performance first), false on desktop
  return isAndroid();
}
```

## 3. i18n Translation Keys (Constitution Principle VIII)

All strings MUST be resolved via `translate(lang, key)`:

| Key | English (`en`) | Persian (`fa`) |
|-----|----------------|----------------|
| `perfModeTitle` | "Performance Mode" | "حالت عملکرد بالا" |
| `perfModeDesc` | "Disable blur effects for smoother scrolling on mobile" | "غیرفعال‌سازی افکت‌های بلور شیشه‌ای برای اسکرول روان‌تر" |
| `perfModeActive` | "High Performance (Reduced Blur)" | "عملکرد بالا (بدون بلور)" |
