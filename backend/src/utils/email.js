const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

// Sender email – default Resend sender (works without domain verification)
const FROM_EMAIL = 'Luxe Perfume <onboarding@resend.dev>';

// =============================================
// OTP email
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to} (OTP: ${otp})`);
  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Your OTP for Luxe Perfume',
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">OTP Code</h2>
          <h1 style="color: #b8860b; font-size: 36px;">${otp}</h1>
          <p>This OTP is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this, please ignore.</p>
        </div>
      `,
    });
    console.log('✅ OTP sent via Resend:', result);
  } catch (error) {
    console.error('❌ Resend error:', error);
    throw new Error('Failed to send OTP email');
  }
};

// =============================================
// Verification email (optional)
// =============================================
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  console.log(`📧 Sending verification email to ${to}`);
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Verify Your Luxe Perfume Account',
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">Welcome</h2>
          <a href="${link}" style="background: #b8860b; color: white; padding: 12px 24px;">Verify Email</a>
          <p>Expires in 1 hour.</p>
        </div>
      `,
    });
    console.log('✅ Verification email sent');
  } catch (error) {
    console.error('❌ Resend error:', error);
    throw new Error('Failed to send verification email');
  }
};