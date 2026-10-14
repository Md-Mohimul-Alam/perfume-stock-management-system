const nodemailer = require("nodemailer");

const host =
  process.env.SMTP_HOST?.trim() ||
  "smtp.gmail.com";

const port = Number(
  process.env.SMTP_PORT || 465
);

const user =
  process.env.SMTP_USER?.trim();

const pass =
  process.env.SMTP_PASS?.trim();

const secure =
  process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.toLowerCase() ===
      "true"
    : port === 465;

if (!user) {
  throw new Error(
    "SMTP_USER is not configured"
  );
}

if (!pass) {
  throw new Error(
    "SMTP_PASS is not configured"
  );
}

if (
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error(
    "SMTP_PORT is invalid"
  );
}

const transporter =
  nodemailer.createTransport({
    host,
    port,
    secure,

    auth: {
      user,
      pass,
    },

    connectionTimeout:
      15000,

    greetingTimeout:
      10000,

    socketTimeout:
      20000,

    tls: {
      minVersion:
        "TLSv1.2",
    },
  });

module.exports = transporter;