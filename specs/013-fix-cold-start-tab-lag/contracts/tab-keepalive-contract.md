# Tab Keep-Alive & Pre-Warm Contract

**Feature**: `013-fix-cold-start-tab-lag` | **Date**: 2026-09-20

Frontend architectural contract between navigation tabs, keep-alive container, and responsive grid layouts.

## 1. KeepAlivePane Props Contract

```typescript
export interface KeepAlivePaneProps {
  /** Whether the pane is currently active and visible to the user */
  active: boolean;
  /** Child React component tree to preserve */
  children: React.ReactNode;
  /**
   * If true (default), defers mounting until the tab is first visited or pre-warmed.
   * If false, mounts synchronously on initial render.
   */
  lazy?: boolean;
  /**
   * If true, allows the pane to mount in the background during idle time
   * while maintaining style={{ display: "none" }}.
   */
  prewarm?: boolean;
}
```

### Behavioral Contract:
1. **Synchronous First Mount on Active**:
   When `active` flips from `false` to `true`, `KeepAlivePane` MUST render `children` within that same render pass. It MUST NOT return `null` and wait for `useEffect` to trigger a second render.
2. **Idle Pre-Warming**:
   When `prewarm` is `true`, `KeepAlivePane` mounts `children` into the DOM with `className="hidden"` and `style={{ display: "none" }}`.
3. **Scroll & State Preservation**:
   Once mounted, the container element remains permanently in the DOM hierarchy. No child unmount or state destruction occurs when switching tabs.

## 2. Responsive Column Calculation Contract

```typescript
export function getResponsiveAlbumCols(width: number): number {
  if (width >= 1024) return 6;
  if (width >= 768) return 5;
  if (width >= 640) return 4;
  return 3;
}
```

### Behavioral Contract:
1. The hook `useAlbumColumns` MUST initialize `cols` state synchronously using `getResponsiveAlbumCols(window.innerWidth)` on client environments.
2. The initial render pass of `AlbumGridVirtualized` MUST render with the calculated `cols` matching the viewport, ensuring zero layout shifts or redundant virtualizer recalculations on first paint.

## 3. Idle Scheduling Contract

In `MusicPlayerView.tsx`:
1. Following initial mount, an idle scheduler triggers `idlePrewarm = true` using `requestIdleCallback` (or `setTimeout` fallback at ~200ms).
2. Panes configured with `prewarm={idlePrewarm}` transition their background DOM into a warm state.
3. User interactions (touch/click on navigation dock) take immediate precedence over pending idle tasks.
