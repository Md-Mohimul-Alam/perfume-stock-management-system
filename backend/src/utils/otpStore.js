const Otp = require('../models/Otp');

exports.saveOtp = async (email, otp, expiresInMs = 5 * 60 * 1000) => {
  // Delete any existing OTP for this email
  await Otp.deleteMany({ email });
  
  // Save new OTP
  await Otp.create({
    email,
    otp,
    expiresAt: new Date(Date.now() + expiresInMs),
  });
};

exports.getOtp = async (email) => {
  const record = await Otp.findOne({ email });
  if (!record) return null;
  
  // Safety check: if expired (though MongoDB will auto‑delete)
  if (Date.now() > record.expiresAt.getTime()) {
    await Otp.deleteOne({ email });
    return null;
  }
  
  return record.otp;
};

exports.deleteOtp = async (email) => {
  await Otp.deleteMany({ email });
};