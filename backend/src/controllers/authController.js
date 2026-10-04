const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { sendOtpEmail } = require("../utils/email");
const {
  saveOtp,
  getOtp,
  deleteOtp,
} = require("../utils/otpStore");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn:
      process.env.JWT_EXPIRES_IN ||
      process.env.JWT_EXPIRE ||
      "7d",
  });
};

// ---------- REGISTER (sends OTP) ----------
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

    const existingUser = await User.findOne({ email });
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

    const user = await User.create({ name, email, password, role });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOtp(email, otp);
    await sendOtpEmail(email, otp);

    res.status(201).json({
      message:
        "User created. An OTP has been sent to your email for verification.",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- VERIFY REGISTRATION OTP ----------
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const storedOtp = await getOtp(email);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isVerified = true;
    await user.save();

    await deleteOtp(email);

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("Verify registration OTP error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- LOGIN (Step 1: send OTP) ----------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ message: "Please verify your email first (check your OTP)." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOtp(email, otp);

    // Try to send the email. If it fails (Resend down, no API key, etc.),
    // do NOT fail the whole login — the OTP is already in the DB and can
    // be read from there.
    try {
      await sendOtpEmail(email, otp);
      console.log("OTP email sent to", email);
    } catch (emailError) {
      console.error("OTP email failed (login continues):", {
        message: emailError.message,
      });
    }

    res.json({
      message: "OTP sent to your email. Check the database if it didn't arrive.",
    });
  } catch (error) {
    console.error("Login step 1 error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- VERIFY OTP (Step 2: complete login) ----------
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const storedOtp = await getOtp(email);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await deleteOtp(email);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ message: error.message });
  }
};