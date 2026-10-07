const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const {
  rateLimit,
} = require("express-rate-limit");

const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

const connectDB = require("./config/db");

const {
  notFound,
  errorHandler,
} = require("./middlewares/errorMiddleware");

const app = express();

/* ========================================
   PROXY
======================================== */

/*
  Required for deployments behind
  Vercel / reverse proxy.

  This also allows rate-limit to identify
  the real client IP correctly.
*/

app.set("trust proxy", 1);

/* ========================================
   SECURITY HEADERS
======================================== */

app.use(
  helmet({
    /*
      Images may be loaded by your
      frontend from another origin.
    */
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },

    crossOriginEmbedderPolicy:
      false,
  })
);

/* ========================================
   CORS
======================================== */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",

  "https://perfume-stock-management-system-545.vercel.app",
  "https://perfume-stock-management-system-ewa.vercel.app",
  "https://luxeperfume.netlify.app",
];

/*
  FRONTEND_URL may contain one URL.

  Example:

  FRONTEND_URL=https://luxeperfume.netlify.app
*/

if (
  process.env.FRONTEND_URL
) {
  const frontendUrl =
    process.env.FRONTEND_URL
      .trim()
      .replace(
        /\/$/,
        ""
      );

  if (
    frontendUrl &&
    !allowedOrigins.includes(
      frontendUrl
    )
  ) {
    allowedOrigins.push(
      frontendUrl
    );
  }
}

/*
  Optional additional frontend origins.

  Example:

  EXTRA_ALLOWED_ORIGINS=https://site1.com,https://site2.com
*/

if (
  process.env
    .EXTRA_ALLOWED_ORIGINS
) {
  const additionalOrigins =
    process.env
      .EXTRA_ALLOWED_ORIGINS
      .split(",")
      .map((origin) =>
        origin
          .trim()
          .replace(
            /\/$/,
            ""
          )
      )
      .filter(Boolean);

  for (
    const origin of
    additionalOrigins
  ) {
    if (
      !allowedOrigins.includes(
        origin
      )
    ) {
      allowedOrigins.push(
        origin
      );
    }
  }
}

const corsOptions = {
  origin: (
    origin,
    callback
  ) => {
    /*
      Requests without Origin:
      - Postman
      - curl
      - server-to-server
      - same-origin
    */

    if (!origin) {
      return callback(
        null,
        true
      );
    }

    const normalizedOrigin =
      origin.replace(
        /\/$/,
        ""
      );

    if (
      allowedOrigins.includes(
        normalizedOrigin
      )
    ) {
      return callback(
        null,
        true
      );
    }

    console.warn(
      `CORS blocked: ${normalizedOrigin}`
    );

    return callback(
      null,
      false
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

  maxAge: 86400,
};

app.use(
  cors(corsOptions)
);

/* ========================================
   BODY PARSERS
======================================== */

/*
  Prevent extremely large JSON requests.

  5 MB is enough for your bulk-import
  JSON payloads while still providing
  basic protection.
*/

app.use(
  express.json({
    limit: "5mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "5mb",
  })
);

/* ========================================
   RATE LIMITERS
======================================== */

/*
  General API limit.

  500 requests / 15 min / IP.
*/

const apiLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 500,

    standardHeaders:
      "draft-7",

    legacyHeaders:
      false,

    message: {
      message:
        "Too many requests. Please try again later.",
    },
  });

/*
  Login / OTP / password security.

  Do NOT make this too low because users
  may legitimately need to resend OTP.
*/

const authLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 15,

    standardHeaders:
      "draft-7",

    legacyHeaders:
      false,

    message: {
      message:
        "Too many authentication attempts. Please try again later.",
    },
  });

/*
  Resend OTP separately.

  Helps protect SMTP quota.
*/

const otpResendLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 6,

    standardHeaders:
      "draft-7",

    legacyHeaders:
      false,

    message: {
      message:
        "Too many OTP requests. Please wait before requesting another code.",
    },
  });

/*
  Public orders.

  This protects the public endpoint
  from basic order-spam.
*/

const publicOrderLimiter =
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 30,

    standardHeaders:
      "draft-7",

    legacyHeaders:
      false,

    message: {
      message:
        "Too many order attempts. Please try again later.",
    },
  });

/*
  Contact form.

  Keep lower because each request may
  trigger an email.
*/

const contactLimiter =
  rateLimit({
    windowMs:
      60 * 60 * 1000,

    limit: 10,

    standardHeaders:
      "draft-7",

    legacyHeaders:
      false,

    message: {
      message:
        "Too many messages sent. Please try again later.",
    },
  });

/* ========================================
   HEALTH / LIVENESS

   Keep before DB middleware so the
   deployment can still report that the
   Node server itself is alive even if
   MongoDB is temporarily unavailable.
======================================== */

