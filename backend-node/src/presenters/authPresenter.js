import crypto from "crypto";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
} from "../utils/sendEmail.js";

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If exists but not verified, allow re-registration with new OTP
      if (!existingUser.isVerified) {
        const otp = generateOTP();
        existingUser.fullName = fullName;
        existingUser.password = password;
        existingUser.verificationOTP = otp;
        existingUser.verificationOTPExpires = new Date(
          Date.now() + 10 * 60 * 1000,
        ); // 10 minutes
        await existingUser.save();

        await sendVerificationEmail(email, fullName, otp);

        return res.status(200).json({
          message:
            "A verification code has been sent to your email. Please check your inbox.",
          email,
        });
      }

      return res
        .status(400)
        .json({ message: "An account with this email already exists" });
    }

    // Generate OTP
    const otp = generateOTP();

    // Create user (unverified)
    const user = await User.create({
      fullName,
      email,
      password,
      verificationOTP: otp,
      verificationOTPExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    // Send verification email
    await sendVerificationEmail(email, fullName, otp);

    // Return success (no token — user must verify first)
    res.status(201).json({
      message:
        "Registration successful! A verification code has been sent to your email.",
      email: user.email,
    });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// @desc    Verify email with OTP
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email and verification code are required" });
    }

    const user = await User.findOne({ email }).select(
      "+verificationOTP +verificationOTPExpires",
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ message: "This account is already verified" });
    }

    // Check OTP match
    if (user.verificationOTP !== otp) {
      return res
        .status(400)
        .json({ message: "Invalid verification code. Please try again." });
    }

    // Check OTP expiry
    if (user.verificationOTPExpires < new Date()) {
      return res.status(400).json({
        message:
          "Verification code has expired. Please request a new one.",
        expired: true,
      });
    }

    // Activate account
    user.isVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;
    await user.save();

    // Return token so user is auto-logged in after verification
    res.status(200).json({
      message: "Email verified successfully!",
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("VerifyEmail error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// @desc    Resend OTP verification code
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ message: "This account is already verified" });
    }

    // Generate new OTP
    const otp = generateOTP();
    user.verificationOTP = otp;
    user.verificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send email
    await sendVerificationEmail(email, user.fullName, otp);

    res.status(200).json({
      message: "A new verification code has been sent to your email.",
    });
  } catch (error) {
    console.error("ResendOTP error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// @desc    Login user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        message:
          "Your account has not been verified. Please check your email for the verification code.",
        needsVerification: true,
        email: user.email,
      });
    }

    // Return user info + token
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists or not (security)
      return res.status(200).json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash and save to user
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // Build reset URL
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send email
    await sendResetPasswordEmail(email, user.fullName, resetLink);

    res.status(200).json({
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("ForgotPassword error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// @desc    Reset password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "New password is required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    // Hash the token from URL to compare with stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      return res.status(400).json({
        message:
          "Invalid or expired reset link. Please request a new password reset.",
      });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    // Also verify email if not already (user proved ownership)
    user.isVerified = true;
    await user.save();

    res.status(200).json({
      message:
        "Password reset successful! You can now log in with your new password.",
    });
  } catch (error) {
    console.error("ResetPassword error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("GetMe error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};
