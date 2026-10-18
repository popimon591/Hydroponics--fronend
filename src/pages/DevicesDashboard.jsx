import { useState, useCallback, memo } from "react";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { Plus, Wifi, WifiOff, AlertTriangle, ChevronRight, X, CheckCircle2 } from "lucide-react";

import { EmptyState, ErrorBanner, Sheet, SkeletonCards } from "@/components/Feedback";
import { createFrontendDevice, deviceIdFromName, timeAgoShort } from "@/lib/telemetry";
import { useFleet } from "@/lib/useFleet";

const StatusPill = ({ online }) => {
  const style = online ? { color: "#39B54A", background: "rgba(57,181,74,0.12)" } : { color: "#E36361", background: "rgba(227,99,97,0.12)" };
  return <span className="pill" style={style}>{online ? "Online" : "Offline"}</span>;
};

const TabButton = ({ active, onClick, children, testid }) => (
  <button onClick={onClick} role="tab" aria-selected={active} className="pb-3 min-h-[44px] text-sm font-medium transition-colors relative" style={{ color: active ? "#fff" : "rgba(255,255,255,0.6)" }} data-testid={testid}><span className="flex items-center gap-2">{children}</span>{active && <div className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#39B54A] rounded-full" />}</button>
);

const countBadgeStyle = ({ tone, active, n }) => {
  if (tone === "alarm" && n > 0) return { background: "rgba(227,99,97,0.15)", color: "#E36361" };
  if (active) return { background: "rgba(57,181,74,0.15)", color: "#39B54A" };
  return { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" };
};

const CountBadge = ({ n, active, tone }) => <span className="text-[11px] font-semibold rounded-full px-1.5 py-0.5" style={countBadgeStyle({ tone, active, n })}>{n}</span>;

const DeviceListItem = memo(function DeviceListItem({ device, onOpen }) {
  const Icon = device.online ? Wifi : WifiOff;
  const iconColor = device.online ? "#39B54A" : "#E36361";
  return (
    <button onClick={() => onOpen(device.id)} className="w-full text-left surface surface-hover p-4 flex items-center gap-4 transition-colors" data-testid={`dashboard-device-${device.id}`}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${iconColor}24` }}>
        <Icon className="h-4 w-4" style={{ color: iconColor }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><div className="font-semibold text-white truncate">{device.name}</div><StatusPill online={device.online} /></div>
        <div className="text-xs text-white/60 mt-1 truncate">{device.zone} · {device.kind}</div>
        <div className="text-xs text-white/55 mt-1">Last reading: {device.lastSync ? timeAgoShort(device.lastSync) : "none yet"}</div>
      </div>
      <ChevronRight className="h-5 w-5 text-white/40 flex-shrink-0" aria-hidden="true" />
    </button>
  );
});

const alarmStyles = (severity) => {
  const isCritical = severity === "MAX" || severity === "MIN";
  return isCritical
    ? {
        pill: { color: "#E36361", background: "rgba(227,99,97,0.12)" },
        iconBg: { background: "rgba(227,99,97,0.18)" },
        iconColor: "#E36361",
        surface: {
          borderColor: "rgba(227,99,97,0.3)",
          background: "linear-gradient(180deg, rgba(227,99,97,0.10), rgba(227,99,97,0.02))",
        },
        label: "Critical",
      }
    : {
        pill: { color: "#E5B23B", background: "rgba(229,178,59,0.12)" },
        iconBg: { background: "rgba(229,178,59,0.18)" },
        iconColor: "#E5B23B",
        surface: {
          borderColor: "rgba(229,178,59,0.25)",
          background: "linear-gradient(180deg, rgba(229,178,59,0.08), rgba(229,178,59,0.02))",
        },
        label: "Warning",
      };
};

const AlarmItem = ({ alarm, onDismiss }) => {
  const s = alarmStyles(alarm.level);
  return (
    <div className="surface p-4 flex items-start gap-3" style={s.surface} data-testid={`alarm-${alarm.id}`}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={s.iconBg}>
        <AlertTriangle className="h-4 w-4" style={{ color: s.iconColor }} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="pill" style={s.pill}>{s.label}</span>
          <span className="text-white font-semibold text-sm">{alarm.device_name}</span>
        </div>
        <div className="text-sm text-white mt-2">
          <span className="text-white/60">{alarm.parameter}:</span> {alarm.value}
        </div>
        <div className="text-xs text-white/70 mt-1 leading-relaxed">{alarm.message}</div>
        <div className="text-xs text-white/50 mt-2">{timeAgoShort(alarm.at)}</div>
      </div>
      <button onClick={() => onDismiss(alarm.id)} className="h-10 w-10 -mr-2 -mt-2 rounded-full flex items-center justify-center text-white/60 hover:text-white active:bg-white/[0.06] transition-colors" aria-label={`Dismiss alarm for ${alarm.device_name || "device"}`} data-testid={`dismiss-${alarm.id}`}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const KIND_OPTIONS = ["Soil", "Hydroponic", "Mixed"];
const Field = ({ label, htmlFor, children, error }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-[11px] uppercase tracking-[0.2em] text-white/60">{label}</label>
    <div className="mt-1">{children}</div>
    {error && <div className="text-xs text-[#E36361] mt-1.5" role="alert" data-testid="field-error">{error}</div>}
  </div>
);

const KindPicker = ({ value, onChange }) => (
  <div className="flex gap-2 mt-2" role="radiogroup" aria-label="Kind">
    {KIND_OPTIONS.map((kind) => {
      const active = value === kind;
      return (
        <button key={kind} role="radio" aria-checked={active} onClick={() => onChange(kind)} className="flex-1 rounded-full h-11 text-sm font-medium transition-colors" style={{ background: active ? "rgba(57,181,74,0.18)" : "rgba(255,255,255,0.03)", color: active ? "#39B54A" : "rgba(255,255,255,0.7)", border: `1px solid ${active ? "rgba(57,181,74,0.4)" : "rgba(255,255,255,0.1)"}` }} data-testid={`kind-${kind.toLowerCase()}`}>
          {kind}
        </button>
      );
    })}
  </div>
);

const AddDeviceSheet = ({ onClose, onSubmit, submitting, existingIds }) => {
  const [form, setForm] = useState({ name: "", zone: "", kind: "Soil" });
  const duplicate = form.name.trim() && existingIds.includes(deviceIdFromName(form.name));
  const canSubmit = form.name.trim() && form.zone.trim() && !duplicate;
  return (
    <Sheet onClose={onClose} labelledBy="add-device-title" testid="add-device-sheet">
      <div className="flex items-start justify-between">
        <div>
          <div id="add-device-title" className="text-white font-display font-bold text-lg">Add New Device</div>
          <div className="text-xs text-white/60 mt-1">Register a hardware unit on your farm</div>
        </div>
        <button onClick={onClose} className="h-10 w-10 -mr-2 -mt-2 rounded-full flex items-center justify-center text-white/60 hover:text-white active:bg-white/[0.06]" aria-label="Close" data-testid="btn-close-add"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-6 space-y-5">
        <Field label="Device Name" htmlFor="device-name" error={duplicate ? "You already have a device with this name. Choose a different name." : null}>
          <input id="device-name" className="input-clean w-full" placeholder="Greenhouse Delta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-device-name" />
        </Field>
        <Field label="Location / Zone" htmlFor="device-zone">
          <input id="device-zone" className="input-clean w-full" placeholder="Sector · Row 3" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} data-testid="input-device-zone" />
        </Field>
        <Field label="Kind"><KindPicker value={form.kind} onChange={(kind) => setForm({ ...form, kind })} /></Field>
      </div>
      <button onClick={() => onSubmit(form)} disabled={!canSubmit || submitting} className="mt-8 w-full h-12 rounded-full bg-[#39B54A] hover:bg-[#43C755] disabled:bg-white/10 disabled:text-white/40 text-[#0B2214] font-semibold transition-colors" data-testid="btn-provision-device">{submitting ? "Adding..." : "Add Device"}</button>
    </Sheet>
  );
};

export default function DevicesDashboard({ onOpenDevice, intent, pollResumeKey }) {
  const [tab, setTab] = useState(() => intent?.tab || "list");
  const [addOpen, setAddOpen] = useState(() => Boolean(intent?.add));
  const [submitting, setSubmitting] = useState(false);
  const { devices, alarms, loading, error, reloading, reload, dismissAlarm, addDevice: addToFleet } = useFleet({ pollResumeKey });

  const addDevice = useCallback(async (payload) => {
    setSubmitting(true);
    try {
      const newDevice = await createFrontendDevice(payload);
      addToFleet(newDevice);
      setAddOpen(false);
      setTab("list");
      toast.success(`${newDevice.name} added`);
      reload();
    } catch (err) {
      toast.error(err.message || "Failed to add device.", { duration: 6000 });
    } finally {
      setSubmitting(false);
    }
  }, [addToFleet, reload]);

  const onDismiss = useCallback((id) => {
    dismissAlarm(id);
    toast.success("Alarm dismissed");
  }, [dismissAlarm]);

  return (
    <div className="mx-auto max-w-md px-6 pt-2 pb-36">
      <div className="flex items-center justify-between gap-3 mt-2">
        <div className="min-w-0">
          <div className="text-white font-display text-xl font-bold">Devices</div>
          <div className="text-xs text-white/60 mt-0.5">Manage hardware & alarms</div>
        </div>
        <button onClick={() => setAddOpen(true)} className="h-11 rounded-full bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-sm px-4 flex items-center gap-1.5 transition-colors flex-shrink-0" data-testid="btn-add-device"><Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> Add Device</button>
      </div>
      {error && <ErrorBanner message={error} onRetry={reload} retrying={reloading} note={devices.length ? "Showing the last saved data." : null} />}
      <div className="mt-6 flex gap-6 border-b border-white/10" role="tablist">
        <TabButton active={tab === "list"} onClick={() => setTab("list")} testid="tab-list">Device List <CountBadge n={devices.length} active={tab === "list"} /></TabButton>
        <TabButton active={tab === "alarms"} onClick={() => setTab("alarms")} testid="tab-alarms">Active Alarms <CountBadge n={alarms.length} active={tab === "alarms"} tone="alarm" /></TabButton>
      </div>
      <div className="mt-5 space-y-3" data-testid={tab === "list" ? "device-list" : "alarms-list"}>
        {tab === "list" ? (
          loading ? <SkeletonCards /> : devices.length === 0 ? (
            !error && <EmptyState icon={<Plus className="h-5 w-5" />} title="No devices yet" body="Add your first sensor unit to start monitoring." actionLabel="Add a device" onAction={() => setAddOpen(true)} testid="devices-empty" />
          ) : devices.map((device) => <DeviceListItem key={device.id} device={device} onOpen={onOpenDevice} />)
        ) : alarms.length === 0 ? (
          <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="All systems normal" body="No active environmental warnings." testid="alarms-empty" />
        ) : (
          alarms.map((alarm) => <AlarmItem key={alarm.id} alarm={alarm} onDismiss={onDismiss} />)
        )}
      </div>
      <AnimatePresence>{addOpen && <AddDeviceSheet onClose={() => setAddOpen(false)} onSubmit={addDevice} submitting={submitting} existingIds={devices.map((d) => d.id)} />}</AnimatePresence>
    </div>
  );
}
