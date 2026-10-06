const nodemailer = require("nodemailer");

// ---------------------------------------------
// Reusable Gmail SMTP transporter
// ---------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password
  },
});

// ---------------------------------------------
// Shared sender
// ---------------------------------------------
const FROM_EMAIL =
  process.env.EMAIL_FROM || process.env.SMTP_USER;

// =============================================
// OTP email
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to} (OTP: ${otp})`);

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject: "Your OTP for FAME'S Organization",
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">OTP Code</h2>
          <h1 style="color: #b8860b; font-size: 36px;">${otp}</h1>
          <p>This OTP is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this, please ignore.</p>
        </div>
      `,
    });

    console.log("✅ OTP sent via Gmail:", info.messageId);
  } catch (error) {
    console.error("❌ Gmail SMTP error:", error);
    throw new Error("Failed to send OTP email");
  }
};

// =============================================
// Verification email (optional)
// =============================================
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  console.log(`📧 Sending verification email to ${to}`);

  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject: "Verify Your FAME'S Organization Account",
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">Welcome</h2>
          <a href="${link}"
             style="background:#b8860b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">
            Verify Email
          </a>
          <p>This link expires in 1 hour.</p>
        </div>
      `,
    });

    console.log("✅ Verification email sent:", info.messageId);
  } catch (error) {
    console.error("❌ Gmail SMTP error:", error);
    throw new Error("Failed to send verification email");
  }
};