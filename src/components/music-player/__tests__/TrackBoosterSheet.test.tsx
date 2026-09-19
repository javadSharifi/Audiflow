// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TrackBoosterSheet } from "../TrackBoosterSheet";
import { useAppStore } from "../../../stores/useAppStore";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";

beforeEach(() => {
  cleanup();
  useAppStore.setState({ lang: "fa" });
  useMusicPlayerStore.setState({
    volumeGainPercent: 100,
  });
});

describe("TrackBoosterSheet", () => {
  it("does not render when isOpen is false", () => {
    render(<TrackBoosterSheet isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/تقویت صدا \(بوستر\)/i)).toBeNull();
  });

  it("renders correctly when isOpen is true", () => {
    render(<TrackBoosterSheet isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText(/تقویت صدا \(بوستر\)/i)).toBeTruthy();
    expect(screen.getByRole("slider")).toBeTruthy();
    expect(screen.getByRole("button", { name: "100%" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "150%" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "200%" })).toBeTruthy();
  });

  it("tapping Speaker Protection (محافظت از اسپیکر) safely resets gain to 100% without hardware side effects", () => {
    useMusicPlayerStore.setState({ volumeGainPercent: 250 });
    render(<TrackBoosterSheet isOpen={true} onClose={vi.fn()} />);

    const protectBtn = screen.getByRole("button", { name: /محافظت از اسپیکر/i });
    expect(protectBtn).toBeTruthy();

    fireEvent.click(protectBtn);

    // Boost resets to safe baseline 100%
    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(100);
  });

  it("tapping a preset pill updates volumeGainPercent in real time without closing the sheet", () => {
    const onClose = vi.fn();
    render(<TrackBoosterSheet isOpen={true} onClose={onClose} />);

    const preset150 = screen.getByRole("button", { name: "150%" });
    fireEvent.click(preset150);

    // Gain updates to 150%
    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(150);
    // Sheet must NOT be closed automatically!
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows high boost confirmation modal when selecting >200% and unlocks on confirm", () => {
    render(<TrackBoosterSheet isOpen={true} onClose={vi.fn()} />);

    const preset300 = screen.getByRole("button", { name: "300%" });
    fireEvent.click(preset300);

    // Level capped at 200% while modal is shown
    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(200);
    expect(screen.getByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeTruthy();

    // Confirm high boost
    const confirmBtn = screen.getByRole("button", { name: /تأیید و افزایش توان/i });
    fireEvent.click(confirmBtn);

    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(300);
    expect(screen.queryByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeNull();
  });

  it("keeps volume at 200% when high boost modal is cancelled", () => {
    render(<TrackBoosterSheet isOpen={true} onClose={vi.fn()} />);

    const preset400 = screen.getByRole("button", { name: "400%" });
    fireEvent.click(preset400);

    expect(screen.getByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeTruthy();

    const cancelBtn = screen.getByRole("button", { name: /انصراف/i });
    fireEvent.click(cancelBtn);

    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(200);
    expect(screen.queryByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeNull();
  });

  it("calls onClose when close button or backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<TrackBoosterSheet isOpen={true} onClose={onClose} />);

    const closeBtn = screen.getByRole("button", { name: /Close Sound Booster/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders in English locale properly", () => {
    useAppStore.setState({ lang: "en" });
    render(<TrackBoosterSheet isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Sound Booster/i)).toBeTruthy();
  });

  it("does not render the audition hint subtitle text in the header", () => {
    render(<TrackBoosterSheet isOpen={true} onClose={vi.fn()} />);

    expect(screen.queryByText(/برای مقایسه آنی بلندی صدا ضربه بزنید/i)).toBeNull();
  });

  it("shows tooltip only while changing/interacting with the slider", () => {
    const { container } = render(<TrackBoosterSheet isOpen={true} onClose={vi.fn()} />);
    const tooltip = container.querySelector(".tooltip");
    expect(tooltip).toBeTruthy();
    expect(tooltip?.className).toContain("opacity-0");

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "150" } });

    expect(tooltip?.className).toContain("opacity-100");
  });
});
