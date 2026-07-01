const express = require('express');
const router = express.Router();
const {
  register,
  verifyRegistrationOtp,  // 👈 new
  login,
  verifyOtp,
} = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.post('/verify-registration', verifyRegistrationOtp); // 👈 new OTP verification
router.post('/login', login);
router.post('/verify-otp', verifyOtp);

module.exports = router;