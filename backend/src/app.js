const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const {
  notFound,
  errorHandler,
} = require("./middlewares/errorMiddleware");

const app = express();

// ------------------- CORS -------------------

const allowedOrigins = [
  "http://localhost:5173",
  "https://perfume-stock-management-system-545.vercel.app",
  "https://luxeperfume.netlify.app",
];

if (process.env.FRONTEND_URL) {
  const frontendUrl =
    process.env.FRONTEND_URL.replace(/\/$/, "");

  if (!allowedOrigins.includes(frontendUrl)) {
    allowedOrigins.push(frontendUrl);
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman, curl, server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error(
        `CORS blocked for origin: ${origin}`
      );

      return callback(
        new Error(
          `Not allowed by CORS: ${origin}`
        )
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ------------------- Parsers -------------------

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ------------------- Uploads -------------------

const uploadDir = path.join(
  __dirname,
  "uploads"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });

  console.log(
    "Uploads directory created"
  );
}

app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader(
      "Access-Control-Allow-Origin",
      "*"
    );

    res.setHeader(
      "Cross-Origin-Resource-Policy",
      "cross-origin"
    );

    res.setHeader(
      "Cross-Origin-Embedder-Policy",
      "unsafe-none"
    );

    next();
  },
  express.static(uploadDir)
);

// ------------------- Health -------------------

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Luxe Perfume API is running",
  });
});

app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ------------------- Routes -------------------

app.use(
  "/api/auth",
  require("./routes/authRoutes")
);

app.use(
  "/api/inventory",
  require("./routes/inventoryRoutes")
);

app.use(
  "/api/purchases",
  require("./routes/purchaseRoutes")
);

app.use(
  "/api/products",
  require("./routes/productRoutes")
);

app.use(
  "/api/production",
  require("./routes/productionRoutes")
);

app.use(
  "/api/sales",
  require("./routes/saleRoutes")
);

app.use(
  "/api/expenses",
  require("./routes/expenseRoutes")
);

app.use(
  "/api/investors",
  require("./routes/investorRoutes")
);

app.use(
  "/api/reports",
  require("./routes/reportRoutes")
);

app.use(
  "/api/upload",
  require("./routes/uploadRoutes")
);

app.use(
  "/api/orders",
  require("./routes/orderRoutes")
);

app.use(
  "/api/admin",
  require("./routes/adminRoutes")
);

// TEMPORARY — remove before going to production
app.get("/api/debug", (req, res) => {
  const mongoose = require("mongoose");
  res.json({
    hasUri: Boolean(process.env.MONGO_URI),
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || null,
  });
});

// TEMPORARY — remove before going to production
app.get("/api/debug/otp/:key", async (req, res) => {
  try {
    const Otp = require("./models/Otp");
    const record = await Otp.findOne({ email: req.params.key });
    if (!record) {
      return res.status(404).json({ message: "No OTP found" });
    }
    res.json({
      otp: record.otp,
      expiresAt: record.expiresAt,
      expired: new Date(record.expiresAt) < new Date(),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ------------------- Error Handling -------------------

app.use(notFound);

app.use(errorHandler);

module.exports = app;