/**
 * Shared Layout Geometry Constants for Bottom Navigation and Floating MiniPlayer
 * Ensures synchronized safe-area-inset-bottom elevation and strict 8px vertical gap.
 */

/** Tailwind class for bottom positioning of MusicPlayerNav dock */
export const NAVIGATION_DOCK_BOTTOM_CLASS =
  "bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]";

/** Tailwind class for bottom positioning of MiniPlayer floating card */
export const MINI_PLAYER_BOTTOM_CLASS =
  "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))]";

/** Tailwind class for bottom scroll padding in virtualized track lists */
export const LIST_SCROLL_BOTTOM_PADDING_CLASS =
  "pb-[calc(11.5rem+env(safe-area-inset-bottom,0px))]";

/** Standard vertical gap in pixels between top of dock and bottom of mini player */
export const DOCK_TO_MINIPLAYER_GAP_PX = 8;
