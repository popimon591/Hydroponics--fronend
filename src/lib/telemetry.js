import axios from "axios";

import {
  LS_KEYS,
  clearSession,
  getAccessToken,
  getDeviceMeta,
  getRefreshToken,
  saveSession,
  saveTokens,
  writeJSON,
} from "@/lib/storage";

export const ATTRIBUTES = [
  { key: "temperature", label: "Air Temperature", short: "AirT", unit: "°C", min: 0, max: 45, target: [18, 28], step: 0.1, group: "core", mandatory: true },
  { key: "humidity", label: "Air Humidity", short: "Humidity", unit: "%", min: 0, max: 100, target: [45, 70], step: 1, group: "core", mandatory: true },
  { key: "tds", label: "Nutrient TDS", short: "TDS", unit: "ppm", min: 0, max: 2000, target: [500, 1200], step: 5, group: "core", mandatory: true },
  { key: "light_intensity", label: "Light Intensity", short: "Light", unit: "lux", min: 0, max: 60000, target: [15000, 40000], step: 100, group: "core", mandatory: true },
  { key: "water_temperature", label: "Water Temperature", short: "WaterT", unit: "°C", min: 5, max: 35, target: [18, 22], step: 0.1, group: "hydro", mandatory: false },
  { key: "water_level", label: "Water Level", short: "WLevel", unit: "%", min: 0, max: 100, target: [50, 95], step: 1, group: "hydro", mandatory: false },
  { key: "ph", label: "Hydroponic pH", short: "pH", unit: "PH", min: 3, max: 10, target: [5.5, 6.5], step: 0.05, group: "hydro", mandatory: false },
  { key: "soil_ph", label: "Soil pH", short: "SoilPH", unit: "PH", min: 3, max: 10, target: [6.0, 7.0], step: 0.05, group: "soil", mandatory: false },
  { key: "soil_moisture", label: "Soil Moisture", short: "Soil", unit: "%", min: 0, max: 100, target: [40, 80], step: 1, group: "soil", mandatory: false },
  { key: "ec", label: "EC Conductivity", short: "EC", unit: "mS/cm", min: 0, max: 4, target: [0.8, 2.0], step: 0.02, group: "soil", mandatory: false },
];

const STATUS_COLORS = {
  IDEAL: "#39B54A",
  FAIR: "#E5B23B",
  STRESS: "#E36361",
  "N/A": "#5C6B62",
};

const groupsFor = (kind) => {
  const k = (kind || "Mixed").toLowerCase();
  if (k === "soil") return new Set(["core", "soil"]);
  if (k === "hydroponic") return new Set(["core", "hydro"]);
  return new Set(["core", "hydro", "soil"]);
};

const jitter = (v, spread) => v + (Math.random() - 0.5) * spread;
const seed = {
  temperature: () => Number(jitter(24, 5).toFixed(1)),
  humidity: () => Math.round(jitter(58, 20)),
  tds: () => Math.round(jitter(850, 300)),
  light_intensity: () => Math.round(jitter(26000, 12000)),
  water_temperature: () => Number(jitter(20, 4).toFixed(1)),
  water_level: () => Math.round(jitter(72, 20)),
  ph: () => Number(jitter(6.05, 0.7).toFixed(2)),
  soil_ph: () => Number(jitter(6.4, 0.6).toFixed(2)),
  soil_moisture: () => Math.round(jitter(58, 25)),
  ec: () => Number(jitter(1.6, 0.9).toFixed(2)),
};

// Sensors relevant to a device type. Sensors that are reporting a value are
// always kept, so nothing the hardware sends is hidden.
export const attributesFor = (kind, readings = {}) => {
  const groups = groupsFor(kind);
  return ATTRIBUTES.filter((a) => groups.has(a.group) || hasValue(readings[a.key]));
};

export const hasValue = (v) => v !== null && v !== undefined && !Number.isNaN(v);

export const emptyReadings = () => {
  const out = {};
  for (const a of ATTRIBUTES) out[a.key] = null;
  return out;
};

