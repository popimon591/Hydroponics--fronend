import { memo, useState } from "react";
import { AlertTriangle, ChevronRight, Plus, Sprout, Wifi, WifiOff } from "lucide-react";

import { EmptyState, ErrorBanner, SkeletonCards } from "@/components/Feedback";
import { PullIndicator, usePullToRefresh } from "@/components/PullToRefresh";
import { ATTRIBUTES, attrStatus, hasValue, statusColor, timeAgoShort } from "@/lib/telemetry";
import { useFleet } from "@/lib/useFleet";

const SpotlightBanner = memo(function SpotlightBanner() {
  return (
    <div className="mt-4 fade-up relative overflow-hidden surface p-0" data-testid="spotlight-banner">
      <div className="relative h-36" style={{ background: "radial-gradient(260px 180px at 85% 60%, rgba(57,181,74,0.28), transparent 70%), linear-gradient(135deg, #0F2417 0%, #0A160F 100%)" }}>
        <Sprout className="absolute -right-4 -bottom-6 h-40 w-40 text-[#39B54A]/20" strokeWidth={1.2} aria-hidden="true" />
        <div className="relative h-full flex flex-col justify-center p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-300">Groxvel Tech</div>
          <div className="mt-1 font-display text-xl font-bold text-white leading-tight max-w-[70%]">Smarter farming with regenerative sensing</div>
        </div>
      </div>
    </div>
  );
});

const SummaryTile = ({ icon, label, value, tone, onClick, selected, testid }) => {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} aria-pressed={selected === undefined ? undefined : selected} className="surface p-3 text-left min-h-[72px] transition-colors" style={selected ? { borderColor: tone, background: `${tone}14` } : undefined} data-testid={testid}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/60">
        <span style={{ color: tone }} aria-hidden="true">{icon}</span>{label}
        {onClick && selected === undefined && <ChevronRight className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />}
      </div>
      <div className="font-display font-bold text-xl mt-1.5 leading-none" style={{ color: tone }}>{value}</div>
    </Tag>
  );
};

const DevicePill = ({ online }) => {
  const style = online ? { color: "#39B54A", background: "rgba(57,181,74,0.12)" } : { color: "#E36361", background: "rgba(227,99,97,0.12)" };
  return <span className="pill" style={style}>{online ? "Online" : "Offline"}</span>;
};

// The four readings that matter most for each kind of farm.
const QUICK_STATS = {
  Soil: ["temperature", "humidity", "soil_moisture", "soil_ph"],
  Hydroponic: ["temperature", "humidity", "ph", "tds"],
  Mixed: ["temperature", "humidity", "ph", "soil_moisture"],
};
const ATTR_BY_KEY = Object.fromEntries(ATTRIBUTES.map((a) => [a.key, a]));
const SHORT_LABEL = { temperature: "Air", humidity: "Humidity", soil_moisture: "Soil", soil_ph: "Soil pH", ph: "pH", tds: "TDS" };

const formatStat = (a, v) => {
  if (!hasValue(v)) return "N/A";
  if (a.unit === "PH") return v.toFixed(1);
  if (a.unit === "°C") return `${Number(v).toFixed(1)}°`;
  if (a.unit === "%") return `${Math.round(v)}%`;
  return `${Math.round(v)}`;
};

const MiniStat = ({ attrKey, value }) => {
  const a = ATTR_BY_KEY[attrKey];
  const available = hasValue(value);
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 px-2 py-2.5 text-center">
      <div className="text-xs text-white/60 truncate">{SHORT_LABEL[attrKey]}</div>
      <div className="font-display font-bold text-base mt-1 leading-none" style={{ color: available ? statusColor(attrStatus(a, value)) : "rgba(255,255,255,0.6)" }}>
        {formatStat(a, value)}
      </div>
    </div>
  );
};

