// src/utils/email.js
const brevo = require('@getbrevo/brevo');

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

// Must match your verified sender
const sender = { email: 'mohimreza1234@gmail.com', name: 'Luxe Perfume' };

// =============================================
// OTP email
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to} with OTP: ${otp}`);
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = 'Your OTP for Luxe Perfume';
    sendSmtpEmail.htmlContent = `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">OTP Code</h2>
        <p>Your one‑time password is:</p>
        <h1 style="color: #b8860b; font-size: 36px;">${otp}</h1>
        <p>This OTP is valid for <strong>5 minutes</strong>.</p>
        <p>If you didn't request this, please ignore.</p>
      </div>
    `;
    sendSmtpEmail.sender = sender;
    sendSmtpEmail.to = [{ email: to }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ OTP email sent via Brevo:', result);
  } catch (error) {
    console.error('❌ Brevo error:', error.response?.body || error);
    throw new Error('Failed to send OTP email');
  }
};

// =============================================
// Verification email
// =============================================
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  console.log(`📧 Sending verification email to ${to}`);
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = 'Verify Your Luxe Perfume Account';
    sendSmtpEmail.htmlContent = `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">Welcome to Luxe Perfume</h2>
        <p>Please click the button below to verify your email:</p>
        <a href="${link}" style="display: inline-block; background: #b8860b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Verify Email</a>
        <p>This link expires in 1 hour.</p>
      </div>
    `;
    sendSmtpEmail.sender = sender;
    sendSmtpEmail.to = [{ email: to }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Verification email sent via Brevo:', result);
  } catch (error) {
    console.error('❌ Brevo error:', error.response?.body || error);
    throw new Error('Failed to send verification email');
  }
};