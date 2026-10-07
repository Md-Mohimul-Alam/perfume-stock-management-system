const multer = require("multer");

/* ========================================
   CONFIG
======================================== */

const MAX_FILE_SIZE =
  5 * 1024 * 1024; // 5 MB

/*
  Do not allow SVG here.

  SVG can contain scripts / active content,
  so for product images we keep the list
  limited to normal raster image formats.
*/

const ALLOWED_MIME_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);

/* ========================================
   MEMORY STORAGE
======================================== */

/*
  IMPORTANT:

  We no longer save uploaded files to:

  backend/src/uploads

  Multer keeps the image in memory as:

  req.file.buffer

  The controller sends that buffer directly
  to ImgBB.

  This works much better on:
  - Vercel
  - Render
  - serverless environments
*/

const storage =
  multer.memoryStorage();

/* ========================================
   FILE FILTER
======================================== */

const fileFilter = (
  req,
  file,
  callback
) => {
  if (
    !ALLOWED_MIME_TYPES.has(
      file.mimetype
    )
  ) {
    const error =
      new Error(
        "Only JPEG, PNG, WEBP, and GIF images are allowed"
      );

    error.statusCode = 400;

    return callback(
      error,
      false
    );
  }

  return callback(
    null,
    true
  );
};

/* ========================================
   MULTER
======================================== */

const upload =
  multer({
    storage,

    fileFilter,

    limits: {
      fileSize:
        MAX_FILE_SIZE,

      /*
        Upload endpoint accepts only
        one image per request.
      */

      files: 1,
    },
  });

module.exports = upload;