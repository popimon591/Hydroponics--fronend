// Android hardware back button routing.
// Screens and overlays register a handler while they are open; the most
// recently registered one runs first. A handler returns true when it handled
// the press. If nothing handles it, useMobile minimizes the app.

import { useEffect, useRef } from "react";

const handlers = [];

export const handleBack = () => {
  for (let i = handlers.length - 1; i >= 0; i -= 1) {
    if (handlers[i].current?.() === true) return true;
  }
  return false;
};

export function useBackHandler(handler, active = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    handlers.push(ref);
    return () => {
      const index = handlers.lastIndexOf(ref);
      if (index !== -1) handlers.splice(index, 1);
    };
  }, [active]);
}

// Lets the browser smoke tests simulate the hardware back button.
if (process.env.REACT_APP_E2E === "true" && typeof window !== "undefined") {
  window.__groxvelBack = handleBack;
}
