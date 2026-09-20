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
    expect(screen.getByRole("radio", { name: /Studio Sound/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Efficient Mode/i })).toBeTruthy();
  });

  it("enables high performance mode immediately on click", () => {
    render(<PerformanceSection />);
    const onBtn = screen.getByRole("radio", { name: /Studio Sound/i });
    fireEvent.click(onBtn);

    expect(useAppStore.getState().reducedBlur).toBe(true);
    expect(localStorage.getItem("ac:reduced-blur")).toBe("1");
  });

  it("disables high performance mode immediately on click", () => {
    useAppStore.setState({ reducedBlur: true });
    render(<PerformanceSection />);
    const offBtn = screen.getByRole("radio", { name: /Efficient Mode/i });
    fireEvent.click(offBtn);

    expect(useAppStore.getState().reducedBlur).toBe(false);
    expect(localStorage.getItem("ac:reduced-blur")).toBe("0");
  });

  it("exposes a labeled radiogroup with radio roles and aria-checked selected state", () => {
    useAppStore.setState({ reducedBlur: false });
    render(<PerformanceSection />);

    screen.getByRole("radiogroup", { name: /Audio Engine & Effects/i });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);

    expect(screen.getByRole("radio", { name: /Efficient Mode/i }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: /Studio Sound/i }).getAttribute("aria-checked")).toBe("false");

    fireEvent.click(screen.getByRole("radio", { name: /Studio Sound/i }));
    expect(screen.getByRole("radio", { name: /Studio Sound/i }).getAttribute("aria-checked")).toBe("true");
  });
});
