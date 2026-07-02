// src/utils/email.js – Brevo HTTP API (no SDK, built-in fetch)

// Environment variables (set on Render)
const {
  BREVO_API_KEY,
  EMAIL_FROM = 'mohimreza1234@gmail.com', // fallback if not set
  BASE_URL,
} = process.env;

// Helper: send email via Brevo
const sendBrevoEmail = async ({ to, subject, htmlContent, senderName = 'Luxe Perfume' }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        sender: { email: EMAIL_FROM, name: senderName },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP ${response.status}`;
      console.error('Brevo API error details:', errorData);
      throw new Error(`Brevo API error: ${message}`);
    }

    const result = await response.json();
    console.log(`✅ Email sent to ${to} (Message ID: ${result.messageId})`);
    return result;
  } catch (error) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      console.error('⏱️ Brevo request timed out after 15s');
      throw new Error('Email service timeout');
    }
    console.error('❌ Brevo request failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// =============================================
// OTP email
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to} (OTP: ${otp})`);
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 500px;">
      <h2 style="color: #b8860b;">OTP Code</h2>
      <p>Your one‑time password is:</p>
      <h1 style="color: #b8860b; font-size: 36px;">${otp}</h1>
      <p>This OTP is valid for <strong>5 minutes</strong>.</p>
      <p>If you didn't request this, please ignore.</p>
    </div>
  `;

  return sendBrevoEmail({
    to,
    subject: 'Your OTP for Luxe Perfume',
    htmlContent,
  });
};

// =============================================
// Verification email (for email confirmation)
// =============================================
exports.sendVerificationEmail = async (to, token) => {
  const link = `${BASE_URL}/api/auth/verify/${token}`;
  console.log(`📧 Sending verification email to ${to}`);
  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 500px;">
      <h2 style="color: #b8860b;">Welcome to Luxe Perfume</h2>
      <p>Please verify your email address by clicking the button below:</p>
      <a href="${link}" style="display: inline-block; background: #b8860b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 20px 0;">Verify Email</a>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <p>If you didn't create an account, you can ignore this email.</p>
    </div>
  `;

  return sendBrevoEmail({
    to,
    subject: 'Verify Your Luxe Perfume Account',
    htmlContent,
  });
};