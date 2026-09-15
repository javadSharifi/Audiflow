// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { KeepAlivePane } from "../KeepAlivePane";

describe("KeepAlivePane", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders children with display block/flex when active is true", () => {
    const { container } = render(
      <KeepAlivePane active={true}>
        <div data-testid="child-view">Active Content</div>
      </KeepAlivePane>
    );

    const child = screen.getByTestId("child-view");
    expect(child).toBeDefined();
    expect(child.textContent).toBe("Active Content");

    const pane = container.firstElementChild as HTMLElement;
    expect(pane.style.display).not.toBe("none");
    expect(pane.getAttribute("aria-hidden")).toBe("false");
  });

  it("hides children using display: none and aria-hidden when active is false and lazy is false", () => {
    const { container } = render(
      <KeepAlivePane active={false} lazy={false}>
        <div data-testid="child-view">Dormant Content</div>
      </KeepAlivePane>
    );

    const child = screen.getByTestId("child-view");
    expect(child).toBeDefined();

    const pane = container.firstElementChild as HTMLElement;
    expect(pane.style.display).toBe("none");
    expect(pane.getAttribute("aria-hidden")).toBe("true");
  });

  it("defers mounting when active is false and lazy is true (default)", () => {
    render(
      <KeepAlivePane active={false}>
        <div data-testid="lazy-child">Lazy Content</div>
      </KeepAlivePane>
    );

    expect(screen.queryByTestId("lazy-child")).toBeNull();
  });

  it("preserves DOM nodes across active toggles without unmounting", () => {
    const { container, rerender } = render(
      <KeepAlivePane active={true}>
        <input data-testid="test-input" defaultValue="persisted-value" />
      </KeepAlivePane>
    );

    const input = screen.getByTestId("test-input") as HTMLInputElement;
    expect(input.value).toBe("persisted-value");

    // Toggle active to false
    rerender(
      <KeepAlivePane active={false}>
        <input data-testid="test-input" defaultValue="persisted-value" />
      </KeepAlivePane>
    );

    const pane = container.firstElementChild as HTMLElement;
    expect(pane.style.display).toBe("none");
    // Node is still in the document tree, retaining its value
    expect(screen.getByTestId("test-input")).toBeDefined();

    // Toggle back to active
    rerender(
      <KeepAlivePane active={true}>
        <input data-testid="test-input" defaultValue="persisted-value" />
      </KeepAlivePane>
    );

    expect(pane.style.display).not.toBe("none");
    expect((screen.getByTestId("test-input") as HTMLInputElement).value).toBe("persisted-value");
  });
});