export const baselineReadings = (kind = "Mixed") => {
  const groups = groupsFor(kind);
  const out = {};
  for (const a of ATTRIBUTES) out[a.key] = groups.has(a.group) ? seed[a.key]() : null;
  return out;
};

const FMT_BY_UNIT = {
  PH: (v) => Number(v.toFixed(2)),
  "°C": (v) => Number(v.toFixed(1)),
  "mS/cm": (v) => Number(v.toFixed(2)),
};
const fmtByUnit = (v, unit) => (FMT_BY_UNIT[unit] || Math.round)(v);

export const driftReadings = (readings) => {
  // Disabled for commercial standard: return readings as-is
  return readings;
};

export const attrStatus = (a, v) => {
  if (!hasValue(v)) return "N/A";
  const [lo, hi] = a.target;
  if (v >= lo && v <= hi) return "IDEAL";
  const span = a.max - a.min;
  const dist = v < lo ? lo - v : v - hi;
  if (dist / span < 0.10) return "FAIR";
  return "STRESS";
};

export const statusColor = (s) => STATUS_COLORS[s] || STATUS_COLORS["N/A"];

const STATUS_LABELS = { IDEAL: "Ideal", FAIR: "Fair", STRESS: "Out of range", "N/A": "No data" };
export const statusLabel = (s) => STATUS_LABELS[s] || s;

// Display form of a unit ("PH" is the internal key, users read "pH").
export const unitLabel = (unit) => (unit === "PH" ? "pH" : unit);

export const DEFAULT_ALARMS = [
  { id: "alarm-1", device: "Greenhouse Alpha", trigger: "Soil Moisture", critical: "14.1%", at: Date.now() - 1000 * 60 * 8, severity: "CRITICAL", description: "Critical dryness detected. Review irrigation loop A." },
  { id: "alarm-2", device: "Greenhouse Alpha", trigger: "Temperature", critical: "34.5 C", at: Date.now() - 1000 * 60 * 22, severity: "WARNING", description: "Canopy temperature above comfort band." },
  { id: "alarm-3", device: "Farm Hub 1", trigger: "Soil pH", critical: "7.9 pH", at: Date.now() - 1000 * 60 * 45, severity: "WARNING", description: "Alkaline drift detected. Consider nutrient balancing." },
];

