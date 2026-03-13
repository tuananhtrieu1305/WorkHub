import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { resendOTP } from "../../services/authService";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";
import InteractiveBackground from "./InteractiveBackground";
import AuthFormBackground from "./AuthFormBackground";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        try {
          await resendOTP(err.response.data.email);
        } catch {
          
        }
        navigate(
          `/verify-email?email=${encodeURIComponent(err.response.data.email)}`
        );
        return;
      }
      setError(
        err.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="auth-page">
      {}
      <div className="auth-hero hidden lg:flex lg:w-1/2">
        <img
          src="/login-hero.png"
          alt="Team collaboration"
          className="auth-hero-image"
        />
        <div className="auth-hero-content">
          <div className="auth-hero-logo">
            <img src={workHubLogo} alt="WorkHub" />
            <span>WorkHub</span>
          </div>

          <h1>
            Nâng tầm hiệu suất
            <br />
            <span className="highlight">làm việc nhóm.</span>
          </h1>

          <p>
            Nền tảng hợp nhất cho quản lý dự án, cộng tác và phát triển doanh
            nghiệp.
          </p>
        </div>

        {}
        <InteractiveBackground />
      </div>

      {}
      <div className="auth-form-panel w-full lg:w-1/2">
        <AuthFormBackground />
        <div className="auth-wrapper">
          <div className="auth-form-box">
            <h2>Chào mừng trở lại!</h2>
            <p className="auth-subtitle">
              Đăng nhập để tiếp tục vào hệ thống
            </p>

            <form onSubmit={handleSubmit}>
              {}
              <div className="auth-input-box">
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder=" "
                  autoComplete="email"
                />
                <label htmlFor="login-email">Email</label>
                <span className="icon">
                  <ion-icon name="mail"></ion-icon>
                </span>
              </div>

              {}
              <div className="auth-input-box">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder=" "
                  autoComplete="current-password"
                />
                <label htmlFor="login-password">Mật khẩu</label>
                <span
                  className="icon clickable"
                  onClick={togglePassword}
                  title="Hiển thị/Ẩn mật khẩu"
                >
                  <ion-icon
                    name={showPassword ? "eye-off" : "eye"}
                  ></ion-icon>
                </span>
              </div>

              {}
              {error && <div className="auth-error-message">{error}</div>}

              {}
              <div className="auth-remember">
                <label>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Ghi nhớ đăng nhập
                </label>
                <Link to="/forgot-password">Quên mật khẩu?</Link>
              </div>

              {}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="auth-btn-form"
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Đang đăng nhập...
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </form>

            {}
            <div className="auth-oauth-divider">HOẶC</div>

            {}
            <button type="button" className="auth-google-btn">
              <svg
                className="google-icon"
                viewBox="0 0 24 24"
                width="20"
                height="20"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Đăng nhập với Google
            </button>

            {}
            <div className="auth-login-register">
              <p>
                Chưa có tài khoản?{" "}
                <Link to="/register">Đăng ký</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
