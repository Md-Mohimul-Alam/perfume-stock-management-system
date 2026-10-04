// api/index.js
require("dotenv").config();

const app = require("../src/app");
const connectDB = require("../src/config/db");

// Critical: await DB connection before every request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("DB connect failed:", err.message);
    return res.status(503).json({ message: "Database unavailable" });
  }
});

module.exports = app;