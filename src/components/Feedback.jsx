import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { motion } from "framer-motion";
import { LogOut, RefreshCw, WifiOff } from "lucide-react";

import { Avatar } from "@/components/TopBar";

import { useBackHandler } from "@/lib/backHandler";

export const ErrorBanner = ({ message, onRetry, retrying, note = "Showing the last saved data." }) => (
  <div
    className="mt-4 rounded-2xl border p-4 flex items-start gap-3"
    style={{ borderColor: "rgba(227,99,97,0.3)", background: "rgba(227,99,97,0.08)" }}
    role="alert"
    data-testid="error-banner"
  >
    <WifiOff className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#E36361]" aria-hidden="true" />
    <div className="flex-1 min-w-0">
      <div className="text-sm text-white font-medium">{message}</div>
      {note && <div className="text-xs text-white/60 mt-1">{note}</div>}
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        disabled={retrying}
        className="h-9 px-3.5 rounded-full bg-white/[0.06] border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
        data-testid="btn-retry"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "spin-slow" : ""}`} aria-hidden="true" />
        Retry
      </button>
    )}
  </div>
);

export const SkeletonCards = ({ count = 3 }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading devices" data-testid="loading-skeleton">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="surface p-4 animate-pulse">
        <div className="h-4 w-1/2 rounded bg-white/10" />
        <div className="mt-3 h-3 w-1/3 rounded bg-white/[0.06]" />
        <div className="mt-4 h-8 w-full rounded-lg bg-white/[0.04]" />
      </div>
    ))}
  </div>
);

export const EmptyState = ({ icon, title, body, actionLabel, onAction, testid }) => (
  <div className="surface p-8 text-center" data-testid={testid}>
    {icon && <div className="mx-auto mb-3 h-12 w-12 rounded-2xl flex items-center justify-center bg-[#39B54A]/12 text-[#39B54A]">{icon}</div>}
    <div className="text-white font-semibold">{title}</div>
    {body && <div className="text-sm text-white/60 mt-1">{body}</div>}
    {actionLabel && (
      <button
        onClick={onAction}
        className="mt-5 h-11 px-5 rounded-full bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-sm transition-colors"
        data-testid={testid ? `${testid}-action` : undefined}
      >
        {actionLabel}
      </button>
    )}
  </div>
);

// Bottom sheet wrapper: backdrop tap and the Android back button both close it.
export const Sheet = ({ onClose, labelledBy, children, testid }) => {
  useBackHandler(() => { onClose(); return true; });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-4"
      style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
        className="w-full max-w-md rounded-3xl bg-[#0D1A12] border border-white/10 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        data-testid={testid}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

export const ConfirmSheet = ({ title, body, confirmLabel, onConfirm, onCancel, testid }) => (
  <Sheet onClose={onCancel} labelledBy="confirm-title" testid={testid}>
    <div id="confirm-title" className="text-white font-display font-bold text-lg">{title}</div>
    {body && <div className="text-sm text-white/60 mt-2">{body}</div>}
    <div className="mt-6 grid grid-cols-2 gap-3">
      <button onClick={onCancel} className="h-12 rounded-full bg-white/[0.06] border border-white/10 text-white font-semibold" data-testid="btn-confirm-cancel">
        Cancel
      </button>
      <button onClick={onConfirm} className="h-12 rounded-full bg-[#E36361] hover:bg-[#EA7573] text-white font-semibold transition-colors" data-testid="btn-confirm-ok">
        {confirmLabel}
      </button>
    </div>
  </Sheet>
);

// Account details and logout, opened from the name in the top bar.
export const ProfileSheet = ({ operator, onLogout, onClose }) => {
  const [version, setVersion] = useState(null);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    CapApp.getInfo().then((info) => setVersion(`${info.version} (${info.build})`)).catch(() => {});
  }, []);
  return (
    <Sheet onClose={onClose} labelledBy="profile-title" testid="profile-sheet">
      <div className="flex items-center gap-4">
        <Avatar operator={operator} size={52} />
        <div className="min-w-0">
          <div id="profile-title" className="text-white font-display font-bold text-lg truncate">{operator?.full_name || "Operator"}</div>
          {operator?.phone_number && <div className="text-sm text-white/65 mt-0.5">{operator.phone_number}</div>}
        </div>
      </div>
      {version && <div className="mt-5 text-xs text-white/60">Groxvel app version {version}</div>}
      <button onClick={onLogout} className="mt-6 w-full h-12 rounded-full bg-white/[0.06] border border-white/10 text-[#E36361] font-semibold flex items-center justify-center gap-2" data-testid="btn-logout">
        <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
      </button>
    </Sheet>
  );
};
