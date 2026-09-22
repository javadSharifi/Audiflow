# Technical Research & Architecture Decisions: Bottom Navigation Layout & Mini Player Spacing

**Feature**: `015-fix-bottom-nav-layout`  
**Date**: 2026-09-22  
**Status**: Completed

---

## 1. Problem Space & Root Cause Analysis

### 1.1 Root Cause 1: Vertical Spacing Disparity Between Mini Player and Bottom Navigation Dock

**Symptom**: On the developer's personal phone and standard emulator, the gap between the bottom navigation dock and the floating mini player card looked normal (~8px). On customer devices (particularly Android phones with virtual 3-button navigation bars), an enormous empty gap (50px–80px) appeared between the two components, exposing background track rows through the middle of the screen.

**Investigation**:
- In `src/components/music-player/MiniPlayer.tsx` (line 138):
  ```tsx
  className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-35 w-full max-w-md px-3 sm:px-4 select-none animate-in slide-in-from-bottom duration-200"
  ```
  `MiniPlayer` dynamically adds `env(safe-area-inset-bottom, 0px)` to its `bottom` coordinate.
- In `src/components/music-player/MusicPlayerNav.tsx` (line 36):
  ```tsx
  className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[55] w-fit max-w-[calc(100vw-1.5rem)] sm:max-w-xl lg:max-w-2xl px-1 select-none"
  ```
  `MusicPlayerNav` uses a static `bottom-4` (`1rem = 16px`) without incorporating `env(safe-area-inset-bottom, 0px)`.

**Mathematical Analysis**:
- On zero-inset devices (`safe-area-inset-bottom = 0px`):
  - Dock baseline: `16px`.
  - Dock height: `52px` (button) + `16px` (padding `p-2`) = `68px`.
  - Dock top: `16px + 68px = 84px`.
  - MiniPlayer baseline: `5.75rem = 92px`.
  - Gap: `92px - 84px = 8px` (compact and visually intended).
- On Android 3-button navigation devices (`safe-area-inset-bottom = 48px`):
  - Dock baseline: `16px` (did not elevate; sits in the 3-button navigation strip).
  - Dock top: `16px + 68px = 84px`.
  - MiniPlayer baseline: `92px + 48px = 140px`.
  - Gap: `140px - 84px = 56px`! (Oversized empty gap exposing the song list).

**Resolution**:
Both `MusicPlayerNav` and `MiniPlayer` must bind to a synchronized, deterministic bottom elevation formula that accounts for `env(safe-area-inset-bottom, 0px)`.
- Dock baseline: `calc(0.75rem + env(safe-area-inset-bottom, 0px))` (12px + inset)
- Dock height: `~64px` (48px button + 12px padding + 2px border)
- Desired gap: `8px` (`0.5rem`)
- MiniPlayer baseline: `calc(0.75rem + 4rem + 0.5rem + env(safe-area-inset-bottom, 0px)) = calc(5.25rem + env(safe-area-inset-bottom, 0px))`
- Result: Gap is **always strictly 8px** across all devices (0px, 24px, 48px, 72px inset).

---

### 1.2 Root Cause 2: Horizontal Viewport Overflow on Compact Mobile Screens

**Symptom**: When a user taps a navigation tab on narrow or standard Android devices (360px width), the navigation dock expands outside the viewport boundaries, causing outermost tabs (Albums or Converter) to be partially cut off or clipped.

**Investigation**:
- `MusicPlayerNav.tsx` contains 5 tabs: Albums, Liked, Songs, Booster, Converter.
- Inactive tabs:
  ```tsx
  className="... flex-none w-[52px] h-[52px] gap-0 px-0 sm:flex-auto sm:w-auto ..."
  ```
  4 inactive tabs: `4 * 52px = 208px`.
- Container padding & gaps:
  `p-2` (16px total) + `gap-1.5` (4 gaps * 6px = 24px) = `40px`.
  Subtotal for non-active elements alone = `208px + 40px = 248px`.
- Active tab:
  ```tsx
  className="... flex-none w-auto max-w-[45%] gap-2 px-5 bg-gradient-to-r ... font-bold"
  ```
  Active tab has `px-5` (40px horizontal padding) + 22px icon + 8px gap + text label.
  In Persian:
  - "علاقه‌مندی‌ها" (Liked): 13 characters, ~85px width at 11px font.
  - Total active tab width = `40px + 22px + 8px + 85px = 155px`.
- Total Dock Width required = `248px + 155px = 403px`.
- On a 360px screen:
  Available width with margins (`calc(100vw - 1.5rem)`) = `336px`.
  Because the buttons are `flex-none`, they cannot shrink.
  The container overflows by `403px - 336px = 67px`!
  Since the dock is centered via `left-1/2 -translate-x-1/2`, it spills over 33px outside each screen edge.

