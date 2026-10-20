import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 110;

// Pull down from the top of the page to refresh. The whole app scrolls the
// window, so this listens on window and only engages when already at the top.
// Touches that start inside an open sheet are ignored.
export function usePullToRefresh(onRefresh, refreshing) {
  const [pull, setPull] = useState(0);
  const startY = useRef(null);
  const pullRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const onStart = (e) => {
      if (window.scrollY > 0 || e.touches.length !== 1 || e.target.closest?.('[role="dialog"]')) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // Resistance so the indicator slows down the further it is pulled.
      const next = Math.min(MAX_PULL, dy * 0.5);
      pullRef.current = next;
      setPull(next);
    };
    const onEnd = () => {
      if (startY.current !== null && pullRef.current >= THRESHOLD) onRefreshRef.current?.();
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return { pull, ready: pull >= THRESHOLD, refreshing };
}

export const PullIndicator = ({ pull, ready, refreshing }) => {
  const visible = pull > 0 || refreshing;
  const offset = refreshing ? 56 : pull;
  return (
    <div
      className="fixed left-0 right-0 z-30 flex justify-center pointer-events-none"
      style={{ top: "calc(env(safe-area-inset-top) + 64px)", transform: `translateY(${offset - 48}px)`, opacity: visible ? 1 : 0, transition: pull > 0 ? "none" : "transform 200ms ease, opacity 200ms ease" }}
      aria-hidden="true"
      data-testid="pull-indicator"
    >
      <div className="h-10 w-10 rounded-full bg-[#0D1A12] border border-white/10 flex items-center justify-center shadow-lg">
        <RefreshCw
          className={`h-4 w-4 ${refreshing ? "spin-slow" : ""}`}
          style={{ color: ready || refreshing ? "#39B54A" : "rgba(255,255,255,0.6)", transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  );
};
