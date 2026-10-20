// Whether the app is in the foreground. useMobile updates it from Capacitor's
// appStateChange; on the web the page visibility is used. Polling timers check
// it so the app does not keep hitting the API (and the battery) while it sits
// in the background. Resuming triggers an immediate refresh via pollResumeKey.

let active = typeof document === "undefined" ? true : !document.hidden;

export const isAppActive = () => active;

export const setAppActive = (value) => {
  active = Boolean(value);
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => setAppActive(!document.hidden));
}
