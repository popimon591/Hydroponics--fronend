// Shared localStorage helpers with proper error logging.

export const LS_KEYS = {
  DEVICES: "groxvel_devices_v4",
  DEVICE_META: "groxvel_device_meta_v1",
  READINGS: "groxvel_readings_v4",
  ALARMS: "groxvel_alarms_v4",
  DISMISSED_ALARMS: "groxvel_dismissed_alarms_v1",
  ACCESS_TOKEN: "groxvel_access_token",
  REFRESH_TOKEN: "groxvel_refresh_token",
  SESSION_USER: "groxvel_session_user",
};

export const readJSON = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Failed to read localStorage key "${key}":`, err);
    return fallback;
  }
};

export const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Failed to write localStorage key "${key}":`, err);
  }
};

export const removeKey = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`Failed to remove localStorage key "${key}":`, err);
  }
};

export const getAccessToken = () => localStorage.getItem(LS_KEYS.ACCESS_TOKEN) || "";
export const getRefreshToken = () => localStorage.getItem(LS_KEYS.REFRESH_TOKEN) || "";
export const getSessionUser = () => readJSON(LS_KEYS.SESSION_USER, null);
export const getDeviceMeta = () => readJSON(LS_KEYS.DEVICE_META, {});

export const saveTokens = ({ access, refresh }) => {
  try {
    if (access) localStorage.setItem(LS_KEYS.ACCESS_TOKEN, access);
    if (refresh) localStorage.setItem(LS_KEYS.REFRESH_TOKEN, refresh);
  } catch (err) {
    console.error("Failed to save auth tokens:", err);
  }
};

export const saveSessionUser = (user) => writeJSON(LS_KEYS.SESSION_USER, user);

export const saveSession = ({ user, token }) => {
  saveSessionUser(user || null);
  saveTokens(token || {});
};

export const clearSession = () => {
  removeKey(LS_KEYS.ACCESS_TOKEN);
  removeKey(LS_KEYS.REFRESH_TOKEN);
  removeKey(LS_KEYS.SESSION_USER);
};

// Cached farm data belongs to the signed-in account; drop it on logout so
// the next account never sees it.
export const clearUserData = () => {
  removeKey(LS_KEYS.DEVICES);
  removeKey(LS_KEYS.READINGS);
  removeKey(LS_KEYS.ALARMS);
  removeKey(LS_KEYS.DISMISSED_ALARMS);
};

export const hasSession = () => Boolean(getRefreshToken() && getSessionUser());