app.get(
  "/",
  (req, res) => {
    res.status(200).json({
      success: true,

      message:
        "Luxe Perfume API is running",
    });
  }
);

app.get(
  "/health",
  (req, res) => {
    const readyState =
      mongoose.connection
        .readyState;

    const dbStates = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    res.status(200).json({
      success: true,

      status: "ok",

      database:
        dbStates[
          readyState
        ] ||
        "unknown",

      timestamp:
        new Date().toISOString(),
    });
  }
);

/* ========================================
   GENERAL API RATE LIMIT
======================================== */

app.use(
  "/api",
  apiLimiter
);

/* ========================================
   STRICT PUBLIC/AUTH RATE LIMITS
======================================== */

app.use(
  "/api/auth/login",
  authLimiter
);

app.use(
  "/api/auth/verify-otp",
  authLimiter
);

app.use(
  "/api/auth/verify-registration",
  authLimiter
);

app.use(
  "/api/auth/forgot-password",
  authLimiter
);

app.use(
  "/api/auth/reset-password",
  authLimiter
);

app.use(
  "/api/auth/resend-otp",
  otpResendLimiter
);

app.use(
  "/api/contact",
  contactLimiter
);

/*
  Only POST /api/orders is public.

  This limiter runs for all order requests,
  but authenticated requests are already
  protected separately at route level.

  30/15min is high enough for normal admin
  use and prevents simple public spam.
*/

app.use(
  "/api/orders",
  publicOrderLimiter
);

/* ========================================
   DATABASE CONNECTION
======================================== */

app.use(
  async (
    req,
    res,
    next
  ) => {
    try {
      /*
        Already connected.
      */

      if (
        mongoose.connection
          .readyState ===
        1
      ) {
        return next();
      }

      /*
        A connection is already being
        established.

        connectDB() should manage the
        connection lifecycle.
      */

      await connectDB();

      return next();
    } catch (error) {
      console.error(
        "Database connection failed:",
        error.message
      );

      return res
        .status(503)
        .json({
          message:
            "Database temporarily unavailable",
        });
    }
  }
);

/* ========================================
   LOCAL FILE UPLOADS

   NOTE:
   This remains for compatibility with
   your existing upload system.

   Vercel storage is NOT persistent.

   We will replace this in the upload
   update with Cloudinary/S3/etc.
======================================== */

const uploadDir =
  path.join(
    __dirname,
    "uploads"
  );

try {
  if (
    !fs.existsSync(
      uploadDir
    )
  ) {
    fs.mkdirSync(
      uploadDir,
      {
        recursive: true,
      }
    );
  }
} catch (error) {
  /*
    Expected possibility on read-only
    serverless filesystem.
  */

  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    console.warn(
      "Could not create uploads directory:",
      error.message
    );
  }
}

app.use(
  "/uploads",

  (
    req,
    res,
    next
  ) => {
    /*
      Required when frontend and backend
      are hosted on different domains.
    */

    res.setHeader(
      "Cross-Origin-Resource-Policy",
      "cross-origin"
    );

    next();
  },

  express.static(
    uploadDir,
    {
      fallthrough: true,

      maxAge:
        process.env.NODE_ENV ===
        "production"
          ? "1d"
          : 0,
    }
  )
);

/* ========================================
   ROUTES
======================================== */

app.use(
  "/api/auth",
  require(
    "./routes/authRoutes"
  )
);

app.use(
  "/api/inventory",
  require(
    "./routes/inventoryRoutes"
  )
);

app.use(
  "/api/purchases",
  require(
    "./routes/purchaseRoutes"
  )
);

app.use(
  "/api/products",
  require(
    "./routes/productRoutes"
  )
);

app.use(
  "/api/production",
  require(
    "./routes/productionRoutes"
  )
);

app.use(
  "/api/sales",
  require(
    "./routes/saleRoutes"
  )
);

app.use(
  "/api/expenses",
  require(
    "./routes/expenseRoutes"
  )
);

app.use(
  "/api/investors",
  require(
    "./routes/investorRoutes"
  )
);

app.use(
  "/api/reports",
  require(
    "./routes/reportRoutes"
  )
);

app.use(
  "/api/upload",
  require(
    "./routes/uploadRoutes"
  )
);

app.use(
  "/api/orders",
  require(
    "./routes/orderRoutes"
  )
);

app.use(
  "/api/admin",
  require(
    "./routes/adminRoutes"
  )
);

app.use(
  "/api/contact",
  require(
    "./routes/contactRoutes"
  )
);

/* ========================================
   ERROR HANDLING
======================================== */

app.use(
  notFound
);

app.use(
  errorHandler
);

module.exports = app;