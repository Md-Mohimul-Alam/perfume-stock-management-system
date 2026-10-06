const nodemailer = require("nodemailer");

// --------------------------------------------------
// Reusable transporter (same Gmail setup as OTP)
// --------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || process.env.SMTP_USER;
const TO =
  process.env.CONTACT_RECEIVER_EMAIL ||
  process.env.SMTP_USER;

// --------------------------------------------------
// Escape user input before injecting into HTML
// --------------------------------------------------
const esc = (str) =>
  String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// --------------------------------------------------
// Send a contact form submission
// --------------------------------------------------
exports.sendContactEmail = async ({ name, email, phone, message }) => {
  if (!TO) {
    throw new Error("CONTACT_RECEIVER_EMAIL is not configured");
  }

  const subject = `📬 New contact — ${name}`;

  const text =
    `New contact form submission\n\n` +
    `Name:  ${name}\n` +
    `Email: ${email}\n` +
    `Phone: ${phone || "—"}\n\n` +
    `Message:\n${message}\n`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #faf7f2; padding: 24px;">
      <div style="background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e9d9a6;">
        <div style="background: linear-gradient(135deg, #d4af37, #b8860b); padding: 20px 24px;">
          <h2 style="margin: 0; color: #000; font-size: 18px; letter-spacing: 0.05em; text-transform: uppercase;">
            New Contact Message
          </h2>
        </div>

        <div style="padding: 24px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #888; width: 90px; vertical-align: top;">Name</td>
              <td style="padding: 8px 0; color: #111; font-weight: 500;">${esc(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; vertical-align: top;">Email</td>
              <td style="padding: 8px 0; color: #111;">
                <a href="mailto:${esc(email)}" style="color: #b8860b; text-decoration: none;">${esc(email)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #888; vertical-align: top;">Phone</td>
              <td style="padding: 8px 0; color: #111;">
                ${phone ? `<a href="tel:${esc(phone)}" style="color: #b8860b; text-decoration: none;">${esc(phone)}</a>` : '<span style="color: #999;">—</span>'}
              </td>
            </tr>
          </table>

          <hr style="border: none; border-top: 1px solid #f0e6d2; margin: 20px 0;" />

          <p style="margin: 0 0 8px; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">
            Message
          </p>
          <div style="background: #faf7f2; border-left: 3px solid #d4af37; padding: 14px 16px; border-radius: 6px; color: #222; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
            ${esc(message)}
          </div>

          <div style="margin-top: 24px; text-align: center;">
            <a href="mailto:${esc(email)}?subject=Re:%20Your%20message%20to%20LUXE"
               style="display: inline-block; background: #d4af37; color: #000; padding: 12px 28px; border-radius: 999px; text-decoration: none; font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">
              Reply to ${esc(name)}
            </a>
          </div>
        </div>

        <div style="background: #faf7f2; padding: 14px 24px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #f0e6d2;">
          Sent from the LUXE Perfume contact form
        </div>
      </div>
    </div>
  `;

  const info = await transporter.sendMail({
    from: FROM,
    to: TO,
    replyTo: email, // hitting "Reply" in Gmail goes straight to the sender
    subject,
    text,
    html,
  });

  console.log("[contactMailer] Sent:", info.messageId);
  return info;
};