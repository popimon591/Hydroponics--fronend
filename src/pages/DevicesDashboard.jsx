import { useEffect, useState, useCallback, memo } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Wifi, WifiOff, AlertTriangle, ChevronRight, X } from "lucide-react";
import {
  DEFAULT_DEVICES, DEFAULT_ALARMS, baselineReadings, timeAgoShort, hasValue,
} from "@/lib/telemetry";
import { LS_KEYS, readJSON, writeJSON } from "@/lib/storage";

// ---------- Small presentational atoms ----------

const StatusPill = ({ online }) => {
  const style = online
    ? { color: "#39B54A", background: "rgba(57,181,74,0.12)" }
    : { color: "#E36361", background: "rgba(227,99,97,0.12)" };
  return <span className="pill" style={style}>{online ? "ONLINE" : "OFFLINE"}</span>;
};

const TabButton = ({ active, onClick, children, testid }) => (
  <button
    onClick={onClick}
    className="pb-3 text-sm font-medium transition-colors relative"
    style={{ color: active ? "#fff" : "rgba(255,255,255,0.4)" }}
    data-testid={testid}
  >
    <span className="flex items-center gap-2">{children}</span>
    {active && <div className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#39B54A] rounded-full" />}
  </button>
);

// Count-badge color rules extracted so no nested ternaries live inline.
const countBadgeStyle = ({ tone, active }) => {
  if (tone === "alarm") {
    return { background: "rgba(227,99,97,0.15)", color: "#E36361" };
  }
  if (active) {
    return { background: "rgba(57,181,74,0.15)", color: "#39B54A" };
  }
  return { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" };
};

const CountBadge = ({ n, active, tone }) => (
  <span
    className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
    style={countBadgeStyle({ tone, active })}
  >
    {n}
  </span>
);

const formatCore = (v, suffix) => (hasValue(v) ? `${v}${suffix}` : "N/A");
const formatPh   = (v) => (hasValue(v) ? v.toFixed(2) : "N/A");

// ---------- Device list card ----------

const DeviceListItem = memo(function DeviceListItem({ device, readings, onOpen }) {
  const Icon = device.online ? Wifi : WifiOff;
  const iconColor = device.online ? "text-emerald-400" : "text-rose-400";
  return (
    <button
      onClick={() => onOpen(device.id)}
      className="w-full text-left surface surface-hover p-4 flex items-center gap-4 transition-colors"
      data-testid={`dashboard-device-${device.id}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-white truncate">{device.name}</div>
          <StatusPill online={device.online} />
        </div>
        <div className="text-xs text-white/40 mt-1">{device.zone} · {device.kind}</div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-white/50 flex-wrap">
          <span>Air <span className="text-white font-semibold">{formatCore(readings.temperature, "°")}</span></span>
          <span>Humid <span className="text-white font-semibold">{formatCore(readings.humidity, "%")}</span></span>
          <span>pH <span className="text-white font-semibold">{formatPh(readings.ph)}</span></span>
          <span>Soil <span className="text-white font-semibold">{formatCore(readings.soil_moisture, "%")}</span></span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <ChevronRight className="h-4 w-4 text-white/30" />
      </div>
    </button>
  );
});

// ---------- Alarm card ----------

const alarmStyles = (critical) => (critical
  ? {
      pill:   { color: "#E36361", background: "rgba(227,99,97,0.12)" },
      iconBg: { background: "rgba(227,99,97,0.18)" },
      iconColor: "#E36361",
      surface: {
        borderColor: "rgba(227,99,97,0.3)",
        background: "linear-gradient(180deg, rgba(227,99,97,0.10), rgba(227,99,97,0.02))",
      },
    }
  : {
      pill:   { color: "#E5B23B", background: "rgba(229,178,59,0.12)" },
      iconBg: { background: "rgba(229,178,59,0.18)" },
      iconColor: "#E5B23B",
      surface: {
        borderColor: "rgba(229,178,59,0.25)",
        background: "linear-gradient(180deg, rgba(229,178,59,0.08), rgba(229,178,59,0.02))",
      },
    }
);

const AlarmItem = ({ alarm, onDismiss }) => {
  const isCritical = alarm.severity === "CRITICAL";
  const s = alarmStyles(isCritical);
  return (
    <div className="surface p-4 flex items-start gap-3" style={s.surface} data-testid={`alarm-${alarm.id}`}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={s.iconBg}>
        <AlertTriangle className="h-4 w-4" style={{ color: s.iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill" style={s.pill}>{alarm.severity}</span>
          <span className="text-white font-semibold text-sm">{alarm.device}</span>
        </div>
        <div className="text-[13px] text-white mt-2">
          <span className="text-white/50">{alarm.trigger}:</span> {alarm.critical}
        </div>
        <div className="text-xs text-white/50 mt-1 leading-relaxed">{alarm.description}</div>
        <div className="text-[11px] text-white/30 mt-2">{timeAgoShort(alarm.at)}</div>
      </div>
      <button
        onClick={() => onDismiss(alarm.id)}
        className="text-white/30 hover:text-white transition-colors"
        aria-label="Dismiss"
        data-testid={`dismiss-${alarm.id}`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const EmptyAlarms = () => (
  <div className="surface p-8 text-center">
    <div className="text-white/60">All systems nominal</div>
    <div className="text-xs text-white/30 mt-1">No active environmental warnings</div>
  </div>
);

// ---------- Add-device modal (extracted subcomponent) ----------

const KIND_OPTIONS = ["Soil", "Hydroponic", "Mixed"];

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.24em] text-white/40">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const KindPicker = ({ value, onChange }) => (
  <div className="flex gap-2 mt-2">
    {KIND_OPTIONS.map((k) => {
      const active = value === k;
      const style = {
        background: active ? "rgba(57,181,74,0.18)" : "rgba(255,255,255,0.03)",
        color: active ? "#39B54A" : "rgba(255,255,255,0.6)",
        border: `1px solid ${active ? "rgba(57,181,74,0.4)" : "rgba(255,255,255,0.08)"}`,
      };
      return (
        <button
          key={k}
          onClick={() => onChange(k)}
          className="flex-1 rounded-full py-2 text-sm font-medium transition-colors"
          style={style}
        >
          {k}
        </button>
      );
    })}
  </div>
);

const AddDeviceSheet = ({ onClose, onSubmit }) => {
  const [form, setForm] = useState({ name: "", zone: "", kind: "Soil" });
  const canSubmit = form.name.trim() && form.zone.trim();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 pb-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="w-full max-w-md rounded-3xl bg-[#0D1A12] border border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-white font-display font-bold text-lg">Add New Device</div>
            <div className="text-xs text-white/40 mt-1">Register a hardware unit into your farm</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white" data-testid="btn-close-add">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <Field label="Device Name">
            <input
              className="input-clean w-full"
              placeholder="Greenhouse Delta"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              data-testid="input-device-name"
            />
          </Field>
          <Field label="Location / Zone">
            <input
              className="input-clean w-full"
              placeholder="Sector · Row 3"
              value={form.zone}
              onChange={(e) => setForm({ ...form, zone: e.target.value })}
              data-testid="input-device-zone"
            />
          </Field>
          <Field label="Kind">
            <KindPicker value={form.kind} onChange={(kind) => setForm({ ...form, kind })} />
          </Field>
        </div>

        <button
          onClick={() => onSubmit(form)}
          disabled={!canSubmit}
          className="mt-8 w-full h-12 rounded-full bg-[#39B54A] hover:bg-[#43C755] disabled:bg-white/10 disabled:text-white/30 text-[#0B2214] font-semibold transition-colors"
          data-testid="btn-provision-device"
        >
          Add Device
        </button>
      </motion.div>
    </motion.div>
  );
};

// ---------- Page ----------

export default function DevicesDashboard({ onOpenDevice }) {
  const [tab, setTab] = useState("list"); // list | alarms
  const [devices, setDevices] = useState(() => readJSON(LS_KEYS.DEVICES) || DEFAULT_DEVICES);
  const [alarms, setAlarms] = useState(() => readJSON(LS_KEYS.ALARMS) || DEFAULT_ALARMS);
  const [readings, setReadings] = useState(() => readJSON(LS_KEYS.READINGS, {}));
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { writeJSON(LS_KEYS.DEVICES, devices); }, [devices]);
  useEffect(() => { writeJSON(LS_KEYS.ALARMS, alarms); }, [alarms]);

  const addDevice = useCallback((payload) => {
    const id = `${payload.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}`;
    const newDevice = {
      id, name: payload.name, zone: payload.zone, kind: payload.kind,
      online: true, lastSync: Date.now(),
    };
    const baseline = baselineReadings(payload.kind);
    setDevices((d) => [newDevice, ...d]);
    setReadings((r) => {
      const merged = { ...r, [id]: baseline };
      writeJSON(LS_KEYS.READINGS, merged);
      return merged;
    });
    setAddOpen(false);
    toast.success(`${newDevice.name} added`);
  }, []);

  const dismissAlarm = useCallback((id) => {
    setAlarms((a) => a.filter((x) => x.id !== id));
  }, []);

  return (
    <div className="mx-auto max-w-md px-6 pt-2 pb-36">
      <div className="flex items-center justify-between mt-2">
        <div>
          <div className="text-white font-display text-xl font-bold">Devices</div>
          <div className="text-xs text-white/40 mt-0.5">Manage hardware & environmental alarms</div>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-full bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-[13px] px-4 py-2 flex items-center gap-1.5 transition-colors"
          data-testid="btn-add-device"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add New Device
        </button>
      </div>

      <div className="mt-6 flex gap-6 border-b border-white/8">
        <TabButton active={tab === "list"} onClick={() => setTab("list")} testid="tab-list">
          Device List <CountBadge n={devices.length} active={tab === "list"} />
        </TabButton>
        <TabButton active={tab === "alarms"} onClick={() => setTab("alarms")} testid="tab-alarms">
          Active Alarms <CountBadge n={alarms.length} active={tab === "alarms"} tone="alarm" />
        </TabButton>
      </div>

      {tab === "list"
        ? <DeviceListView devices={devices} readings={readings} onOpen={onOpenDevice} />
        : <AlarmsListView alarms={alarms} onDismiss={dismissAlarm} />}

      <AnimatePresence>
        {addOpen && <AddDeviceSheet onClose={() => setAddOpen(false)} onSubmit={addDevice} />}
      </AnimatePresence>
    </div>
  );
}

const DeviceListView = ({ devices, readings, onOpen }) => (
  <div className="mt-5 space-y-3" data-testid="device-list">
    {devices.map((d) => (
      <DeviceListItem
        key={d.id}
        device={d}
        readings={readings[d.id] || {}}
        onOpen={onOpen}
      />
    ))}
  </div>
);

const AlarmsListView = ({ alarms, onDismiss }) => {
  if (alarms.length === 0) {
    return (
      <div className="mt-5 space-y-3" data-testid="alarms-list">
        <EmptyAlarms />
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-3" data-testid="alarms-list">
      {alarms.map((a) => (
        <AlarmItem key={a.id} alarm={a} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
