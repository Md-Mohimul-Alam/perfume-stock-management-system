require("dotenv").config();
const transporter = require("./src/utils/mailer");

(async () => {
  try {
    await transporter.verify();
    console.log("✅ SMTP verify OK");

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.SMTP_USER,
      subject: "Local SMTP test",
      text: "If you see this, SMTP works.",
    });
    console.log("✅ Sent:", info.messageId);
  } catch (err) {
    console.error("❌ Failed:", err.message);
    console.error(err);
  }
})();