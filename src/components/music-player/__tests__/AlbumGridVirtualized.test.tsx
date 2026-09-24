// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { getResponsiveAlbumCols, useAlbumColumns } from "../useAlbumColumns";

describe("AlbumGridVirtualized Responsive Columns", () => {
  afterEach(() => {
    cleanup();
  });

  describe("getResponsiveAlbumCols", () => {
    it("maps viewport breakpoints correctly", () => {
      expect(getResponsiveAlbumCols(1440)).toBe(6);
      expect(getResponsiveAlbumCols(1024)).toBe(6);
      expect(getResponsiveAlbumCols(900)).toBe(5);
      expect(getResponsiveAlbumCols(768)).toBe(5);
      expect(getResponsiveAlbumCols(700)).toBe(4);
      expect(getResponsiveAlbumCols(640)).toBe(4);
      expect(getResponsiveAlbumCols(600)).toBe(3);
      expect(getResponsiveAlbumCols(360)).toBe(3);
    });
  });

  describe("useAlbumColumns hook", () => {
    it("initializes synchronously to 6 columns on desktop viewport without re-render delay", () => {
      window.innerWidth = 1200;
      const { result } = renderHook(() => useAlbumColumns());

      // Immediate synchronous value must be 6 on first render pass
      expect(result.current).toBe(6);
    });

    it("initializes synchronously to 3 columns on mobile viewport", () => {
      window.innerWidth = 375;
      const { result } = renderHook(() => useAlbumColumns());

      expect(result.current).toBe(3);
    });

    it("updates responsive columns when window resize fires", () => {
      window.innerWidth = 375;
      const { result } = renderHook(() => useAlbumColumns());
      expect(result.current).toBe(3);

      act(() => {
        window.innerWidth = 1024;
        window.dispatchEvent(new Event("resize"));
      });

      expect(result.current).toBe(6);
    });
  });
});
