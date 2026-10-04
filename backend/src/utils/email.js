const nodemailer = require("nodemailer");
const {
  SESv2Client,
  SendEmailCommand,
} = require("@aws-sdk/client-sesv2");

let transporter;

const createTransporter = () => {
  const required = [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "EMAIL_FROM",
  ];

  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing email environment variables: ${missing.join(", ")}`
    );
  }

  const sesClient = new SESv2Client({
    region: process.env.AWS_REGION.trim(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
    },
  });

  return nodemailer.createTransport({
    SES: {
      sesClient,
      SendEmailCommand,
    },
  });
};

exports.sendOtpEmail = async (to, otp) => {
  const recipient = String(to || "").trim();
  const otpCode = String(otp);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("A valid recipient email is required");
  }

  if (!/^\d{6}$/.test(otpCode)) {
    throw new Error("A six-digit OTP is required");
  }

  try {
    if (!transporter) {
      transporter = createTransporter();
    }

    return await transporter.sendMail({
      from: process.env.EMAIL_FROM.trim(),
      to: recipient,
      subject: "Your Luxe Perfume verification code",
      text: `Your verification code is ${otpCode}. It is valid for 5 minutes.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
          <h2 style="color:#b8860b">Luxe Perfume verification code</h2>
          <p>Enter this code to continue:</p>
          <h1 style="color:#b8860b;font-size:36px;letter-spacing:8px">
            ${otpCode}
          </h1>
          <p>This code is valid for <strong>5 minutes</strong>.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Nodemailer SES email error:", {
      message: error.message,
      code: error.code,
      name: error.name,
    });

    throw error;
  }
};