/**
 * useMobile.js
 *
 * Capacitor mobile integration hook for Groxvel Agriculture App.
 * Handles:
 *  - Native platform detection
 *  - StatusBar styling (dark theme, branded background)
 *  - SplashScreen auto-hide after first render
 *  - App foreground/background lifecycle (pause sensors / resume polling)
 *  - Soft keyboard show/hide layout adjustment
 *
 * Safe to call in browser — all Capacitor calls are no-ops on web.
 */

import { useCallback, useEffect, useRef } from "react";

import { App as CapApp } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

import { setAppActive } from "@/lib/appState";
import { handleBack } from "@/lib/backHandler";

const IS_NATIVE = Capacitor.isNativePlatform();

/* ─── StatusBar ─────────────────────────────────────────────────────────── */

async function initStatusBar() {
  if (!IS_NATIVE) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#080F0B" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    // Non-fatal — some Android versions may not support all options
    console.warn("[Groxvel] StatusBar init error:", err);
  }
}

/* ─── SplashScreen ──────────────────────────────────────────────────────── */

async function hideSplash() {
  if (!IS_NATIVE) return;
  try {
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (err) {
    console.warn("[Groxvel] SplashScreen hide error:", err);
  }
}

/* ─── useMobile hook ────────────────────────────────────────────────────── */

/**
 * @param {object} options
 * @param {() => void}  options.onResume   - Called when app comes back to foreground
 * @param {() => void}  options.onPause    - Called when app goes to background
 * @param {boolean}     options.appReady   - Set true once your UI has painted
 */
export function useMobile({ onResume, onPause, appReady = false } = {}) {
  const splashHidden = useRef(false);

  // ── On mount: configure StatusBar immediately ──────────────────────────
  useEffect(() => {
    initStatusBar();
  }, []);

  // ── Hide SplashScreen once the caller signals "app is ready" ──────────
  useEffect(() => {
    if (appReady && !splashHidden.current) {
      splashHidden.current = true;
      hideSplash();
    }
  }, [appReady]);

  // ── App foreground / background lifecycle ─────────────────────────────
  useEffect(() => {
    if (!IS_NATIVE) return;

    let listener;
    CapApp.addListener("appStateChange", ({ isActive }) => {
      setAppActive(isActive);
      if (isActive) {
        // Returned to foreground — resume sensor polling
        onResume?.();
      } else {
        // Sent to background — pause polling to save battery
        onPause?.();
      }
    }).then((l) => {
      listener = l;
    });

    return () => {
      listener?.remove();
    };
  }, [onResume, onPause]);

  // ── Hardware back button (Android) ────────────────────────────────────
  // Open overlays and sub-screens handle back first (see backHandler.js);
  // at the root screen, minimize rather than kill the app.
  useEffect(() => {
    if (!IS_NATIVE) return;

    let listener;
    CapApp.addListener("backButton", () => {
      if (!handleBack()) {
        CapApp.minimizeApp();
      }
    }).then((l) => {
      listener = l;
    });

    return () => {
      listener?.remove();
    };
  }, []);

  // ── Keyboard show: keep the focused field visible ─────────────────────
  // capacitor.config.json sets Keyboard.resize = "body", so the plugin
  // already shrinks the body; adding padding here as well pushed forms up
  // twice. All that is left to do is scroll the focused field into view.
  useEffect(() => {
    if (!IS_NATIVE) return;

    let showListener;

    Keyboard.addListener("keyboardDidShow", () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active && typeof active.scrollIntoView === "function") {
          active.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    }).then((l) => {
      showListener = l;
    });

    return () => {
      showListener?.remove();
    };
  }, []);

  return { isNative: IS_NATIVE };
}

/**
 * Standalone utility — imperatively show/hide the StatusBar.
 * Call from any screen that needs to override the default style
 * (e.g., a full-screen map or camera view).
 */
export async function setStatusBarStyle({ dark = true, color = "#080F0B" } = {}) {
  if (!IS_NATIVE) return;
  try {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color });
  } catch (err) {
    console.warn("[Groxvel] setStatusBarStyle error:", err);
  }
}

/**
 * Utility — dismiss the soft keyboard programmatically.
 * Useful after OTP form submission.
 */
export async function dismissKeyboard() {
  if (!IS_NATIVE) return;
  try {
    await Keyboard.hide();
  } catch (err) {
    console.warn("[Groxvel] Keyboard.hide error:", err);
  }
}

export { IS_NATIVE };
