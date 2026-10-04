const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

exports.sendOtpEmail = async (to, otp) => {
  try {
    return await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject: "Your FAME'S Organization verification code",
      text: `Your verification code is ${otp}. It is valid for 5 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
          <h2 style="color:#047857">Email verification</h2>
          <p>Your verification code is:</p>
          <h1 style="color:#047857;font-size:36px;letter-spacing:8px">${otp}</h1>
          <p>This code is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    // Don't log the OTP or SMTP password.
    console.error("Nodemailer OTP email error:", {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
    });
    throw error;
  }
};