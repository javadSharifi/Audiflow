import { useState, useRef, useCallback, useEffect } from "react";

export interface UseNowPlayingGesturesOptions {
  onDismiss: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  dismissThreshold?: number;
  swipeThreshold?: number;
}

export type TransitionState = "idle" | "dismissing" | "sliding-next" | "sliding-prev" | "snapping";

export function useNowPlayingGestures({
  onDismiss,
  onNextTrack,
  onPreviousTrack,
  canGoPrevious = true,
  canGoNext = true,
  dismissThreshold = 120,
  swipeThreshold = 60,
}: UseNowPlayingGesturesOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [dragY, setDragY] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const [transitionState, setTransitionState] = useState<TransitionState>("idle");

  const gestureRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    vx: number;
    vy: number;
    mode: "idle" | "locking" | "vertical" | "horizontal";
    isCardGesture: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0,
    mode: "idle",
    isCardGesture: false,
  });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only primary button
    if (e.button !== 0) return;

    // Do not hijack seekbars, sliders, or interactive buttons
    const target = e.target as HTMLElement | null;
    if (
      target?.closest("input[type=range]") ||
      target?.closest("button") ||
      target?.closest("[data-no-gesture]")
    ) {
      return;
    }

    const isCard = !!cardRef.current && (cardRef.current === target || cardRef.current.contains(target));

    gestureRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastTime: performance.now(),
      vx: 0,
      vy: 0,
      mode: "locking",
      isCardGesture: isCard,
    };
    setIsInteracting(true);
    setTransitionState("idle");
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g.active || g.pointerId !== e.pointerId) return;

    const now = performance.now();
    const dt = Math.max(16, now - g.lastTime);
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    g.vx = (e.clientX - g.lastX) / dt;
    g.vy = (e.clientY - g.lastY) / dt;
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    g.lastTime = now;

    // Deadband disambiguation (8px)
    if (g.mode === "locking") {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 8 && absY < 8) return;

      if (g.isCardGesture && absX > absY) {
        g.mode = "horizontal";
      } else if (dy > 0 && absY >= absX) {
        g.mode = "vertical";
      } else {
        return;
      }
    }

    if (g.mode === "vertical") {
      // Only allow pulling downwards
      const clampedY = Math.max(0, dy);
      setDragY(clampedY);
    } else if (g.mode === "horizontal") {
      // Apply rubberband resistance at boundary
      let effectiveX = dx;
      if (dx > 0 && !canGoPrevious) {
        effectiveX = dx * 0.25;
      } else if (dx < 0 && !canGoNext) {
        effectiveX = dx * 0.25;
      }
      setSwipeX(effectiveX);
    }
  }, [canGoNext, canGoPrevious]);

  const handlePointerEnd = useCallback((e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g.active || g.pointerId !== e.pointerId) return;

    g.active = false;
    setIsInteracting(false);

    if (g.mode === "vertical") {
      const dy = e.clientY - g.startY;
      const timeSinceMove = performance.now() - g.lastTime;
      const isQuickFlick = timeSinceMove < 80 && g.vy >= 0.5;
      const shouldDismiss = dy >= dismissThreshold || isQuickFlick;

      if (shouldDismiss) {
        setTransitionState("dismissing");
        setDragY(window.innerHeight || 800);
        setTimeout(() => {
          onDismiss();
          setDragY(0);
          setTransitionState("idle");
        }, 280);
      } else {
        setTransitionState("snapping");
        setDragY(0);
        setTimeout(() => setTransitionState("idle"), 240);
      }
    } else if (g.mode === "horizontal") {
      const dx = e.clientX - g.startX;
      const timeSinceMove = performance.now() - g.lastTime;
      const isQuickFlickNext = timeSinceMove < 80 && g.vx <= -0.4;
      const isQuickFlickPrev = timeSinceMove < 80 && g.vx >= 0.4;
      const shouldNext = (dx <= -swipeThreshold || isQuickFlickNext) && canGoNext;
      const shouldPrev = (dx >= swipeThreshold || isQuickFlickPrev) && canGoPrevious;

      if (shouldNext) {
        setTransitionState("sliding-next");
        setSwipeX(-400);
        setTimeout(() => {
          onNextTrack();
          setSwipeX(0);
          setTransitionState("idle");
        }, 200);
      } else if (shouldPrev) {
        setTransitionState("sliding-prev");
        setSwipeX(400);
        setTimeout(() => {
          onPreviousTrack();
          setSwipeX(0);
          setTransitionState("idle");
        }, 200);
      } else {
        setTransitionState("snapping");
        setSwipeX(0);
        setTimeout(() => setTransitionState("idle"), 200);
      }
    }

    g.mode = "idle";
  }, [canGoNext, canGoPrevious, dismissThreshold, onDismiss, onNextTrack, onPreviousTrack, swipeThreshold]);

  // Derived card transforms
  const cardRotation = Math.max(-12, Math.min(12, swipeX * 0.035));
  const cardOpacity = Math.max(0.4, 1 - Math.abs(swipeX) / 450);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      gestureRef.current.active = false;
    };
  }, []);

  return {
    containerRef,
    cardRef,
    dragY,
    swipeX,
    cardRotation,
    cardOpacity,
    isInteracting,
    transitionState,
    bindContainer: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
  };
}
