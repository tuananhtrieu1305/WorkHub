import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../services/authService";
import {
  LoadingOutlined,
  CheckCircleFilled,
  MailOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address");
      triggerShake();
      return;
    }

    setIsLoading(true);
    try {
      await forgotPassword(email);
      setIsSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Something went wrong. Please try again.",
      );
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 600);
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Panel - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden animate-fade-in">
        <img
          src="/login-hero.png"
          alt="Team collaboration"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end p-12 pb-16 text-white">
          <div className="flex items-center gap-3 mb-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">WorkHub</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            Don't worry,
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              we've got you.
            </span>
          </h1>

          <p className="text-lg text-gray-300 max-w-md animate-slide-up" style={{ animationDelay: "0.7s" }}>
            It happens to the best of us. Let's get you back into your account.
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

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12">
        <div className="w-full max-w-md animate-fade-slide-right">
          {/* Mobile Logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden animate-slide-up">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">WorkHub</span>
          </div>

          {/* Back to login */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors mb-8 animate-slide-up"
            style={{ animationDelay: "0.1s" }}
          >
            <ArrowLeftOutlined className="text-xs" />
            Back to sign in
          </Link>

          {isSuccess ? (
            // ===== Success State =====
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6 animate-slide-up">
                <CheckCircleFilled
                  style={{ fontSize: 44, color: "#10b981" }}
                />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
                Check your email
              </h2>
              <p className="text-gray-500 mb-6 animate-slide-up" style={{ animationDelay: "0.2s" }}>
                We've sent a password reset link to{" "}
                <strong className="text-gray-700">{email}</strong>.
                <br />
                Check your inbox and click the link to reset your password.
              </p>

              {/* Info box */}
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-left mb-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
                <p className="text-sm text-blue-700">
                  <strong>Didn't receive the email?</strong>
                  <br />
                  Check your spam/junk folder, or make sure you entered the correct email address.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setEmail("");
                }}
                className="text-sm text-blue-500 hover:text-blue-600 font-semibold transition-colors cursor-pointer animate-slide-up"
                style={{ animationDelay: "0.4s" }}
              >
                Try a different email
              </button>
            </div>
          ) : (
            // ===== Form State =====
            <>
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2 animate-slide-up" style={{ animationDelay: "0.15s" }}>
                  Forgot password?
                </h2>
                <p className="text-gray-500 animate-slide-up" style={{ animationDelay: "0.2s" }}>
                  No worries! Enter the email address associated with your account and we'll send you a link to reset your password.
                </p>
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

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <MailOutlined className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="auth-input pl-10"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  id="forgot-submit"
                  type="submit"
                  disabled={isLoading}
                  className="auth-btn-primary animate-slide-up"
                  style={{ animationDelay: "0.3s" }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingOutlined className="animate-spin" />
                      Sending reset link...
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
