// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HeaderBar } from "../HeaderBar";
import { useAppStore } from "../../stores/useAppStore";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "1.2.14") }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

beforeEach(() => {
  cleanup();
  useAppStore.setState({
    activeTool: "converter",
    lang: "en",
  });
});

describe("HeaderBar Dynamic Title", () => {
  it("shows Audiflow title when activeTool is converter", () => {
    useAppStore.setState({ activeTool: "converter", lang: "en" });
    render(<HeaderBar />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Audiflow");
  });

  it("dynamically shows Music Player title when activeTool is player", () => {
    useAppStore.setState({ activeTool: "player", lang: "en" });
    render(<HeaderBar />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Music Player");
  });

  it("translates title correctly for Persian (fa)", () => {
    useAppStore.setState({ activeTool: "player", lang: "fa" });
    render(<HeaderBar />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("موزیک‌پلیر");
  });

  it("renders no tool switcher in the header", () => {
    useAppStore.setState({ activeTool: "player", lang: "en" });
    render(<HeaderBar />);

    expect(screen.queryByRole("tablist", { name: /Tool Switcher/i })).toBeNull();
  });
});
