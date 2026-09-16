// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { HeaderBar } from "../HeaderBar";
import { useAppStore } from "../../stores/useAppStore";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "1.2.14") }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

const mockRelease = (tag: string) =>
  vi.fn(async () => ({
    ok: true,
    json: async () => ({
      tag_name: tag,
      name: `Audiflow ${tag}`,
      html_url: `https://github.com/javadSharifi/audio-converter/releases/tag/${tag}`,
      body: "Bug fixes",
    }),
  }));

beforeEach(() => {
  cleanup();
  try {
    localStorage.clear();
  } catch {}
  useAppStore.setState({
    activeTool: "converter",
    lang: "en",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
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

describe("HeaderBar Update Notice", () => {
  it("shows the update button when a newer GitHub release exists", async () => {
    vi.stubGlobal("fetch", mockRelease("v9.9.9"));
    useAppStore.setState({ activeTool: "converter", lang: "en" });
    render(<HeaderBar />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Update available" })).not.toBeNull();
    });
  });

  it("hides the update button when already on the latest version", async () => {
    vi.stubGlobal("fetch", mockRelease("v1.2.14"));
    useAppStore.setState({ activeTool: "converter", lang: "en" });
    render(<HeaderBar />);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Update available" })).toBeNull();
    });
  });

  it("opens the update dialog with download action on click", async () => {
    vi.stubGlobal("fetch", mockRelease("v9.9.9"));
    useAppStore.setState({ activeTool: "converter", lang: "en" });
    render(<HeaderBar />);

    const btn = await screen.findByRole("button", { name: "Update available" });
    btn.click();

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "A new version is here" })).not.toBeNull();
    });
    expect(screen.getByRole("button", { name: "Download update" })).not.toBeNull();
  });
});
