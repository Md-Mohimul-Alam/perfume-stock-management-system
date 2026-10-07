const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const User = require("../models/User");
const Otp = require("../models/Otp");
const {
  sendOtpEmail,
  sendPasswordResetEmail,
} = require("../utils/email");

/* ========================================
   CONSTANTS
======================================== */

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESET_EXPIRY_MS = 15 * 60 * 1000;
const ALLOWED_ROLES = new Set(["admin", "staff", "investor"]);

/* ========================================
   HELPERS
======================================== */

const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        process.env.JWT_EXPIRE ||
        "7d",
    }
  );
};

const generate6DigitOtp = () =>
  crypto.randomInt(100000, 1000000).toString();

const hashValue = (value) =>
  crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");

const hashOtp = (key, otp) =>
  hashValue(`${key}:${otp}`);

const timingSafeEqualStrings = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
};

const saveOtp = async (key, otp) => {
  await Otp.deleteMany({ email: key });

  return Otp.create({
    email: key,
    otp: hashOtp(key, otp),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
  });
};

const verifyStoredOtp = async (key, otp) => {
  const record = await Otp.findOne({
    email: key,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return false;
  }

  const expectedHash = hashOtp(key, otp);

  return timingSafeEqualStrings(
    record.otp,
    expectedHash
  );
};

const deleteOtp = async (key) => {
  await Otp.deleteMany({ email: key });
};

const sendOtpOrThrow = async (email, otp) => {
  await sendOtpEmail(email, otp);
};

const getRequestAdmin = async (req) => {
  const authHeader = String(
    req.headers.authorization || ""
  );

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7).trim();

  if (!token || !process.env.JWT_SECRET) {
    return null;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const actor = await User.findById(
      decoded.id
    ).select("_id role isVerified");

    if (
      actor &&
      actor.role === "admin" &&
      actor.isVerified
    ) {
      return actor;
    }

    return null;
  } catch {
    return null;
  }
};

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

/* ========================================
   REGISTER
======================================== */

exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
    } = req.body || {};

    const cleanName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email);
    const cleanPassword = String(password || "");

    if (
      !cleanName ||
      !normalizedEmail ||
      !cleanPassword
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters",
      });
    }

    const requestedRole = role
      ? String(role).trim().toLowerCase()
      : "staff";

    if (!ALLOWED_ROLES.has(requestedRole)) {
      return res.status(400).json({
        message: "Invalid account role",
      });
    }

    const requestAdmin =
      await getRequestAdmin(req);

    /*
      Public registration can create staff only.
      An authenticated, verified admin may create
      staff, investor, or admin accounts.
    */
    if (
      requestedRole !== "staff" &&
      !requestAdmin
    ) {
      return res.status(403).json({
        message:
          "Only an admin can create privileged accounts",
      });
    }

    const existingUser =
      await User.findOne({
        email: normalizedEmail,
      });

    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    if (requestedRole === "admin") {
      const adminCount =
        await User.countDocuments({
          role: "admin",
        });

      if (adminCount >= 2) {
        return res.status(400).json({
          message:
            "Admin limit reached (max 2 admins)",
        });
      }
    }

    const user = await User.create({
      name: cleanName,
      email: normalizedEmail,
      password: cleanPassword,
      role: requestedRole,
      isVerified: false,
    });

    const otp = generate6DigitOtp();
    const otpKey =
      `registration:${normalizedEmail}`;

    await saveOtp(
      otpKey,
      otp
    );

    try {
      await sendOtpOrThrow(
        normalizedEmail,
        otp
      );
    } catch (emailError) {
      console.error(
        "Registration OTP email failed:",
        emailError.message
      );

      /*
        Keep the unverified account + OTP so the
        user can use the resend endpoint.
      */
      return res.status(201).json({
        message:
          "Account created, but the verification email could not be sent. Please use Resend.",
        email: normalizedEmail,
        requiresOtp: true,
        otpPurpose: "registration",
      });
    }

    return res.status(201).json({
      message:
        "Account created. Check your email for the verification code.",
      email: normalizedEmail,
      requiresOtp: true,
      otpPurpose: "registration",
    });
  } catch (error) {
    console.error(
      "Register error:",
      error
    );

    if (error?.code === 11000) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    return res.status(500).json({
      message:
        "Unable to create the account right now.",
    });
  }
};

/* ========================================
   VERIFY REGISTRATION OTP
======================================== */