**Resolution**:
Re-architect the navigation dock using fluid, responsive CSS flexbox rules:
1. **Container**: Reduce mobile padding from `p-2` to `p-1.5` (12px total) and gap from `gap-1.5` to `gap-1 sm:gap-1.5` (4 gaps * 4px = 16px).
2. **Inactive Buttons**: Allow flexible shrinking with a safe minimum:
   `flex-1 sm:flex-none min-w-[38px] max-w-[44px] sm:w-[48px] h-[46px] sm:h-[50px]`.
   4 inactive buttons take `4 * 40px = 160px`.
3. **Active Button**:
   - Reduce mobile padding from `px-5` (40px) to `px-3 sm:px-4` (24px).
   - Icon: `20px` (`h-5 w-5 sm:h-[22px] sm:w-[22px]`).
   - Gap: `gap-1.5` (6px).
   - Label: `text-[11px] font-bold truncate max-w-[80px] sm:max-w-none`.
   - Text "علاقه‌مندی‌ها": clamps to ~70px.
   - Total active button width = `24px + 20px + 6px + 70px = 120px`.
4. **Total Mobile Width**:
   `160px (inactive) + 120px (active) + 16px (gaps) + 12px (padding) = 308px`.
   `308px` fits comfortably inside `336px` on 360px viewports (with 28px margin) and within 296px on 320px viewports when compressed.

---

## 2. Mathematical Viewport Budget

| Viewport Width | Screen Category | Total Available Width (100vw - 24px) | Inactive Tabs (4x) | Active Tab (1x) | Gaps + Padding | Total Dock Width | Margin Remaining | Overflow? |
| :------------: | :-------------- | :----------------------------------: | :----------------: | :-------------: | :------------: | :--------------: | :--------------: | :-------: |
| **320px**      | Ultra-compact   | 296px                                | 152px (4 x 38px)   | 116px           | 28px           | 296px            | 0px              | **NO**    |
| **360px**      | Standard Android| 336px                                | 160px (4 x 40px)   | 120px           | 28px           | 308px            | 28px             | **NO**    |
| **375px**      | iPhone SE       | 351px                                | 168px (4 x 42px)   | 125px           | 28px           | 321px            | 30px             | **NO**    |
| **390px**      | iPhone 13/14    | 366px                                | 176px (4 x 44px)   | 130px           | 28px           | 334px            | 32px             | **NO**    |
| **412px**      | Pixel 6/7/8     | 388px                                | 184px (4 x 46px)   | 135px           | 28px           | 347px            | 41px             | **NO**    |
| **>= 640px**   | Tablet / Desktop| > 500px                              | Auto (unconstrained)| Auto           | 40px           | ~420px           | > 80px           | **NO**    |

---

## 3. Safe-Area Inset Synchronization Matrix

| Platform / State | Bottom Inset | Dock Bottom Formula | Dock Top (h=64px) | MiniPlayer Bottom Formula | Measured Gap | Collision with System Bar? |
| :--------------- | :----------: | :-----------------: | :---------------: | :-----------------------: | :----------: | :------------------------: |
| **Desktop / macOS / Windows** | 0px | `12px` | `76px` | `84px` | **8px** | None |
| **Android (Gestures)** | 16px–24px | `12px + 20px = 32px` | `96px` | `84px + 20px = 104px` | **8px** | None (clears gesture pill) |
| **Android (3-Button Bar)** | 48px | `12px + 48px = 60px` | `124px` | `84px + 48px = 132px` | **8px** | None (clears system buttons) |
| **Android (High Inset)** | 72px | `12px + 72px = 84px` | `148px` | `84px + 72px = 156px` | **8px** | None |

---

## 4. Scroll Padding Synchronization for List Views

When both `MiniPlayer` and `MusicPlayerNav` are floating over the view, virtualized lists (`TrackListView`, `LikedView`, `AlbumDetailView`) must have bottom padding equal to:
`MiniPlayer Height (~96px) + MiniPlayer Bottom Offset (84px + safe-area) = 180px + safe-area`.
Currently, `TrackListView` uses `pb-44` (`176px`) for `isPlayerActive`.
To ensure positive-inset devices don't obscure the last track item, the scroll list container will specify:
`pb-[calc(11.5rem+env(safe-area-inset-bottom,0px))]`.

---

## 5. Architectural & Constitution Verification

1. **Constitution Principle I (Zero-Dependency)**: No new libraries or plugins required; solved entirely with pure CSS variables, flexbox, and Tailwind primitives.
2. **Constitution Principle VIII (File Size Limit <= 300 LOC)**:
   - `src/components/music-player/MusicPlayerNav.tsx`: Currently 92 lines (remains < 130 lines).
   - `src/components/music-player/MiniPlayer.tsx`: Currently 254 lines (remains < 260 lines).
   - `src/components/music-player/TrackListView.tsx`: Currently 310 lines (slight refactor to stay <= 300 lines).
3. **Constitution Principle VIII (Strict i18n)**: All labels remain bound to `translate(lang, tab.labelKey)`.
