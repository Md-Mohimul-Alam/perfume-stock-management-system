const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { sendOtpEmail } = require("../utils/email");
const {
  saveOtp,
  getOtp,
  deleteOtp,
} = require("../utils/otpStore");

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        process.env.JWT_EXPIRE ||
        "7d",
    }
  );
};

const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

const normalizeEmail = (email) => {
  return String(email || "").trim().toLowerCase();
};

// --------------------------------------------------
// REGISTER: CREATE UNVERIFIED USER AND SEND OTP
// --------------------------------------------------

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const requestedRole = String(req.body.role || "staff")
      .trim()
      .toLowerCase();

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedName = String(name).trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    // Only allow public roles. Admin access must be controlled on the server.
    const publicRoles = ["staff", "investor"];
    let role = publicRoles.includes(requestedRole)
      ? requestedRole
      : "staff";

    const adminEmails = (
      process.env.ADMIN_EMAILS ||
      process.env.ADMIN_EMAIL ||
      ""
    )
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean);

    // Only server-configured email addresses can register as admins.
    if (adminEmails.includes(normalizedEmail)) {
      const adminCount = await User.countDocuments({
        role: "admin",
      });

      if (adminCount >= 2) {
        return res.status(403).json({
          message: "Admin limit reached (maximum 2 admins)",
        });
      }

      role = "admin";
    }

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
      role,
      isVerified: false,
    });

    const otpKey = `registration:${normalizedEmail}`;
    const otp = generateOtp();

    try {
      await saveOtp(otpKey, otp);
      await sendOtpEmail(normalizedEmail, otp);
    } catch (emailError) {
      // Remove the unverified account and OTP if the email could not be sent.
      await deleteOtp(otpKey);
      await User.deleteOne({
        _id: user._id,
        isVerified: false,
      });
      throw emailError;
    }

    return res.status(201).json({
      message:
        "User created. An OTP has been sent to your email for verification.",
    });
  } catch (error) {
    console.error("Register error:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
    });

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    return res.status(500).json({
      message: "Unable to complete registration right now.",
    });
  }
};

// --------------------------------------------------
// VERIFY REGISTRATION OTP
// --------------------------------------------------

exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const otpKey = `registration:${email}`;
    const storedOtp = await getOtp(otpKey);

    if (!storedOtp || String(storedOtp) !== otp) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      await deleteOtp(otpKey);

      return res.status(404).json({
        message: "User not found",
      });
    }

    user.isVerified = true;
    await user.save();
    await deleteOtp(otpKey);

    return res.json({
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    console.error("Verify registration OTP error:", error.message);

    return res.status(500).json({
      message: "Unable to verify the email right now.",
    });
  }
};

// --------------------------------------------------
// LOGIN STEP 1: CHECK PASSWORD AND SEND OTP
// --------------------------------------------------

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
      });
    }

    const otpKey = `login:${email}`;
    const otp = generateOtp();

    await saveOtp(otpKey, otp);

    try {
      await sendOtpEmail(email, otp);
    } catch (emailError) {
      await deleteOtp(otpKey);
      throw emailError;
    }

    return res.json({
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("Login OTP error:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
    });

    return res.status(500).json({
      message: "Unable to send the login code right now.",
    });
  }
};

// --------------------------------------------------
// LOGIN STEP 2: VERIFY OTP AND ISSUE JWT
// --------------------------------------------------

exports.verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
      });
    }

    const otpKey = `login:${email}`;
    const storedOtp = await getOtp(otpKey);

    if (!storedOtp || String(storedOtp) !== otp) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    const user = await User.findOne({ email });

    if (!user || !user.isVerified) {
      await deleteOtp(otpKey);

      return res.status(401).json({
        message: "Unable to verify login. Please sign in again.",
      });
    }

    await deleteOtp(otpKey);

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Verify login OTP error:", error.message);

    return res.status(500).json({
      message: "Unable to verify the login code right now.",
    });
  }
};