/**
 * Lightweight platform detection from the webview user-agent.
 * Used to adapt UI that has no meaning on mobile (e.g. folder pickers,
 * opening an OS file explorer) and to route Android-specific behavior.
 */
export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}
