import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchActiveAlarms, fetchFleetState } from "@/lib/telemetry";
import { LS_KEYS, readJSON, writeJSON } from "@/lib/storage";

const POLL_MS = 30000;

// Shared fleet state for Home and Devices: cached devices/readings/alarms,
// 30s polling, immediate refetch when pollResumeKey changes (app resumed),
// and a visible error instead of silently keeping stale data.
export function useFleet({ pollResumeKey = 0 } = {}) {
  const [devices, setDevices] = useState(() => readJSON(LS_KEYS.DEVICES, []));
  const [readings, setReadings] = useState(() => readJSON(LS_KEYS.READINGS, {}));
  const [alarms, setAlarms] = useState(() => readJSON(LS_KEYS.ALARMS, []));
  const [dismissed, setDismissed] = useState(() => readJSON(LS_KEYS.DISMISSED_ALARMS, []));
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [reloading, setReloading] = useState(false);
  const inFlight = useRef(false);

  const reload = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setReloading(true);
    try {
      const snapshot = await fetchFleetState();
      setDevices(snapshot.devices);
      setReadings(snapshot.readingsMap);
      setError(null);
      try {
        setAlarms(await fetchActiveAlarms());
      } catch (alarmError) {
        console.error("Failed to fetch alarms:", alarmError);
      }
    } catch (fleetError) {
      console.error("Failed to load fleet:", fleetError);
      setError(fleetError.message || "Failed to load your devices.");
    } finally {
      inFlight.current = false;
      setReloading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload, pollResumeKey]);
  useEffect(() => {
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);

  useEffect(() => { writeJSON(LS_KEYS.DEVICES, devices); }, [devices]);
  useEffect(() => { writeJSON(LS_KEYS.READINGS, readings); }, [readings]);
  useEffect(() => { writeJSON(LS_KEYS.ALARMS, alarms); }, [alarms]);
  useEffect(() => { writeJSON(LS_KEYS.DISMISSED_ALARMS, dismissed); }, [dismissed]);

  // Forget dismissals for alarms the backend no longer reports.
  useEffect(() => {
    if (!loaded || error) return;
    setDismissed((current) => {
      const next = current.filter((id) => alarms.some((alarm) => alarm.id === id));
      return next.length === current.length ? current : next;
    });
  }, [alarms, loaded, error]);

  const visibleAlarms = useMemo(
    () => alarms.filter((alarm) => !dismissed.includes(alarm.id)),
    [alarms, dismissed]
  );

  const dismissAlarm = useCallback((id) => {
    setDismissed((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const addDevice = useCallback((device) => {
    setDevices((current) => [device, ...current.filter((d) => d.id !== device.id)]);
  }, []);

  return {
    devices,
    readings,
    alarms: visibleAlarms,
    loading: !loaded && devices.length === 0,
    error,
    reloading,
    reload,
    dismissAlarm,
    addDevice,
  };
}
