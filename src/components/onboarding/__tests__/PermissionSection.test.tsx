// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PermissionSection } from "../PermissionSection";
import { useAppStore } from "../../../stores/useAppStore";
import { useMusicPlayerStore } from "../../../stores/useMusicPlayerStore";
import * as platform from "../../../utils/platform";
import * as tauri from "../../../utils/tauri";

vi.mock("../../../utils/tauri", () => ({
  openAppSettings: vi.fn(),
  updateAppSettings: vi.fn(),
}));

describe("PermissionSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ lang: "en" });
  });

  afterEach(() => {
    cleanup();
  });

  describe("Android platform", () => {
    beforeEach(() => {
      vi.spyOn(platform, "isAndroid").mockReturnValue(true);
    });

    it("renders grant button when status is denied and calls requestMediaPermission on click", () => {
      const mockRequest = vi.fn().mockResolvedValue(undefined);
      useMusicPlayerStore.setState({
        permissionStatus: "denied",
        requestMediaPermission: mockRequest,
      });

      render(<PermissionSection />);
      const grantBtn = screen.getByRole("button", { name: /Grant access/i });
      expect(grantBtn).toBeTruthy();

      fireEvent.click(grantBtn);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });

    it("renders open settings button when status is permanentlyDenied", () => {
      useMusicPlayerStore.setState({
        permissionStatus: "permanentlyDenied",
      });

      render(<PermissionSection />);
      const settingsBtn = screen.getByRole("button", { name: /Open device settings/i });
      expect(settingsBtn).toBeTruthy();

      fireEvent.click(settingsBtn);
      expect(tauri.openAppSettings).toHaveBeenCalledTimes(1);
    });

    it("displays granted status when permissionStatus is granted", () => {
      useMusicPlayerStore.setState({
        permissionStatus: "granted",
      });

      render(<PermissionSection />);
      expect(screen.getByText(/Access granted/i)).toBeTruthy();
    });

    it("allows skipping the permission section without blocking", () => {
      useMusicPlayerStore.setState({
        permissionStatus: "denied",
      });

      render(<PermissionSection />);
      const skipBtn = screen.getByRole("button", { name: /Skip access/i });
      expect(skipBtn).toBeTruthy();

      fireEvent.click(skipBtn);
      // Section acknowledges skip
      expect(screen.queryByRole("button", { name: /Grant access/i })).toBeNull();
    });
  });

  describe("Desktop platform", () => {
    beforeEach(() => {
      vi.spyOn(platform, "isAndroid").mockReturnValue(false);
    });

    it("renders desktop folder selection and skip button", () => {
      render(<PermissionSection />);
      expect(screen.getByRole("button", { name: /Choose music folders/i })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Skip access/i })).toBeTruthy();
    });
  });
});
