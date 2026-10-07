const multer = require("multer");

/* ========================================
   404 HANDLER
======================================== */

exports.notFound = (
  req,
  res,
  next
) => {
  const error = new Error(
    `Not Found - ${req.originalUrl}`
  );

  error.statusCode = 404;

  next(error);
};

/* ========================================
   GLOBAL ERROR HANDLER
======================================== */

exports.errorHandler = (
  err,
  req,
  res,
  next
) => {
  /*
    Prevent Express warning about
    unused next argument while keeping
    the required error-handler signature.
  */
  void next;

  console.error(
    "Unhandled application error:",
    err
  );

  /* --------------------------------
     MULTER: FILE TOO LARGE
  -------------------------------- */

  if (
    err instanceof multer.MulterError &&
    err.code === "LIMIT_FILE_SIZE"
  ) {
    return res
      .status(413)
      .json({
        message:
          "Image is too large. Maximum file size is 5 MB.",
      });
  }

  /* --------------------------------
     MULTER: TOO MANY FILES
  -------------------------------- */

  if (
    err instanceof multer.MulterError &&
    err.code === "LIMIT_FILE_COUNT"
  ) {
    return res
      .status(400)
      .json({
        message:
          "Only one image can be uploaded at a time.",
      });
  }

  /* --------------------------------
     MULTER: UNEXPECTED FIELD
  -------------------------------- */

  if (
    err instanceof multer.MulterError &&
    err.code === "LIMIT_UNEXPECTED_FILE"
  ) {
    return res
      .status(400)
      .json({
        message:
          'Unexpected upload field. Use the field name "image".',
      });
  }

  /* --------------------------------
     OTHER MULTER ERRORS
  -------------------------------- */

  if (
    err instanceof multer.MulterError
  ) {
    return res
      .status(400)
      .json({
        message:
          err.message ||
          "Invalid file upload.",
      });
  }

  /* --------------------------------
     MONGOOSE VALIDATION
  -------------------------------- */

  if (
    err?.name ===
    "ValidationError"
  ) {
    const errors =
      Object.values(
        err.errors || {}
      )
        .map(
          (error) =>
            error.message
        )
        .filter(Boolean);

    return res
      .status(400)
      .json({
        message:
          errors.length > 0
            ? errors.join(", ")
            : "Validation failed",
      });
  }

  /* --------------------------------
     INVALID MONGODB ID
  -------------------------------- */

  if (
    err?.name ===
    "CastError"
  ) {
    return res
      .status(400)
      .json({
        message:
          "Invalid resource ID",
      });
  }

  /* --------------------------------
     DUPLICATE MONGODB VALUE
  -------------------------------- */

  if (
    err?.code === 11000
  ) {
    const field =
      Object.keys(
        err.keyPattern ||
        err.keyValue ||
        {}
      )[0];

    let message =
      "A record with this value already exists.";

    if (field) {
      message =
        `${field} already exists.`;
    }

    return res
      .status(409)
      .json({
        message,
      });
  }

  /* --------------------------------
     JSON BODY SYNTAX ERROR
  -------------------------------- */

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res
      .status(400)
      .json({
        message:
          "Invalid JSON request body",
      });
  }

  /* --------------------------------
     REQUEST BODY TOO LARGE
  -------------------------------- */

  if (
    err?.type ===
      "entity.too.large" ||
    err?.status === 413
  ) {
    return res
      .status(413)
      .json({
        message:
          "Request body is too large.",
      });
  }

  /* --------------------------------
     CUSTOM ERRORS
  -------------------------------- */

  const statusCode =
    Number(
      err?.statusCode
    ) ||
    (
      res.statusCode !== 200
        ? res.statusCode
        : 500
    );

  /*
    Do not expose internal implementation
    details in production for 5xx errors.
  */

  const isProduction =
    process.env.NODE_ENV ===
    "production";

  const isServerError =
    statusCode >= 500;

  const response = {
    message:
      isProduction &&
      isServerError
        ? "Internal server error"
        : err?.message ||
          "Something went wrong",
  };

  /*
    Stack trace only during development.
  */

  if (!isProduction) {
    response.stack =
      err?.stack ||
      null;
  }

  return res
    .status(statusCode)
    .json(response);
};