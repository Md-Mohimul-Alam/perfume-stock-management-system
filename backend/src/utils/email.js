const transporter = require("./mailer");

// --------------------------------------------------
// Shared sender
// --------------------------------------------------
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.SMTP_USER;

// =============================================
// OTP email — premium design
// =============================================
exports.sendOtpEmail = async (to, otp) => {
  console.log(`📧 Sending OTP to ${to} (OTP: ${otp})`);

  const digits = String(otp).split("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your OTP Code</title>
</head>
<body style="margin:0;padding:0;background:#f4efe4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2b2b2b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4efe4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(92,61,46,0.10);">
          <tr>
            <td style="height:6px;background:linear-gradient(90deg,#d4af37,#b8860b,#d4af37);"></td>
          </tr>

          <tr>
            <td align="center" style="padding:36px 40px 8px 40px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:6px;color:#b8860b;font-weight:normal;">
                L U X E
              </div>
              <div style="margin-top:6px;font-size:10px;letter-spacing:4px;color:#9a8155;text-transform:uppercase;">
                Perfumers
              </div>
              <div style="margin-top:22px;height:1px;width:60px;background:linear-gradient(90deg,transparent,#d4af37,transparent);"></div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:16px 40px 0 40px;">
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;color:#1c1a16;letter-spacing:2px;">
                Your verification code
              </h1>
              <p style="margin:12px 0 0 0;font-size:14px;line-height:22px;color:#6b6256;">
                Enter this code to complete your sign in.<br />
                Do not share it with anyone.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 40px 8px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${digits
                    .map(
                      (d) => `
                  <td align="center" style="padding:0 4px;">
                    <div style="
                      width:46px;
                      height:56px;
                      line-height:56px;
                      text-align:center;
                      background:#fbf3dc;
                      border:1px solid #e4c66d;
                      border-radius:10px;
                      font-family:Georgia,'Times New Roman',serif;
                      font-size:26px;
                      font-weight:bold;
                      color:#8e6c2c;
                      letter-spacing:0;
                    ">${d}</div>
                  </td>`
                    )
                    .join("")}
                </tr>
              </table>

              <div style="margin-top:18px;font-family:'Courier New',monospace;font-size:15px;letter-spacing:6px;color:#8e6c2c;user-select:all;">
                ${otp}
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:22px 40px 0 40px;">
              <div style="display:inline-block;padding:8px 16px;background:#fbf3dc;border-radius:999px;font-size:12px;letter-spacing:1px;color:#8e6c2c;">
                ⏱ Valid for 5 minutes
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 40px 0 40px;">
              <div style="height:1px;background:#efe6d2;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 32px 40px;">
              <p style="margin:0;font-size:12px;line-height:20px;color:#8a8175;text-align:center;">
                If you didn't request this code, you can safely ignore this email.<br />
                Someone may have typed your email address by mistake.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px;background:#faf6ec;border-top:1px solid #efe6d2;" align="center">
              <p style="margin:0;font-size:11px;letter-spacing:2px;color:#9a8155;text-transform:uppercase;">
                LUXE Perfumers
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#b1a58e;">
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:20px 0 0 0;font-size:11px;color:#b1a58e;text-align:center;">
          © ${new Date().getFullYear()} LUXE Perfumers. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text =
    `LUXE Perfumers — Your verification code\n\n` +
    `Your OTP is: ${otp}\n\n` +
    `This code is valid for 5 minutes. Do not share it with anyone.\n\n` +
    `If you didn't request this code, you can safely ignore this email.`;

  const info = await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject: `${otp} is your LUXE verification code`,
    text,
    html,
  });

  console.log("✅ OTP sent via Gmail:", info.messageId);
  return info;
};

// =============================================
// Verification email (email link)
// =============================================
exports.sendVerificationEmail = async (to, token) => {
  const link = `${process.env.BASE_URL}/api/auth/verify/${token}`;
  console.log(`📧 Sending verification email to ${to}`);

  const info = await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject: "Verify Your LUXE Perfume Account",
    html: `
      <div style="font-family: sans-serif; max-width: 500px;">
        <h2 style="color: #b8860b;">Welcome</h2>
        <a href="${link}"
           style="background:#b8860b;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">
          Verify Email
        </a>
        <p>This link expires in 1 hour.</p>
      </div>
    `,
  });

  console.log("✅ Verification email sent:", info.messageId);
  return info;
};

// =============================================
// Password reset email
// =============================================
exports.sendPasswordResetEmail = async (to, resetUrl) => {
  console.log(`📧 Sending password reset email to ${to}`);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4efe4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2b2b2b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4efe4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(92,61,46,0.10);">
          <tr>
            <td style="height:6px;background:linear-gradient(90deg,#d4af37,#b8860b,#d4af37);"></td>
          </tr>

          <tr>
            <td align="center" style="padding:36px 40px 8px 40px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:6px;color:#b8860b;">
                L U X E
              </div>
              <div style="margin-top:6px;font-size:10px;letter-spacing:4px;color:#9a8155;text-transform:uppercase;">
                Perfumers
              </div>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 40px 0 40px;">
              <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;color:#1c1a16;letter-spacing:1px;">
                Reset your password
              </h1>
              <p style="margin:14px 0 0 0;font-size:14px;line-height:22px;color:#6b6256;">
                We received a request to reset your password. Click the button below to choose a new one.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:30px 40px 0 40px;">
              <a href="${resetUrl}"
                 style="display:inline-block;background:#d4af37;color:#000;padding:14px 36px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">
                Reset Password
              </a>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:22px 40px 0 40px;">
              <div style="display:inline-block;padding:8px 16px;background:#fbf3dc;border-radius:999px;font-size:12px;letter-spacing:1px;color:#8e6c2c;">
                ⏱ This link expires in 15 minutes
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 40px 0 40px;">
              <div style="height:1px;background:#efe6d2;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 32px 40px;">
              <p style="margin:0;font-size:12px;line-height:20px;color:#8a8175;text-align:center;">
                If you didn't request this, you can safely ignore this email.<br />
                Your password won't change until you click the button above.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px;background:#faf6ec;border-top:1px solid #efe6d2;" align="center">
              <p style="margin:0;font-size:11px;letter-spacing:2px;color:#9a8155;text-transform:uppercase;">
                LUXE Perfumers
              </p>
              <p style="margin:8px 0 0 0;font-size:11px;color:#b1a58e;">
                This is an automated message — please do not reply.
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

  const text =
    `LUXE Perfumers — Reset your password\n\n` +
    `Open this link to reset your password: ${resetUrl}\n\n` +
    `This link expires in 15 minutes.\n` +
    `If you didn't request this, you can ignore this email.`;

  const info = await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject: "Reset your LUXE Perfume password",
    text,
    html,
  });

  console.log("✅ Password reset email sent:", info.messageId);
  return info;
};