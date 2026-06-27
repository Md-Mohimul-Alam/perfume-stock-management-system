const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  login,
  verifyOtp,
} = require('../controllers/authController');

// Public routes
router.post('/register', register);                // Step 1: create user & send verification email
router.get('/verify/:token', verifyEmail);         // Step 2: verify email via link
router.post('/login', login);                      // Step 1: send OTP after credentials
router.post('/verify-otp', verifyOtp);             // Step 2: verify OTP and get token

module.exports = router;