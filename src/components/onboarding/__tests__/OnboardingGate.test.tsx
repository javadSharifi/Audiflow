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
    expect(screen.getByText("Welcome to Audiflow")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Get Started/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Skip for now/i })).toBeTruthy();

    // Four sections
    expect(screen.getByText("Permissions")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Language")).toBeTruthy();
    expect(screen.getByText("Performance Mode")).toBeTruthy();
  });

  it("renders Persian strings when lang is fa", () => {
    useAppStore.setState({ lang: "fa" });
    const onComplete = vi.fn();
    render(<OnboardingGate onComplete={onComplete} />);

    expect(screen.getByText("به آئودی‌فلو خوش آمدید")).toBeTruthy();
    expect(screen.getByRole("button", { name: /شروع کنید/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /رد کردن و ورود/i })).toBeTruthy();
  });

  it("calls onComplete and sets first-run-done flag when confirming", () => {
    const onComplete = vi.fn();
    render(<OnboardingGate onComplete={onComplete} />);

    expect(isFirstRunDone()).toBe(false);
    const confirmBtn = screen.getByRole("button", { name: /Get Started/i });
    fireEvent.click(confirmBtn);

    expect(isFirstRunDone()).toBe(true);
    expect(localStorage.getItem(FIRST_RUN_DONE_KEY)).toBe("1");
    expect(onComplete).toHaveBeenCalledTimes(1);
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
