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

  console.log(`[otp] saveOtp called for key=${key}`);

  try {
    await Otp.deleteMany({ email: key });

    const record = await Otp.create({
      email: key,
      otp: String(otp),
      expiresAt: new Date(Date.now() + expiresInMs),
    });

    console.log(
      `[otp] saved OTP for ${key}, expires at ${record.expiresAt.toISOString()}`
    );

    return record;
  } catch (err) {
    console.error(`[otp] saveOtp FAILED for ${key}:`, {
      name: err.name,
      message: err.message,
    });
    throw err;
  }
};

exports.getOtp = async (key) => {
  if (!key) return null;

  const now = new Date();

  try {
    const record = await Otp.findOne({
      email: key,
      expiresAt: { $gt: now },
    });

    if (record) {
      console.log(`[otp] getOtp hit for ${key}`);
      return record.otp;
    }

    // MongoDB's TTL cleanup can take time, so delete expired entries too.
    await Otp.deleteMany({
      email: key,
      expiresAt: { $lte: now },
    });

    console.log(`[otp] getOtp miss for ${key}`);
    return null;
  } catch (err) {
    console.error(`[otp] getOtp FAILED for ${key}:`, {
      name: err.name,
      message: err.message,
    });
    throw err;
  }
};

exports.deleteOtp = async (key) => {
  if (!key) return;

  try {
    const result = await Otp.deleteMany({ email: key });
    console.log(
      `[otp] deleteOtp for ${key}, deleted ${result.deletedCount}`
    );
  } catch (err) {
    console.error(`[otp] deleteOtp FAILED for ${key}:`, {
      name: err.name,
      message: err.message,
    });
    throw err;
  }
};