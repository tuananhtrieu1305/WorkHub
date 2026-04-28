import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { resetPassword } from "../../api/authApi";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";
import InteractiveBackground from "./InteractiveBackground";
import AuthFormBackground from "./AuthFormBackground";

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
      setError("Vui lòng điền đầy đủ thông tin");
      triggerShake();
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự");
      triggerShake();
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
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
          "Đã xảy ra lỗi. Vui lòng thử lại."
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
    <div className="auth-page">

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
            Thiết lập mật khẩu
            <br />
            <span className="highlight">mới an toàn.</span>
          </h1>

          <p>
            Chọn một mật khẩu mạnh để bảo vệ tài khoản của bạn luôn được an
            toàn.
          </p>
        </div>

        <InteractiveBackground />
      </div>


      <div className="auth-form-panel w-full lg:w-1/2">
        <AuthFormBackground />
        <div className="auth-wrapper">
          <div className="auth-form-box">
            {isSuccess ? (
              
              <div style={{ textAlign: "center" }}>
                <div className="auth-success-icon">
                  <ion-icon
                    name="checkmark-circle"
                    style={{ fontSize: 44, color: "#10b981" }}
                  ></ion-icon>
                </div>
                <h2 className="auth-success-title">Đặt lại mật khẩu thành công!</h2>
                <p className="auth-success-text">
                  Mật khẩu của bạn đã được cập nhật thành công.
                  <br />
                  Đang chuyển hướng đến trang đăng nhập...
                </p>
                <div style={{ marginBottom: 16 }}>
                  <span className="spinner" style={{
                    display: "inline-block",
                    width: 24,
                    height: 24,
                    border: "2px solid rgba(255,255,255,0.2)",
                    borderTopColor: "var(--auth-primary)",
                    borderRadius: "50%",
                    animation: "authSpin 0.8s linear infinite",
                  }}></span>
                </div>
                <Link to="/login" className="auth-resend-btn">
                  Đi đến đăng nhập ngay
                </Link>
              </div>
            ) : (
              
              <>
                <h2>Đặt mật khẩu mới</h2>
                <p className="auth-subtitle">
                  Mật khẩu mới phải có ít nhất 6 ký tự và khác với mật khẩu cũ
                  của bạn.
                </p>


                {error && (
                  <div
                    className={`auth-info-box auth-info-box--error ${shakeError ? "auth-shake" : ""}`}
                  >
                    <ion-icon
                      name="alert-circle"
                      style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}
                    ></ion-icon>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>

                  <div className="auth-input-box">
                    <input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder=" "
                      autoComplete="new-password"
                      autoFocus
                    />
                    <label htmlFor="reset-password">Mật khẩu mới</label>
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


                  <div className="auth-input-box">
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder=" "
                      autoComplete="new-password"
                    />
                    <label htmlFor="reset-confirm-password">
                      Xác nhận mật khẩu mới
                    </label>
                    <span
                      className="icon clickable"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      title="Hiển thị/Ẩn mật khẩu"
                    >
                      <ion-icon
                        name={showConfirmPassword ? "eye-off" : "eye"}
                      ></ion-icon>
                    </span>
                  </div>


                  {confirmPassword && confirmPassword !== password && (
                    <p className="auth-match-text auth-match-text--mismatch">
                      ✗ Mật khẩu không khớp
                    </p>
                  )}
                  {confirmPassword && confirmPassword === password && (
                    <p className="auth-match-text auth-match-text--match">
                      ✓ Mật khẩu trùng khớp
                    </p>
                  )}


                  <button
                    id="reset-submit"
                    type="submit"
                    disabled={isLoading}
                    className="auth-btn-form"
                    style={{ marginTop: 36 }}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner"></span>
                        Đang đặt lại...
                      </>
                    ) : (
                      "Đặt lại mật khẩu"
                    )}
                  </button>
                </form>


                <div className="auth-login-register">
                  <p>
                    Nhớ mật khẩu rồi?{" "}
                    <Link to="/login">Đăng nhập</Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
