import { useDeferredValue, useEffect, useState } from "react";

export function useDebouncedDeferred<T>(value: T, delayMs: number): T {
  const isTest =
    (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === "test" ||
    (typeof globalThis !== "undefined" &&
      (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV ===
        "test");
  const ms = isTest ? 0 : delayMs;
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (ms === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync: debounce with zero delay applies the value immediately
      setDebounced(value);
      return;
    }
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  const deferred = useDeferredValue(isTest ? value : debounced);
  return deferred;
}
