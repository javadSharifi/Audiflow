/**
 * Lightweight platform detection from the webview user-agent.
 * Used to adapt UI that has no meaning on mobile (e.g. folder pickers,
 * opening an OS file explorer) and to route Android-specific behavior.
 */
export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

export function isMacOS(): boolean {
  return typeof navigator !== "undefined" && /macintosh|mac os x/i.test(navigator.userAgent);
}

export function isWindows(): boolean {
  return typeof navigator !== "undefined" && /windows|win32/i.test(navigator.userAgent);
}
