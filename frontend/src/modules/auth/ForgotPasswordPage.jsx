import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../services/authService";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";
import InteractiveBackground from "./InteractiveBackground";
import AuthFormBackground from "./AuthFormBackground";

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
      setError("Vui lòng nhập địa chỉ email");
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
            Đừng lo lắng,
            <br />
            <span className="highlight">chúng tôi sẽ giúp bạn.</span>
          </h1>

          <p>
            Ai cũng có lúc quên mật khẩu. Hãy để chúng tôi giúp bạn lấy lại
            quyền truy cập vào tài khoản.
          </p>
        </div>

        <InteractiveBackground />
      </div>

      {}
      <div className="auth-form-panel w-full lg:w-1/2">
        <AuthFormBackground />
        <div className="auth-wrapper">
          <div className="auth-form-box">
            {}
            <Link to="/login" className="auth-back-link">
              <ion-icon name="arrow-back"></ion-icon>
              Quay lại đăng nhập
            </Link>

            {isSuccess ? (
              
              <div style={{ textAlign: "center" }}>
                <div className="auth-success-icon">
                  <ion-icon
                    name="checkmark-circle"
                    style={{ fontSize: 44, color: "#10b981" }}
                  ></ion-icon>
                </div>
                <h2 className="auth-success-title">Kiểm tra email của bạn</h2>
                <p className="auth-success-text">
                  Chúng tôi đã gửi liên kết đặt lại mật khẩu đến{" "}
                  <strong style={{ color: "#fff" }}>{email}</strong>.
                  <br />
                  Vui lòng kiểm tra hộp thư và nhấp vào liên kết để đặt lại mật
                  khẩu.
                </p>

                <div className="auth-info-box auth-info-box--info">
                  <ion-icon
                    name="information-circle"
                    style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}
                  ></ion-icon>
                  <span>
                    <strong>Không nhận được email?</strong>
                    <br />
                    Kiểm tra thư mục spam/junk, hoặc đảm bảo bạn đã nhập đúng
                    địa chỉ email.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                  }}
                  className="auth-resend-btn"
                >
                  Thử email khác
                </button>
              </div>
            ) : (
              
              <>
                <h2>Quên mật khẩu?</h2>
                <p className="auth-subtitle">
                  Nhập email liên kết với tài khoản của bạn để nhận liên kết đặt
                  lại mật khẩu.
                </p>

                {}
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
                  {}
                  <div className="auth-input-box">
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder=" "
                      autoComplete="email"
                      autoFocus
                    />
                    <label htmlFor="forgot-email">Email</label>
                    <span className="icon">
                      <ion-icon name="mail"></ion-icon>
                    </span>
                  </div>

                  {}
                  <button
                    id="forgot-submit"
                    type="submit"
                    disabled={isLoading}
                    className="auth-btn-form"
                    style={{ marginTop: 36 }}
                  >
                    {isLoading ? (
                      <>
                        <span className="spinner"></span>
                        Đang gửi...
                      </>
                    ) : (
                      "Gửi liên kết đặt lại"
                    )}
                  </button>
                </form>
              </>
            )}

            {}
            <div className="auth-login-register">
              <p>
                Nhớ mật khẩu rồi?{" "}
                <Link to="/login">Đăng nhập</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
