const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const { sendOtpEmail, sendPasswordResetEmail } = require("../utils/email");
const { saveOtp, getOtp, deleteOtp } = require("../utils/otpStore");

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn:
      process.env.JWT_EXPIRES_IN ||
      process.env.JWT_EXPIRE ||
      "7d",
  });
};

const generate6DigitOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

// --------------------------------------------------
// REGISTER — creates user, sends registration OTP
// --------------------------------------------------
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // Admin limit: only 2 admins allowed
    if (role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount >= 2) {
        return res
          .status(400)
          .json({ message: "Admin limit reached (max 2 admins)" });
      }
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role,
    });

    // Send registration OTP
    const otp = generate6DigitOtp();
    await saveOtp(`registration:${normalizedEmail}`, otp);

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailError) {
      console.error("Registration OTP email failed:", emailError.message);
      // Continue anyway — OTP is stored; user can use resend.
    }

    return res.status(201).json({
      message:
        "User created. An OTP has been sent to your email for verification.",
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// --------------------------------------------------
// VERIFY REGISTRATION OTP
// --------------------------------------------------
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const storedOtp = await getOtp(`registration:${normalizedEmail}`);

    if (!storedOtp || storedOtp !== String(otp)) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isVerified = true;
    await user.save();

    await deleteOtp(`registration:${normalizedEmail}`);

    return res.json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Verify registration OTP error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// --------------------------------------------------
// LOGIN — Step 1: check credentials, send login OTP
// --------------------------------------------------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      // Resend a fresh registration OTP so they can verify now.
      const regOtp = generate6DigitOtp();
      await saveOtp(`registration:${normalizedEmail}`, regOtp);
      try {
        await sendOtpEmail(normalizedEmail, regOtp);
      } catch (emailError) {
        console.error("Verify-reminder OTP failed:", emailError.message);
      }

      return res.status(403).json({
        message: "Please verify your email first. A new OTP has been sent.",
        requiresOtp: true,
        otpPurpose: "registration",
      });
    }

    // Send login OTP
    const otp = generate6DigitOtp();
    await saveOtp(`login:${normalizedEmail}`, otp);

    try {
      await sendOtpEmail(normalizedEmail, otp);
      console.log("Login OTP sent to", normalizedEmail);
    } catch (emailError) {
      console.error("Login OTP email failed (login continues):", {
        message: emailError.message,
      });
    }

    return res.json({
      message: "OTP sent to your email. Verify to complete login.",
      requiresOtp: true,
      otpPurpose: "login",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Login step 1 error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// --------------------------------------------------
// VERIFY LOGIN OTP — Step 2: issue JWT
// --------------------------------------------------
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const storedOtp = await getOtp(`login:${normalizedEmail}`);

    if (!storedOtp || storedOtp !== String(otp)) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await deleteOtp(`login:${normalizedEmail}`);

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// --------------------------------------------------
// RESEND OTP — for registration or login
// --------------------------------------------------
exports.resendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    if (!email || !purpose) {
      return res
        .status(400)
        .json({ message: "email and purpose are required" });
    }

    if (!["login", "registration"].includes(purpose)) {
      return res
        .status(400)
        .json({ message: "purpose must be 'login' or 'registration'" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (purpose === "registration" && user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    if (purpose === "login" && !user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email first.",
        requiresOtp: true,
        otpPurpose: "registration",
      });
    }

    const otp = generate6DigitOtp();
    const key = `${purpose}:${normalizedEmail}`;
    await saveOtp(key, otp);

    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailError) {
      console.error("Resend OTP email failed:", emailError.message);
      return res.status(500).json({
        message:
          "OTP saved but email failed to send. Please try again shortly.",
      });
    }

    return res.json({
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// --------------------------------------------------
// FORGOT PASSWORD — email a reset link
// --------------------------------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: normalizedEmail });

    // Don't reveal whether the email is registered
    const genericMessage =
      "If an account exists for that email, a password reset link will be sent.";

    if (!user) {
      return res.json({ message: genericMessage });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      console.error("FRONTEND_URL is not configured");
      return res
        .status(500)
        .json({ message: "Server misconfigured: FRONTEND_URL missing" });
    }

    const resetUrl =
      `${frontendUrl.replace(/\/$/, "")}` +
      `/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (emailError) {
      console.error("Reset email failed:", emailError.message);

      // Roll back the token so user isn't stuck with a broken reset
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res
        .status(500)
        .json({ message: "Unable to send the reset email right now." });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Unable to process request." });
  }
};

// --------------------------------------------------
// RESET PASSWORD — consume token, set new password
// --------------------------------------------------
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    if (!password || password.length < 6) {
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
    }).select("+resetPasswordToken +resetPasswordExpires +password");

    if (!user) {
      return res
        .status(400)
        .json({ message: "This password reset link is invalid or has expired." });
    }

    user.password = password; // pre-save hook hashes it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.json({
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Unable to reset the password." });
  }
};