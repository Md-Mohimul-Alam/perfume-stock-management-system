require("dotenv").config();

const app = require("../src/app");
const connectDB = require("../src/config/db");

// Await DB connection before every request.
// Because connectDB uses a cached promise, this is a no-op after
// the first successful connect on a warm function instance.
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