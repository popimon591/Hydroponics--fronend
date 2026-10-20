import { useEffect, useState, useCallback, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Radio, RefreshCw, SlidersHorizontal, Wifi, WifiOff, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import CircularGauge from "@/components/CircularGauge";
import { EmptyState, ErrorBanner, Sheet } from "@/components/Feedback";
import { KindPicker } from "@/components/KindPicker";
import { PullIndicator, usePullToRefresh } from "@/components/PullToRefresh";
import { attributesFor, attrStatus, emptyReadings, hasValue, persistDeviceMeta, fetchDeviceLiveState, fetchSensorHistory, statusColor, statusLabel, timeAgoShort, unitLabel } from "@/lib/telemetry";
import { isAppActive } from "@/lib/appState";
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
      <div className="mt-2 text-xs text-white/65 leading-tight text-center">Ideal: {a.target[0]}–{a.target[1]} {unit}</div>
    </button>
  );
});

const DeviceHeader = ({ device, onBack, onSettings }) => (
  <div className="flex items-center gap-3 py-3">
    <button onClick={onBack} className="h-11 w-11 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center hover:border-[#39B54A]/40 transition-colors flex-shrink-0" aria-label="Back" data-testid="btn-back"><ArrowLeft className="h-5 w-5 text-white/80" /></button>
    <div className="flex-1 min-w-0"><div className="font-display font-bold text-white text-lg truncate">{device.name}</div><div className="text-xs text-white/60 truncate">{device.zone} · {device.kind}</div></div>
    <ConnectivityBadge online={device.online} />
    <button onClick={onSettings} className="h-11 w-11 -mr-2 rounded-full flex items-center justify-center text-white/70 hover:text-white active:bg-white/[0.06] flex-shrink-0" aria-label="Device settings" data-testid="btn-device-settings"><SlidersHorizontal className="h-5 w-5" /></button>
  </div>
);

// The device type decides which sensors are shown. It is stored on this
// phone only (the backend has no field for it yet).
const DeviceSettingsSheet = ({ device, onChangeKind, onClose }) => (
  <Sheet onClose={onClose} labelledBy="device-settings-title" testid="device-settings-sheet">
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <div id="device-settings-title" className="text-white font-display font-bold text-lg truncate">{device.name}</div>
        <div className="text-xs text-white/60 mt-1 truncate">{device.zone} · ID {device.id}</div>
      </div>
      <button onClick={onClose} className="h-10 w-10 -mr-2 -mt-2 rounded-full flex items-center justify-center text-white/60 hover:text-white active:bg-white/[0.06]" aria-label="Close" data-testid="btn-close-device-settings"><X className="h-5 w-5" /></button>
    </div>
    <div className="mt-6">
      <div className="block text-xs uppercase tracking-[0.2em] text-white/60">Device type</div>
      <KindPicker value={device.kind} onChange={onChangeKind} />
      <div className="text-xs text-white/60 mt-3">Choose the farm type this device monitors. It controls which sensors are shown.</div>
    </div>
  </Sheet>
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

// The values on screen are not live when the device has stopped reporting.
const StaleNotice = ({ lastRefresh }) => (
  <div className="mt-4 rounded-2xl border p-4 flex items-start gap-3" style={{ borderColor: "rgba(229,178,59,0.3)", background: "rgba(229,178,59,0.08)" }} role="status" data-testid="stale-notice">
    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#E5B23B]" aria-hidden="true" />
    <div className="text-sm text-white">
      This device is offline. Values below are from its last reading{lastRefresh ? `, ${timeAgoShort(lastRefresh).toLowerCase()}` : ""}.
    </div>
  </div>
);

const GridSkeleton = () => (
  <div className="mt-5 grid grid-cols-2 gap-3" aria-busy="true" aria-label="Loading readings" data-testid="readings-loading">
    {[0, 1, 2, 3].map((i) => <div key={i} className="surface h-[200px] animate-pulse" />)}
  </div>
);

const formatTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatDay = (ms) => new Date(ms).toLocaleDateString([], { weekday: "short", day: "numeric" });
const formatDayTime = (ms) => new Date(ms).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });

const RANGES = [{ hours: 24, label: "24 hours" }, { hours: 168, label: "7 days" }];

