// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { OnboardingGate } from "../OnboardingGate";
import { FIRST_RUN_DONE_KEY, isFirstRunDone } from "../../../utils/bootPrefs";
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

// Mock tauri helpers to prevent unhandled invoke calls
vi.mock("../../../utils/tauri", () => ({
  updateAppSettings: vi.fn().mockResolvedValue(undefined),
  openAppSettings: vi.fn(),
}));

describe("OnboardingGate", () => {
  beforeEach(() => {
    storageMock.clear();
    vi.clearAllMocks();
    useAppStore.setState({ lang: "en" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the welcome title, all four section headers, and actions", () => {
    const onComplete = vi.fn();
    render(<OnboardingGate onComplete={onComplete} />);

    // Welcome title & actions
    expect(screen.getByText("pure sound")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start Listening/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Skip for now/i })).toBeTruthy();

    // Four sections
    expect(screen.getByText("Audio Access")).toBeTruthy();
    expect(screen.getByText("App Appearance")).toBeTruthy();
    expect(screen.getByText("Interface Language")).toBeTruthy();
    expect(screen.getByText("Audio Engine & Effects")).toBeTruthy();
  });

  it("renders Persian strings when lang is fa", () => {
    useAppStore.setState({ lang: "fa" });
    const onComplete = vi.fn();
    render(<OnboardingGate onComplete={onComplete} />);

    expect(screen.getByText("صدای خالص")).toBeTruthy();
    expect(screen.getByRole("button", { name: /آغاز شنیدن/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /رد کردن و ورود/i })).toBeTruthy();
  });

  it("calls onComplete and sets first-run-done flag when confirming", () => {
    const onComplete = vi.fn();
    render(<OnboardingGate onComplete={onComplete} />);

    expect(isFirstRunDone()).toBe(false);
    const confirmBtn = screen.getByRole("button", { name: /Start Listening/i });
    fireEvent.click(confirmBtn);

    expect(isFirstRunDone()).toBe(true);
    expect(localStorage.getItem(FIRST_RUN_DONE_KEY)).toBe("1");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("exposes layout contract: clipped decoration layer, x-clipped scroller, min-h-full column, safe-area padding", () => {
    const onComplete = vi.fn();
    const { container } = render(<OnboardingGate onComplete={onComplete} />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("overflow-x-hidden");
    expect(root.className).toContain("overscroll-contain");
    expect(root.className).not.toContain("overflow-x-visible");

    // Decoration layer: single clipped, non-interactive wrapper that owns the blobs
    const decor = root.querySelector('[aria-hidden="true"]');
    expect(decor).toBeTruthy();
    expect(decor!.className).toContain("overflow-hidden");
    expect(decor!.className).toContain("pointer-events-none");
    // Blobs live only inside the decoration layer
    const insideDecor = Array.from(decor!.querySelectorAll("div")).filter(
      (d) => d.className.includes("-top-") || d.className.includes("-bottom-"),
    );
    expect(insideDecor.length).toBeGreaterThan(0);

    // Column: min-h-full, never h-full, no justify-between on the scroll child
    const column = root.querySelector('[data-purpose="onboarding-column"]') as HTMLElement;
    expect(column).toBeTruthy();
    const colTokens = column.className.split(/\s+/);
    expect(colTokens).toContain("min-h-full");
    expect(colTokens).not.toContain("h-full");
    expect(colTokens).not.toContain("justify-between");
    expect(colTokens).not.toContain("my-auto");

    // Content block flexes so footer rests at the bottom without phantom scroll
    const content = root.querySelector('[data-purpose="onboarding-content"]') as HTMLElement;
    expect(content.className).toContain("flex-1");

    // Safe-area: header top / footer bottom use env() max() padding
    const header = root.querySelector('[data-purpose="onboarding-header"]') as HTMLElement;
    const footer = root.querySelector('[data-purpose="onboarding-footer"]') as HTMLElement;
    expect(header.style?.paddingTop).toContain("env(safe-area-inset-top)");
    expect(footer.style?.paddingBottom).toContain("env(safe-area-inset-bottom)");
  });

  it("renders and touches nothing outside the safe further decorative patterns", () => {
    const onComplete = vi.fn();
    const { container } = render(<OnboardingGate onComplete={onComplete} />);
    const root = container.firstElementChild as HTMLElement;
    const decor = root.querySelector('[aria-hidden="true"]') as HTMLElement;
    // Decoration layer must not contain interactive elements
    expect(decor.querySelectorAll("button, input, a, [role='radio']")).toHaveLength(0);
  });

  it("calls onComplete and sets first-run-done flag when globally skipping", () => {
    const onComplete = vi.fn();
    render(<OnboardingGate onComplete={onComplete} />);

    expect(isFirstRunDone()).toBe(false);
    const skipBtn = screen.getByRole("button", { name: /Skip for now/i });
    fireEvent.click(skipBtn);

    expect(isFirstRunDone()).toBe(true);
    expect(localStorage.getItem(FIRST_RUN_DONE_KEY)).toBe("1");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
