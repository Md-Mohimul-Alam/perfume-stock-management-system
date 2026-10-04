const express = require("express");

const {
  register,
  verifyRegistrationOtp,
  login,
  verifyOtp,
} = require("../controllers/authController");

const router = express.Router();

// Public registration routes
router.post("/register", register);
router.post("/verify-registration", verifyRegistrationOtp);

// Two-step login routes
router.post("/login", login);
router.post("/verify-otp", verifyOtp);

module.exports = router;