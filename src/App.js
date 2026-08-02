import { useCallback, useEffect, useRef, useState } from "react";

import "@/App.css";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import Auth from "@/pages/Auth";
import DevicesDashboard from "@/pages/DevicesDashboard";
import Home from "@/pages/Home";
import Readings from "@/pages/Readings";
import Splash from "@/pages/Splash";
import { Toaster } from "sonner";

import { clearSession, getSessionUser, hasSession } from "@/lib/storage";
import { useMobile } from "@/lib/useMobile";

export default function App() {
  const [phase, setPhase] = useState("splash");
  const [operator, setOperator] = useState(() => getSessionUser());
  const [tab, setTab] = useState("home");
  const [view, setView] = useState("index");
  const [activeDevice, setActiveDevice] = useState(null);

  // appReady becomes true once we have moved past splash into the real UI
  const [appReady, setAppReady] = useState(false);

  // pollResumeKey: incrementing this tells child pages to re-fetch immediately
  const [pollResumeKey, setPollResumeKey] = useState(0);

  // ── Capacitor mobile lifecycle ──────────────────────────────────────────
  const onResume = useCallback(() => {
    // App returned to foreground → nudge sensor pages to refresh
    setPollResumeKey((k) => k + 1);
  }, []);

  const onPause = useCallback(() => {
    // App went to background — child pages handle their own polling via
    // pollResumeKey; nothing to do here at top level
  }, []);

  useMobile({ onResume, onPause, appReady });

  // ── Session restore on mount ────────────────────────────────────────────
  useEffect(() => {
    setOperator(getSessionUser());
  }, []);

  // ── Phase transitions ───────────────────────────────────────────────────
  const onSplashDone = () => {
    setPhase(hasSession() ? "app" : "auth");
    // Signal useMobile to hide the native splash screen
    setAppReady(true);
  };

  const onAuthed = (user) => {
    setOperator(user);
    setPhase("app");
    setAppReady(true);
  };

  const onLogout = () => {
    clearSession();
    setOperator(null);
    setActiveDevice(null);
    setTab("home");
    setView("index");
    setPhase("auth");
  };

  const openDevice = (id) => {
    setActiveDevice(id);
    setView("readings");
  };

  const changeTab = (nextTab) => {
    setTab(nextTab);
    setView("index");
  };

  return (
    <div className="App min-h-screen">
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: {
            background: "#0D1A12",
            border: "1px solid rgba(57,181,74,0.22)",
            color: "#fff",
            fontFamily: "Plus Jakarta Sans, sans-serif",
          },
        }}
      />

      {phase === "splash" && <Splash onDone={onSplashDone} />}
      {phase === "auth" && <Auth onAuthed={onAuthed} />}
      {phase === "app" && operator && (
        <>
          <TopBar operator={operator} onLogout={onLogout} />
          {view === "readings" ? (
            <Readings
              deviceId={activeDevice}
              onBack={() => setView("index")}
              pollResumeKey={pollResumeKey}
            />
          ) : tab === "home" ? (
            <Home
              onOpenDevice={openDevice}
              pollResumeKey={pollResumeKey}
            />
          ) : (
            <DevicesDashboard
              onOpenDevice={openDevice}
              pollResumeKey={pollResumeKey}
            />
          )}
          <BottomNav active={tab} onChange={changeTab} />
        </>
      )}
    </div>
  );
}