const DeviceCard = memo(function DeviceCard({ device, readings, onOpen }) {
  const keys = QUICK_STATS[device.kind] || QUICK_STATS.Mixed;
  return (
    <button onClick={() => onOpen(device.id)} className="w-full text-left surface surface-hover p-4 transition-colors" data-testid={`device-${device.id}`}>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: device.online ? "rgba(57,181,74,0.14)" : "rgba(227,99,97,0.14)" }}>
          <Sprout className="h-5 w-5" style={{ color: device.online ? "#39B54A" : "#E36361" }} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><div className="font-semibold text-white truncate">{device.name}</div><DevicePill online={device.online} /></div>
          <div className="text-xs text-white/60 mt-1 truncate">{device.zone} · {device.kind}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-white/40 flex-shrink-0" aria-hidden="true" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {keys.map((key) => <MiniStat key={key} attrKey={key} value={readings[key]} />)}
      </div>
      <div className="mt-3 text-xs text-white/65">Last reading: {device.lastSync ? timeAgoShort(device.lastSync) : "none yet"}</div>
    </button>
  );
});

export default function Home({ onOpenDevice, onAddDevice, onOpenAlarms, pollResumeKey }) {
  const { devices, readings, alarms, loading, error, reloading, reload } = useFleet({ pollResumeKey });
  const onlineCount = devices.filter((device) => device.online).length;
  const offlineCount = devices.length - onlineCount;
  // Tapping the Online / Offline tile narrows the list; tapping again clears it.
  const [filter, setFilter] = useState(null);
  const toggleFilter = (next) => setFilter((current) => (current === next ? null : next));
  const shown = filter ? devices.filter((device) => device.online === (filter === "online")) : devices;
  const pullState = usePullToRefresh(reload, reloading && !loading);

  return (
    <div className="mx-auto max-w-md px-6 pt-2 pb-36">
      <PullIndicator {...pullState} />
      {error && <ErrorBanner message={error} onRetry={reload} retrying={reloading} note={devices.length ? "Showing the last saved data." : null} />}

      {!loading && devices.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2" data-testid="fleet-summary">
          <SummaryTile icon={<Wifi className="h-3.5 w-3.5" />} label="Online" value={`${onlineCount}/${devices.length}`} tone="#39B54A" onClick={() => toggleFilter("online")} selected={filter === "online"} testid="summary-online" />
          <SummaryTile icon={<WifiOff className="h-3.5 w-3.5" />} label="Offline" value={offlineCount} tone={offlineCount ? "#E36361" : "rgba(255,255,255,0.7)"} onClick={() => toggleFilter("offline")} selected={filter === "offline"} testid="summary-offline" />
          <SummaryTile icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Alarms" value={alarms.length} tone={alarms.length ? "#E5B23B" : "rgba(255,255,255,0.7)"} onClick={onOpenAlarms} testid="summary-alarms" />
        </div>
      )}

      <div className="mt-6 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-white font-display text-lg font-bold">{filter === "online" ? "Online devices" : filter === "offline" ? "Offline devices" : "Your Devices"}</div>
          <div className="text-xs text-white/65 mt-0.5">{filter ? `${shown.length} of ${devices.length} devices` : "Tap a device to view live readings"}</div>
        </div>
        {filter && <button onClick={() => setFilter(null)} className="min-h-[44px] px-2 -mr-2 text-sm text-[#39B54A] font-semibold flex-shrink-0" data-testid="btn-clear-filter">Show all</button>}
      </div>
      <div className="mt-4 space-y-3" data-testid="devices-list">
        {loading ? (
          <SkeletonCards />
        ) : devices.length === 0 ? (
          !error && (
            <EmptyState
              icon={<Plus className="h-5 w-5" />}
              title="No devices yet"
              body="Add your first sensor unit to start monitoring your farm."
              actionLabel="Add a device"
              onAction={onAddDevice}
              testid="home-empty"
            />
          )
        ) : (
          shown.length === 0 ? (
            <div className="surface p-6 text-center text-sm text-white/65" data-testid="filter-empty">{filter === "offline" ? "All devices are online." : "No devices are online right now."}</div>
          ) : (
            shown.map((device) => <DeviceCard key={device.id} device={device} readings={readings[device.id] || {}} onOpen={onOpenDevice} />)
          )
        )}
      </div>

      <SpotlightBanner />
    </div>
  );
}
