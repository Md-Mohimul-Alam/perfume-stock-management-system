const { sendContactEmail } = require("../utils/contactMailer");

exports.submitContact = async (req, res) => {
  try {
    const { name, email, phone, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required.",
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (phone) {
      const digits = String(phone).replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid contact number.",
        });
      }
    }

    // ✅ AWAIT on Vercel — fire-and-forget gets killed when the response is sent
    console.log("[submitContact] Sending email...");
    await sendContactEmail({ name, email, phone, message });
    console.log("[submitContact] Email sent successfully");

    return res.status(200).json({
      success: true,
      message: "Thank you for your message! We will get back to you soon.",
    });
  } catch (error) {
    console.error("[submitContact] Failed:", error.message);
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to send your message right now. Please try again later.",
    });
  }
};