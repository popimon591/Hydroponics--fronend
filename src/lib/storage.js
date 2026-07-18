// Shared localStorage helpers with proper error logging (used across pages)

export const LS_KEYS = {
  DEVICES:  "groxvel_devices_v4",
  READINGS: "groxvel_readings_v4",
  ALARMS:   "groxvel_alarms_v4",
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
