// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NowPlayingArtworkCarousel } from "../NowPlayingArtworkCarousel";

describe("NowPlayingArtworkCarousel", () => {
  beforeEach(() => {
    cleanup();
  });

  const dummyTrack = {
    id: "track_123",
    title: "Carousel Song",
    artist: "Artist",
    coverUrl: "https://example.com/art.jpg",
  };

  it("renders artwork card for the current track", () => {
    render(
      <NowPlayingArtworkCarousel
        currentTrack={dummyTrack}
        swipeX={0}
        cardRotation={0}
        cardOpacity={1}
      />
    );

    const card = screen.getByTestId("now-playing-artwork-carousel");
    expect(card).toBeTruthy();
    expect(card.style.transform).toBe("translateX(0px) rotate(0deg)");
  });

  it("applies dynamic transforms during swipe", () => {
    render(
      <NowPlayingArtworkCarousel
        currentTrack={dummyTrack}
        swipeX={-50}
        cardRotation={-2}
        cardOpacity={0.88}
      />
    );

    const card = screen.getByTestId("now-playing-artwork-carousel");
    expect(card.style.transform).toBe("translateX(-50px) rotate(-2deg)");
    expect(card.style.opacity).toBe("0.88");
  });

  it("adds transition curve when snapping or sliding", () => {
    render(
      <NowPlayingArtworkCarousel
        currentTrack={dummyTrack}
        swipeX={-400}
        cardRotation={-10}
        cardOpacity={0.4}
        transitionState="sliding-next"
      />
    );

    const card = screen.getByTestId("now-playing-artwork-carousel");
    expect(card.style.transition).toContain("transform");
  });
});
