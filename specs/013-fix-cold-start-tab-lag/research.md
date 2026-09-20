# Research: Eliminate Cold-Start Tab Lag (Albums & Liked)

**Feature**: `013-fix-cold-start-tab-lag` | **Date**: 2026-09-20

All unknowns resolved. No NEEDS CLARIFICATION remains.

## R1: Tab Pre-Warming Strategy — Staged Idle Mounting vs. Eager Boot Mount

- **Decision**: Implement a **cooperative idle pre-warming mechanism** (`idlePrewarm`) in `KeepAlivePane` / `MusicPlayerView`. Rather than mounting all tabs synchronously during the critical boot path (which would delay `#boot-splash` dismissal and compete with initial `SongsView` rendering), inactive tabs (`LikedView` and `AlbumsView`) are warmed in the background during browser/system idle time (`requestIdleCallback` with a graceful `setTimeout` fallback, typically 150–300ms after initial paint).
- **Rationale**:
  - The initial view (Songs tab) must remain 100% responsive without any boot time regressions (SC-004).
  - Pre-mounting during idle time constructs the DOM nodes with `display: none`, initializes virtualizers, loads initial viewport artwork from cache, and executes memoized track/album derivations before the user ever taps the tab.
  - When the user subsequently taps Albums or Liked, the tab is already alive in the DOM; switching is a pure CSS toggle (`display: flex`), executing in **<10ms** on all devices.
- **Alternatives considered**:
  - *Eager synchronous mount on first paint (`lazy={false}` on all tabs)*: Rejected because running TanStack virtualizer, album grouping, and cover extraction for 3 full views at once during cold start increases initial CPU pressure and can delay the splash screen removal on lower-end Android phones.
  - *Purely reactive on-demand lazy mount (status quo)*: Rejected because the user experiences a ~250–400ms hitch on first interaction with Albums and Liked.

## R2: Eliminating the 1-Frame Blank Hitch in `KeepAlivePane`

- **Decision**: Fix the state synchronization inside `KeepAlivePane.tsx`. Currently, `hasBeenActive` is updated inside a `useEffect` post-paint:
  ```tsx
  // Current: returns null on the first render pass where active becomes true!
  const [hasBeenActive, setHasBeenActive] = useState(!lazy || active);
  useEffect(() => {
    if (active && !hasBeenActive) setHasBeenActive(true);
  }, [active, hasBeenActive]);
  if (!hasBeenActive) return null;
  ```
  We update `hasBeenActive` synchronously when `active` is true (or derive `const shouldMount = hasBeenActive || active || isPrewarmed;`), ensuring that if a user taps a tab before idle warming occurs, the component mounts immediately on that same render pass rather than waiting for an asynchronous effect tick.
- **Rationale**: Prevents any empty/blank screen flash or dropped frame if the user taps faster than the idle scheduler.
- **Alternatives considered**: Retaining `useEffect`-only activation — rejected because it guarantees a minimum 1-frame dropped state on first tap.

## R3: Synchronous Initial Column Calculation in `AlbumGridVirtualized`

- **Decision**: Initialize `cols` state in `useAlbumColumns` using a synchronous viewport measurement:
  ```tsx
  function getResponsiveAlbumCols(width: number): number {
    if (width >= 1024) return 6;
    if (width >= 768) return 5;
    if (width >= 640) return 4;
    return 3;
  }
  const [cols, setCols] = useState(() =>
    typeof window !== "undefined" ? getResponsiveAlbumCols(window.innerWidth) : 3
  );
  ```
- **Rationale**: Currently, `useAlbumColumns` hardcodes `useState(3)`. On desktop or tablet, this immediately triggers a secondary re-render when `useEffect` runs, causing `rowVirtualizer` to measure twice and creating a perceptible visual stutter. With synchronous initialization, the very first render uses the exact correct column count for the device screen.
- **Alternatives considered**: CSS grid without virtualization — rejected because large libraries with hundreds of albums require virtualization to prevent memory exhaustion and slow scrolling.

## R4: Album Computation Optimization & Warm Cache Re-use

- **Decision**: Ensure `computeAllAlbums(tracks, customAlbums)` computation is seamlessly memoized and leveraged during the idle pre-warm. In `src/stores/useMusicPlayerStore.ts`, `warmLibraryArtwork` already executes `computeAllAlbums` at boot to warm album covers. By pre-warming `AlbumsView` during idle time, `useMemo(() => computeAllAlbums(tracks, customAlbums), [tracks, customAlbums])` runs off-interaction and its output remains memoized.
- **Rationale**: Zero main-thread blocking when the user touches the screen.

## R5: Testing & Verification Strategy

- **Decision**:
  - Unit tests in `src/components/music-player/__tests__/`:
    - `KeepAlivePane.test.tsx`: Verify synchronous mounting on `active={true}`, verify idle pre-warming behavior, verify `display: none` preservation.
    - `AlbumGridVirtualized.test.tsx`: Verify responsive columns initialize synchronously to match viewport width without extra re-renders.
    - `MusicPlayerView.test.tsx`: Verify all tabs remain mounted and preserve state across switches.
  - Manual verification on device/emulator:
    - Launch from cold start.
    - Tap Albums tab immediately: verify instant switch (<50ms) and no layout shift.
    - Tap Liked tab immediately: verify instant switch (<50ms).
    - Switch back and forth: verify <10ms response and scroll preservation.
- **Rationale**: Confirms both the architectural contract and real-world user perception.
