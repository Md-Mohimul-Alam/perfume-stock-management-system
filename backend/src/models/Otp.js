const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    /*
      This field stores OTP keys such as:

      login:user@example.com
      registration:user@example.com

      It is named "email" for compatibility
      with the existing controller/database.
    */
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    /*
      OTP is stored as a SHA-256 hash,
      not as the original 6-digit code.
    */
    otp: {
      type: String,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
  MongoDB TTL index.

  The controller sets expiresAt approximately
  5 minutes after OTP creation.

  MongoDB automatically removes expired records.
*/
otpSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

module.exports = mongoose.model(
  'Otp',
  otpSchema
);