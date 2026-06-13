import express from "express";
import {
  register,
  login,
  googleLogin,
  getMe,
  verifyEmail,
  resendOTP,
  forgotPassword,
  resetPassword,
  logout,
  refreshAccessToken,
} from "../presenters/authPresenter.js";
import protect from "../middlewares/authMiddleware.js";
import {
  loginRateLimit,
  forgotPasswordRateLimit,
  resendOtpRateLimit,
} from "../middlewares/rateLimitMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", loginRateLimit, login);
router.post("/google", googleLogin);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOtpRateLimit, resendOTP);
router.post("/forgot-password", forgotPasswordRateLimit, forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/logout", logout);
router.post("/refresh-token", refreshAccessToken);

router.get("/me", protect, getMe);

export default router;
