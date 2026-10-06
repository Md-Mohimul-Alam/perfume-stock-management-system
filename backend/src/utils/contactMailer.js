const nodemailer = require("nodemailer");

// --------------------------------------------------
// Reusable Gmail SMTP transporter
// --------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
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
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Contact Message</title>
</head>
<body style="margin:0;padding:0;background:#f4efe4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2b2b2b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4efe4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(92,61,46,0.10);">
          <tr>
            <td style="height:6px;background:linear-gradient(90deg,#d4af37,#b8860b,#d4af37);"></td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 40px 8px 40px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:6px;color:#b8860b;">
                L U X E
              </div>
              <div style="margin-top:6px;font-size:10px;letter-spacing:4px;color:#9a8155;text-transform:uppercase;">
                Perfumers
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0 40px;">
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;color:#1c1a16;letter-spacing:1px;text-align:center;">
                New Contact Message
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0 40px;">
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="padding:10px 0;color:#8a8175;width:90px;vertical-align:top;">Name</td>
                  <td style="padding:10px 0;color:#111;font-weight:600;">${esc(name)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#8a8175;vertical-align:top;">Email</td>
                  <td style="padding:10px 0;color:#111;">
                    <a href="mailto:${esc(email)}" style="color:#b8860b;text-decoration:none;">${esc(email)}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#8a8175;vertical-align:top;">Phone</td>
                  <td style="padding:10px 0;color:#111;">
                    ${
                      phone
                        ? `<a href="tel:${esc(phone)}" style="color:#b8860b;text-decoration:none;">${esc(phone)}</a>`
                        : '<span style="color:#999;">—</span>'
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0 40px;">
              <div style="height:1px;background:#efe6d2;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 8px 40px;">
              <p style="margin:0 0 8px 0;color:#8a8175;font-size:11px;text-transform:uppercase;letter-spacing:2px;">
                Message
              </p>
              <div style="background:#faf6ec;border-left:3px solid #d4af37;padding:16px 18px;border-radius:8px;color:#2b2b2b;font-size:14px;line-height:1.7;white-space:pre-wrap;">
${esc(message)}
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 40px 32px 40px;">
              <a href="mailto:${esc(email)}?subject=Re:%20Your%20message%20to%20LUXE"
                 style="display:inline-block;background:#d4af37;color:#000;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">
                Reply to ${esc(name.split(" ")[0])}
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px;background:#faf6ec;border-top:1px solid #efe6d2;" align="center">
              <p style="margin:0;font-size:11px;letter-spacing:2px;color:#9a8155;text-transform:uppercase;">
                LUXE Perfumers
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#b1a58e;">
                Sent from the LUXE contact form
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const info = await transporter.sendMail({
    from: FROM,
    to: TO,
    replyTo: email,
    subject,
    text,
    html,
  });

  console.log("[contactMailer] Sent:", info.messageId, "→", TO);
  return info;
};