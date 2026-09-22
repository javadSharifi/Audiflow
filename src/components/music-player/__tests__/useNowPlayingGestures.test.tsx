// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { useNowPlayingGestures } from "../useNowPlayingGestures";

function TestGestureComponent(props: {
  onDismiss: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
}) {
  const {
    containerRef,
    cardRef,
    dragY,
    swipeX,
    isInteracting,
    transitionState,
    bindContainer,
  } = useNowPlayingGestures(props);

  return (
    <div
      ref={containerRef}
      data-testid="gesture-container"
      data-drag-y={dragY}
      data-swipe-x={swipeX}
      data-interacting={isInteracting}
      data-state={transitionState}
      {...bindContainer}
    >
      <div ref={cardRef} data-testid="artwork-card">
        Artwork Card
      </div>
      <button data-testid="play-btn">Play</button>
      <input type="range" data-testid="seek-bar" />
    </div>
  );
}

describe("useNowPlayingGestures", () => {
  beforeEach(() => {
    cleanup();
    vi.useFakeTimers();
  });

  it("does not initiate gestures when dragging on an interactive button or slider", () => {
    const onDismiss = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();

    const { getByTestId } = render(
      <TestGestureComponent
        onDismiss={onDismiss}
        onNextTrack={onNext}
        onPreviousTrack={onPrev}
      />
    );

    const btn = getByTestId("play-btn");
    fireEvent.pointerDown(btn, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(btn, { clientX: 100, clientY: 200 });

    const container = getByTestId("gesture-container");
    expect(container.getAttribute("data-interacting")).toBe("false");
    expect(container.getAttribute("data-drag-y")).toBe("0");
  });

  it("tracks vertical drag displacement and snaps back when released below threshold", () => {
    const onDismiss = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();

    const { getByTestId } = render(
      <TestGestureComponent
        onDismiss={onDismiss}
        onNextTrack={onNext}
        onPreviousTrack={onPrev}
      />
    );

    const container = getByTestId("gesture-container");

    // Drag down 50px (below 120px threshold)
    fireEvent.pointerDown(container, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    fireEvent.pointerMove(container, { pointerId: 1, clientX: 100, clientY: 150 });
    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(container.getAttribute("data-interacting")).toBe("true");
    expect(Number(container.getAttribute("data-drag-y"))).toBe(50);

    // Release after pausing
    fireEvent.pointerUp(container, { pointerId: 1, clientX: 100, clientY: 150 });
    expect(container.getAttribute("data-state")).toBe("snapping");
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(container.getAttribute("data-state")).toBe("idle");
  });

  it("dismisses with a fast downward flick even below the distance threshold", () => {
    const onDismiss = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();

    const { getByTestId } = render(
      <TestGestureComponent
        onDismiss={onDismiss}
        onNextTrack={onNext}
        onPreviousTrack={onPrev}
      />
    );

    const container = getByTestId("gesture-container");

    // Flick down 50px in 16ms -> vy = 50 / 16 = 3.125 px/ms
    fireEvent.pointerDown(container, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(container, { pointerId: 1, clientX: 100, clientY: 150 });
    fireEvent.pointerUp(container, { pointerId: 1, clientX: 100, clientY: 150 });

    expect(container.getAttribute("data-state")).toBe("dismissing");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses when dragged down beyond the dismiss threshold", () => {
    const onDismiss = vi.fn();
    const onNext = vi.fn();
    const onPrev = vi.fn();

    const { getByTestId } = render(
      <TestGestureComponent
        onDismiss={onDismiss}
        onNextTrack={onNext}
        onPreviousTrack={onPrev}
      />
    );

    const container = getByTestId("gesture-container");

    // Drag down 150px (exceeds 120px threshold)
    fireEvent.pointerDown(container, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(container, { pointerId: 1, clientX: 100, clientY: 250 });

    fireEvent.pointerUp(container, { pointerId: 1, clientX: 100, clientY: 250 });
    expect(container.getAttribute("data-state")).toBe("dismissing");

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
