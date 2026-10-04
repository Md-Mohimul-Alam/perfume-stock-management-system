const nodemailer = require("nodemailer");

const createTransporter = () => {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"];
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing email environment variables: ${missing.join(", ")}`
    );
  }

  const port = Number(process.env.SMTP_PORT || 587);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid port number");
  }

  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.toLowerCase() === "true"
    : port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST.trim(),
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.trim(),
    },

    // --- Render / cloud-host reliability fixes ---
    // Force IPv4: Node 17+ prefers IPv6, but Render often drops IPv6
    // silently, causing ETIMEDOUT. This is the #1 cause of this error.
    family: 4,

    // No pooling — OTP sends are one-shot; pooling adds no benefit
    // and can leave stale sockets around after a timeout.
    pool: false,

    // Slightly more generous timeouts for cold Render instances.
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 30_000,

    // Keep TLS verification ON. Never set rejectUnauthorized: false —
    // it doesn't fix timeouts and it leaks credentials.
    // tls: { rejectUnauthorized: true },
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
    const transporter = createTransporter();

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
    // Never log the OTP or SMTP password.
    // Log the full diagnostic surface so we can see WHY it failed.
    console.error("Nodemailer OTP email error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
    });

    throw error;
  }
};