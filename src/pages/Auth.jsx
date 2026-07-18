import { useState, useCallback } from "react";
import { toast } from "sonner";
import { GroxvelLogo } from "@/components/GroxvelLogo";

const genOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// --- Split-out form field ---
const Field = ({ label, children }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.24em] text-white/40">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

// --- OTP dots input ---
const OtpDots = ({ value, onChange }) => {
  const digits = value.split("");
  const filled = digits.length;
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="absolute inset-0 opacity-0 w-full h-full cursor-text"
        data-testid="input-otp"
      />
      <div className="flex items-center gap-3 py-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <OtpSlot key={i} index={i} filled={filled} digit={digits[i]} />
        ))}
      </div>
    </div>
  );
};

const OtpSlot = ({ index, filled, digit }) => {
  const borderColor = index <= filled ? "#39B54A" : "rgba(255,255,255,0.14)";
  return (
    <div
      className="h-8 w-8 flex items-center justify-center border-b transition-colors"
      style={{ borderColor }}
    >
      {index < filled
        ? <span className="text-white text-lg font-semibold">{digit}</span>
        : <span className="h-1.5 w-1.5 rounded-full bg-white/25" />}
    </div>
  );
};

// --- OTP toast body ---
const OtpToastBody = ({ code, onFill }) => (
  <div className="w-[300px] rounded-2xl border border-emerald-500/30 bg-[#0D1A12]/95 backdrop-blur p-4 shadow-2xl">
    <div className="text-[10px] uppercase tracking-[0.28em] text-emerald-400">OTP dispatched</div>
    <div className="mt-2 text-3xl font-display font-bold tracking-[0.4em] text-emerald-300" data-testid="otp-code">
      {code}
    </div>
    <button
      onClick={onFill}
      className="mt-3 w-full rounded-xl bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-sm py-2"
      data-testid="otp-autofill-btn"
    >
      Autofill
    </button>
  </div>
);

// --- Register toggle CTA ---
const RegisterToggle = ({ showRegister, onToggle }) => {
  if (showRegister) {
    return (
      <button
        onClick={onToggle}
        className="text-[12.5px] text-white/50 hover:text-white transition-colors"
        data-testid="toggle-register"
      >
        Already have an account? Sign in
      </button>
    );
  }
  return (
    <button
      onClick={onToggle}
      className="text-[12.5px] text-white/50 hover:text-white transition-colors"
      data-testid="toggle-register"
    >
      First time?{" "}
      <span className="text-[#39B54A] font-semibold underline underline-offset-2">
        Create an account
      </span>
    </button>
  );
};

export default function Auth({ onAuthed }) {
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [dispatched, setDispatched] = useState(null);

  const validateFields = useCallback(() => {
    if (!phone) { toast.error("Enter your phone number"); return false; }
    if (showRegister && !name) { toast.error("Enter your full name"); return false; }
    return true;
  }, [phone, showRegister, name]);

  const dispatchOTP = useCallback(() => {
    if (!validateFields()) return;
    const code = genOTP();
    setDispatched(code);
    // Twilio SMS integration slot — swap toast for real dispatcher.
    toast.custom((id) => (
      <OtpToastBody
        code={code}
        onFill={() => { setOtp(code); toast.dismiss(id); }}
      />
    ), { duration: 15000 });
  }, [validateFields]);

  const submit = useCallback(() => {
    if (!validateFields()) return;
    if (!dispatched) { toast.error("Request an OTP first"); return; }
    if (otp !== dispatched) { toast.error("Invalid OTP"); return; }
    onAuthed({
      fullName: showRegister ? name : "Alex Brown",
      phone,
      role: showRegister ? "Operator" : "Grower",
      since: new Date().toISOString(),
    });
  }, [validateFields, dispatched, otp, showRegister, name, phone, onAuthed]);

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-10"
      style={{ background: "radial-gradient(700px 400px at 50% -10%, rgba(57,181,74,0.08), transparent 65%), #080F0B" }}
    >
      <div className="w-full max-w-sm mx-auto fade-up">
        <div className="flex justify-center mb-10">
          <GroxvelLogo height={54} />
        </div>

        <h2 className="text-white text-lg font-semibold mb-6">Sign in</h2>

        <div className="space-y-6">
          {showRegister && (
            <Field label="Full Name">
              <input
                type="text"
                className="input-clean w-full"
                placeholder="Alex Brown"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-fullname"
              />
            </Field>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <Field label="Phone Number">
              <input
                type="tel"
                className="input-clean w-full"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
            </Field>
            <button
              onClick={dispatchOTP}
              className="h-10 px-4 rounded-full bg-[#39B54A]/12 border border-[#39B54A]/40 text-[#39B54A] text-xs font-semibold hover:bg-[#39B54A]/20 transition-colors mb-1"
              data-testid="btn-dispatch-otp"
            >
              Send OTP
            </button>
          </div>

          <Field label="OTP">
            <OtpDots value={otp} onChange={setOtp} />
          </Field>
        </div>

        <button
          onClick={submit}
          className="mt-10 w-full h-12 rounded-full bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-base transition-colors"
          data-testid="btn-submit-auth"
        >
          Sign In
        </button>

        <p className="mt-4 text-center text-[11px] text-white/40">
          SMS Delivery by Twilio · slot reserved
        </p>

        <div className="mt-8 text-center">
          <RegisterToggle
            showRegister={showRegister}
            onToggle={() => setShowRegister((v) => !v)}
          />
        </div>
      </div>
    </div>
  );
}
