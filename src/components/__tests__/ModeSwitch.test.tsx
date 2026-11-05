// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ModeSwitch } from "../ModeSwitch";
import { useAppStore } from "../../stores/useAppStore";

describe("ModeSwitch Component", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ appMode: "converter", lang: "fa" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders switch with role switch and initial unchecked state", () => {
    render(<ModeSwitch />);

    const switchInput = screen.getByRole("switch") as HTMLInputElement;
    expect(switchInput).toBeDefined();
    expect(switchInput.checked).toBe(false);
    expect(screen.getByText("کانورتر")).toBeDefined();
    expect(screen.getByText("موزیک پلیر")).toBeDefined();
  });

  it("toggles mode to player on change", () => {
    render(<ModeSwitch />);

    const switchInput = screen.getByRole("switch") as HTMLInputElement;
    fireEvent.click(switchInput);

    expect(useAppStore.getState().appMode).toBe("player");
  });
});
