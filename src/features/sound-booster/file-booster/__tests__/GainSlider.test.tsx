// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GainSlider } from "../GainSlider";
import { useAppStore } from "../../../../stores/useAppStore";

describe("GainSlider (008-real-volume-boost-400 US3)", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ lang: "en" });
  });

  it("renders with 0 to 400 max range on the slider input", () => {
    const onChange = vi.fn();
    render(<GainSlider gainPercent={100} onChangeGain={onChange} />);

    const slider = screen.getByRole("slider");
    expect(slider.getAttribute("min")).toBe("0");
    expect(slider.getAttribute("max")).toBe("400");
    expect(slider.getAttribute("step")).toBe("5");
    expect(slider.getAttribute("value")).toBe("100");
  });

  it("displays graduation markers including 0%, 100%, 200%, and 400%", () => {
    render(<GainSlider gainPercent={100} onChangeGain={vi.fn()} />);

    expect(screen.getByText("0% (Mute)")).toBeDefined();
    expect(screen.getByText("100% (Original)")).toBeDefined();
    expect(screen.getByText("200%")).toBeDefined();
    expect(screen.getByText("400% (+80 dB)")).toBeDefined();
  });

  it("shows high boost warning when gainPercent > 200", () => {
    const { rerender } = render(<GainSlider gainPercent={200} onChangeGain={vi.fn()} />);
    expect(screen.queryByText(/Peak limiter actively guards/i)).toBeNull();

    rerender(<GainSlider gainPercent={250} onChangeGain={vi.fn()} />);
    expect(screen.getByText(/Peak limiter actively guards/i)).toBeDefined();
  });

  it("displays correct gain badges at 200% and 400%", () => {
    const { rerender } = render(<GainSlider gainPercent={200} onChangeGain={vi.fn()} />);
    expect(screen.getByText("+26.7 dB")).toBeDefined();

    rerender(<GainSlider gainPercent={400} onChangeGain={vi.fn()} />);
    expect(screen.getByText("+80.0 dB")).toBeDefined();
  });
});
