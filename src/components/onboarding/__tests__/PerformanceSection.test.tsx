// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PerformanceSection } from "../PerformanceSection";
import { useAppStore } from "../../../stores/useAppStore";

// In-memory localStorage mock
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

vi.stubGlobal("localStorage", storageMock);

describe("PerformanceSection", () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    useAppStore.setState({
      lang: "en",
      reducedBlur: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders high performance mode toggle or buttons", () => {
    render(<PerformanceSection />);
    expect(screen.getByRole("button", { name: /High Performance/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Standard Visuals/i })).toBeTruthy();
  });

  it("enables high performance mode immediately on click", () => {
    render(<PerformanceSection />);
    const onBtn = screen.getByRole("button", { name: /High Performance/i });
    fireEvent.click(onBtn);

    expect(useAppStore.getState().reducedBlur).toBe(true);
    expect(localStorage.getItem("ac:reduced-blur")).toBe("1");
  });

  it("disables high performance mode immediately on click", () => {
    useAppStore.setState({ reducedBlur: true });
    render(<PerformanceSection />);
    const offBtn = screen.getByRole("button", { name: /Standard Visuals/i });
    fireEvent.click(offBtn);

    expect(useAppStore.getState().reducedBlur).toBe(false);
    expect(localStorage.getItem("ac:reduced-blur")).toBe("0");
  });
});
