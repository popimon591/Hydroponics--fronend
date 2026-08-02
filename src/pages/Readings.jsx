import { useEffect, useState, useCallback, memo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Wifi, WifiOff } from "lucide-react";
import CircularGauge from "@/components/CircularGauge";
import { ATTRIBUTES, attrStatus, emptyReadings, fetchDeviceLiveState, statusColor, timeAgoShort } from "@/lib/telemetry";
import { LS_KEYS, readJSON, writeJSON } from "@/lib/storage";

const POLL_MS = 30000;
const TIMEAGO_TICK_MS = 15000;

const SensorCard = memo(function SensorCard({ a, value }) {
  const status = attrStatus(a, value);
  const color = statusColor(status);
  const optimalUnit = a.unit === "PH" ? "" : a.unit;
  return (
    <div className="surface p-4 flex flex-col items-center" data-testid={`sensor-card-${a.key}`}>
      <div className="w-full flex items-start justify-between">
        <div className="text-[9.5px] tracking-[0.16em] uppercase text-white/50 leading-tight">{a.label}</div>
        <span className="pill" style={{ color, background: `${color}1F` }}>{status}</span>
      </div>
      <div className="mt-3"><CircularGauge a={a} value={value} size={112} thickness={7} /></div>
      <div className="mt-2 text-[10px] text-white/35 leading-tight text-center">Optimal: {a.target[0]}–{a.target[1]} {optimalUnit}</div>
    </div>
  );
});

const DeviceHeader = ({ device, onBack }) => (
  <div className="flex items-center gap-3 py-3">
    <button onClick={onBack} className="h-9 w-9 rounded-full bg-white/[0.04] border border-white/8 flex items-center justify-center hover:border-[#39B54A]/40 transition-colors" data-testid="btn-back"><ArrowLeft className="h-4 w-4 text-white/80" /></button>
    <div className="flex-1 min-w-0"><div className="font-display font-bold text-white text-lg truncate">{device.name}</div><div className="text-xs text-white/40">{device.zone} · {device.kind}</div></div>
    <ConnectivityBadge online={device.online} />
  </div>
);

const ConnectivityBadge = ({ online }) => {
  const color = online ? "#39B54A" : "#E36361";
  const Icon = online ? Wifi : WifiOff;
  return <div className="flex items-center gap-1 text-[11px]" style={{ color }}><Icon className="h-3.5 w-3.5" />{online ? "Online" : "Offline"}</div>;
};

const RefreshRow = ({ refreshing, lastRefresh, onRefresh }) => (
  <div className="mt-2 flex items-center justify-between">
    <div className="flex items-center gap-1.5 text-[12px] text-white/50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "spin-slow text-[#39B54A]" : ""}`} /><span data-testid="refresh-time">Updated {lastRefresh ? timeAgoShort(lastRefresh) : "No data"}</span></div>
    <button onClick={onRefresh} className="text-[12px] text-[#39B54A] font-semibold hover:text-[#4FD263] transition-colors" data-testid="btn-refresh-readings">Refresh</button>
  </div>
);

const CARD_VARIANTS = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const GRID_VARIANTS = { show: { transition: { staggerChildren: 0.05 } } };

export default function Readings({ deviceId, onBack }) {
  const devices = readJSON(LS_KEYS.DEVICES, []);
  const device = devices.find((item) => item.id === deviceId) || devices[0];
  const initialMap = readJSON(LS_KEYS.READINGS, {});
  const [readings, setReadings] = useState(initialMap[device?.id] || emptyReadings());
  const [lastRefresh, setLastRefresh] = useState(device?.lastSync || null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveDevice, setLiveDevice] = useState(device);
  const [, forceTick] = useState(0);

  const loadReadings = useCallback(async () => {
    if (!device) return;
    setRefreshing(true);
    try {
      const result = await fetchDeviceLiveState(device);
      setLiveDevice(result.device);
      setReadings(result.readings);
      setLastRefresh(result.readings.updated_at ? Date.parse(result.readings.updated_at) : result.device.lastSync || Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [device]);

  useEffect(() => { loadReadings().catch((error) => console.error("Failed to load device readings:", error)); }, [loadReadings]);
  useEffect(() => {
    if (!device) return undefined;
    const timer = setInterval(() => { loadReadings().catch((error) => console.error("Failed to refresh device readings:", error)); }, POLL_MS);
    return () => clearInterval(timer);
  }, [device, loadReadings]);
  useEffect(() => {
    const timer = setInterval(() => forceTick((x) => x + 1), TIMEAGO_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!device?.id) return;
    const all = readJSON(LS_KEYS.READINGS, {});
    all[device.id] = readings;
    writeJSON(LS_KEYS.READINGS, all);
  }, [device?.id, readings]);

  if (!device) {
    return <div className="mx-auto max-w-md px-6 pt-10 pb-36 text-center"><p className="text-white/50">No device selected.</p><button onClick={onBack} className="mt-4 text-[#39B54A]">Back to Home</button></div>;
  }

  return (
    <div className="mx-auto max-w-md px-6 pt-2 pb-36">
      <DeviceHeader device={liveDevice || device} onBack={onBack} />
      <RefreshRow refreshing={refreshing} lastRefresh={lastRefresh} onRefresh={loadReadings} />
      <motion.div className="mt-5 grid grid-cols-2 gap-3" initial="hidden" animate="show" variants={GRID_VARIANTS} data-testid="readings-grid">
        {ATTRIBUTES.map((a) => <motion.div key={a.key} variants={CARD_VARIANTS}><SensorCard a={a} value={readings[a.key]} /></motion.div>)}
      </motion.div>
    </div>
  );
}

