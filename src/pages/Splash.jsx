import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { GroxvelLogo } from "@/components/GroxvelLogo";

// Brand moment with a loading percentage after the native launch screen
// hides; kept short so launching the app still feels fast.
const DURATION_MS = 1500;

export default function Splash({ onDone }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const startedAt = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    let raf;
    let cancelled = false;
    const tick = () => {
      const elapsed = Date.now() - startedAt.current;
      const p = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(p);
      if (p >= 100 && !finished.current) {
        finished.current = true;
        setLeaving(true);
        // let the fade-out play, then hand off
        setTimeout(() => onDone?.(), 300);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    // On a cold start Android's launch screen can still be covering the app
    // when this mounts. Hide it first and start counting once it has faded,
    // so the user actually sees the percentage run from 0 to 100.
    const start = () => {
      if (cancelled) return;
      startedAt.current = Date.now();
      raf = requestAnimationFrame(tick);
    };
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 300 })
        .catch(() => {})
        .then(() => setTimeout(start, 300));
    } else {
      start();
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // Intentionally ignore onDone identity changes — the splash controls its own lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}
      style={{ background: "#080F0B" }}
      data-testid="splash-screen"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-3xl soft-glow" />
      </div>

      <div className="relative fade-up">
        <GroxvelLogo height={68} />
      </div>

      <div className="relative mt-10 w-56">
        <div className="h-[3px] w-full rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #279A38, #4FD263)",
              boxShadow: "0 0 12px rgba(57,181,74,0.5)",
              transition: "width 120ms linear",
            }}
            data-testid="splash-progress-bar"
          />
        </div>
        <div className="mt-3 text-center text-xs tracking-[0.32em] text-white/60 tabular-nums" data-testid="splash-progress-text">
          {Math.floor(progress)}%
        </div>
      </div>
    </div>
  );
}
