const axios = require("axios");
const FormData = require("form-data");

/* ========================================
   CONSTANTS
======================================== */

const IMGBB_UPLOAD_URL =
  "https://api.imgbb.com/1/upload";

const UPLOAD_TIMEOUT =
  30000;

/* ========================================
   HELPERS
======================================== */

const sanitizeFilename = (
  filename
) => {
  return String(
    filename || "image"
  )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .slice(
      0,
      120
    );
};

const getImgBbErrorMessage = (
  error
) => {
  return (
    error?.response?.data
      ?.error?.message ||
    error?.response?.data
      ?.error ||
    error?.message ||
    "Image upload failed"
  );
};

/* ========================================
   UPLOAD IMAGE
======================================== */

exports.uploadImage =
  async (req, res) => {
    try {
      /* --------------------------------
         API KEY
      -------------------------------- */

      const apiKey =
        process.env
          .IMGBB_API_KEY;

      if (!apiKey) {
        console.error(
          "IMGBB_API_KEY is not configured"
        );

        return res
          .status(503)
          .json({
            message:
              "Image upload service is not configured",
          });
      }

      /* --------------------------------
         FILE VALIDATION
      -------------------------------- */

      if (!req.file) {
        return res
          .status(400)
          .json({
            message:
              "No image file uploaded",
          });
      }

      if (
        !req.file.buffer ||
        req.file.buffer.length ===
          0
      ) {
        return res
          .status(400)
          .json({
            message:
              "Uploaded image is empty",
          });
      }

      /* --------------------------------
         BUILD FORM DATA
      -------------------------------- */

      const formData =
        new FormData();

      /*
        Send the in-memory Buffer directly.

        No local file is created.
      */

      formData.append(
        "image",
        req.file.buffer,
        {
          filename:
            sanitizeFilename(
              req.file.originalname
            ),

          contentType:
            req.file.mimetype,

          knownLength:
            req.file.size,
        }
      );

      /* --------------------------------
         SEND TO IMGBB
      -------------------------------- */

      const response =
        await axios.post(
          IMGBB_UPLOAD_URL,

          formData,

          {
            params: {
              key:
                apiKey,
            },

            headers: {
              ...formData.getHeaders(),
            },

            timeout:
              UPLOAD_TIMEOUT,

            maxBodyLength:
              Infinity,

            maxContentLength:
              Infinity,
          }
        );

      /* --------------------------------
         VALIDATE RESPONSE
      -------------------------------- */

      const data =
        response?.data?.data;

      const imageUrl =
        data?.url;

      if (!imageUrl) {
        console.error(
          "ImgBB response did not contain image URL"
        );

        return res
          .status(502)
          .json({
            message:
              "Image hosting service returned an invalid response",
          });
      }

      /* --------------------------------
         RESPONSE
      -------------------------------- */

      return res
        .status(200)
        .json({
          success: true,

          url:
            imageUrl,

          /*
            Useful if you later want
            thumbnails or delete support.
          */

          displayUrl:
            data.display_url ||
            imageUrl,

          thumbnail:
            data.thumb?.url ||
            null,

          deleteUrl:
            data.delete_url ||
            null,
        });
    } catch (error) {
      const message =
        getImgBbErrorMessage(
          error
        );

      console.error(
        "Image upload error:",
        message
      );

      /*
        Axios timeout
      */

      if (
        error?.code ===
        "ECONNABORTED"
      ) {
        return res
          .status(504)
          .json({
            message:
              "Image upload timed out. Please try again.",
          });
      }

      /*
        ImgBB rejected request
      */

      if (
        error?.response
          ?.status
      ) {
        return res
          .status(502)
          .json({
            message:
              "Image hosting service rejected the upload",
          });
      }

      return res
        .status(
          error?.statusCode ||
          500
        )
        .json({
          message,
        });
    }
  };