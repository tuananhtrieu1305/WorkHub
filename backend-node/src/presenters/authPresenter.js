import crypto from "crypto";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
} from "../utils/sendEmail.js";


const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};




export const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      
      if (!existingUser.isVerified) {
        const otp = generateOTP();
        existingUser.fullName = fullName;
        existingUser.password = password;
        existingUser.verificationOTP = otp;
        existingUser.verificationOTPExpires = new Date(
          Date.now() + 10 * 60 * 1000,
        ); 
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

    
    const otp = generateOTP();

    
    const user = await User.create({
      fullName,
      email,
      password,
      verificationOTP: otp,
      verificationOTPExpires: new Date(Date.now() + 10 * 60 * 1000), 
    });

    
    await sendVerificationEmail(email, fullName, otp);

    
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

    
    if (user.verificationOTP !== otp) {
      return res
        .status(400)
        .json({ message: "Invalid verification code. Please try again." });
    }

    
    if (user.verificationOTPExpires < new Date()) {
      return res.status(400).json({
        message:
          "Verification code has expired. Please request a new one.",
        expired: true,
      });
    }

    
    user.isVerified = true;
    user.verificationOTP = undefined;
    user.verificationOTPExpires = undefined;
    await user.save();

    
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

    
    const otp = generateOTP();
    user.verificationOTP = otp;
    user.verificationOTPExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    
    await sendVerificationEmail(email, user.fullName, otp);

    res.status(200).json({
      message: "A new verification code has been sent to your email.",
    });
  } catch (error) {
    console.error("ResendOTP error:", error.message);
    res.status(500).json({ message: "Server error, please try again" });
  }
};




export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }

    
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    
    if (!user.password) {
      return res.status(401).json({ message: "Tài khoản này được đăng ký bằng Google. Vui lòng đăng nhập bằng Google." });
    }

    
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    
    if (!user.isVerified) {
      return res.status(403).json({
        message:
          "Your account has not been verified. Please check your email for the verification code.",
        needsVerification: true,
        email: user.email,
      });
    }

    
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




export const googleLogin = async (req, res) => {
  try {
    const { email, name, picture, sub: googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ message: "Google account info is missing" });
    }

    let user = await User.findOne({ email });

    if (user) {
      if (user.authProvider !== "google" || !user.googleId) {
        user.googleId = googleId;
        user.authProvider = "google";
        user.isVerified = true; 
        if (!user.avatar) user.avatar = picture;
        await user.save();
      }
    } else {
      user = await User.create({
        fullName: name,
        email,
        googleId,
        authProvider: "google",
        avatar: picture,
        isVerified: true, 
      });
    }

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Google verify error:", error.message);
    res.status(500).json({ message: "Xác thực Google thất bại. Vui lòng thử lại" });
  }
};




export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      
      return res.status(200).json({
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    
    const resetToken = crypto.randomBytes(32).toString("hex");

    
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); 
    await user.save();

    
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    
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

    
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
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
