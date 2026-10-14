const transporter = require("./mailer");

const sender =
  process.env.EMAIL_FROM ||
  `Luxe Perfume <${process.env.SMTP_USER}>`;

exports.sendOtpEmail = async (to, otp) => {
  const result = await transporter.sendMail({
    from: sender,
    to,
    subject: "Your OTP for Luxe Perfume",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">Luxe Perfume Login Code</h2>
        <p>Your one-time password is:</p>
        <h1 style="color: #b8860b; font-size: 36px; letter-spacing: 5px;">
          ${otp}
        </h1>
        <p>This OTP is valid for <strong>5 minutes</strong>.</p>
        <p>If you did not request this login code, please ignore this email.</p>
      </div>
    `,
  });

  return result;
};

exports.sendVerificationEmail = async (to, token) => {
  const link =
    `${process.env.BASE_URL}/api/auth/verify/${token}`;

  const result = await transporter.sendMail({
    from: sender,
    to,
    subject: "Verify Your Luxe Perfume Account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">Welcome to Luxe Perfume</h2>
        <p>Please verify your email address by clicking the button below.</p>

        <a
          href="${link}"
          style="
            display:inline-block;
            background:#b8860b;
            color:white;
            padding:12px 24px;
            text-decoration:none;
            border-radius:6px;
            margin:20px 0;
          "
        >
          Verify Email
        </a>

        <p>This verification link expires in 1 hour.</p>
      </div>
    `,
  });

  return result;
};

exports.sendPasswordResetEmail = async (to, resetUrl) => {
  const result = await transporter.sendMail({
    from: sender,
    to,
    subject: "Reset Your Luxe Perfume Password",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">Reset Your Password</h2>

        <p>
          We received a request to reset your Luxe Perfume password.
        </p>

        <a
          href="${resetUrl}"
          style="
            display:inline-block;
            background:#b8860b;
            color:white;
            padding:12px 24px;
            text-decoration:none;
            border-radius:6px;
            margin:20px 0;
          "
        >
          Reset Password
        </a>

        <p>If you did not request this, please ignore this email.</p>
      </div>
    `,
  });

  return result;
};