export const timeAgoShort = (ts) => {
  const value = typeof ts === "string" ? Date.parse(ts) : ts;
  if (!value) return "No data";
  const s = Math.floor((Date.now() - value) / 1000);
  if (s < 10) return "Just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const rawBaseUrl = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
const apiBaseUrl = rawBaseUrl.endsWith("/api/v1") ? rawBaseUrl : `${rawBaseUrl}/api/v1`;
const LIVE_CACHE_TTL = 15000;

const liveCache = new Map();
let refreshPromise = null;

// Fired when the refresh token is rejected; App listens and returns to login.
export const SESSION_EXPIRED_EVENT = "groxvel:session-expired";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  if (config.skipAuth) {
    if (config.headers) {
      delete config.headers.Authorization;
      delete config.headers.authorization;
    }
    return config;
  }

  const access = getAccessToken();
  if (access) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

const refreshAccessToken = async () => {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error("No refresh token available.");
  const response = await axios.post(`${apiBaseUrl}/user/token/refresh`, { refresh }, { timeout: 10000 });
  saveTokens(response.data);
  return response.data.access;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};
    const isRefreshRequest = String(originalRequest?.url || "").includes("/user/token/refresh");
    if (status !== 401 || originalRequest._retry || isRefreshRequest || originalRequest.skipAuth) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    try {
      refreshPromise = refreshPromise || refreshAccessToken();
      const access = await refreshPromise;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${access}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      clearSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);

const extractMessage = (error, fallback) => {
  const data = error?.response?.data;
  if (data?.message) return data.message;
  if (data?.detail) return data.detail;
  if (data?.errors) {
    const firstKey = Object.keys(data.errors)[0];
    const firstError = firstKey ? data.errors[firstKey] : null;
    if (Array.isArray(firstError) && firstError.length) return firstError[0];
    if (typeof firstError === "string") return firstError;
  }
  if (data?.error) return data.error;
  if (!error?.response) {
    return "Cannot reach Groxvel. Check your internet connection and try again.";
  }
  return fallback || error.message || "Something went wrong.";
};

const normalizeReadingPayload = (payload) => {
  const normalized = emptyReadings();
  const source = payload || {};
  for (const attr of ATTRIBUTES) {
    normalized[attr.key] = hasValue(source[attr.key]) ? source[attr.key] : null;
  }
  normalized.updated_at = source.updated_at || null;
  return normalized;
};

const mergeDeviceMeta = (device) => {
  const meta = getDeviceMeta();
  const key = device.id || device.device_id;
  return meta[key] || {};
};

export const normalizeFrontendDevice = (device, live) => {
  const meta = mergeDeviceMeta(device);
  const updatedAt = live?.updated_at || null;
  const online = Boolean(updatedAt && Date.now() - Date.parse(updatedAt) < 15 * 60 * 1000);
  return {
    id: device.device_id,
    name: device.device_name,
    zone: device.location || "Unassigned Zone",
    kind: meta.kind || "Mixed",
    online,
    lastSync: updatedAt ? Date.parse(updatedAt) : null,
  };
};

export const persistDeviceMeta = (deviceId, metaUpdate) => {
  const current = getDeviceMeta();
  writeJSON(LS_KEYS.DEVICE_META, {
    ...current,
    [deviceId]: { ...(current[deviceId] || {}), ...metaUpdate },
  });
};

export const authApi = {
  async sendRegisterOtp(fullName, phoneNumber) {
    try {
      const response = await apiClient.post(
        "user/register/send-otp",
        { full_name: fullName, phone_number: phoneNumber },
        { skipAuth: true }
      );
      return response.data;
    } catch (error) {
      throw new Error(extractMessage(error, "Failed to send registration OTP."));
    }
  },
  async verifyRegisterOtp(fullName, phoneNumber, firebaseIdToken) {
    try {
      const response = await apiClient.post("user/register/verify-otp", {
        full_name: fullName,
        phone_number: phoneNumber,
        firebase_id_token: firebaseIdToken,
      }, { skipAuth: true });
      saveSession(response.data.data);
      return response.data;
    } catch (error) {
      throw new Error(extractMessage(error, "Failed to verify registration OTP."));
    }
  },
  async sendLoginOtp(phoneNumber) {
    try {
      const response = await apiClient.post(
        "user/login/send-otp",
        { phone_number: phoneNumber },
        { skipAuth: true }
      );
      return response.data;
    } catch (error) {
      throw new Error(extractMessage(error, "Failed to send login OTP."));
    }
  },
  async verifyLoginOtp(phoneNumber, firebaseIdToken) {
    try {
      const response = await apiClient.post("user/login/verify-otp", {
        phone_number: phoneNumber,
        firebase_id_token: firebaseIdToken,
      }, { skipAuth: true });
      saveSession(response.data.data);
      return response.data;
    } catch (error) {
      throw new Error(extractMessage(error, "Failed to verify login OTP."));
    }
  },
};

export const sensorApi = {
  async getHome() {
    const response = await apiClient.get("sensor/home/");
    return response.data;
  },
  async listDevices() {
    const response = await apiClient.get("sensor/devices/");
    return response.data;
  },
  async createDevice(payload) {
    const response = await apiClient.post("sensor/devices/", payload);
    return response.data;
  },
  async getLiveReading(deviceId, { force = false } = {}) {
    const cacheKey = String(deviceId);
    const cached = liveCache.get(cacheKey);
    if (!force && cached && Date.now() - cached.at < LIVE_CACHE_TTL) {
      return cached.value;
    }
    const response = await apiClient.get(`sensor/devices/${deviceId}/live/`);
    const value = normalizeReadingPayload(response.data.data || response.data);
    liveCache.set(cacheKey, { at: Date.now(), value });
    return value;
  },
  async getActiveAlarms() {
    const response = await apiClient.get("sensor/alarms/warning/");
    return response.data;
  },
  async getSensorHistory(deviceId, hours = 24) {
    const response = await apiClient.get(`sensor/history/${deviceId}/`, { params: { hours } });
    return response.data;
  },
  async getDailySummary(deviceId) {
    const response = await apiClient.get(`sensor/daily-summary/${deviceId}/`);
    return response.data;
  },
};

export const fetchFleetState = async () => {
  try {
    return await loadFleetState();
  } catch (error) {
    throw new Error(extractMessage(error, "Failed to load your devices."));
  }
};

export const fetchActiveAlarms = async () => {
  try {
    const response = await sensorApi.getActiveAlarms();
    return Array.isArray(response?.data) ? response.data : [];
  } catch (error) {
    throw new Error(extractMessage(error, "Failed to load alarms."));
  }
};

const loadFleetState = async () => {
  try {
    const home = await sensorApi.getHome();
    const devices = home?.data?.devices || [];
    const deviceList = devices.map((item) => normalizeFrontendDevice(item, item.live));
    const readingsMap = {};
    for (const item of devices) readingsMap[item.device_id] = normalizeReadingPayload(item.live);
    return { devices: deviceList, readingsMap };
  } catch (homeError) {
    const list = await sensorApi.listDevices();
    const rawDevices = list?.data || [];
    const settled = await Promise.allSettled(rawDevices.map((device) => sensorApi.getLiveReading(device.device_id, { force: true })));
    const devices = [];
    const readingsMap = {};
    rawDevices.forEach((rawDevice, index) => {
      const liveResult = settled[index];
      const live = liveResult.status === "fulfilled" ? liveResult.value : emptyReadings();
      readingsMap[rawDevice.device_id] = live;
      devices.push(normalizeFrontendDevice(rawDevice, live));
    });
    return { devices, readingsMap };
  }
};

export const deviceIdFromName = (name) =>
  `${name}`.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const createFrontendDevice = async ({ name, zone, kind }) => {
  const deviceId = deviceIdFromName(name) || `device-${Date.now()}`;
  let response;
  try {
    response = await sensorApi.createDevice({
      device_id: deviceId,
      device_name: name.trim(),
      location: zone.trim(),
    });
  } catch (error) {
    throw new Error(extractMessage(error, "Failed to add device."));
  }
  persistDeviceMeta(deviceId, { kind });
  const device = normalizeFrontendDevice(response.data, null);
  return { ...device, kind };
};

export const fetchDeviceLiveState = async (device) => {
  try {
    const live = await sensorApi.getLiveReading(device.id, { force: true });
    return {
      device: {
        ...device,
        online: Boolean(live.updated_at && Date.now() - Date.parse(live.updated_at) < 15 * 60 * 1000),
        lastSync: live.updated_at ? Date.parse(live.updated_at) : device.lastSync,
      },
      readings: live,
    };
  } catch (error) {
    return {
      device: { ...device, online: false },
      readings: emptyReadings(),
      error: extractMessage(error, "Failed to load live sensor data."),
    };
  }
};

const HISTORY_TIME_KEYS = ["updated_at", "created_at", "timestamp", "recorded_at", "time"];

// Normalizes sensor history into [{ at: ms, <attr>: number|null }] sorted by
// time. Accepts a bare array or one nested under data / readings / history.
export const fetchSensorHistory = async (deviceId, hours = 24) => {
  let body;
  try {
    body = await sensorApi.getSensorHistory(deviceId, hours);
  } catch (error) {
    throw new Error(extractMessage(error, "Failed to load history."));
  }
  const candidates = [body, body?.data, body?.data?.readings, body?.data?.history, body?.readings, body?.history];
  const rows = candidates.find(Array.isArray) || [];
  return rows
    .map((row) => {
      const timeKey = HISTORY_TIME_KEYS.find((k) => row?.[k]);
      const at = timeKey ? Date.parse(row[timeKey]) : NaN;
      if (Number.isNaN(at)) return null;
      const point = { at };
      for (const a of ATTRIBUTES) {
        const v = row[a.key] === null || row[a.key] === undefined ? null : Number(row[a.key]);
        point[a.key] = Number.isNaN(v) ? null : v;
      }
      return point;
    })
    .filter(Boolean)
    .sort((x, y) => x.at - y.at);
};
