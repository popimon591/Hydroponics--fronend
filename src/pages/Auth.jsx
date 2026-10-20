import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { GroxvelLogo } from "@/components/GroxvelLogo";
import { authApi } from "@/lib/telemetry";

const Field = ({ label, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-xs uppercase tracking-[0.2em] text-white/60">{label}</label>
    <div className="mt-1">{children}</div>
  </div>
);

const OtpDots = ({ value, onChange, disabled, inputRef }) => {
  const digits = value.split("");
  const filled = digits.length;
  return (
    <div className="relative">
      <input
        id="otp"
        ref={inputRef}
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit verification code"
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
            style={{ borderColor: i <= filled ? "#39B54A" : "rgba(255,255,255,0.2)" }}
          >
            {i < filled ? <span className="text-white text-lg font-semibold">{digits[i]}</span> : <span className="h-1.5 w-1.5 rounded-full bg-white/35" />}
          </div>
        ))}
      </div>
    </div>
  );
};

const RegisterToggle = ({ showRegister, onToggle, disabled }) => (
  <button onClick={onToggle} disabled={disabled} className="min-h-[44px] px-2 text-sm text-white/60 hover:text-white transition-colors disabled:opacity-50" data-testid="toggle-register">
    {showRegister ? (
      "Already have an account? Sign in"
    ) : (
      <>
        First time? <span className="text-[#39B54A] font-semibold underline underline-offset-2">Create an account</span>
      </>
    )}
  </button>
);

// digits = valid national number lengths, without the leading 0
const COUNTRY_CODES = [
  { code: "+91", short: "IN +91", name: "India", digits: [10] },
  { code: "+1", short: "US +1", name: "United States", digits: [10] },
  { code: "+44", short: "UK +44", name: "United Kingdom", digits: [10] },
  { code: "+971", short: "AE +971", name: "United Arab Emirates", digits: [9] },
];

