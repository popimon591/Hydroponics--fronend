import { GroxvelLogo } from "@/components/GroxvelLogo";
import { ChevronDown } from "lucide-react";

export const initialsOf = (operator) =>
  (operator?.full_name || "U").split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");

export const Avatar = ({ operator, size = 36 }) => (
  <div
    className="rounded-full flex items-center justify-center text-xs font-semibold text-[#0B2214] flex-shrink-0"
    style={{ height: size, width: size, fontSize: size > 40 ? 18 : undefined, background: "linear-gradient(135deg, #58D46B, #279A38)" }}
    data-testid="user-avatar"
  >
    {initialsOf(operator)}
  </div>
);

export default function TopBar({ operator, onOpenProfile }) {
  const fullName = operator?.full_name || "Operator";

  return (
    <div className="sticky top-0 z-20 bg-[#080F0B]/85 backdrop-blur-lg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto max-w-md px-6 py-4 flex items-center justify-between">
        <GroxvelLogo height={26} />

        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2.5 min-h-[44px] pl-1 pr-2 -mr-2 rounded-full active:bg-white/[0.06] transition-colors"
          aria-label={`Account: ${fullName}`}
          data-testid="btn-profile"
        >
          <Avatar operator={operator} />
          <span className="text-sm text-white font-medium max-w-[120px] truncate">{fullName}</span>
          <ChevronDown className="h-4 w-4 text-white/60" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
