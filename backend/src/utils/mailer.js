// utils/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Give Vercel a bit more time to negotiate TLS
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

module.exports = transporter;