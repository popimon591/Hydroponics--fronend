import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import "@/App.css";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";
import Auth from "@/pages/Auth";
import DevicesDashboard from "@/pages/DevicesDashboard";
import Home from "@/pages/Home";
import Readings from "@/pages/Readings";
import Splash from "@/pages/Splash";
import { AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";

import { ConfirmSheet, ProfileSheet } from "@/components/Feedback";
import { useBackHandler } from "@/lib/backHandler";
import { clearSession, clearUserData, getSessionUser, hasSession } from "@/lib/storage";
import { SESSION_EXPIRED_EVENT } from "@/lib/telemetry";
import { useMobile } from "@/lib/useMobile";

export default function App() {
  const [phase, setPhase] = useState("splash");
  const [operator, setOperator] = useState(() => getSessionUser());
  const [tab, setTab] = useState("home");
  const [view, setView] = useState("index");
  const [activeDevice, setActiveDevice] = useState(null);
  // What the Devices tab should open on: { tab: "list" | "alarms", add: bool }
  const [devicesIntent, setDevicesIntent] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [appReady, setAppReady] = useState(false);
  useEffect(() => { setAppReady(true); }, []);

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

  // ── Scroll position per screen ──────────────────────────────────────────
  // The whole app scrolls the window, so without this a device opened from
  // halfway down Home would land halfway down Readings. Readings always
  // starts at the top; Home and Devices come back where the user left them.
  const screenKey = view === "readings" ? `readings:${activeDevice}` : tab;
  const scrollPositions = useRef({});
  const currentScreen = useRef(screenKey);
  useEffect(() => {
    const onScroll = () => { scrollPositions.current[currentScreen.current] = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useLayoutEffect(() => {
    currentScreen.current = screenKey;
    window.scrollTo(0, screenKey.startsWith("readings:") ? 0 : scrollPositions.current[screenKey] || 0);
  }, [screenKey]);

  // ── Session restore on mount ────────────────────────────────────────────
  useEffect(() => {
    setOperator(getSessionUser());
  }, []);

  // ── Phase transitions ───────────────────────────────────────────────────
  const onSplashDone = () => setPhase(hasSession() ? "app" : "auth");

  const onAuthed = (user) => {
    setOperator(user);
    setPhase("app");
  };

  const onLogout = useCallback(() => {
    clearSession();
    clearUserData();
    setConfirmLogout(false);
    setProfileOpen(false);
    setOperator(null);
    setActiveDevice(null);
    setDevicesIntent(null);
    setTab("home");
    setView("index");
    setPhase("auth");
    scrollPositions.current = {};
  }, []);

  // The API layer fires this when the session can no longer be refreshed.
  useEffect(() => {
    const onExpired = () => {
      if (!hasSession()) {
        onLogout();
        // Several requests can fail at once; the id keeps it to one toast.
        toast.error("Your session has expired. Please sign in again.", { id: "session-expired" });
      }
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [onLogout]);

  const openDevice = (id) => {
    setActiveDevice(id);
    setView("readings");
  };

  const changeTab = (nextTab, intent = null) => {
    setDevicesIntent(intent);
    setTab(nextTab);
    setView("index");
  };

  // Android back: Readings → list, Devices tab → Home, Home → minimize.
  useBackHandler(() => {
    if (phase !== "app") return false;
    if (view === "readings") {
      setView("index");
      return true;
    }
    if (tab !== "home") {
      changeTab("home");
      return true;
    }
    return false;
  });

  return (
    <div className={phase === "auth" ? "App h-[100dvh] min-h-0 overflow-hidden" : "App min-h-screen"}>
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
          <TopBar operator={operator} onOpenProfile={() => setProfileOpen(true)} />
          {view === "readings" ? (
            <Readings
              deviceId={activeDevice}
              onBack={() => setView("index")}
              pollResumeKey={pollResumeKey}
            />
          ) : tab === "home" ? (
            <Home
              onOpenDevice={openDevice}
              onAddDevice={() => changeTab("device", { tab: "list", add: true })}
              onOpenAlarms={() => changeTab("device", { tab: "alarms" })}
              pollResumeKey={pollResumeKey}
            />
          ) : (
            <DevicesDashboard
              onOpenDevice={openDevice}
              intent={devicesIntent}
              pollResumeKey={pollResumeKey}
            />
          )}
          <BottomNav active={tab} onChange={(next) => changeTab(next)} />
          <AnimatePresence>
            {profileOpen && !confirmLogout && (
              <ProfileSheet
                operator={operator}
                onLogout={() => setConfirmLogout(true)}
                onClose={() => setProfileOpen(false)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {confirmLogout && (
              <ConfirmSheet
                title="Log out?"
                body="You will need to verify your phone number again to sign back in."
                confirmLabel="Log out"
                onConfirm={onLogout}
                onCancel={() => { setConfirmLogout(false); setProfileOpen(false); }}
                testid="confirm-logout"
              />
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
