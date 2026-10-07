const jwt = require("jsonwebtoken");

const User = require("../models/User");

/* ========================================
   PROTECT ROUTES
======================================== */

exports.protect = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    /* ----------------------------------------
       Check Authorization header
    ---------------------------------------- */

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res
        .status(401)
        .json({
          message:
            "Authentication required",
        });
    }

    /* ----------------------------------------
       Extract token
    ---------------------------------------- */

    const token =
      authHeader
        .slice(7)
        .trim();

    if (!token) {
      return res
        .status(401)
        .json({
          message:
            "Authentication token is missing",
        });
    }

    /* ----------------------------------------
       JWT secret check
    ---------------------------------------- */

    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET is not configured"
      );

      return res
        .status(500)
        .json({
          message:
            "Authentication service is unavailable",
        });
    }

    /* ----------------------------------------
       Verify JWT
    ---------------------------------------- */

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    if (!decoded?.id) {
      return res
        .status(401)
        .json({
          message:
            "Invalid authentication token",
        });
    }

    /* ----------------------------------------
       Find current user
    ---------------------------------------- */

    const user =
      await User.findById(
        decoded.id
      ).select(
        "_id name email role isVerified"
      );

    /*
      This also prevents a deleted user
      from continuing to use an old JWT.
    */

    if (!user) {
      return res
        .status(401)
        .json({
          message:
            "Account no longer exists",
        });
    }

    /* ----------------------------------------
       Verified account check
    ---------------------------------------- */

    if (!user.isVerified) {
      return res
        .status(403)
        .json({
          message:
            "Please verify your email first",
        });
    }

    /* ----------------------------------------
       Attach user
    ---------------------------------------- */

    req.user = user;

    return next();
  } catch (error) {
    /*
      Expired JWT
    */

    if (
      error?.name ===
      "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({
          message:
            "Session expired. Please sign in again.",
        });
    }

    /*
      Invalid/tampered JWT
    */

    if (
      error?.name ===
      "JsonWebTokenError"
    ) {
      return res
        .status(401)
        .json({
          message:
            "Invalid authentication token",
        });
    }

    console.error(
      "Auth middleware error:",
      error
    );

    return res
      .status(401)
      .json({
        message:
          "Authentication failed",
      });
  }
};

/* ========================================
   ADMIN ONLY
======================================== */

exports.admin = (
  req,
  res,
  next
) => {
  if (!req.user) {
    return res
      .status(401)
      .json({
        message:
          "Authentication required",
      });
  }

  if (
    req.user.role !==
    "admin"
  ) {
    return res
      .status(403)
      .json({
        message:
          "Admin access required",
      });
  }

  return next();
};

/* ========================================
   GENERIC ROLE AUTHORIZATION
======================================== */

/*
  Example:

  router.get(
    "/something",
    protect,
    authorizeRoles(
      "admin",
      "staff"
    ),
    controller
  );
*/

exports.authorizeRoles =
  (...allowedRoles) =>
  (
    req,
    res,
    next
  ) => {
    if (!req.user) {
      return res
        .status(401)
        .json({
          message:
            "Authentication required",
        });
    }

    if (
      !allowedRoles.includes(
        req.user.role
      )
    ) {
      return res
        .status(403)
        .json({
          message:
            "You do not have permission to perform this action",
        });
    }

    return next();
  };