const HistorySheet = ({ a, deviceId, onClose }) => {
  const [state, setState] = useState({ loading: true, points: [], error: null });
  const [hours, setHours] = useState(24);
  const unit = unitLabel(a.unit);
  const week = hours > 24;

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetchSensorHistory(deviceId, hours)
      .then((points) => { if (!cancelled) setState({ loading: false, points: points.filter((p) => p[a.key] !== null), error: null }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, points: [], error: err.message }); });
    return () => { cancelled = true; };
  }, [deviceId, a.key, hours]);

  return (
    <Sheet onClose={onClose} labelledBy="history-title" testid="history-sheet">
      <div className="flex items-start justify-between">
        <div>
          <div id="history-title" className="text-white font-display font-bold text-lg">{a.label}</div>
          <div className="text-xs text-white/60 mt-1">Ideal range {a.target[0]}–{a.target[1]} {unit}</div>
        </div>
        <button onClick={onClose} className="h-10 w-10 -mr-2 -mt-2 rounded-full flex items-center justify-center text-white/60 hover:text-white active:bg-white/[0.06]" aria-label="Close" data-testid="btn-close-history"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-4 inline-flex rounded-full bg-white/[0.04] border border-white/10 p-1" role="radiogroup" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.hours} role="radio" aria-checked={hours === r.hours} onClick={() => setHours(r.hours)} className="h-9 px-4 rounded-full text-sm font-medium transition-colors" style={hours === r.hours ? { background: "rgba(57,181,74,0.18)", color: "#39B54A" } : { color: "rgba(255,255,255,0.7)" }} data-testid={`range-${r.hours}`}>{r.label}</button>
        ))}
      </div>
      <div className="mt-4 h-56" data-testid="history-chart">
        {state.loading ? (
          <div className="h-full rounded-2xl bg-white/[0.04] animate-pulse" />
        ) : state.error ? (
          <div className="h-full flex items-center justify-center text-sm text-white/60 text-center px-4">{state.error}</div>
        ) : state.points.length < 2 ? (
          <div className="h-full flex items-center justify-center text-sm text-white/60 text-center px-4">Not enough readings in the last {week ? "7 days" : "24 hours"} to draw a chart.</div>
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
              <XAxis dataKey="at" type="number" domain={["dataMin", "dataMax"]} tickFormatter={week ? formatDay : formatTime} tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" minTickGap={40} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" width={44} domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={week ? formatDayTime : formatTime}
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
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pullState = usePullToRefresh(() => loadReadings(), refreshing && loadedOnce);
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
      // Keep a type chosen in device settings; result.device starts from the mount-time copy.
      setLiveDevice((prev) => ({ ...result.device, kind: prev?.kind || result.device.kind }));
      setReadings(result.readings);
      setLastRefresh(result.device.lastSync || null);
    } finally {
      setRefreshing(false);
      setLoadedOnce(true);
    }
  }, [device]);

  useEffect(() => { loadReadings(); }, [loadReadings, pollResumeKey]);
  useEffect(() => {
    if (!device) return undefined;
    const timer = setInterval(() => { if (isAppActive()) loadReadings(); }, POLL_MS);
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

  const changeKind = (kind) => {
    persistDeviceMeta(current.id, { kind });
    // Keep the cached device list in step so Home shows the new type at once.
    writeJSON(LS_KEYS.DEVICES, readJSON(LS_KEYS.DEVICES, []).map((d) => (d.id === current.id ? { ...d, kind } : d)));
    setLiveDevice({ ...current, kind });
  };
  const attributes = attributesFor(current.kind, readings);
  const hasAnyReading = attributes.some((a) => hasValue(readings[a.key]));

  let body;
  if (!hasAnyReading && !loadedOnce) {
    body = <GridSkeleton />;
  } else if (!hasAnyReading && !error) {
    body = (
      <div className="mt-5">
        <EmptyState
          icon={<Radio className="h-5 w-5" />}
          title="No readings yet"
          body="This device hasn't sent any data. Check that it is powered on and connected to the internet."
          testid="readings-empty"
        />
      </div>
    );
  } else {
    body = (
      <>
        {!current.online && hasAnyReading && !error && <StaleNotice lastRefresh={lastRefresh} />}
        <motion.div className="mt-5 grid grid-cols-2 gap-3" initial="hidden" animate="show" variants={GRID_VARIANTS} data-testid="readings-grid">
          {attributes.map((a) => <motion.div key={a.key} variants={CARD_VARIANTS}><SensorCard a={a} value={readings[a.key]} onOpen={setHistoryAttr} /></motion.div>)}
        </motion.div>
        <div className="mt-4 text-center text-xs text-white/65">Tap a sensor to see its 24-hour history</div>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 pt-2 pb-36">
      <PullIndicator {...pullState} />
      <DeviceHeader device={current} onBack={onBack} onSettings={() => setSettingsOpen(true)} />
      <RefreshRow refreshing={refreshing} lastRefresh={lastRefresh} onRefresh={loadReadings} />
      {error && <ErrorBanner message={error} onRetry={loadReadings} retrying={refreshing} note="Showing the last readings received." />}
      {body}
      <AnimatePresence>{settingsOpen && <DeviceSettingsSheet device={current} onChangeKind={changeKind} onClose={() => setSettingsOpen(false)} />}</AnimatePresence>
      <AnimatePresence>{historyAttr && <HistorySheet a={historyAttr} deviceId={current.id} onClose={() => setHistoryAttr(null)} />}</AnimatePresence>
    </div>
  );
}
