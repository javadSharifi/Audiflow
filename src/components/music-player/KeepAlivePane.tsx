import React, { memo, useEffect, useState } from "react";

export interface KeepAlivePaneProps {
  active: boolean;
  children: React.ReactNode;
  /**
   * If true (default), defers initial mounting until the tab is first visited or pre-warmed.
   * Once activated, the container remains mounted in the DOM permanently.
   */
  lazy?: boolean;
  /**
   * If true, mounts the tab into the DOM in the background (display: none)
   * so it is warm and ready before the user clicks it.
   */
  prewarm?: boolean;
}

/**
 * High-performance tab view preservation container.
 * Keeps inactive views mounted in the DOM using CSS display: none
 * to achieve <10ms tab switching and preserve exact scroll positions
 * without React component unmounting/re-mounting thrashing.
 */
export const KeepAlivePane = memo(function KeepAlivePane({
  active,
  children,
  lazy = true,
  prewarm = false,
}: KeepAlivePaneProps): React.JSX.Element | null {
  const [hasMounted, setHasMounted] = useState(!lazy || active || prewarm);

  if ((active || prewarm) && !hasMounted) {
    setHasMounted(true);
  }

  useEffect(() => {
    if ((active || prewarm) && !hasMounted) {
      setHasMounted(true);
    }
  }, [active, prewarm, hasMounted]);

  const shouldRender = hasMounted || active || prewarm;
  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`flex flex-col flex-1 w-full min-h-0 overflow-hidden ${
        active ? "flex" : "hidden"
      }`}
      style={{ display: active ? undefined : "none" }}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
});
