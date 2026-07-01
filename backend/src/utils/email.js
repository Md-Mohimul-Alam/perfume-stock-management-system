const { Resend } = require('resend');

// Initialize Resend with your API key from environment variables
const resend = new Resend(process.env.RESEND_API_KEY);

// Sender email – you can change this later after verifying your own domain.
// For now, the default Resend sender works.
const FROM_EMAIL = 'Luxe Perfume <onboarding@resend.dev>';

// =============================================
// Registration verification email
// =============================================
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Verify Your Luxe Perfume Account',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; color: #333;">
          <h2 style="color: #b8860b;">Welcome to Luxe Perfume</h2>
          <p>Please click the button below to verify your email and activate your account.</p>
          <a href="${link}" style="display: inline-block; background: #b8860b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email</a>
          <p>If you didn't create an account, you can ignore this email.</p>
          <p>This link expires in 1 hour.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Verification email error:', error);
    throw new Error('Failed to send verification email');
  }
};

// =============================================
// OTP email for login
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your Login OTP for Luxe Perfume',
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">Login OTP</h2>
          <p>Your one‑time password is:</p>
          <h1 style="color: #b8860b; font-size: 36px;">${otp}</h1>
          <p>This OTP is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this, please ignore.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('OTP email error:', error);
    throw new Error('Failed to send OTP email');
  }
};