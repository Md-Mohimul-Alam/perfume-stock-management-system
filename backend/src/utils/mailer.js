const nodemailer = require("nodemailer");

// --------------------------------------------------
// Shared Gmail SMTP transporter
// Reads all values from env vars so Vercel's port
// change (465 vs 587) takes effect on every send.
// --------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

module.exports = transporter;