const RESEND_SECONDS = 30;

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

  const [resendIn, setResendIn] = useState(0);
  const phoneInputRef = useRef(null);
  const otpInputRef = useRef(null);
  // The last code auto-submitted, so a failed attempt is not retried in a loop.
  const autoSubmitted = useRef("");

  // Digits only, without a trunk-prefix 0 (e.g. "098765 43210" -> "9876543210").
  const phoneDigits = useMemo(() => phone.replace(/\D/g, "").replace(/^0+/, ""), [phone]);

  const fullPhone = useMemo(() => {
    const code = countryCode.trim();
    if (!phoneDigits) return "";
    return code.startsWith("+") ? `${code}${phoneDigits}` : `+${code}${phoneDigits}`;
  }, [countryCode, phoneDigits]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const validateFields = useCallback(() => {
    if (!phoneDigits) {
      toast.error("Enter your phone number");
      return false;
    }
    const country = COUNTRY_CODES.find((c) => c.code === countryCode);
    if (country && !country.digits.includes(phoneDigits.length)) {
      toast.error(`Enter a valid ${country.digits[0]}-digit phone number`);
      return false;
    }
    if (showRegister && !name.trim()) {
      toast.error("Enter your full name");
      return false;
    }
    return true;
  }, [name, phoneDigits, countryCode, showRegister]);

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
      try {
        await measureAuthOperation("backend account preflight", () => (
          showRegister
            ? authApi.sendRegisterOtp(name.trim(), fullPhone)
            : authApi.sendLoginOtp(fullPhone)
        ));
      } catch (backendError) {
        // Backend messages are already user-friendly; Firebase ones are not.
        backendError.isBackendError = true;
        throw backendError;
      }

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
              () => reject(new Error("Timed out waiting for the verification code.")),
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
        setOtp("");
        setResendIn(RESEND_SECONDS);
        toast.success(`Verification code sent to ${fullPhone}`);
      } finally {
        await Promise.all(listeners.map((listener) => listener.remove()));
      }
    } catch (error) {
      // Firebase "app not authorized" failures usually mean the signing key's
      // SHA-1 is missing in the Firebase console.
      console.error("Phone OTP request failed:", error);
      toast.error(error.isBackendError ? error.message : "We couldn't send the code. Check the number and try again.", { duration: 6000 });
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
      toast.error("Request a verification code first");
      return;
    }
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
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
        toast.error("That code is incorrect. Please check it and try again.");
        setOtp("");
      } else if (/session-expired|code-expired/i.test(errorMessage)) {
        toast.error("This code has expired. Request a new one.");
      } else {
        toast.error(error.message || "We couldn't verify the code. Please try again.");
      }
    } finally {
      submitInProgress.current = false;
      setSubmitting(false);
      logAuthTiming("OTP submit total", totalStartedAt);
    }
  }, [otp, otpSent, verificationId, onAuthed, fullPhone, name, showRegister, validateFields]);

  const resetOtp = () => {
    autoSubmitted.current = "";
    setOtp("");
    setOtpSent(false);
    setVerificationId("");
    setResendIn(0);
  };

  const changeNumber = () => {
    resetOtp();
    requestAnimationFrame(() => phoneInputRef.current?.focus());
  };

  const busy = sending || submitting;
  const canSubmit = otpSent && otp.length === 6 && !busy;

  // Once the code is sent, put the cursor in the code field so the keyboard
  // is already up (and Android can offer the SMS code as a suggestion).
  useEffect(() => {
    if (otpSent && !busy && !otp) otpInputRef.current?.focus();
  }, [otpSent, busy, otp]);

  // Submit as soon as the 6th digit is entered.
  useEffect(() => {
    if (canSubmit && autoSubmitted.current !== otp) {
      autoSubmitted.current = otp;
      submit();
    }
  }, [canSubmit, otp, submit]);

  const onEnter = (action) => (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      action();
    }
  };
  const sendLabel = otpSent ? (resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code") : "Send code";

  return (
    <div className="h-screen h-[100dvh] w-full flex flex-col items-center overflow-hidden px-6 select-none" style={{ background: "radial-gradient(700px 400px at 50% -10%, rgba(57,181,74,0.08), transparent 65%), #080F0B", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div className="min-h-full w-full max-w-sm mx-auto py-6 sm:py-8 fade-up flex flex-col justify-center">
        <div className="flex justify-center mb-6 sm:mb-8">
          <GroxvelLogo height={46} />
        </div>

        <h2 className="text-white text-lg font-semibold mb-5 text-center sm:text-left">{title}</h2>

        <div className="space-y-4 sm:space-y-5">
          {showRegister && (
            <Field label="Full Name" htmlFor="full-name">
              <input id="full-name" type="text" autoComplete="name" className="input-clean w-full" placeholder="Alex Brown" value={name} disabled={busy || otpSent} enterKeyHint="next" onKeyDown={onEnter(() => phoneInputRef.current?.focus())} onChange={(e) => setName(e.target.value)} data-testid="input-fullname" />
            </Field>
          )}

          <div className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[96px_minmax(0,1fr)_auto] gap-2.5 items-end">
            <Field label="Country" htmlFor="country-code">
              <div className="relative">
                <div className="input-clean w-full h-10 flex items-center pl-1 pr-6 text-sm font-semibold text-white pointer-events-none" aria-hidden="true" style={{ opacity: busy || otpSent ? 0.5 : 1 }}>
                  {COUNTRY_CODES.find((c) => c.code === countryCode)?.short || countryCode}
                </div>
                <select
                  id="country-code"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                  value={countryCode}
                  disabled={busy || otpSent}
                  onChange={(e) => { setCountryCode(e.target.value); resetOtp(); }}
                  data-testid="select-country-code"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#080F0B] text-white">
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60 text-[12px]" aria-hidden="true">▼</div>
              </div>
            </Field>
            <Field label="Phone Number" htmlFor="phone">
              <input id="phone" ref={phoneInputRef} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} className="input-clean w-full" placeholder="98765 43210" value={phone} disabled={busy || otpSent} enterKeyHint="send" onKeyDown={onEnter(dispatchOTP)} onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s-]/g, "")); resetOtp(); }} data-testid="input-phone" />
            </Field>
            <button onClick={dispatchOTP} disabled={busy || resendIn > 0} className="col-span-2 sm:col-span-1 justify-self-end h-11 px-4 rounded-full bg-[#39B54A]/12 border border-[#39B54A]/40 text-[#39B54A] text-sm font-semibold hover:bg-[#39B54A]/20 transition-colors mb-0.5 disabled:opacity-50 whitespace-nowrap" data-testid="btn-dispatch-otp">
              {sending ? <span className="flex items-center gap-1.5"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Sending...</span> : sendLabel}
            </button>
          </div>

          {otpSent && (
            <div className="flex items-center justify-between gap-3 text-sm text-white/70" data-testid="otp-sent-info">
              <span className="min-w-0 truncate">Code sent to <span className="text-white font-medium">{fullPhone}</span></span>
              <button onClick={changeNumber} disabled={busy} className="min-h-[44px] px-2 -mr-2 text-[#39B54A] font-semibold flex-shrink-0 disabled:opacity-50" data-testid="btn-change-number">Change number</button>
            </div>
          )}

          <Field label="Verification Code" htmlFor="otp">
            <OtpDots value={otp} onChange={setOtp} disabled={busy || !otpSent} inputRef={otpInputRef} />
          </Field>
        </div>

        <button onClick={submit} disabled={!canSubmit} className="mt-6 sm:mt-8 w-full h-11 sm:h-12 rounded-full bg-[#39B54A] hover:bg-[#43C755] text-[#0B2214] font-semibold text-base transition-colors disabled:opacity-50" data-testid="btn-submit-auth">
          {submitting ? <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />{showRegister ? "Creating Account..." : "Signing In..."}</span> : showRegister ? "Create Account" : "Sign In"}
        </button>

        <p className="mt-3 text-center text-xs text-white/60">You'll stay signed in on this phone.</p>

        <div className="mt-5 sm:mt-6 text-center">
          <RegisterToggle showRegister={showRegister} onToggle={() => { setShowRegister((value) => !value); resetOtp(); }} disabled={busy} />
        </div>
      </div>
      </div>
    </div>
  );
}
