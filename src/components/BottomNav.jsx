import { Home, Cpu } from "lucide-react";

export default function BottomNav({ active, onChange }) {
  const items = [
    { key: "home",   icon: Home, label: "Home" },
    { key: "device", icon: Cpu,  label: "Devices" },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none">
      <div className="mx-auto max-w-md px-6 pointer-events-auto" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
        <div className="rounded-full bg-[#0D1A12]/95 backdrop-blur-lg border border-white/6 flex items-center justify-around px-3 py-2.5 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.6)]">
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = active === it.key;
            return (
              <button
                key={it.key}
                onClick={() => onChange(it.key)}
                aria-current={isActive ? "page" : undefined}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-full transition-colors"
                data-testid={`nav-${it.key}`}
                style={isActive ? { background: "rgba(57,181,74,0.14)" } : {}}
              >
                <Icon
                  className="h-4 w-4"
                  style={{ color: isActive ? "#39B54A" : "rgba(255,255,255,0.6)" }}
                />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: isActive ? "#39B54A" : "rgba(255,255,255,0.6)" }}
                >
                  {it.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
