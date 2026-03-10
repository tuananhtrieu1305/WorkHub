import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { resetPassword } from "../../services/authService";
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  LockOutlined,
} from "@ant-design/icons";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      triggerShake();
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      triggerShake();
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      triggerShake();
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setIsSuccess(true);
      setTimeout(() => navigate("/login"), 3000);
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
            Create a new
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              secure password.
            </span>
          </h1>

          <p className="text-lg text-gray-300 max-w-md animate-slide-up" style={{ animationDelay: "0.7s" }}>
            Choose a strong password to keep your account safe and secure.
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

          {isSuccess ? (
            // ===== Success State =====
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full mb-6 animate-slide-up">
                <CheckCircleFilled
                  style={{ fontSize: 44, color: "#10b981" }}
                />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
                Password Reset!
              </h2>
              <p className="text-gray-500 mb-8 animate-slide-up" style={{ animationDelay: "0.2s" }}>
                Your password has been updated successfully.
                <br />
                Redirecting you to sign in...
              </p>
              <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
                <LoadingOutlined className="text-2xl text-blue-500 animate-spin" />
              </div>
              <Link
                to="/login"
                className="inline-block mt-6 text-sm text-blue-500 hover:text-blue-600 font-semibold transition-colors animate-slide-up"
                style={{ animationDelay: "0.4s" }}
              >
                Go to Sign In now
              </Link>
            </div>
          ) : (
            // ===== Form State =====
            <>
              {/* Header */}
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
                  <LockOutlined style={{ fontSize: 24, color: "#3b82f6" }} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2 animate-slide-up" style={{ animationDelay: "0.15s" }}>
                  Set new password
                </h2>
                <p className="text-gray-500 animate-slide-up" style={{ animationDelay: "0.2s" }}>
                  Your new password must be at least 6 characters and different from your previous password.
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
                {/* New Password */}
                <div className="animate-slide-up" style={{ animationDelay: "0.25s" }}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    New Password
                  </label>
                  <div className="relative group">
                    <input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="auth-input pr-11"
                      autoComplete="new-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {showPassword ? <EyeOutlined className="text-lg" /> : <EyeInvisibleOutlined className="text-lg" />}
                    </button>
                  </div>
                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="mt-2 animate-fade-in">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                              password.length >= level * 3
                                ? level <= 1
                                  ? "bg-red-400"
                                  : level <= 2
                                  ? "bg-orange-400"
                                  : level <= 3
                                  ? "bg-yellow-400"
                                  : "bg-emerald-400"
                                : "bg-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs transition-colors ${
                        password.length >= 12 ? "text-emerald-500" : password.length >= 9 ? "text-yellow-500" : password.length >= 6 ? "text-orange-500" : "text-red-500"
                      }`}>
                        {password.length >= 12 ? "Strong password" : password.length >= 9 ? "Good password" : password.length >= 6 ? "Fair password" : "Too short"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative group">
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`auth-input pr-11 ${
                        confirmPassword && confirmPassword !== password
                          ? "!border-red-300 !ring-red-100"
                          : confirmPassword && confirmPassword === password
                          ? "!border-emerald-300 !ring-emerald-100"
                          : ""
                      }`}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOutlined className="text-lg" /> : <EyeInvisibleOutlined className="text-lg" />}
                    </button>
                  </div>
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-red-500 mt-1 animate-fade-in">Passwords do not match</p>
                  )}
                  {confirmPassword && confirmPassword === password && (
                    <p className="text-xs text-emerald-500 mt-1 animate-fade-in">✓ Passwords match</p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  id="reset-submit"
                  type="submit"
                  disabled={isLoading}
                  className="auth-btn-primary animate-slide-up"
                  style={{ animationDelay: "0.35s" }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingOutlined className="animate-spin" />
                      Resetting password...
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>

              {/* Back to Login */}
              <p className="text-center text-sm text-gray-500 mt-8 animate-slide-up" style={{ animationDelay: "0.4s" }}>
                Remember your password?{" "}
                <Link to="/login" className="text-blue-500 hover:text-blue-600 font-semibold transition-colors">
                  Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
