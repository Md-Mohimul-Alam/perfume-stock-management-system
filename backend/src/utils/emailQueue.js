const {
  sendOtpEmail,
  sendPasswordResetEmail,
} = require("./email");

// --------------------------------------------------
// Config
// --------------------------------------------------

const MIN_GAP_MS = 3000;

// Keep retries low for Vercel/serverless requests.
// We do not want login requests hanging for 30-90 seconds.
const MAX_RETRIES = 1;

const RETRY_BACKOFF_MS = [];

// --------------------------------------------------
// State
// --------------------------------------------------

const queue = [];
let isProcessing = false;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const sleep = (ms) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

const isRateLimitError = (err) => {
  const msg =
    String(err?.message || "").toLowerCase();

  const response =
    String(err?.response || "").toLowerCase();

  return (
    msg.includes("421") ||
    msg.includes("451") ||
    msg.includes("550-5.4.5") ||
    msg.includes("rate limit") ||
    msg.includes("quota exceeded") ||
    msg.includes("too many") ||
    response.includes("421") ||
    response.includes("451") ||
    response.includes("550-5.4.5") ||
    response.includes("rate limit") ||
    response.includes("quota exceeded") ||
    response.includes("too many")
  );
};

const isDailyQuotaError = (err) => {
  const msg =
    `${err?.message || ""} ${err?.response || ""}`
      .toLowerCase();

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
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    while (queue.length > 0) {
      const job = queue.shift();

      const {
        type,
        args,
        resolve,
        reject,
      } = job;

      let success = false;
      let lastError = null;

      for (
        let attempt = 0;
        attempt < MAX_RETRIES;
        attempt += 1
      ) {
        try {
          if (type === "otp") {
            await sendOtpEmail(...args);
          } else if (type === "reset") {
            await sendPasswordResetEmail(
              ...args
            );
          } else {
            throw new Error(
              `Unknown email job type: ${type}`
            );
          }

          success = true;
          break;
        } catch (err) {
          lastError = err;

          console.error(
            "[emailQueue] send failed:",
            {
              recipient: args[0],
              type,
              attempt:
                attempt + 1,
              maxRetries:
                MAX_RETRIES,

              message:
                err?.message,
              code:
                err?.code,
              command:
                err?.command,
              response:
                err?.response,
              responseCode:
                err?.responseCode,
              errno:
                err?.errno,
              syscall:
                err?.syscall,
              address:
                err?.address,
              port:
                err?.port,
            }
          );

          // Gmail daily sending quota.
          if (
            isDailyQuotaError(err)
          ) {
            console.error(
              "[emailQueue] Gmail daily quota appears to have been reached."
            );

            break;
          }

          // Only retry errors that look temporary.
          if (
            !isRateLimitError(err)
          ) {
            break;
          }

          if (
            attempt <
            MAX_RETRIES - 1
          ) {
            const wait =
              RETRY_BACKOFF_MS[
                attempt
              ] || 3000;

            console.log(
              `[emailQueue] waiting ${
                wait / 1000
              }s before retry...`
            );

            await sleep(wait);
          }
        }
      }

      if (success) {
        resolve();
      } else {
        reject(
          lastError ||
            new Error(
              "Email send failed"
            )
        );
      }

      if (
        queue.length > 0 &&
        MIN_GAP_MS > 0
      ) {
        await sleep(
          MIN_GAP_MS
        );
      }
    }
  } finally {
    isProcessing = false;

    // A job could theoretically have been pushed
    // between the last queue check and cleanup.
    if (queue.length > 0) {
      processQueue().catch(
        (error) => {
          console.error(
            "[emailQueue] worker restart error:",
            error
          );
        }
      );
    }
  }
};

// --------------------------------------------------
// Public API
// --------------------------------------------------

exports.queueOtpEmail = (
  to,
  otp
) => {
  return new Promise(
    (resolve, reject) => {
      queue.push({
        type: "otp",
        args: [
          to,
          otp,
        ],
        resolve,
        reject,
      });

      processQueue().catch(
        (error) => {
          console.error(
            "[emailQueue] worker error:",
            error
          );
        }
      );
    }
  );
};

exports.queuePasswordResetEmail = (
  to,
  resetUrl
) => {
  return new Promise(
    (resolve, reject) => {
      queue.push({
        type: "reset",
        args: [
          to,
          resetUrl,
        ],
        resolve,
        reject,
      });

      processQueue().catch(
        (error) => {
          console.error(
            "[emailQueue] worker error:",
            error
          );
        }
      );
    }
  );
};

exports.getQueueSize =
  () => queue.length;

exports.isQueueBusy =
  () => isProcessing;