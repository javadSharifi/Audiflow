// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BoosterView } from "../BoosterView";
import { useAppStore } from "../../../stores/useAppStore";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";

beforeEach(() => {
  cleanup();
  useAppStore.setState({ lang: "fa" });
  useMusicPlayerStore.setState({
    volumeGainPercent: 100,
  });
});

describe("BoosterView", () => {
  it("renders with booster disabled initially at 100%", () => {
    render(<BoosterView />);

    expect(screen.getByText(/افزایش صدای سراسری گوشی/i)).toBeTruthy();
    expect(screen.getByText(/تقویت صدا خاموش است/i)).toBeTruthy();
    expect(screen.getByTestId("booster-percent-display").textContent).toBe("100%");

    const toggle = screen.getByRole("switch", { name: /Toggle Sound Booster/i });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("turns ON booster when master switch is clicked", () => {
    render(<BoosterView />);

    const toggle = screen.getByRole("switch", { name: /Toggle Sound Booster/i });
    fireEvent.click(toggle);

    // Boost engine turns ON (gain jumps to 200% by default)
    expect(useMusicPlayerStore.getState().volumeGainPercent).toBeGreaterThan(100);
    expect(screen.getByText("تقویت صدا فعال است")).toBeTruthy();
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("updates volume when dial value changes up to 200%", () => {
    render(<BoosterView />);

    const dial = screen.getByRole("slider");
    fireEvent.keyDown(dial, { key: "PageUp" });
    fireEvent.keyDown(dial, { key: "PageUp" });

    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(150);
    expect(screen.getByTestId("booster-percent-display").textContent).toBe("150%");
  });

  it("shows warning modal when attempting >200% and unlocks up to 400% on confirm", () => {
    render(<BoosterView />);

    const dial = screen.getByRole("slider");
    fireEvent.keyDown(dial, { key: "End" });

    // Capped at 200% while modal is shown
    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(200);
    expect(screen.getByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeTruthy();

    // Clicking confirm unlocks and applies 400%
    const confirmBtn = screen.getByRole("button", { name: /تأیید و افزایش توان/i });
    fireEvent.click(confirmBtn);

    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(400);
    expect(screen.queryByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeNull();
  });

  it("keeps volume at 200% when high boost modal is cancelled", () => {
    render(<BoosterView />);

    const dial = screen.getByRole("slider");
    fireEvent.keyDown(dial, { key: "End" });

    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(200);
    expect(screen.getByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeTruthy();

    const cancelBtn = screen.getByRole("button", { name: /انصراف/i });
    fireEvent.click(cancelBtn);

    expect(useMusicPlayerStore.getState().volumeGainPercent).toBe(200);
    expect(screen.queryByText(/هشدار افزایش توان صدا به بیش از ۲۰۰٪/i)).toBeNull();
  });

  it("displays safety warning when gain exceeds 200%", () => {
    useMusicPlayerStore.setState({ volumeGainPercent: 300 });
    render(<BoosterView />);

    expect(screen.getByText(/توجه: افزایش بیش از حد صدا/i)).toBeTruthy();
  });

  it("renders properly in English (en)", () => {
    useAppStore.setState({ lang: "en" });
    useMusicPlayerStore.setState({ volumeGainPercent: 200 });
    render(<BoosterView />);

    expect(screen.getByText(/Global Sound Booster/i)).toBeTruthy();
    expect(screen.getByText(/Sound Boost is Active/i)).toBeTruthy();
  });

  it("uses radial-fade glow (no solid square box behind dial)", () => {
    useMusicPlayerStore.setState({ volumeGainPercent: 220 });
    const { container } = render(<BoosterView />);

    const glow = container.querySelector(".w-72.h-72.rounded-full") as HTMLElement | null;
    expect(glow).toBeTruthy();
    expect(glow?.className ?? "").not.toMatch(/blur-3xl/);
    expect(glow?.style.background ?? "").toMatch(/radial-gradient/);
  });
});
