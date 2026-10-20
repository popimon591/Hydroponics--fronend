import { attrStatus, statusColor, statusLabel, hasValue, unitLabel } from "@/lib/telemetry";

// Minimal circular gauge — thin arc, big centered value+unit.
// When value is null/undefined, renders "N/A" with no progress arc.
export default function CircularGauge({ a, value, size = 132, thickness = 8, showState = false, testid }) {
  const r = (size - thickness) / 2 - 2;
  const cx = size / 2, cy = size / 2;
  const c = 2 * Math.PI * r;
  const available = hasValue(value);
  const t = available ? Math.max(0, Math.min(1, (value - a.min) / (a.max - a.min))) : 0;
  const dash = c * t;
  const status = attrStatus(a, value);
  const color = statusColor(status);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }} data-testid={testid}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} fill="none" strokeDasharray={available ? undefined : "4 4"} />
        {available && (
          <circle
            cx={cx} cy={cy} r={r}
            stroke={color} strokeWidth={thickness} fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - dash}
            style={{ transition: "stroke-dashoffset 600ms ease, stroke 250ms", filter: `drop-shadow(0 0 6px ${color}55)` }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {available ? (
          <>
            <div className="font-display font-bold text-white text-2xl leading-none">{format(value, a)}</div>
            <div className="text-xs tracking-wider text-white/60 mt-1.5">{unitLabel(a.unit)}</div>
          </>
        ) : (
          <>
            <div className="font-display font-bold text-white/60 text-xl leading-none">N/A</div>
            <div className="text-xs tracking-wider text-white/60 mt-1.5">No data</div>
          </>
        )}
        {showState && available && (
          <div className="text-xs uppercase tracking-wider mt-1 font-semibold" style={{ color }}>{statusLabel(status)}</div>
        )}
      </div>
    </div>
  );
}

const format = (v, a) => {
  if (a.unit === "PH") return v.toFixed(2);
  if (a.unit === "°C") return v.toFixed(1);
  if (a.unit === "mS/cm") return v.toFixed(2);
  return Math.round(v).toLocaleString();
};
