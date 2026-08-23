import { useEffect } from "react";

/**
 * Smooth, frame-based auto-scroll for hands-free playing.
 * Pauses while the tab is hidden and avoids interval drift on mobile browsers.
 */
export function useAutoScroll(enabled: boolean, pixelsPerSecond = 18) {
  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let previous = performance.now();

    const tick = (now: number) => {
      frame = window.requestAnimationFrame(tick);
      if (document.hidden) {
        previous = now;
        return;
      }

      const deltaSeconds = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      const maxScrollTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (window.scrollY >= maxScrollTop - 1) return;

      window.scrollBy({ top: pixelsPerSecond * deltaSeconds, behavior: "auto" });
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, pixelsPerSecond]);
}
