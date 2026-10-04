require("dotenv").config();

const net = require("net");

const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5001;

// --------------------------------------------------
// TEMPORARY SMTP REACHABILITY TEST — remove after confirming
// --------------------------------------------------
const testSmtpReachability = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host) {
    console.log("[smtp-test] SMTP_HOST not set, skipping reachability test");
    return;
  }

  const socket = net.createConnection({ host, port, family: 4 });

  const timer = setTimeout(() => {
    console.error(`[smtp-test] timed out connecting to ${host}:${port}`);
    socket.destroy();
  }, 8000);

  socket.on("connect", () => {
    clearTimeout(timer);
    console.log(`[smtp-test] OK — reached ${host}:${port}`);
    socket.end();
  });

  socket.on("error", (err) => {
    clearTimeout(timer);
    console.error(
      `[smtp-test] FAILED ${host}:${port} →`,
      err.code || err.message
    );
  });
};

const startServer = async () => {
  try {
    // Run the SMTP check first so its log lines appear before DB connect noise
    testSmtpReachability();

    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();