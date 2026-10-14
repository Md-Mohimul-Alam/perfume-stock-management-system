const transporter = require("./mailer");

const sender =
  process.env.EMAIL_FROM ||
  `Luxe Perfume <${process.env.SMTP_USER}>`;

// =============================================
// OTP EMAIL
// =============================================

exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to}`);

  try {
    const result = await transporter.sendMail({
      from: sender,
      to,
      subject: "Your OTP for Luxe Perfume",

      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">
            Luxe Perfume Login Code
          </h2>

          <p>Your one-time password is:</p>

          <h1
            style="
              color: #b8860b;
              font-size: 36px;
              letter-spacing: 5px;
            "
          >
            ${otp}
          </h1>

          <p>
            This OTP is valid for
            <strong>5 minutes</strong>.
          </p>

          <p>
            If you did not request this login code,
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
    console.error("❌ OTP email error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });

    throw error;
  }
};

// =============================================
// VERIFICATION EMAIL
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
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">
            Welcome to Luxe Perfume
          </h2>

          <p>
            Please verify your email address
            by clicking the button below.
          </p>

          <a
            href="${link}"
            style="
              display: inline-block;
              background: #b8860b;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            "
          >
            Verify Email
          </a>

          <p>
            This verification link expires
            in 1 hour.
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
      {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
      }
    );

    throw error;
  }
};

// =============================================
// PASSWORD RESET EMAIL
// =============================================

exports.sendPasswordResetEmail = async (
  to,
  resetUrl
) => {
  console.log(
    `📧 Sending password reset email to ${to}`
  );

  try {
    const result = await transporter.sendMail({
      from: sender,
      to,
      subject:
        "Reset Your Luxe Perfume Password",

      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px;">
          <h2 style="color: #b8860b;">
            Reset Your Password
          </h2>

          <p>
            We received a request to reset
            your Luxe Perfume password.
          </p>

          <a
            href="${resetUrl}"
            style="
              display: inline-block;
              background: #b8860b;
              color: #ffffff;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            "
          >
            Reset Password
          </a>

          <p>
            If you did not request this,
            you can safely ignore this email.
          </p>
        </div>
      `,
    });

    console.log(
      "✅ Password reset email sent:",
      result.messageId
    );

    return result;
  } catch (error) {
    console.error(
      "❌ Password reset email error:",
      {
        message: error.message,
        code: error.code,
        command: error.command,
        response: error.response,
        responseCode: error.responseCode,
      }
    );

    throw error;
  }
};