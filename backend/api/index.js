require("dotenv").config();

console.log(">>> api/index.js LOADED");

const app = require("../src/app");
const connectDB = require("../src/config/db");

app.use(async (req, res, next) => {
  console.log(">>> middleware running, MONGO_URI present:", !!process.env.MONGO_URI);
  try {
    await connectDB();
    console.log(">>> connectDB resolved");
    next();
  } catch (err) {
    console.error(">>> DB connect failed:", err.message);
    return res.status(503).json({ message: "Database unavailable" });
  }
});

module.exports = app;