import { useEffect } from "react";

export function useAutoScroll(enabled: boolean, pixelsPerTick = 1, intervalMs = 55) {
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      window.scrollBy({ top: pixelsPerTick, behavior: "auto" });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, pixelsPerTick]);
}
