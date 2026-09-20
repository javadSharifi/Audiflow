# Data Model: Eliminate Cold-Start Tab Lag

**Feature**: `013-fix-cold-start-tab-lag` | **Date**: 2026-09-20

No new database entities or persistent storage schemas. This feature optimizes **runtime lifecycle and presentation state** within the React component tree and navigation containers.

## Entity 1: Tab Lifecycle & Pre-Warm State

Represents the mounting and visibility lifecycle of a library tab pane inside `KeepAlivePane`.

- **Fields**:
  - `active: boolean`: Whether the tab is currently visible and interactable.
  - `hasMounted: boolean`: Tracks whether the component tree has been created and mounted into the DOM.
  - `prewarm: boolean`: Optional instruction to mount the tab during idle time before first interaction.
  - `displayStyle: "flex" | "none"`: CSS display property applied to the DOM wrapper. When `active` is true, defaults to `flex`; when inactive but mounted, sets `none`.
  - `ariaHidden: boolean`: Mirrors `!active` to ensure inactive background tabs are ignored by screen readers and accessibility trees.
- **Validation Rules**:
  - If `active === true`, `hasMounted` MUST be `true` synchronously within the same render pass (zero blank intermediate frames).
  - If `prewarm === true` and idle time is triggered, `hasMounted` becomes `true` while `displayStyle` remains `"none"`.
  - Once `hasMounted` is `true`, it NEVER reverts to `false` during the application session (permanent keep-alive).
- **State Transitions**:
  1. `Unmounted (hasMounted: false, active: false)` -> Initial state on cold start.
  2. `Unmounted` -> `Active (hasMounted: true, active: true)` -> When user navigates directly to the tab before idle warm.
  3. `Unmounted` -> `Prewarmed (hasMounted: true, active: false)` -> When idle scheduler triggers pre-warm in background.
  4. `Prewarmed` <-> `Active` -> Pure CSS display toggle (`"none"` <-> `"flex"`), instantaneous (<10ms).

## Entity 2: Responsive Grid Column State

Represents the computed column structure for the virtualized album grid in `AlbumGridVirtualized`.

- **Fields**:
  - `viewportWidth: number`: Current inner window width.
  - `cols: number`: Number of columns for the grid (3 for <640px, 4 for 640-767px, 5 for 768-1023px, 6 for >=1024px).
  - `rowCount: number`: Total number of virtual rows (`Math.ceil(items.length / cols)`).
  - `estimateRowHeight: number`: Fixed conservative row height estimation (210px).
- **Validation Rules**:
  - Initial `cols` state MUST be derived synchronously from `window.innerWidth` on first render pass (never a hardcoded default of 3 unless `window` is undefined).
  - Window `resize` events MUST update `cols` only when the responsive breakpoint threshold is crossed.

## Entity 3: Idle Task Coordinator

Represents the background scheduler that dispatches pre-warm tasks during system idle periods.

- **Fields**:
  - `isIdleWarmed: boolean`: Boolean flag tracking whether idle warming has dispatched.
  - `idleTimeoutMs: number`: Maximum time before fallback execution if system stays busy (default 400ms).
- **Validation Rules**:
  - MUST NOT execute while the critical boot sequence (`bootReady === false`) is running.
  - MUST use `requestIdleCallback` when available with `setTimeout` fallback.
  - MUST cancel pending idle callbacks on unmount to prevent memory leaks.
