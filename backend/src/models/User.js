const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["admin", "staff", "investor"],
      default: "staff",
    },

    isVerified: { type: Boolean, default: false },

    // ---------------------------------------------
    // Email verification (optional legacy fields)
    // ---------------------------------------------
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },

    // ---------------------------------------------
    // Password reset (used by forgotPassword /
    // resetPassword controllers)
    // ---------------------------------------------
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Hash password whenever it is set/changed
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare a plain password against the stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);