exports.verifyRegistrationOtp =
  async (req, res) => {
    try {
      const { email, otp } =
        req.body || {};

      const normalizedEmail =
        normalizeEmail(email);

      const cleanOtp =
        String(otp || "").trim();

      if (
        !normalizedEmail ||
        !cleanOtp
      ) {
        return res.status(400).json({
          message:
            "Email and OTP are required",
        });
      }

      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({
          message:
            "OTP must be a 6-digit code",
        });
      }

      const otpKey =
        `registration:${normalizedEmail}`;

      const validOtp =
        await verifyStoredOtp(
          otpKey,
          cleanOtp
        );

      if (!validOtp) {
        return res.status(400).json({
          message:
            "Invalid or expired OTP",
        });
      }

      const user =
        await User.findOne({
          email: normalizedEmail,
        });

      if (!user) {
        await deleteOtp(otpKey);

        return res.status(404).json({
          message: "User not found",
        });
      }

      if (!user.isVerified) {
        user.isVerified = true;
        await user.save();
      }

      await deleteOtp(otpKey);

      return res.json({
        message:
          "Email verified successfully. You can now log in.",
      });
    } catch (error) {
      console.error(
        "Verify registration OTP error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to verify the email right now.",
      });
    }
  };

/* ========================================
   LOGIN - STEP 1
======================================== */

exports.login = async (req, res) => {
  try {
    const { email, password } =
      req.body || {};

    const normalizedEmail =
      normalizeEmail(email);

    const cleanPassword =
      String(password || "");

    if (
      !normalizedEmail ||
      !cleanPassword
    ) {
      return res.status(400).json({
        message:
          "Email and password are required",
      });
    }

    const user =
      await User.findOne({
        email: normalizedEmail,
      }).select("+password");

    if (
      !user ||
      !(await user.matchPassword(
        cleanPassword
      ))
    ) {
      return res.status(401).json({
        message:
          "Invalid email or password",
      });
    }

    if (!user.isVerified) {
      const registrationOtp =
        generate6DigitOtp();

      const registrationKey =
        `registration:${normalizedEmail}`;

      await saveOtp(
        registrationKey,
        registrationOtp
      );

      try {
        await sendOtpOrThrow(
          normalizedEmail,
          registrationOtp
        );
      } catch (emailError) {
        console.error(
          "Verification reminder OTP failed:",
          emailError.message
        );

        return res.status(500).json({
          message:
            "Your email is not verified and we could not send a verification code right now.",
        });
      }

      return res.status(403).json({
        message:
          "Please verify your email first. A new verification code has been sent.",
        requiresOtp: true,
        otpPurpose: "registration",
        email: normalizedEmail,
      });
    }

    const otp =
      generate6DigitOtp();

    const otpKey =
      `login:${normalizedEmail}`;

    await saveOtp(
      otpKey,
      otp
    );

    try {
      await sendOtpOrThrow(
        normalizedEmail,
        otp
      );
    } catch (emailError) {
      console.error(
        "Login OTP email failed:",
        emailError.message
      );

      await deleteOtp(otpKey);

      return res.status(500).json({
        message:
          "Could not send the login code. Please try again.",
      });
    }

    return res.json({
      message:
        "OTP sent to your email. Verify to complete login.",
      requiresOtp: true,
      otpPurpose: "login",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error(
      "Login step 1 error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to sign in right now.",
    });
  }
};

/* ========================================
   VERIFY LOGIN OTP - STEP 2
======================================== */

exports.verifyOtp =
  async (req, res) => {
    try {
      const { email, otp } =
        req.body || {};

      const normalizedEmail =
        normalizeEmail(email);

      const cleanOtp =
        String(otp || "").trim();

      if (
        !normalizedEmail ||
        !cleanOtp
      ) {
        return res.status(400).json({
          message:
            "Email and OTP are required",
        });
      }

      if (!/^\d{6}$/.test(cleanOtp)) {
        return res.status(400).json({
          message:
            "OTP must be a 6-digit code",
        });
      }

      const otpKey =
        `login:${normalizedEmail}`;

      const validOtp =
        await verifyStoredOtp(
          otpKey,
          cleanOtp
        );

      if (!validOtp) {
        return res.status(400).json({
          message:
            "Invalid or expired OTP",
        });
      }

      const user =
        await User.findOne({
          email: normalizedEmail,
        });

      if (!user) {
        await deleteOtp(otpKey);

        return res.status(404).json({
          message: "User not found",
        });
      }

      if (!user.isVerified) {
        await deleteOtp(otpKey);

        return res.status(403).json({
          message:
            "Please verify your email before signing in.",
        });
      }

      await deleteOtp(otpKey);

      return res.json({
        ...publicUser(user),
        token: generateToken(user._id),
      });
    } catch (error) {
      console.error(
        "Verify OTP error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to verify the login code right now.",
      });
    }
  };

/* ========================================
   RESEND OTP
======================================== */

