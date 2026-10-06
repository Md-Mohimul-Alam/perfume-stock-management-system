const express = require("express");
const {
  register,
  verifyRegistrationOtp,
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();

// Registration
router.post("/register", register);
router.post("/verify-registration", verifyRegistrationOtp);

// Two-step login
router.post("/login", login);
router.post("/verify-otp", verifyOtp);

// Resend OTP
router.post("/resend-otp", resendOtp);

// Password reset
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

module.exports = router;