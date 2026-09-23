// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerDropOverlay } from "../PlayerDropOverlay";

describe("PlayerDropOverlay", () => {
  it("renders null or remains hidden when isVisible is false", () => {
    const { container } = render(<PlayerDropOverlay isVisible={false} lang="en" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders drop message and subtitle in English when visible", () => {
    render(<PlayerDropOverlay isVisible={true} lang="en" />);

    expect(screen.getByText("Drop to Play")).toBeDefined();
    expect(screen.getByText("Release to queue and play audio files or folders")).toBeDefined();
  });

  it("renders drop message in Persian when lang is fa", () => {
    render(<PlayerDropOverlay isVisible={true} lang="fa" />);

    expect(screen.getByText("رها کنید تا پخش شود")).toBeDefined();
    expect(
      screen.getByText("فایل‌ها یا پوشه‌های آهنگ را رها کنید تا در صف پخش قرار گیرند"),
    ).toBeDefined();
  });
});
