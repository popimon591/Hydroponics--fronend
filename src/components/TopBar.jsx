import { GroxvelLogo } from "@/components/GroxvelLogo";
import { LogOut } from "lucide-react";

export default function TopBar({ operator, onLogout }) {
  const initials = (operator?.full_name || "U")
    .split(" ").slice(0, 2).map((s) => s[0]?.toUpperCase()).join("");
  const fullName = operator?.full_name || "Operator";

  return (
    <div className="sticky top-0 z-20 bg-[#080F0B]/85 backdrop-blur-lg">
      <div className="mx-auto max-w-md px-6 py-5 flex items-center justify-between">
        <GroxvelLogo height={26} />

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-[#0B2214]"
              style={{ background: "linear-gradient(135deg, #58D46B, #279A38)" }}
              data-testid="user-avatar"
            >
              {initials}
            </div>
            <div className="text-sm text-white font-medium max-w-[120px] truncate">{fullName}</div>
          </div>
          <button
            onClick={onLogout}
            className="text-white/35 hover:text-white/70 transition-colors ml-1"
            aria-label="Log out"
            data-testid="btn-logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
