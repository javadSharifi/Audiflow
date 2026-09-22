/**
 * Contract: Now Playing Gestures System
 * Feature: 014-nowplaying-gestures-artwork
 */

import type { RefObject } from "react";

export interface UseNowPlayingGesturesOptions {
  /** Callback triggered when vertical drag dismisses the view. */
  onDismiss: () => void;
  /** Callback triggered when horizontal swipe advances to next track. */
  onNextTrack: () => void;
  /** Callback triggered when horizontal swipe returns to previous track. */
  onPreviousTrack: () => void;
  /** Whether can navigate previous (false at start of non-repeating playlist). */
  canGoPrevious?: boolean;
  /** Whether can navigate next (false at end of non-repeating playlist). */
  canGoNext?: boolean;
}

export interface UseNowPlayingGesturesResult {
  /** Ref to attach to the root container for drag-to-dismiss tracking. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Ref to attach to the album art card container for horizontal swipe tracking. */
  cardRef: RefObject<HTMLDivElement | null>;
  /** Real-time vertical translation in px (0 if not dragging). */
  dragY: number;
  /** Real-time horizontal card translation in px (0 if not swiping). */
  swipeX: number;
  /** Real-time card rotation in degrees during horizontal swipe. */
  cardRotation: number;
  /** Real-time card opacity during swipe. */
  cardOpacity: number;
  /** Whether the user is actively dragging vertically or swiping horizontally. */
  isInteracting: boolean;
  /** Current active gesture animation state ('idle' | 'dismissing' | 'sliding-next' | 'sliding-prev'). */
  transitionState: "idle" | "dismissing" | "sliding-next" | "sliding-prev" | "snapping";
}
