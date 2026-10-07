const transporter = require("./mailer");

/* ========================================
   HELPERS
======================================== */

const getFromEmail = () => {
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER;

  if (!from) {
    throw new Error(
      "EMAIL_FROM or SMTP_USER is not configured"
    );
  }

  return from;
};

const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .toLowerCase();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const validateRecipient = (to) => {
  const email = normalizeEmail(to);

  if (!email || !isValidEmail(email)) {
    throw new Error(
      "A valid recipient email address is required"
    );
  }

  return email;
};

/* ========================================
   OTP EMAIL
======================================== */

exports.sendOtpEmail = async (to, otp) => {
  const recipient =
    validateRecipient(to);

  const cleanOtp =
    String(otp || "").trim();

  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new Error(
      "OTP must be a 6-digit code"
    );
  }

  const digits =
    cleanOtp.split("");

  const digitBoxes =
    digits
      .map(
        (digit) => `
          <td
            align="center"
            style="padding:0 4px;"
          >
            <div
              style="
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
              "
            >
              ${escapeHtml(digit)}
            </div>
          </td>
        `
      )
      .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    LUXE Verification Code
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4efe4;
    font-family:Arial,sans-serif;
    color:#2b2b2b;
  "
>
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      background:#f4efe4;
      padding:40px 16px;
    "
  >
    <tr>
      <td align="center">

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:520px;
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
          "
        >

          <tr>
            <td
              style="
                height:6px;
                background:#d4af37;
              "
            ></td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:36px 40px 8px;
              "
            >
              <div
                style="
                  font-family:Georgia,serif;
                  font-size:26px;
                  letter-spacing:6px;
                  color:#b8860b;
                "
              >
                L U X E
              </div>

              <div
                style="
                  margin-top:6px;
                  font-size:10px;
                  letter-spacing:4px;
                  color:#9a8155;
                  text-transform:uppercase;
                "
              >
                Perfumers
              </div>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:20px 40px 0;
              "
            >
              <h1
                style="
                  margin:0;
                  font-family:Georgia,serif;
                  font-size:22px;
                  font-weight:normal;
                  color:#1c1a16;
                "
              >
                Your Verification Code
              </h1>

              <p
                style="
                  margin:12px 0 0;
                  font-size:14px;
                  line-height:22px;
                  color:#6b6256;
                "
              >
                Enter this code to complete
                your verification.
                <br />

                Do not share it with anyone.
              </p>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:28px 20px 8px;
              "
            >
              <table
                role="presentation"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>
                  ${digitBoxes}
                </tr>
              </table>

              <div
                style="
                  margin-top:18px;
                  font-family:monospace;
                  font-size:15px;
                  letter-spacing:6px;
                  color:#8e6c2c;
                "
              >
                ${escapeHtml(cleanOtp)}
              </div>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:22px 40px 0;
              "
            >
              <div
                style="
                  display:inline-block;
                  padding:8px 16px;
                  background:#fbf3dc;
                  border-radius:999px;
                  font-size:12px;
                  color:#8e6c2c;
                "
              >
                ⏱ Valid for 5 minutes
              </div>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:30px 40px;
              "
            >
              <p
                style="
                  margin:0;
                  font-size:12px;
                  line-height:20px;
                  color:#8a8175;
                  text-align:center;
                "
              >
                If you didn't request this
                code, you can safely ignore
                this email.
              </p>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:22px 40px;
                background:#faf6ec;
                border-top:1px solid #efe6d2;
              "
            >
              <p
                style="
                  margin:0;
                  font-size:11px;
                  letter-spacing:2px;
                  color:#9a8155;
                "
              >
                LUXE PERFUMERS
              </p>

              <p
                style="
                  margin:8px 0 0;
                  font-size:11px;
                  color:#b1a58e;
                "
              >
                Automated message —
                please do not reply.
              </p>
            </td>
          </tr>

        </table>

        <p
          style="
            margin:20px 0 0;
            font-size:11px;
            color:#b1a58e;
          "
        >
          © ${new Date().getFullYear()}
          LUXE Perfumers
        </p>

      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text =
    `LUXE Perfumers — Verification Code\n\n` +
    `Your OTP is: ${cleanOtp}\n\n` +
    `This code is valid for 5 minutes.\n` +
    `Do not share it with anyone.\n\n` +
    `If you didn't request this code, ` +
    `you can ignore this email.`;

  const info =
    await transporter.sendMail({
      from: getFromEmail(),
      to: recipient,

      subject:
        `${cleanOtp} is your LUXE verification code`,

      text,
      html,
    });

  console.log(
    "✅ OTP email sent:",
    info.messageId
  );

  return info;
};

/* ========================================
   LEGACY VERIFICATION EMAIL
======================================== */

