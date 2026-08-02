import { useCallback, useEffect, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Thermometer, Droplets, Sprout, ArrowRight } from "lucide-react";
import { fetchFleetState, hasValue, timeAgoShort } from "@/lib/telemetry";
import { LS_KEYS, readJSON, writeJSON } from "@/lib/storage";

const POLL_MS = 30000;

const SpotlightBanner = memo(function SpotlightBanner() {
  return (
    <div className="mt-4 fade-up relative overflow-hidden surface p-0" data-testid="spotlight-banner">
      <div className="relative h-40">
        <img src="https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=1000&q=60" alt="Groxvel field technology" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(8,15,11,0.9) 0%, rgba(8,15,11,0.55) 55%, rgba(8,15,11,0.15) 100%)" }} />
        <div className="relative h-full flex flex-col justify-between p-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-emerald-300">Groxvel Tech</div>
            <div className="mt-1 font-display text-xl font-bold text-white leading-tight max-w-[65%]">Smarter farming with regenerative sensing</div>
          </div>
          <button className="self-start rounded-full bg-[#39B54A]/15 border border-[#39B54A]/40 text-[#39B54A] text-xs font-semibold px-4 py-1.5 flex items-center gap-1.5 hover:bg-[#39B54A]/25 transition-colors" data-testid="btn-spotlight-learn">
            Learn more <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

const DevicePill = ({ online }) => {
  const style = online ? { color: "#39B54A", background: "rgba(57,181,74,0.12)" } : { color: "#E36361", background: "rgba(227,99,97,0.12)" };
  return <span className="pill" style={style}>{online ? "ONLINE" : "OFFLINE"}</span>;
};

const MiniStat = ({ icon, label, value }) => (
  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
    <div className="flex items-center gap-1.5 text-white/40 text-[10px] uppercase tracking-widest"><span className="text-emerald-400/80">{icon}</span>{label}</div>
    <div className="font-display font-bold text-white text-lg mt-1 leading-none">{value}</div>
  </div>
);

const formatCore = (value, suffix) => (hasValue(value) ? `${value}${suffix}` : "N/A");
const formatPh = (value) => (hasValue(value) ? value.toFixed(2) : "N/A");

const DeviceExpanded = ({ device, readings, onOpen }) => (
  <div className="px-4 pb-4">
    <div className="mt-1 pt-4 border-t border-white/5">
      <div className="grid grid-cols-4 gap-2">
        <MiniStat icon={<Thermometer className="h-3.5 w-3.5" />} label="Air" value={formatCore(readings.temperature, "°")} />
        <MiniStat icon={<Droplets className="h-3.5 w-3.5" />} label="Humid" value={formatCore(readings.humidity, "%")} />
        <MiniStat icon={<Sprout className="h-3.5 w-3.5" />} label="Soil" value={formatCore(readings.soil_moisture, "%")} />
        <MiniStat icon={<Droplets className="h-3.5 w-3.5" />} label="pH" value={formatPh(readings.ph)} />
      </div>
      <div className="mt-4 flex items-center justify-between text-[11px] text-white/40">
        <span>Last sync: {device.lastSync ? timeAgoShort(device.lastSync) : "No data"}</span>
        <button onClick={(e) => { e.stopPropagation(); onOpen(device.id); }} className="text-[#39B54A] font-semibold hover:underline" data-testid={`btn-open-${device.id}`}>View details ?</button>
      </div>
    </div>
  </div>
);

const DeviceCard = ({ device, readings, isOpen, onToggle, onOpen }) => (
  <div className="surface surface-hover overflow-hidden transition-colors">
    <button onClick={onToggle} className="w-full text-left p-4 flex items-center gap-4" data-testid={`device-${device.id}`}>
      <div className="h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: device.online ? "rgba(57,181,74,0.14)" : "rgba(227,99,97,0.14)" }}><Sprout className="h-5 w-5" style={{ color: device.online ? "#39B54A" : "#E36361" }} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2"><div className="font-semibold text-white truncate">{device.name}</div><DevicePill online={device.online} /></div>
        <div className="text-xs text-white/40 mt-1 flex items-center gap-2"><span>{device.zone}</span><span className="text-white/20">·</span><span>{device.kind}</span></div>
      </div>
      <ChevronRight className="h-4 w-4 text-white/30 transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0)" }} />
    </button>
    <AnimatePresence initial={false}>{isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden"><DeviceExpanded device={device} readings={readings} onOpen={onOpen} /></motion.div>}</AnimatePresence>
  </div>
);

export default function Home({ onOpenDevice }) {
  const [devices, setDevices] = useState(() => readJSON(LS_KEYS.DEVICES, []));
  const [readings, setReadings] = useState(() => readJSON(LS_KEYS.READINGS, {}));
  const [expanded, setExpanded] = useState(null);

  const loadFleet = useCallback(async () => {
    const snapshot = await fetchFleetState();
    setDevices(snapshot.devices);
    setReadings(snapshot.readingsMap);
  }, []);

  useEffect(() => { loadFleet().catch((error) => console.error("Failed to load home fleet:", error)); }, [loadFleet]);
  useEffect(() => {
    const timer = setInterval(() => {
      loadFleet().catch((error) => console.error("Failed to refresh home fleet:", error));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [loadFleet]);

  useEffect(() => { writeJSON(LS_KEYS.DEVICES, devices); }, [devices]);
  useEffect(() => { writeJSON(LS_KEYS.READINGS, readings); }, [readings]);

  const toggleExpand = useCallback((id) => { setExpanded((current) => (current === id ? null : id)); }, []);
  const onlineCount = devices.filter((device) => device.online).length;

  return (
    <div className="mx-auto max-w-md px-6 pt-2 pb-36">
      <div className="mt-2"><div className="text-white font-display text-lg font-bold">Spotlight</div><div className="text-xs text-white/40 mt-0.5">News, updates & product highlights</div></div>
      <SpotlightBanner />
      <div className="mt-8 flex items-end justify-between"><div><div className="text-white font-display text-lg font-bold">Your Devices</div><div className="text-xs text-white/40 mt-0.5">Tap a device to view live readings</div></div><div className="text-[11px] text-white/40">{onlineCount}/{devices.length} online</div></div>
      <div className="mt-4 space-y-3" data-testid="devices-list">{devices.map((device) => <DeviceCard key={device.id} device={device} readings={readings[device.id] || {}} isOpen={expanded === device.id} onToggle={() => toggleExpand(device.id)} onOpen={onOpenDevice} />)}</div>
    </div>
  );
}

