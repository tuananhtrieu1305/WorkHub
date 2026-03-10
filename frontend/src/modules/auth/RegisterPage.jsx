import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { EyeInvisibleOutlined, EyeOutlined, GoogleOutlined, WindowsOutlined, LoadingOutlined } from "@ant-design/icons";

const RegisterPage = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!fullName || !email || !password || !confirmPassword) {
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

    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      triggerShake();
      return;
    }

    setIsLoading(true);
    try {
      await register(fullName, email, password);
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please try again.");
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
          src="/register-hero.png"
          alt="Team collaboration"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col justify-end p-12 pb-16 text-white">
          {/* Headline */}
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight mb-4 animate-slide-up" style={{ animationDelay: "0.5s" }}>
            Empower your team's
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              collective genius.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-gray-300 max-w-md animate-slide-up" style={{ animationDelay: "0.7s" }}>
            Join thousands of teams who have transformed their workflow and increased productivity by 40%.
          </p>
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

      {/* Right Panel - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12 overflow-y-auto">
        <div className="w-full max-w-md animate-fade-slide-right">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6 animate-slide-up" style={{ animationDelay: "0.1s" }}>
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
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2 animate-slide-up" style={{ animationDelay: "0.15s" }}>
              Create your account
            </h2>
            <p className="text-gray-500 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              Join the movement and start building together.
            </p>
          </div>

          {/* Social Login */}
          <div className="grid grid-cols-2 gap-3 mb-6 animate-slide-up" style={{ animationDelay: "0.25s" }}>
            <button type="button" className="auth-btn-social">
              <GoogleOutlined className="text-lg" />
              <span>Google</span>
            </button>
            <button type="button" className="auth-btn-social">
              <WindowsOutlined className="text-lg text-blue-500" />
              <span>Microsoft</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative mb-6 animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-400 uppercase tracking-wider text-xs">Or register with email</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className={`mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2 animate-fade-in ${shakeError ? "animate-shake" : ""}`}>
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div className="animate-slide-up" style={{ animationDelay: "0.35s" }}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Full Name
              </label>
              <input
                id="register-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="auth-input"
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="animate-slide-up" style={{ animationDelay: "0.4s" }}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="auth-input"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="animate-slide-up" style={{ animationDelay: "0.45s" }}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative group">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input pr-11"
                  autoComplete="new-password"
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
            <div className="animate-slide-up" style={{ animationDelay: "0.5s" }}>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative group">
                <input
                  id="register-confirm-password"
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

            {/* Terms Checkbox */}
            <div className="flex items-start gap-2 animate-slide-up" style={{ animationDelay: "0.55s" }}>
              <input
                id="agree-terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500/20 transition cursor-pointer"
              />
              <label htmlFor="agree-terms" className="text-sm text-gray-600 cursor-pointer select-none">
                By signing up, you agree to our{" "}
                <a href="#" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-blue-500 hover:text-blue-600 font-medium transition-colors">
                  Privacy Policy
                </a>
                .
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="register-submit"
              type="submit"
              disabled={isLoading}
              className="auth-btn-primary animate-slide-up"
              style={{ animationDelay: "0.6s" }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingOutlined className="animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-sm text-gray-500 mt-6 animate-slide-up" style={{ animationDelay: "0.65s" }}>
            Already have an account?{" "}
            <Link to="/login" className="text-blue-500 hover:text-blue-600 font-semibold transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
