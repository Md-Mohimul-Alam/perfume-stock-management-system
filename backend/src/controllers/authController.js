const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendOtpEmail } = require('../utils/email');
const { saveOtp, getOtp, deleteOtp } = require('../utils/otpStore');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
};

// ---------- REGISTER (sends OTP) ----------
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Admin limit: only 2 admins allowed
    if (role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount >= 2) {
        return res.status(400).json({ message: 'Admin limit reached (max 2 admins)' });
      }
    }

    // Create user (unverified)
    const user = await User.create({ name, email, password, role });

    // Generate 6‑digit OTP and store in database
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOtp(email, otp); // ✅ added 'await'

    // Send OTP via email
    await sendOtpEmail(email, otp);

    res.status(201).json({
      message: 'User created. An OTP has been sent to your email for verification.',
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- VERIFY REGISTRATION OTP ----------
exports.verifyRegistrationOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const storedOtp = await getOtp(email); // ✅ added 'await'
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Activate user
    user.isVerified = true;
    await user.save();

    // Remove OTP from database
    await deleteOtp(email); // ✅ added 'await'

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Verify registration OTP error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- LOGIN (Step 1: send OTP) ----------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email first (check your OTP).' });
    }

    // Generate 6‑digit OTP and store
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOtp(email, otp); // ✅ added 'await'

    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Login step 1 error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ---------- VERIFY OTP (Step 2: complete login) ----------
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const storedOtp = await getOtp(email); // ✅ added 'await'
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await deleteOtp(email); // ✅ added 'await'

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: error.message });
  }
};