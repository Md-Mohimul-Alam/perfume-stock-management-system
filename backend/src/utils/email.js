const nodemailer = require("nodemailer");

const createTransporter = () => {
  const required = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "EMAIL_FROM",
  ];

  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Missing email environment variables: ${missing.join(", ")}`);
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
};

exports.sendOtpEmail = async (to, otp) => {
  if (!to || !/^\d{6}$/.test(String(otp))) {
    throw new Error("A recipient email and six-digit OTP are required");
  }

  try {
    const transporter = createTransporter();

    return await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: "Your Luxe Perfume verification code",
      text: `Your verification code is ${otp}. It is valid for 5 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
          <h2 style="color:#b8860b">Luxe Perfume verification code</h2>
          <p>Enter this code to continue:</p>
          <h1 style="color:#b8860b;font-size:36px;letter-spacing:8px">${otp}</h1>
          <p>This code is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    // Never log the OTP or SMTP password.
    console.error("Nodemailer OTP email error:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
    });

    throw error;
  }
};