exports.sendVerificationEmail =
  async (to, token) => {
    const recipient =
      validateRecipient(to);

    const baseUrl =
      String(
        process.env.BASE_URL || ""
      )
        .trim()
        .replace(/\/+$/, "");

    if (!baseUrl) {
      throw new Error(
        "BASE_URL is not configured"
      );
    }

    const cleanToken =
      String(token || "").trim();

    if (!cleanToken) {
      throw new Error(
        "Verification token is required"
      );
    }

    const verificationUrl =
      `${baseUrl}/api/auth/verify/` +
      encodeURIComponent(
        cleanToken
      );

    const safeUrl =
      escapeHtml(
        verificationUrl
      );

    const info =
      await transporter.sendMail({
        from: getFromEmail(),

        to: recipient,

        subject:
          "Verify Your LUXE Perfume Account",

        text:
          `Verify your account:\n\n` +
          verificationUrl,

        html: `
          <div
            style="
              font-family:Arial,sans-serif;
              max-width:500px;
              margin:auto;
            "
          >
            <h2
              style="
                color:#b8860b;
              "
            >
              Welcome to LUXE
            </h2>

            <p>
              Click below to verify
              your email address.
            </p>

            <a
              href="${safeUrl}"
              style="
                display:inline-block;
                background:#b8860b;
                color:#ffffff;
                padding:12px 24px;
                text-decoration:none;
                border-radius:6px;
              "
            >
              Verify Email
            </a>
          </div>
        `,
      });

    console.log(
      "✅ Verification email sent:",
      info.messageId
    );

    return info;
  };

/* ========================================
   PASSWORD RESET EMAIL
======================================== */

exports.sendPasswordResetEmail =
  async (to, resetUrl) => {
    const recipient =
      validateRecipient(to);

    const cleanResetUrl =
      String(
        resetUrl || ""
      ).trim();

    if (!cleanResetUrl) {
      throw new Error(
        "Password reset URL is required"
      );
    }

    let parsedUrl;

    try {
      parsedUrl =
        new URL(
          cleanResetUrl
        );
    } catch {
      throw new Error(
        "Invalid password reset URL"
      );
    }

    if (
      ![
        "http:",
        "https:",
      ].includes(
        parsedUrl.protocol
      )
    ) {
      throw new Error(
        "Reset URL must use HTTP or HTTPS"
      );
    }

    const resetLink =
      parsedUrl.toString();

    const safeResetLink =
      escapeHtml(
        resetLink
      );

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    Reset Your Password
  </title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4efe4;
    font-family:Arial,sans-serif;
    color:#2b2b2b;
  "
>
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      background:#f4efe4;
      padding:40px 16px;
    "
  >
    <tr>
      <td align="center">

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            max-width:520px;
            background:#ffffff;
            border-radius:16px;
            overflow:hidden;
          "
        >

          <tr>
            <td
              style="
                height:6px;
                background:#d4af37;
              "
            ></td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:36px 40px 8px;
              "
            >
              <div
                style="
                  font-family:Georgia,serif;
                  font-size:26px;
                  letter-spacing:6px;
                  color:#b8860b;
                "
              >
                L U X E
              </div>

              <div
                style="
                  margin-top:6px;
                  font-size:10px;
                  letter-spacing:4px;
                  color:#9a8155;
                "
              >
                PERFUMERS
              </div>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:20px 40px 0;
              "
            >
              <h1
                style="
                  margin:0;
                  font-family:Georgia,serif;
                  font-size:22px;
                  font-weight:normal;
                  color:#1c1a16;
                "
              >
                Reset Your Password
              </h1>

              <p
                style="
                  margin:14px 0 0;
                  font-size:14px;
                  line-height:22px;
                  color:#6b6256;
                "
              >
                We received a request to
                reset your password.
              </p>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:30px 40px 0;
              "
            >
              <a
                href="${safeResetLink}"
                style="
                  display:inline-block;
                  background:#d4af37;
                  color:#000000;
                  padding:14px 36px;
                  border-radius:999px;
                  text-decoration:none;
                  font-size:12px;
                  font-weight:600;
                  letter-spacing:2px;
                "
              >
                RESET PASSWORD
              </a>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:22px 40px 0;
              "
            >
              <div
                style="
                  display:inline-block;
                  padding:8px 16px;
                  background:#fbf3dc;
                  border-radius:999px;
                  font-size:12px;
                  color:#8e6c2c;
                "
              >
                ⏱ Link expires in
                15 minutes
              </div>
            </td>
          </tr>

          <tr>
            <td
              style="
                padding:30px 40px;
              "
            >
              <p
                style="
                  margin:0;
                  font-size:12px;
                  line-height:20px;
                  color:#8a8175;
                  text-align:center;
                "
              >
                If you didn't request
                this password reset,
                you can safely ignore
                this email.
              </p>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                padding:22px 40px;
                background:#faf6ec;
                border-top:1px solid #efe6d2;
              "
            >
              <p
                style="
                  margin:0;
                  font-size:11px;
                  letter-spacing:2px;
                  color:#9a8155;
                "
              >
                LUXE PERFUMERS
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
      `Open this link:\n` +
      `${resetLink}\n\n` +
      `This link expires in 15 minutes.\n\n` +
      `If you didn't request this, ` +
      `you can ignore this email.`;

    const info =
      await transporter.sendMail({
        from: getFromEmail(),

        to: recipient,

        subject:
          "Reset your LUXE Perfume password",

        text,
        html,
      });

    console.log(
      "✅ Password reset email sent:",
      info.messageId
    );

    return info;
  };