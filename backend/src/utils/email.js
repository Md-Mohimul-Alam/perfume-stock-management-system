const nodemailer = require('nodemailer');
const dns = require('dns');

// ✅ Force IPv4 using custom DNS lookup
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS – port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
  // Override DNS lookup to force IPv4 only
  lookup: (hostname, options, callback) => {
    dns.lookup(hostname, { family: 4 }, callback);
  },
});

// =============================================
// OTP email for login & registration
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to} with OTP: ${otp}`);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Your OTP for Luxe Perfume',
    html: `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">OTP Code</h2>
        <p>Your one‑time password is:</p>
        <h1 style="color: #b8860b; font-size: 36px;">${otp}</h1>
        <p>This OTP is valid for <strong>5 minutes</strong>.</p>
        <p>If you didn't request this, please ignore.</p>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully');
  } catch (error) {
    console.error('❌ Nodemailer error:', error);
    throw new Error('Failed to send OTP email');
  }
};

// =============================================
// Verification email (token‑based) – kept for backward compatibility
// =============================================
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  console.log(`📧 Sending verification email to ${to}`);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Verify Your Luxe Perfume Account',
    html: `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">Welcome to Luxe Perfume</h2>
        <p>Please click the button below to verify your email and activate your account.</p>
        <a href="${link}" style="display: inline-block; background: #b8860b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email</a>
        <p>If you didn't create an account, you can ignore this email.</p>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent');
  } catch (error) {
    console.error('❌ Verification email error:', error);
    throw new Error('Failed to send verification email');
  }
};