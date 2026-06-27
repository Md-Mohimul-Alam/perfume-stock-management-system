const otpStore = new Map();

exports.saveOtp = (email, otp, expiresInMs = 5 * 60 * 1000) => {
  otpStore.set(email, { otp, expires: Date.now() + expiresInMs });
};

exports.getOtp = (email) => {
  const record = otpStore.get(email);
  if (!record) return null;
  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return null;
  }
  return record.otp;
};

exports.deleteOtp = (email) => {
  otpStore.delete(email);
};