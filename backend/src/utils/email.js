// src/utils/email.js – works without any extra npm package
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to} with OTP: ${otp}`);
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'mohimreza1234@gmail.com', name: 'Luxe Perfume' },
        to: [{ email: to }],
        subject: 'Your OTP for Luxe Perfume',
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 500px;">
            <h2 style="color: #b8860b;">OTP Code</h2>
            <h1 style="color: #b8860b; font-size: 36px;">${otp}</h1>
            <p>This OTP is valid for <strong>5 minutes</strong>.</p>
            <p>If you didn't request this, please ignore.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Brevo API error:', error);
      throw new Error(error.message || 'Brevo API error');
    }

    console.log('✅ OTP email sent via Brevo');
  } catch (error) {
    console.error('❌ Brevo error:', error);
    throw new Error('Failed to send OTP email');
  }
};

// (Optional) Verification email – same pattern
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'mohimreza1234@gmail.com', name: 'Luxe Perfume' },
        to: [{ email: to }],
        subject: 'Verify Your Luxe Perfume Account',
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 500px;">
            <h2>Welcome to Luxe Perfume</h2>
            <a href="${link}" style="background: #b8860b; color: white; padding: 12px 24px;">Verify Email</a>
            <p>This link expires in 1 hour.</p>
          </div>
        `,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Brevo API error');
    }
    console.log('✅ Verification email sent');
  } catch (error) {
    console.error('❌ Brevo error:', error);
    throw new Error('Failed to send verification email');
  }
};