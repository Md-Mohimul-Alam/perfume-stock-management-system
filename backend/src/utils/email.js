const transporter = require("./mailer");

const sender =
  process.env.EMAIL_FROM ||
  `Luxe Perfume <${process.env.SMTP_USER}>`;

// =============================================
// OTP email
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to}`);

  try {
    const result = await transporter.sendMail({
      from: sender,
      to,
      subject: "Your OTP for Luxe Perfume",
      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">OTP Code</h2>
          <p>Your one-time password is:</p>

          <h1 style="
            color: #b8860b;
            font-size: 36px;
            letter-spacing: 4px;
          ">
            ${otp}
          </h1>

          <p>
            This OTP is valid for
            <strong>5 minutes</strong>.
          </p>

          <p>
            If you didn't request this,
            please ignore this email.
          </p>
        </div>
      `,
    });

    console.log(
      "✅ OTP email sent:",
      result.messageId
    );

    return result;
  } catch (error) {
    console.error(
      "❌ OTP email error:",
      error.message || error
    );

    throw new Error(
      "Failed to send OTP email"
    );
  }
};

// =============================================
// Verification email
// =============================================
exports.sendVerificationEmail = async (
  to,
  token
) => {
  const link =
    `${process.env.BASE_URL}/api/auth/verify/${token}`;

  console.log(
    `📧 Sending verification email to ${to}`
  );

  try {
    const result = await transporter.sendMail({
      from: sender,
      to,
      subject:
        "Verify Your Luxe Perfume Account",

      html: `
        <div style="font-family: sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">
            Welcome to Luxe Perfume
          </h2>

          <p>
            Please click the button below
            to verify your email:
          </p>

          <a
            href="${link}"
            style="
              display: inline-block;
              background: #b8860b;
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            "
          >
            Verify Email
          </a>

          <p>
            This link expires in 1 hour.
          </p>
        </div>
      `,
    });

    console.log(
      "✅ Verification email sent:",
      result.messageId
    );

    return result;
  } catch (error) {
    console.error(
      "❌ Verification email error:",
      error.message || error
    );

    throw new Error(
      "Failed to send verification email"
    );
  }
};