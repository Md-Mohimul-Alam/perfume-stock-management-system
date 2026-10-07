const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: [
        "admin",
        "staff",
        "investor",
      ],
      default: "staff",
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    /* Legacy email verification fields */
    verificationToken: {
      type: String,
      select: false,
    },

    verificationTokenExpires: {
      type: Date,
      select: false,
    },

    /* Password reset */
    resetPasswordToken: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,

    toJSON: {
      transform: (
        _doc,
        ret
      ) => {
        delete ret.password;
        delete ret.verificationToken;
        delete ret.verificationTokenExpires;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;

        return ret;
      },
    },
  }
);

/* ========================================
   PASSWORD HASHING
======================================== */

userSchema.pre(
  "save",
  async function () {
    if (
      !this.isModified(
        "password"
      )
    ) {
      return;
    }

    const salt =
      await bcrypt.genSalt(12);

    this.password =
      await bcrypt.hash(
        this.password,
        salt
      );
  }
);

/* ========================================
   PASSWORD COMPARISON
======================================== */

userSchema.methods.matchPassword =
  async function (
    enteredPassword
  ) {
    if (!this.password) {
      return false;
    }

    return bcrypt.compare(
      enteredPassword,
      this.password
    );
  };

module.exports =
  mongoose.model(
    "User",
    userSchema
  );