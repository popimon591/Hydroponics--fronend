import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { LoaderCircle } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { GroxvelLogo } from "@/components/GroxvelLogo";
import { authApi } from "@/lib/telemetry";

const Field = ({ label, children }) => (
  <div>
    <label className="block text-[10px] uppercase tracking-[0.24em] text-white/40">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const OtpDots = ({ value, onChange, disabled }) => {
  const digits = value.split("");
  const filled = digits.length;
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        maxLength={6}
        value={value}
        disabled={disabled}
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

const RegisterToggle = ({ showRegister, onToggle, disabled }) => (
  <button onClick={onToggle} disabled={disabled} className="text-[12.5px] text-white/50 hover:text-white transition-colors disabled:opacity-50" data-testid="toggle-register">
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

const logAuthTiming = (operation, startedAt) => {
  if (process.env.NODE_ENV !== "production" || process.env.REACT_APP_AUTH_TIMINGS === "true") {
    console.info(`[auth-timing] ${operation}: ${Math.round(performance.now() - startedAt)}ms`);
  }
};

const measureAuthOperation = async (operation, action) => {
  const startedAt = performance.now();
  try {
    return await action();
  } finally {
    logAuthTiming(operation, startedAt);
  }
};

export default function Auth({ onAuthed }) {
  const [showRegister, setShowRegister] = useState(false);
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sendInProgress = useRef(false);
  const submitInProgress = useRef(false);

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
    if (sendInProgress.current || submitInProgress.current) return;
    const totalStartedAt = performance.now();
    const validationStartedAt = performance.now();
    if (!validateFields()) return;
    logAuthTiming("phone/name input validation", validationStartedAt);
    if (!Capacitor.isNativePlatform()) {
      toast.error("Phone OTP is available in the Android app.");
      return;
    }

    sendInProgress.current = true;
    setSending(true);
    try {
      await measureAuthOperation("backend account preflight", () => (
        showRegister
          ? authApi.sendRegisterOtp(name.trim(), fullPhone)
          : authApi.sendLoginOtp(fullPhone)
      ));

      let resolveCodeSent;
      let rejectCodeSent;
      const codeSent = new Promise((resolve, reject) => {
        resolveCodeSent = resolve;
        rejectCodeSent = reject;
      });
      const listeners = [];
      try {
        listeners.push(
          await FirebaseAuthentication.addListener("phoneCodeSent", (event) => {
            resolveCodeSent(event.verificationId);
          })
        );
        listeners.push(
          await FirebaseAuthentication.addListener("phoneVerificationFailed", (event) => {
            rejectCodeSent(new Error(event.message));
          })
        );

        let timeoutId;
        let receivedVerificationId;
        try {
          const timeout = new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("Timed out waiting for Firebase phone verification.")),
              60000
            );
          });
          const verificationRequest = FirebaseAuthentication.signInWithPhoneNumber({
            phoneNumber: fullPhone,
            timeout: 0,
          }).then(() => codeSent);
          receivedVerificationId = await measureAuthOperation(
            "Firebase OTP request",
            () => Promise.race([verificationRequest, timeout])
          );
        } finally {
          clearTimeout(timeoutId);
        }
        setVerificationId(receivedVerificationId);
        setOtpSent(true);
        toast.success("Firebase sent the verification code.");
      } finally {
        await Promise.all(listeners.map((listener) => listener.remove()));
      }
    } catch (error) {
      console.error("Phone OTP request failed:", error);
      toast.error(error.message || "Firebase could not send OTP. Verify SHA-1 in Firebase Console.", { duration: 6000 });
    } finally {
      sendInProgress.current = false;
      setSending(false);
      logAuthTiming("send OTP total", totalStartedAt);
    }
  }, [name, fullPhone, showRegister, validateFields]);

  const submit = useCallback(async () => {
    if (sendInProgress.current || submitInProgress.current) return;
    if (!validateFields()) return;
    if (!otpSent) {
      toast.error("Request an OTP first");
      return;
    }
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    if (!verificationId) {
      toast.error("Request a new verification code first");
      return;
    }

    const totalStartedAt = performance.now();
    let stageStartedAt = totalStartedAt;
    submitInProgress.current = true;
    setSubmitting(true);
    try {
      await measureAuthOperation("Firebase OTP verification", () =>
        FirebaseAuthentication.confirmVerificationCode({
          verificationId,
          verificationCode: otp,
        })
      );
      const { token: firebaseIdToken } = await measureAuthOperation(
        "Firebase ID token retrieval",
        () => FirebaseAuthentication.getIdToken()
      );
      const response = await measureAuthOperation(
        "backend authentication and user lookup",
        () => (
          showRegister
            ? authApi.verifyRegisterOtp(name.trim(), fullPhone, firebaseIdToken)
            : authApi.verifyLoginOtp(fullPhone, firebaseIdToken)
        )
      );
      onAuthed(response.data.user);
      toast.success(showRegister ? "Registration successful" : "Login successful");
    } catch (error) {
      const errorMessage = String(error?.code || error?.message || "");
      if (/invalid-verification-code|invalid.*verification code|verification code.*invalid|invalid code/i.test(errorMessage)) {
        toast.error("Invalid OTP. Please check the code and try again.");
      } else if (/session-expired|code-expired/i.test(errorMessage)) {
        toast.error("This OTP has expired. Request a new code.");
      } else {
        toast.error(error.message || "Unable to verify the OTP.");
      }
    } finally {
      submitInProgress.current = false;
      setSubmitting(false);
      logAuthTiming("OTP submit total", totalStartedAt);
    }
  }, [otp, otpSent, verificationId, onAuthed, fullPhone, name, showRegister, validateFields]);

  const resetOtp = () => {
    setOtp("");
    setOtpSent(false);
    setVerificationId("");
  };

  return (
    <div className="h-screen h-[100dvh] w-full flex flex-col items-center overflow-hidden px-6 select-none" style={{ background: "radial-gradient(700px 400px at 50% -10%, rgba(57,181,74,0.08), transparent 65%), #080F0B" }}>
      <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="min-h-full w-full max-w-sm mx-auto py-6 sm:py-8 fade-up flex flex-col justify-center">
        <div className="flex justify-center mb-6 sm:mb-8">
          <GroxvelLogo height={46} />
        </div>

        <h2 className="text-white text-lg font-semibold mb-5 text-center sm:text-left">{title}</h2>

        <div className="space-y-4 sm:space-y-5">
          {showRegister && (
            <Field label="Full Name">
              <input type="text" className="input-clean w-full" placeholder="Alex Brown" value={name} disabled={sending || submitting} onChange={(e) => setName(e.target.value)} data-testid="input-fullname" />
            </Field>
          )}

          <div className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[96px_minmax(0,1fr)_auto] gap-2.5 items-end">
            <Field label="Code">
              <div className="relative">
                <select
                  className="input-clean w-full h-10 bg-transparent text-white border-b border-white/14 focus:border-[#39B54A] transition-colors cursor-pointer appearance-none pl-3 pr-7 text-base font-semibold"
                  value={countryCode}
                  disabled={sending || submitting}
                  onChange={(e) => { setCountryCode(e.target.value); resetOtp(); }}
                  data-testid="select-country-code"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#080F0B] text-white">
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 text-[12px]">▼</div>
              </div>
            </Field>
            <Field label="Phone Number">
              <input type="tel" className="input-clean w-full" placeholder="98765 43210" value={phone} disabled={sending || submitting} onChange={(e) => { setPhone(e.target.value); resetOtp(); }} data-testid="input-phone" />
            </Field>
            <button onClick={dispatchOTP} disabled={sending || submitting} className="col-span-2 sm:col-span-1 justify-self-end h-10 px-3.5 rounded-full bg-[#39B54A]/12 border border-[#39B54A]/40 text-[#39B54A] text-xs font-semibold hover:bg-[#39B54A]/20 transition-colors mb-0.5 disabled:opacity-50 whitespace-nowrap" data-testid="btn-dispatch-otp">
              {sending ? <span className="flex items-center gap-1.5"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Sending...</span> : "Send OTP"}
            </button>
          </div>

          <Field label="OTP">
            <OtpDots value={otp} onChange={setOtp} disabled={sending || submitting} />
          </Field>
        </div>

        <button onClick={submit} disabled={sending || submitting} className="mt-6 sm:mt-8 w-full h-11 sm:h-12 rounded-full bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-base transition-colors disabled:opacity-50" data-testid="btn-submit-auth">
          {submitting ? <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />{showRegister ? "Creating Account..." : "Signing In..."}</span> : showRegister ? "Create Account" : "Sign In"}
        </button>

        <p className="mt-3 text-center text-[11px] text-white/40">OTPs are rate-limited. Session persists via refresh token for around 2 months.</p>

        <div className="mt-5 sm:mt-6 text-center">
          <RegisterToggle showRegister={showRegister} onToggle={() => { setShowRegister((value) => !value); resetOtp(); }} disabled={sending || submitting} />
        </div>
      </div>
      </div>
    </div>
  );
}
