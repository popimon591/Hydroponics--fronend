import { useState } from "react";
import "@/App.css";
import { Toaster } from "sonner";
import Splash from "@/pages/Splash";
import Auth from "@/pages/Auth";
import TopBar from "@/components/TopBar";
import BottomNav from "@/components/BottomNav";
import Home from "@/pages/Home";
import DevicesDashboard from "@/pages/DevicesDashboard";
import Readings from "@/pages/Readings";

export default function App() {
  const [phase, setPhase] = useState("splash");
  const [operator, setOperator] = useState(() => {
    try {
      const raw = localStorage.getItem("groxvel_session");
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s?.expiresAt > Date.now()) return s.operator;
      localStorage.removeItem("groxvel_session");
    } catch (err) {
      console.error("Failed to restore session:", err);
    }
    return null;
  });
  const [tab, setTab] = useState("home");            // home | device
  const [view, setView] = useState("index");         // index | readings
  const [activeDevice, setActiveDevice] = useState(null);

  const onSplashDone = () => setPhase(operator ? "app" : "auth");

  const onAuthed = (op) => {
    const session = { operator: op, expiresAt: Date.now() + 1000*60*60*24*30 };
    localStorage.setItem("groxvel_session", JSON.stringify(session));
    setOperator(op);
    setPhase("app");
  };

  const onLogout = () => {
    localStorage.removeItem("groxvel_session");
    setOperator(null);
    setActiveDevice(null);
    setTab("home"); setView("index");
    setPhase("auth");
  };

  const openDevice = (id) => {
    setActiveDevice(id);
    setView("readings");
  };

  const changeTab = (t) => {
    setTab(t);
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
      {phase === "auth"   && <Auth onAuthed={onAuthed} />}
      {phase === "app" && operator && (
        <>
          <TopBar operator={operator} onLogout={onLogout} />
          {view === "readings"
            ? <Readings deviceId={activeDevice} onBack={() => setView("index")} />
            : tab === "home"
              ? <Home onOpenDevice={openDevice} />
              : <DevicesDashboard onOpenDevice={openDevice} />}
          <BottomNav active={tab} onChange={changeTab} />
        </>
      )}
    </div>
  );
}
