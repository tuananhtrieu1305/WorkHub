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

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/verify-email", verifyEmail);
router.post("/resend-otp", resendOTP);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/logout", logout);
router.post("/refresh-token", refreshAccessToken);

router.get("/me", protect, getMe);

export default router;
