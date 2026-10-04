require("dotenv").config();
const app = require("../src/app");
const connectDB = require("../src/config/db");

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    return res.status(503).json({ message: "Database unavailable" });
  }
});

module.exports = app;