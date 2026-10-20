export const KIND_OPTIONS = ["Soil", "Hydroponic", "Mixed"];

export const KindPicker = ({ value, onChange }) => (
  <div className="flex gap-2 mt-2" role="radiogroup" aria-label="Device type">
    {KIND_OPTIONS.map((kind) => {
      const active = value === kind;
      return (
        <button key={kind} role="radio" aria-checked={active} onClick={() => onChange(kind)} className="flex-1 rounded-full h-11 text-sm font-medium transition-colors" style={{ background: active ? "rgba(57,181,74,0.18)" : "rgba(255,255,255,0.03)", color: active ? "#39B54A" : "rgba(255,255,255,0.7)", border: `1px solid ${active ? "rgba(57,181,74,0.4)" : "rgba(255,255,255,0.1)"}` }} data-testid={`kind-${kind.toLowerCase()}`}>
          {kind}
        </button>
      );
    })}
  </div>
);
