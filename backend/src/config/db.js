// api/index.js
require("dotenv").config();

const app = require("../src/app");
const connectDB = require("../src/config/db");

module.exports = async (req, res) => {
  // Let Express handle CORS preflight without waiting for MongoDB.
  if (req.method === "OPTIONS") {
    return app(req, res);
  }

  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("DB connect failed:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database unavailable",
    });
  }
};