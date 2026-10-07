const express = require("express");

const router =
  express.Router();

const upload =
  require(
    "../middlewares/upload"
  );

const {
  uploadImage,
} = require(
  "../controllers/uploadController"
);

const {
  protect,
  authorizeRoles,
} = require(
  "../middlewares/authMiddleware"
);

router.post(
  "/",

  protect,

  authorizeRoles(
    "admin",
    "staff"
  ),

  upload.single(
    "image"
  ),

  uploadImage
);

module.exports =
  router;