exports.resendOtp =
  async (req, res) => {
    try {
      const { email, purpose } =
        req.body || {};

      const normalizedEmail =
        normalizeEmail(email);

      const cleanPurpose =
        String(purpose || "")
          .trim()
          .toLowerCase();

      if (
        !normalizedEmail ||
        !cleanPurpose
      ) {
        return res.status(400).json({
          message:
            "Email and purpose are required",
        });
      }

      if (
        ![
          "login",
          "registration",
        ].includes(cleanPurpose)
      ) {
        return res.status(400).json({
          message:
            "Purpose must be 'login' or 'registration'",
        });
      }

      const user =
        await User.findOne({
          email: normalizedEmail,
        });

      if (!user) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      if (
        cleanPurpose ===
          "registration" &&
        user.isVerified
      ) {
        return res.status(400).json({
          message:
            "Email is already verified",
        });
      }

      if (
        cleanPurpose === "login" &&
        !user.isVerified
      ) {
        return res.status(403).json({
          message:
            "Please verify your email first.",
          requiresOtp: true,
          otpPurpose: "registration",
        });
      }

      const otp =
        generate6DigitOtp();

      const otpKey =
        `${cleanPurpose}:${normalizedEmail}`;

      await saveOtp(
        otpKey,
        otp
      );

      try {
        await sendOtpOrThrow(
          normalizedEmail,
          otp
        );
      } catch (emailError) {
        console.error(
          "Resend OTP failed:",
          emailError.message
        );

        await deleteOtp(otpKey);

        return res.status(500).json({
          message:
            "Could not send the verification code. Please try again.",
        });
      }

      return res.json({
        message:
          "A new OTP has been sent to your email.",
      });
    } catch (error) {
      console.error(
        "Resend OTP error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to resend the code right now.",
      });
    }
  };

/* ========================================
   FORGOT PASSWORD
======================================== */

exports.forgotPassword =
  async (req, res) => {
    try {
      const normalizedEmail =
        normalizeEmail(
          req.body?.email
        );

      if (!normalizedEmail) {
        return res.status(400).json({
          message:
            "Email is required",
        });
      }

      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          message:
            "Please enter a valid email address",
        });
      }

      const genericMessage =
        "If an account exists for that email, a password reset link will be sent.";

      const user =
        await User.findOne({
          email: normalizedEmail,
        });

      if (!user) {
        return res.json({
          message: genericMessage,
        });
      }

      const resetToken =
        crypto
          .randomBytes(32)
          .toString("hex");

      user.resetPasswordToken =
        hashValue(resetToken);

      user.resetPasswordExpires =
        new Date(
          Date.now() +
            RESET_EXPIRY_MS
        );

      await user.save({
        validateBeforeSave: false,
      });

      const frontendUrl =
        String(
          process.env.FRONTEND_URL ||
            ""
        )
          .trim()
          .replace(/\/+$/, "");

      if (!frontendUrl) {
        console.error(
          "FRONTEND_URL is not configured"
        );

        user.resetPasswordToken =
          undefined;

        user.resetPasswordExpires =
          undefined;

        await user.save({
          validateBeforeSave: false,
        });

        return res.status(500).json({
          message:
            "Password reset is temporarily unavailable.",
        });
      }

      const resetUrl =
        `${frontendUrl}/reset-password?token=` +
        encodeURIComponent(
          resetToken
        );

      try {
        await sendPasswordResetEmail(
          user.email,
          resetUrl
        );
      } catch (emailError) {
        console.error(
          "Reset email failed:",
          emailError.message
        );

        user.resetPasswordToken =
          undefined;

        user.resetPasswordExpires =
          undefined;

        await user.save({
          validateBeforeSave: false,
        });

        return res.status(500).json({
          message:
            "Unable to send the reset email right now.",
        });
      }

      return res.json({
        message: genericMessage,
      });
    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to process the request right now.",
      });
    }
  };

/* ========================================
   RESET PASSWORD
======================================== */

exports.resetPassword =
  async (req, res) => {
    try {
      /*
        Supports both:
        POST /reset-password/:token
        POST /reset-password { token, password }
      */
      const token = String(
        req.params?.token ||
          req.body?.token ||
          ""
      ).trim();

      const password = String(
        req.body?.password || ""
      );

      if (!token) {
        return res.status(400).json({
          message:
            "Reset token is required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message:
            "Password must be at least 6 characters",
        });
      }

      const hashedToken =
        hashValue(token);

      const user =
        await User.findOne({
          resetPasswordToken:
            hashedToken,
          resetPasswordExpires: {
            $gt: new Date(),
          },
        }).select(
          "+resetPasswordToken +resetPasswordExpires +password"
        );

      if (!user) {
        return res.status(400).json({
          message:
            "This password reset link is invalid or has expired.",
        });
      }

      user.password = password;
      user.resetPasswordToken =
        undefined;
      user.resetPasswordExpires =
        undefined;

      await user.save();

      await Promise.allSettled([
        deleteOtp(
          `login:${user.email}`
        ),
        deleteOtp(
          `registration:${user.email}`
        ),
      ]);

      return res.json({
        message:
          "Password reset successfully. You can now log in.",
      });
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      return res.status(500).json({
        message:
          "Unable to reset the password right now.",
      });
    }
  };