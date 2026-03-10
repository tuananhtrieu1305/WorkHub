import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { resendOTP } from "../../services/authService";
import {
  LoadingOutlined,
  CheckCircleFilled,
  MailOutlined,
} from "@ant-design/icons";

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const emailFromParams = searchParams.get("email") || "";
  const navigate = useNavigate();
  const { verifyAndLogin } = useAuth();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  // Resend state
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");
    setResendMessage("");

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (value && index === 5) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Backspace: clear current and focus previous
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (code) => {
    if (!emailFromParams) {
      setError("Email not found. Please register again.");
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      await verifyAndLogin(emailFromParams, code);
      setIsSuccess(true);
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Verification failed. Please try again.",
      );
      triggerShake();
      // Clear OTP inputs on error
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || isResending) return;

    setIsResending(true);
    setError("");
    setResendMessage("");
    try {
      const data = await resendOTP(emailFromParams);
      setResendMessage(data.message);
      setResendCooldown(60);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to resend code. Please try again.",
      );
      triggerShake();
    } finally {
      setIsResending(false);
    }
  };

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 600);
  };

  // Mask email for display
  const maskEmail = (email) => {
    if (!email) return "";
    const [user, domain] = email.split("@");
    if (user.length <= 2) return `${user}@${domain}`;
    return `${user[0]}${"•".repeat(Math.min(user.length - 2, 6))}${user[user.length - 1]}@${domain}`;
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex bg-white">
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden animate-fade-in">
          <img
            src="/register-hero.png"
            alt="Team collaboration"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>

        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12">
          <div className="w-full max-w-md text-center animate-fade-slide-right">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6 animate-slide-up">
              <CheckCircleFilled
                style={{ fontSize: 44, color: "#10b981" }}
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Email Verified!
            </h2>
            <p className="text-gray-500 mb-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              Your account has been activated successfully. Redirecting you to the dashboard...
            </p>
            <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <LoadingOutlined className="text-2xl text-blue-500 animate-spin" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden animate-fade-in">
        <img
          src="/register-hero.png"
          alt="Team collaboration"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end p-12 pb-16 text-white">
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            Almost there!
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              Verify your email.
            </span>
          </h1>
          <p className="text-lg text-gray-300 max-w-md animate-slide-up" style={{ animationDelay: "0.7s" }}>
            We need to make sure it's really you. Check your inbox for the verification code.
          </p>
        </div>

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full animate-float"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.8}s`,
                animationDuration: `${3 + i * 0.5}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Right Panel - OTP Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12">
        <div className="w-full max-w-md animate-fade-slide-right">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">WorkHub</span>
          </div>

          {/* Header */}
          <div className="mb-2">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 animate-slide-up" style={{ animationDelay: "0.15s" }}>
              Check your email
            </h2>
            <p className="text-gray-500 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              We've sent a 6-digit verification code to
            </p>
          </div>

          {/* Email display */}
          <div className="flex items-center gap-2 mb-8 p-3 bg-blue-50 rounded-xl border border-blue-100 animate-slide-up" style={{ animationDelay: "0.25s" }}>
            <MailOutlined className="text-blue-500" />
            <span className="text-sm font-medium text-blue-700">
              {maskEmail(emailFromParams)}
            </span>
          </div>

          {/* Error Alert */}
          {error && (
            <div className={`mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-fade-in ${shakeError ? "animate-shake" : ""}`}>
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Success Message (resend) */}
          {resendMessage && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600 text-sm flex items-center gap-2 animate-fade-in">
              <CheckCircleFilled />
              {resendMessage}
            </div>
          )}

          {/* OTP Inputs */}
          <div className="flex justify-center gap-3 mb-8 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                disabled={isLoading}
                className="h-14 text-center text-2xl font-bold text-gray-900 border-2 border-gray-200 rounded-xl bg-white outline-none transition-all duration-300 hover:border-blue-300 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 focus:shadow-[0_0_20px_rgba(59,130,246,0.05)] disabled:opacity-50"
                style={{ width: 52, caretColor: "transparent" }}
              />
            ))}
          </div>

          {/* Verify Button */}
          <button
            id="verify-submit"
            type="button"
            onClick={() => handleVerify(otp.join(""))}
            disabled={isLoading || otp.join("").length !== 6}
            className="auth-btn-primary mb-6 animate-slide-up"
            style={{ animationDelay: "0.35s" }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingOutlined className="animate-spin" />
                Verifying...
              </span>
            ) : (
              "Verify Email"
            )}
          </button>

          {/* Resend OTP */}
          <div className="text-center animate-slide-up" style={{ animationDelay: "0.4s" }}>
            <p className="text-sm text-gray-500 mb-1">
              Didn't receive the code?
            </p>
            {resendCooldown > 0 ? (
              <p className="text-sm text-gray-400">
                Resend code in{" "}
                <span className="font-semibold text-blue-500">
                  {resendCooldown}s
                </span>
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={isResending}
                className="text-sm text-blue-500 hover:text-blue-600 font-semibold transition-colors cursor-pointer"
              >
                {isResending ? (
                  <span className="flex items-center justify-center gap-1">
                    <LoadingOutlined className="animate-spin" />
                    Sending...
                  </span>
                ) : (
                  "Resend Code"
                )}
              </button>
            )}
          </div>

          {/* Back to Login */}
          <p className="text-center text-sm text-gray-500 mt-8 animate-slide-up" style={{ animationDelay: "0.45s" }}>
            Wrong email?{" "}
            <Link to="/register" className="text-blue-500 hover:text-blue-600 font-semibold transition-colors">
              Go back
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
