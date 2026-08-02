import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { GroxvelLogo } from "@/components/GroxvelLogo";
import { authApi } from "@/lib/telemetry";

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.24em] text-white/40">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

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
          <div
            key={i}
            className="h-8 w-8 flex items-center justify-center border-b transition-colors"
            style={{ borderColor: i <= filled ? "#39B54A" : "rgba(255,255,255,0.14)" }}
          >
            {i < filled ? <span className="text-white text-lg font-semibold">{digits[i]}</span> : <span className="h-1.5 w-1.5 rounded-full bg-white/25" />}
          </div>
        ))}
      </div>
    </div>
  );
};

const RegisterToggle = ({ showRegister, onToggle }) => (
  <button onClick={onToggle} className="text-[12.5px] text-white/50 hover:text-white transition-colors" data-testid="toggle-register">
    {showRegister ? (
      "Already have an account? Sign in"
    ) : (
      <>
        First time? <span className="text-[#39B54A] font-semibold underline underline-offset-2">Create an account</span>
      </>
    )}
  </button>
);

const COUNTRY_CODES = [
  { code: "+91", label: "+91" },
  { code: "+1", label: "+1" },
  { code: "+44", label: "+44" },
  { code: "+971", label: "+971" },
];

export default function Auth({ onAuthed }) {
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const title = useMemo(() => (showRegister ? "Create account" : "Sign in"), [showRegister]);

  const fullPhone = useMemo(() => {
    const code = countryCode.trim();
    const num = phone.trim();
    if (!num) return "";
    return code.startsWith("+") ? `${code}${num}` : `+${code}${num}`;
  }, [countryCode, phone]);

  const validateFields = useCallback(() => {
    if (!phone.trim()) {
      toast.error("Enter your phone number");
      return false;
    }
    if (!countryCode.trim()) {
      toast.error("Enter country code");
      return false;
    }
    if (showRegister && !name.trim()) {
      toast.error("Enter your full name");
      return false;
    }
    return true;
  }, [name, phone, countryCode, showRegister]);

  const dispatchOTP = useCallback(async () => {
    if (!validateFields()) return;
    setSending(true);
    try {
      if (showRegister) {
        await authApi.sendRegisterOtp(name.trim(), fullPhone);
      } else {
        await authApi.sendLoginOtp(fullPhone);
      }
      setOtpSent(true);
      toast.success("OTP sent successfully. Use the mock SMS/server logs during development.");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }, [name, fullPhone, showRegister, validateFields]);

  const submit = useCallback(async () => {
    if (!validateFields()) return;
    if (!otpSent) {
      toast.error("Request an OTP first");
      return;
    }
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }

    setSubmitting(true);
    try {
      const response = showRegister
        ? await authApi.verifyRegisterOtp(fullPhone, otp)
        : await authApi.verifyLoginOtp(fullPhone, otp);
      onAuthed(response.data.user);
      toast.success(showRegister ? "Registration successful" : "Login successful");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }, [otp, otpSent, onAuthed, fullPhone, showRegister, validateFields]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 py-10" style={{ background: "radial-gradient(700px 400px at 50% -10%, rgba(57,181,74,0.08), transparent 65%), #080F0B" }}>
      <div className="w-full max-w-sm mx-auto fade-up">
        <div className="flex justify-center mb-10">
          <GroxvelLogo height={54} />
        </div>

        <h2 className="text-white text-lg font-semibold mb-6">{title}</h2>

        <div className="space-y-6">
          {showRegister && (
            <Field label="Full Name">
              <input type="text" className="input-clean w-full" placeholder="Alex Brown" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-fullname" />
            </Field>
          )}

          <div className="grid grid-cols-[90px_1fr_auto] gap-3 items-end">
            <Field label="Code">
              <div className="relative">
                <select
                  className="input-clean w-full h-10 bg-transparent text-white border-b border-white/14 focus:border-[#39B54A] transition-colors cursor-pointer appearance-none pl-1 text-base font-semibold"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  data-testid="select-country-code"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#080F0B] text-white">
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-[12px]">▼</div>
              </div>
            </Field>
            <Field label="Phone Number">
              <input type="tel" className="input-clean w-full" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
            </Field>
            <button onClick={dispatchOTP} disabled={sending} className="h-10 px-4 rounded-full bg-[#39B54A]/12 border border-[#39B54A]/40 text-[#39B54A] text-xs font-semibold hover:bg-[#39B54A]/20 transition-colors mb-1 disabled:opacity-50" data-testid="btn-dispatch-otp">
              {sending ? "Sending..." : "Send OTP"}
            </button>
          </div>

          <Field label="OTP">
            <OtpDots value={otp} onChange={setOtp} />
          </Field>
        </div>

        <button onClick={submit} disabled={submitting} className="mt-10 w-full h-12 rounded-full bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-base transition-colors disabled:opacity-50" data-testid="btn-submit-auth">
          {submitting ? "Verifying..." : showRegister ? "Create Account" : "Sign In"}
        </button>

        <p className="mt-4 text-center text-[11px] text-white/40">OTPs are rate-limited. Session persists via refresh token for around 2 months.</p>

        <div className="mt-8 text-center">
          <RegisterToggle showRegister={showRegister} onToggle={() => { setShowRegister((value) => !value); setOtp(""); setOtpSent(false); }} />
        </div>
      </div>
    </div>
  );
}

