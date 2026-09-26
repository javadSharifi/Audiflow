// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LanguagePickerModal } from "../LanguagePickerModal";
import { useAppStore } from "../../../stores/useAppStore";

describe("LanguagePickerModal", () => {
  beforeEach(() => {
    useAppStore.setState({ lang: "fa", targetLanguage: "fa" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders when open and lists languages", () => {
    render(<LanguagePickerModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("language-search-input")).toBeDefined();
    expect(screen.getByText("فارسی")).toBeDefined();
  });

  it("filters languages by search query", () => {
    render(<LanguagePickerModal isOpen={true} onClose={vi.fn()} />);

    const searchInput = screen.getByTestId("language-search-input");
    fireEvent.change(searchInput, { target: { value: "German" } });

    expect(screen.getByText("آلمانی")).toBeDefined();
    expect(screen.queryByText("فارسی")).toBeNull();
  });

  it("selects language on click and closes modal", () => {
    const onClose = vi.fn();
    render(<LanguagePickerModal isOpen={true} onClose={onClose} />);

    const germanBtn = screen.getByText("آلمانی");
    fireEvent.click(germanBtn);

    expect(useAppStore.getState().targetLanguage).toBe("de");
    expect(onClose).toHaveBeenCalled();
  });
});
