import { useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { resendOTP } from "../../api/authApi";
import workHubLogo from "../../assets/WorkHub_logo_blue_background.png";
import InteractiveBackground from "./InteractiveBackground";
import AuthFormBackground from "./AuthFormBackground";

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

  
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const inputRefs = useRef([]);

  
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");
    setResendMessage("");

    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    
    if (value && index === 5) {
      const fullOtp = newOtp.join("");
      if (fullOtp.length === 6) {
        handleVerify(fullOtp);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    
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
      setError("Không tìm thấy email. Vui lòng đăng ký lại.");
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
          "Xác minh thất bại. Vui lòng thử lại."
      );
      triggerShake();
      
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
      setResendMessage(data.message || "Đã gửi lại mã xác minh!");
      setResendCooldown(60);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không thể gửi lại mã. Vui lòng thử lại."
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

  
  const maskEmail = (email) => {
    if (!email) return "";
    const [user, domain] = email.split("@");
    if (user.length <= 2) return `${user}@${domain}`;
    return `${user[0]}${"•".repeat(Math.min(user.length - 2, 6))}${user[user.length - 1]}@${domain}`;
  };

  
  if (isSuccess) {
    return (
      <div className="auth-page">
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
              Xác minh
              <br />
              <span className="highlight">thành công!</span>
            </h1>
            <p>
              Tài khoản của bạn đã được kích hoạt. Chào mừng bạn đến với
              WorkHub!
            </p>
          </div>
          <InteractiveBackground />
        </div>

        <div className="auth-form-panel w-full lg:w-1/2">
          <AuthFormBackground />
          <div className="auth-wrapper">
            <div className="auth-form-box" style={{ textAlign: "center" }}>
              <div className="auth-success-icon">
                <ion-icon
                  name="checkmark-circle"
                  style={{ fontSize: 44, color: "#10b981" }}
                ></ion-icon>
              </div>
              <h2 className="auth-success-title">Email đã được xác minh!</h2>
              <p className="auth-success-text">
                Tài khoản của bạn đã được kích hoạt thành công.
                <br />
                Đang chuyển hướng đến trang chính...
              </p>
              <div>
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  
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
            Chỉ còn một bước nữa!
            <br />
            <span className="highlight">Xác minh email của bạn.</span>
          </h1>

          <p>
            Chúng tôi cần xác minh rằng đó thực sự là bạn. Kiểm tra hộp thư để
            lấy mã xác minh.
          </p>
        </div>

        <InteractiveBackground />
      </div>

      {}
      <div className="auth-form-panel w-full lg:w-1/2">
        <AuthFormBackground />
        <div className="auth-wrapper">
          <div className="auth-form-box">
            <h2>Kiểm tra email của bạn</h2>
            <p className="auth-subtitle">
              Chúng tôi đã gửi mã xác minh gồm 6 chữ số đến
            </p>

            {}
            <div className="auth-email-badge">
              <ion-icon name="mail" style={{ fontSize: 18 }}></ion-icon>
              <span>{maskEmail(emailFromParams)}</span>
            </div>

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

            {}
            {resendMessage && (
              <div className="auth-info-box auth-info-box--success">
                <ion-icon
                  name="checkmark-circle"
                  style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}
                ></ion-icon>
                {resendMessage}
              </div>
            )}

            {}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginBottom: 28,
              }}
            >
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
                  className="auth-otp-input"
                />
              ))}
            </div>

            {}
            <button
              id="verify-submit"
              type="button"
              onClick={() => handleVerify(otp.join(""))}
              disabled={isLoading || otp.join("").length !== 6}
              className="auth-btn-form"
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Đang xác minh...
                </>
              ) : (
                "Xác minh Email"
              )}
            </button>

            {}
            <div className="auth-resend-section">
              <p style={{ marginBottom: 4 }}>Không nhận được mã?</p>
              {resendCooldown > 0 ? (
                <p className="auth-cooldown">
                  Gửi lại mã sau <span>{resendCooldown}s</span>
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isResending}
                  className="auth-resend-btn"
                >
                  {isResending ? (
                    <>
                      <span className="spinner" style={{
                        display: "inline-block",
                        width: 14,
                        height: 14,
                        border: "2px solid rgba(255,255,255,0.2)",
                        borderTopColor: "var(--auth-primary)",
                        borderRadius: "50%",
                        animation: "authSpin 0.8s linear infinite",
                        verticalAlign: "middle",
                        marginRight: 6,
                      }}></span>
                      Đang gửi...
                    </>
                  ) : (
                    "Gửi lại mã"
                  )}
                </button>
              )}
            </div>

            {}
            <div className="auth-login-register">
              <p>
                Sai email?{" "}
                <Link to="/register">Quay lại</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
