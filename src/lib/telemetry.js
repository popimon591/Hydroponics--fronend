// Sensor attributes + drift engine + status helpers
// Keys match Django CurrentSensorData model exactly for seamless backend wiring.
//
// Mandatory attrs (always sent): temperature, humidity, tds, light_intensity
// Hydroponic (may be null on Soil-only devices):    water_temperature, water_level, ph
// Soil (may be null on Hydroponic-only devices):    soil_ph, soil_moisture, ec

export const ATTRIBUTES = [
  { key: "temperature",       label: "Air Temperature",   short: "AirT",     unit: "°C",    min: 0,  max: 45,    target: [18, 28],       step: 0.1,  group: "core",  mandatory: true  },
  { key: "humidity",          label: "Air Humidity",      short: "Humidity", unit: "%",     min: 0,  max: 100,   target: [45, 70],       step: 1,    group: "core",  mandatory: true  },
  { key: "tds",               label: "Nutrient TDS",      short: "TDS",      unit: "ppm",   min: 0,  max: 2000,  target: [500, 1200],    step: 5,    group: "core",  mandatory: true  },
  { key: "light_intensity",   label: "Light Intensity",   short: "Light",    unit: "lux",   min: 0,  max: 60000, target: [15000, 40000], step: 100,  group: "core",  mandatory: true  },

  { key: "water_temperature", label: "Water Temperature", short: "WaterT",   unit: "°C",    min: 5,  max: 35,    target: [18, 22],       step: 0.1,  group: "hydro", mandatory: false },
  { key: "water_level",       label: "Water Level",       short: "WLevel",   unit: "%",     min: 0,  max: 100,   target: [50, 95],       step: 1,    group: "hydro", mandatory: false },
  { key: "ph",                label: "Hydroponic pH",     short: "pH",       unit: "PH",    min: 3,  max: 10,    target: [5.5, 6.5],     step: 0.05, group: "hydro", mandatory: false },

  { key: "soil_ph",           label: "Soil pH",           short: "SoilPH",   unit: "PH",    min: 3,  max: 10,    target: [6.0, 7.0],     step: 0.05, group: "soil",  mandatory: false },
  { key: "soil_moisture",     label: "Soil Moisture",     short: "Soil",     unit: "%",     min: 0,  max: 100,   target: [40, 80],       step: 1,    group: "soil",  mandatory: false },
  { key: "ec",                label: "EC Conductivity",   short: "EC",       unit: "mS/cm", min: 0,  max: 4,     target: [0.8, 2.0],     step: 0.02, group: "soil",  mandatory: false },
];

// Which optional groups apply per device kind
const groupsFor = (kind) => {
  const k = (kind || "Mixed").toLowerCase();
  if (k === "soil")        return new Set(["core", "soil"]);
  if (k === "hydroponic")  return new Set(["core", "hydro"]);
  return new Set(["core", "hydro", "soil"]); // Mixed
};

const jitter = (v, spread) => v + (Math.random() - 0.5) * spread;
const seed = {
  temperature:       () => Number(jitter(24, 5).toFixed(1)),
  humidity:          () => Math.round(jitter(58, 20)),
  tds:               () => Math.round(jitter(850, 300)),
  light_intensity:   () => Math.round(jitter(26000, 12000)),
  water_temperature: () => Number(jitter(20, 4).toFixed(1)),
  water_level:       () => Math.round(jitter(72, 20)),
  ph:                () => Number(jitter(6.05, 0.7).toFixed(2)),
  soil_ph:           () => Number(jitter(6.4, 0.6).toFixed(2)),
  soil_moisture:     () => Math.round(jitter(58, 25)),
  ec:                () => Number(jitter(1.6, 0.9).toFixed(2)),
};

// Baseline honoring device kind — optional attrs come back as null when N/A.
export const baselineReadings = (kind = "Mixed") => {
  const groups = groupsFor(kind);
  const out = {};
  for (const a of ATTRIBUTES) {
    out[a.key] = groups.has(a.group) ? seed[a.key]() : null;
  }
  return out;
};

// Format helpers per unit — avoids nested ternaries and keeps rules co-located.
const FMT_BY_UNIT = {
  "PH":    (v) => Number(v.toFixed(2)),
  "°C":    (v) => Number(v.toFixed(1)),
  "mS/cm": (v) => Number(v.toFixed(2)),
};
const fmtByUnit = (v, unit) => (FMT_BY_UNIT[unit] || Math.round)(v);

// Drift only the attributes that already have a numeric value (respect null = N/A).
export const driftReadings = (r) => {
  const next = { ...r };
  for (const a of ATTRIBUTES) {
    const current = next[a.key];
    if (current === null || current === undefined) { next[a.key] = null; continue; }
    const magnitude = (a.max - a.min) * 0.008;
    let v = current + (Math.random() - 0.5) * magnitude * 2;
    v = Math.max(a.min, Math.min(a.max, v));
    next[a.key] = fmtByUnit(v, a.unit);
  }
  return next;
};

export const hasValue = (v) => v !== null && v !== undefined && !Number.isNaN(v);

export const attrStatus = (a, v) => {
  if (!hasValue(v)) return "N/A";
  const [lo, hi] = a.target;
  if (v >= lo && v <= hi) return "IDEAL";
  const span = a.max - a.min;
  const dist = v < lo ? lo - v : v - hi;
  if (dist / span < 0.10) return "FAIR";
  return "STRESS";
};

const STATUS_COLORS = {
  IDEAL:  "#39B54A",
  FAIR:   "#E5B23B",
  STRESS: "#E36361",
  "N/A":  "#5C6B62",
};

export const statusColor = (s) => STATUS_COLORS[s] || STATUS_COLORS["N/A"];

export const DEFAULT_DEVICES = [
  { id: "farm-hub-1",       name: "Farm Hub 1",       zone: "Sector · Zone A",   kind: "Soil",       online: true,  lastSync: Date.now() - 1000*60*3 },
  { id: "greenhouse-alpha", name: "Greenhouse Alpha", zone: "North Wing",        kind: "Hydroponic", online: true,  lastSync: Date.now() - 1000*60*12 },
  { id: "rooftop-b",        name: "Rooftop Beta",     zone: "Sector B · Basil",  kind: "Mixed",      online: true,  lastSync: Date.now() - 1000*60*1 },
  { id: "field-node-3",     name: "Field Node 3",     zone: "Outer Field",       kind: "Soil",       online: false, lastSync: Date.now() - 1000*60*42 },
];

export const DEFAULT_ALARMS = [
  { id: "alarm-1", device: "Greenhouse Alpha", trigger: "Soil Moisture", critical: "14.1%",  at: Date.now() - 1000*60*8,  severity: "CRITICAL", description: "Critical Dryness — below 20% for 15 min. Trigger irrigation loop A." },
  { id: "alarm-2", device: "Greenhouse Alpha", trigger: "Temperature",   critical: "34.5°C", at: Date.now() - 1000*60*22, severity: "WARNING",  description: "Above canopy comfort band. Enable evaporative cooling." },
  { id: "alarm-3", device: "Farm Hub 1",       trigger: "Soil pH",       critical: "7.9 pH", at: Date.now() - 1000*60*45, severity: "WARNING",  description: "Alkaline drift detected. Consider sulphur amendment." },
];

export const timeAgoShort = (ts) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 10) return "Just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} min${m>1?"s":""} ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
};
