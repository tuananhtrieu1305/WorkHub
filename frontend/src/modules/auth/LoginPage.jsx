import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { resendOTP } from "../../services/authService";
import { EyeInvisibleOutlined, EyeOutlined, GoogleOutlined, WindowsOutlined, LoadingOutlined } from "@ant-design/icons";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      triggerShake();
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      // If account is not verified, redirect to verify-email page
      if (err.response?.data?.needsVerification) {
        // Resend OTP automatically
        try {
          await resendOTP(err.response.data.email);
        } catch {
          // ignore resend error
        }
        navigate(`/verify-email?email=${encodeURIComponent(err.response.data.email)}`);
        return;
      }
      setError(err.response?.data?.message || "Login failed. Please try again.");
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
        {/* Background Image */}
        <img
          src="/login-hero.png"
          alt="Team collaboration"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col justify-end p-12 pb-16 text-white">
          {/* Logo */}
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

          {/* Headline */}
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            Empower your team's
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              productivity.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-gray-300 mb-8 max-w-md animate-slide-up" style={{ animationDelay: "0.7s" }}>
            The unified platform for collaboration, project management, and corporate growth.
          </p>

          {/* Social Proof */}
          <div className="flex items-center gap-3 animate-slide-up" style={{ animationDelay: "0.9s" }}>
            <div className="flex -space-x-2">
              {["bg-blue-500", "bg-emerald-500", "bg-violet-500"].map((color, i) => (
                <div key={i} className={`w-9 h-9 ${color} rounded-full border-2 border-white/20 flex items-center justify-center text-xs font-bold shadow-lg`}>
                  {["JD", "AK", "ML"][i]}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-300">Joined by <strong className="text-white">10k+</strong> teams globally</span>
          </div>
        </div>

        {/* Floating particles effect */}
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

      {/* Right Panel - Login Form */}
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

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 animate-slide-up" style={{ animationDelay: "0.1s" }}>
              Welcome back
            </h2>
            <p className="text-gray-500 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              Please enter your details to sign in.
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="animate-slide-up" style={{ animationDelay: "0.3s" }}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="auth-input"
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div className="animate-slide-up" style={{ animationDelay: "0.4s" }}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-gray-700">
                  Password
                </label>
                <Link to="/forgot-password" className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative group">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input pr-11"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOutlined className="text-lg" /> : <EyeInvisibleOutlined className="text-lg" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2 animate-slide-up" style={{ animationDelay: "0.45s" }}>
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500/20 transition cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-sm text-gray-600 cursor-pointer select-none">
                Remember me for 30 days
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit"
              type="submit"
              disabled={isLoading}
              className="auth-btn-primary animate-slide-up"
              style={{ animationDelay: "0.5s" }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingOutlined className="animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-7 animate-slide-up" style={{ animationDelay: "0.55s" }}>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-400">Or continue with</span>
            </div>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-3 animate-slide-up" style={{ animationDelay: "0.6s" }}>
            <button type="button" className="auth-btn-social">
              <GoogleOutlined className="text-lg" />
              <span>Google</span>
            </button>
            <button type="button" className="auth-btn-social">
              <WindowsOutlined className="text-lg text-blue-500" />
              <span>Microsoft</span>
            </button>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-gray-500 mt-8 animate-slide-up" style={{ animationDelay: "0.65s" }}>
            Don't have an account?{" "}
            <Link to="/register" className="text-blue-500 hover:text-blue-600 font-semibold transition-colors">
              Create an account
            </Link>
          </p>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10 text-xs text-gray-400 animate-slide-up" style={{ animationDelay: "0.7s" }}>
            <a href="#" className="hover:text-gray-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Contact Support</a>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3 animate-slide-up" style={{ animationDelay: "0.75s" }}>
            © 2024 WorkHub Technologies Inc. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
