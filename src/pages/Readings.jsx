import { useEffect, useState, useCallback, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import CircularGauge from "@/components/CircularGauge";
import { ErrorBanner, Sheet } from "@/components/Feedback";
import { attributesFor, attrStatus, emptyReadings, fetchDeviceLiveState, fetchSensorHistory, statusColor, statusLabel, timeAgoShort, unitLabel } from "@/lib/telemetry";
import { LS_KEYS, readJSON, writeJSON } from "@/lib/storage";

const POLL_MS = 30000;
const TIMEAGO_TICK_MS = 15000;

const SensorCard = memo(function SensorCard({ a, value, onOpen }) {
  const status = attrStatus(a, value);
  const color = statusColor(status);
  const unit = unitLabel(a.unit);
  return (
    <button onClick={() => onOpen(a)} className="w-full surface surface-hover p-4 flex flex-col items-center transition-colors" aria-label={`${a.label}: view 24-hour history`} data-testid={`sensor-card-${a.key}`}>
      <div className="w-full flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-white/75 leading-tight text-left">{a.label}</div>
        <span className="pill flex-shrink-0" style={{ color, background: `${color}1F` }}>{statusLabel(status)}</span>
      </div>
      <div className="mt-3"><CircularGauge a={a} value={value} size={112} thickness={7} /></div>
      <div className="mt-2 text-xs text-white/55 leading-tight text-center">Ideal: {a.target[0]}–{a.target[1]} {unit}</div>
    </button>
  );
});

const DeviceHeader = ({ device, onBack }) => (
  <div className="flex items-center gap-3 py-3">
    <button onClick={onBack} className="h-11 w-11 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center hover:border-[#39B54A]/40 transition-colors flex-shrink-0" aria-label="Back" data-testid="btn-back"><ArrowLeft className="h-5 w-5 text-white/80" /></button>
    <div className="flex-1 min-w-0"><div className="font-display font-bold text-white text-lg truncate">{device.name}</div><div className="text-xs text-white/60 truncate">{device.zone} · {device.kind}</div></div>
    <ConnectivityBadge online={device.online} />
  </div>
);

const ConnectivityBadge = ({ online }) => {
  const color = online ? "#39B54A" : "#E36361";
  const Icon = online ? Wifi : WifiOff;
  return <div className="flex items-center gap-1 text-xs font-medium flex-shrink-0" style={{ color }} data-testid="connectivity"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{online ? "Online" : "Offline"}</div>;
};

const RefreshRow = ({ refreshing, lastRefresh, onRefresh }) => (
  <div className="mt-2 flex items-center justify-between">
    <div className="flex items-center gap-1.5 text-xs text-white/60"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "spin-slow text-[#39B54A]" : ""}`} aria-hidden="true" /><span data-testid="refresh-time">{lastRefresh ? `Last reading ${timeAgoShort(lastRefresh).toLowerCase()}` : "No readings yet"}</span></div>
    <button onClick={onRefresh} disabled={refreshing} className="h-10 px-3 -mr-3 text-sm text-[#39B54A] font-semibold hover:text-[#4FD263] disabled:opacity-50 transition-colors" data-testid="btn-refresh-readings">{refreshing ? "Refreshing..." : "Refresh"}</button>
  </div>
);

const formatTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const HistorySheet = ({ a, deviceId, onClose }) => {
  const [state, setState] = useState({ loading: true, points: [], error: null });
  const unit = unitLabel(a.unit);

  useEffect(() => {
    let cancelled = false;
    fetchSensorHistory(deviceId, 24)
      .then((points) => { if (!cancelled) setState({ loading: false, points: points.filter((p) => p[a.key] !== null), error: null }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, points: [], error: err.message }); });
    return () => { cancelled = true; };
  }, [deviceId, a.key]);

  return (
    <Sheet onClose={onClose} labelledBy="history-title" testid="history-sheet">
      <div className="flex items-start justify-between">
        <div>
          <div id="history-title" className="text-white font-display font-bold text-lg">{a.label}</div>
          <div className="text-xs text-white/60 mt-1">Last 24 hours · ideal {a.target[0]}–{a.target[1]} {unit}</div>
        </div>
        <button onClick={onClose} className="h-10 w-10 -mr-2 -mt-2 rounded-full flex items-center justify-center text-white/60 hover:text-white active:bg-white/[0.06]" aria-label="Close" data-testid="btn-close-history"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-5 h-56" data-testid="history-chart">
        {state.loading ? (
          <div className="h-full rounded-2xl bg-white/[0.04] animate-pulse" />
        ) : state.error ? (
          <div className="h-full flex items-center justify-center text-sm text-white/60 text-center px-4">{state.error}</div>
        ) : state.points.length < 2 ? (
          <div className="h-full flex items-center justify-center text-sm text-white/60 text-center px-4">Not enough readings in the last 24 hours to draw a chart.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 224 }}>
            <AreaChart data={state.points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#39B54A" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#39B54A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <ReferenceArea y1={a.target[0]} y2={a.target[1]} fill="#39B54A" fillOpacity={0.08} />
              <XAxis dataKey="at" type="number" domain={["dataMin", "dataMax"]} tickFormatter={formatTime} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" minTickGap={40} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" width={44} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={formatTime}
                formatter={(v) => [`${v} ${unit}`, a.label]}
                contentStyle={{ background: "#0D1A12", border: "1px solid rgba(57,181,74,0.3)", borderRadius: 12, color: "#fff" }}
              />
              <Area type="monotone" dataKey={a.key} stroke="#39B54A" strokeWidth={2} fill="url(#historyFill)" connectNulls isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Sheet>
  );
};

const CARD_VARIANTS = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const GRID_VARIANTS = { show: { transition: { staggerChildren: 0.05 } } };

export default function Readings({ deviceId, onBack, pollResumeKey }) {
  const [device] = useState(() => readJSON(LS_KEYS.DEVICES, []).find((item) => item.id === deviceId) || null);
  const [readings, setReadings] = useState(() => readJSON(LS_KEYS.READINGS, {})[deviceId] || emptyReadings());
  const [lastRefresh, setLastRefresh] = useState(device?.lastSync || null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [liveDevice, setLiveDevice] = useState(device);
  const [historyAttr, setHistoryAttr] = useState(null);
  const [, forceTick] = useState(0);

  const loadReadings = useCallback(async () => {
    if (!device) return;
    setRefreshing(true);
    try {
      const result = await fetchDeviceLiveState(device);
      if (result.error) {
        // Keep the last good readings on screen and say so.
        setError(result.error);
        return;
      }
      setError(null);
      setLiveDevice(result.device);
      setReadings(result.readings);
      setLastRefresh(result.device.lastSync || null);
    } finally {
      setRefreshing(false);
    }
  }, [device]);

  useEffect(() => { loadReadings(); }, [loadReadings, pollResumeKey]);
  useEffect(() => {
    if (!device) return undefined;
    const timer = setInterval(loadReadings, POLL_MS);
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
    return <div className="mx-auto max-w-md px-6 pt-10 pb-36 text-center"><p className="text-white/60">This device is no longer available.</p><button onClick={onBack} className="mt-4 h-11 px-5 rounded-full text-[#39B54A] font-semibold">Back to devices</button></div>;
  }

  const current = liveDevice || device;
  const attributes = attributesFor(current.kind, readings);

  return (
    <div className="mx-auto max-w-md px-6 pt-2 pb-36">
      <DeviceHeader device={current} onBack={onBack} />
      <RefreshRow refreshing={refreshing} lastRefresh={lastRefresh} onRefresh={loadReadings} />
      {error && <ErrorBanner message={error} onRetry={loadReadings} retrying={refreshing} note="Showing the last readings received." />}
      <motion.div className="mt-5 grid grid-cols-2 gap-3" initial="hidden" animate="show" variants={GRID_VARIANTS} data-testid="readings-grid">
        {attributes.map((a) => <motion.div key={a.key} variants={CARD_VARIANTS}><SensorCard a={a} value={readings[a.key]} onOpen={setHistoryAttr} /></motion.div>)}
      </motion.div>
      <div className="mt-4 text-center text-xs text-white/50">Tap a sensor to see its 24-hour history</div>
      <AnimatePresence>{historyAttr && <HistorySheet a={historyAttr} deviceId={current.id} onClose={() => setHistoryAttr(null)} />}</AnimatePresence>
    </div>
  );
}
