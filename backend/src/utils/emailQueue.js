const { sendOtpEmail, sendPasswordResetEmail } = require("./email");

// --------------------------------------------------
// Config
// --------------------------------------------------
const MIN_GAP_MS = 12_000; // 12 seconds → ~5 emails/minute (Gmail safe rate)
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [30_000, 60_000, 90_000]; // 30s, 60s, 90s

// --------------------------------------------------
// State
// --------------------------------------------------
const queue = [];
let isProcessing = false;

// --------------------------------------------------
// Helpers
// --------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const isRateLimitError = (err) => {
  const msg = String(err?.message || "");
  return (
    msg.includes("421") ||
    msg.includes("451") ||
    msg.includes("550-5.4.5") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("quota exceeded") ||
    msg.toLowerCase().includes("too many")
  );
};

const isDailyQuotaError = (err) => {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("daily") ||
    msg.includes("quota") ||
    msg.includes("5.4.5")
  );
};

// --------------------------------------------------
// Worker
// --------------------------------------------------
const processQueue = async () => {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    const { type, args, resolve, reject } = job;

    let success = false;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (type === "otp") {
          await sendOtpEmail(...args);
        } else if (type === "reset") {
          await sendPasswordResetEmail(...args);
        } else {
          throw new Error(`Unknown email job type: ${type}`);
        }

        success = true;
        break;
      } catch (err) {
        lastError = err;
        console.error(
          `[emailQueue] attempt ${attempt + 1}/${MAX_RETRIES} failed for ${args[0]}:`,
          err.message
        );

        // Daily quota = permanent failure for today — no point retrying
        if (isDailyQuotaError(err)) {
          console.error(
            "[emailQueue] Daily Gmail quota hit. Skipping retries."
          );
          break;
        }

        // Only retry on rate-limit errors
        if (!isRateLimitError(err)) {
          break;
        }

        if (attempt < MAX_RETRIES - 1) {
          const wait = RETRY_BACKOFF_MS[attempt] || 90_000;
          console.log(`[emailQueue] waiting ${wait / 1000}s before retry...`);
          await sleep(wait);
        }
      }
    }

    if (success) {
      resolve();
    } else {
      reject(lastError || new Error("Email send failed"));
    }

    // Enforce gap between sends — even after a success
    if (queue.length > 0) {
      await sleep(MIN_GAP_MS);
    }
  }

  isProcessing = false;
};

// --------------------------------------------------
// Public API — mirrors the old email helpers,
// but queues instead of sending immediately.
// --------------------------------------------------
exports.queueOtpEmail = (to, otp) => {
  return new Promise((resolve, reject) => {
    queue.push({ type: "otp", args: [to, otp], resolve, reject });
    processQueue();
  });
};

exports.queuePasswordResetEmail = (to, resetUrl) => {
  return new Promise((resolve, reject) => {
    queue.push({
      type: "reset",
      args: [to, resetUrl],
      resolve,
      reject,
    });
    processQueue();
  });
};

// Optional: expose queue size for monitoring
exports.getQueueSize = () => queue.length;
exports.isQueueBusy = () => isProcessing;