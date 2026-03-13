import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";
import InteractiveBackground from "./InteractiveBackground";
import AuthFormBackground from "./AuthFormBackground";

const RegisterPage = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !email || !password || !confirmPassword) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setIsLoading(true);
    try {
      await register(username, email, password);
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(
        err.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {}
      <div className="auth-hero hidden lg:flex lg:w-1/2">
        <img
          src="/register-hero.png"
          alt="Team collaboration"
          className="auth-hero-image"
        />
        <div className="auth-hero-content">
          <div className="auth-hero-logo">
            <img src={workHubLogo} alt="WorkHub" />
            <span>WorkHub</span>
          </div>

          <h1>
            Cùng nhau xây dựng
            <br />
            <span className="highlight">tương lai số.</span>
          </h1>

          <p>
            Tham gia cùng hàng nghìn đội ngũ đã thay đổi cách làm việc và tăng
            năng suất lên 40%.
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
            <h2>Tạo tài khoản mới</h2>
            <p className="auth-subtitle">
              Điền thông tin để đăng ký tài khoản
            </p>

            <form onSubmit={handleSubmit}>
              {}
              <div className="auth-input-box">
                <input
                  id="register-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder=" "
                  autoComplete="username"
                />
                <label htmlFor="register-username">Tên người dùng</label>
                <span className="icon">
                  <ion-icon name="person"></ion-icon>
                </span>
              </div>

              {}
              <div className="auth-input-box">
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder=" "
                  autoComplete="email"
                />
                <label htmlFor="register-email">Email</label>
                <span className="icon">
                  <ion-icon name="mail"></ion-icon>
                </span>
              </div>

              {}
              <div className="auth-input-box">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder=" "
                  autoComplete="new-password"
                />
                <label htmlFor="register-password">Mật khẩu</label>
                <span
                  className="icon clickable"
                  onClick={() => setShowPassword(!showPassword)}
                  title="Hiển thị/Ẩn mật khẩu"
                >
                  <ion-icon
                    name={showPassword ? "eye-off" : "eye"}
                  ></ion-icon>
                </span>
              </div>

              {}
              <div className="auth-input-box">
                <input
                  id="register-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder=" "
                  autoComplete="new-password"
                />
                <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
                <span
                  className="icon clickable"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title="Hiển thị/Ẩn mật khẩu"
                >
                  <ion-icon
                    name={showConfirmPassword ? "eye-off" : "eye"}
                  ></ion-icon>
                </span>
              </div>

              {}
              {error && <div className="auth-error-message">{error}</div>}

              {}
              <button
                id="register-submit"
                type="submit"
                disabled={isLoading}
                className="auth-btn-form"
                style={{ marginTop: "36px" }}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Đang đăng ký...
                  </>
                ) : (
                  "Đăng ký"
                )}
              </button>
            </form>

            {}
            <div className="auth-login-register">
              <p>
                Đã có tài khoản?{" "}
                <Link to="/login">Đăng nhập</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
