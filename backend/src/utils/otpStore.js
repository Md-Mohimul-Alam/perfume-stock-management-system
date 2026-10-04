const Otp = require("../models/Otp");

const DEFAULT_EXPIRY_MS = 5 * 60 * 1000;

// `key` may be an email, `login:${email}`, or `registration:${email}`.
exports.saveOtp = async (
  key,
  otp,
  expiresInMs = DEFAULT_EXPIRY_MS
) => {
  if (!key || !otp) {
    throw new Error("OTP key and code are required");
  }

  await Otp.deleteMany({ email: key });

  await Otp.create({
    email: key,
    otp: String(otp),
    expiresAt: new Date(Date.now() + expiresInMs),
  });
};

exports.getOtp = async (key) => {
  if (!key) return null;

  const now = new Date();

  const record = await Otp.findOne({
    email: key,
    expiresAt: { $gt: now },
  });

  if (record) {
    return record.otp;
  }

  // MongoDB's TTL cleanup can take time, so delete expired entries too.
  await Otp.deleteMany({
    email: key,
    expiresAt: { $lte: now },
  });

  return null;
};

exports.deleteOtp = async (key) => {
  if (!key) return;

  await Otp.deleteMany({ email: key });
};