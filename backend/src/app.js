const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const connectDB = require("./config/db");

const {
  notFound,
  errorHandler,
} = require("./middlewares/errorMiddleware");

const app = express();

// ------------------- CORS -------------------

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  "https://perfume-stock-management-system-545.vercel.app",
  "https://perfume-stock-management-system-ewa.vercel.app",
  "https://luxeperfume.netlify.app",
];

if (process.env.FRONTEND_URL) {
  const frontendUrl = process.env.FRONTEND_URL.trim().replace(/\/$/, "");
  if (frontendUrl && !allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);

      console.error(`CORS blocked for origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ❌ REMOVED: app.options("*", cors()); — crashes on Express 5

// ------------------- Parsers -------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------- DB Connection Middleware -------------------

app.use(async (req, res, next) => {
  try {
    if (mongoose.connection.readyState === 1) return next();

    console.log(">>> DB middleware: connecting...");
    await connectDB();
    console.log(">>> DB middleware: connected");
    next();
  } catch (err) {
    console.error(">>> DB middleware failed:", err.message);
    return res.status(503).json({ message: "Database unavailable" });
  }
});

// ------------------- Uploads -------------------
// ⚠️ Vercel's filesystem is read-only except for /tmp.
// Wrap mkdir in try/catch so a read-only FS doesn't crash the whole app.

const uploadDir = path.join(__dirname, "uploads");

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("Uploads directory created");
  }
} catch (err) {
  console.warn("Uploads directory unavailable (read-only FS?):", err.message);
}

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
    next();
  },
  express.static(uploadDir)
);

// ------------------- Health -------------------

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Luxe Perfume API is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ------------------- Debug (TEMPORARY) -------------------

app.get("/api/debug", (req, res) => {
  res.json({
    hasUri: Boolean(process.env.MONGO_URI),
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
    smtpHost: process.env.SMTP_HOST || null,
    smtpPort: process.env.SMTP_PORT || null,
    contactReceiver: process.env.CONTACT_RECEIVER_EMAIL || null,
  });
});

// ------------------- Routes -------------------

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/purchases", require("./routes/purchaseRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/production", require("./routes/productionRoutes"));
app.use("/api/sales", require("./routes/saleRoutes"));
app.use("/api/expenses", require("./routes/expenseRoutes"));
app.use("/api/investors", require("./routes/investorRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));

// ------------------- Error Handling -------------------

app.use(notFound);
app.use(errorHandler);

module.exports = app;