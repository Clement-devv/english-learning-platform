// server/middleware/errorHandler.js
// Central Express error handler — must be registered AFTER all routes.
// Also exports process-level handlers for uncaught exceptions/rejections.

import logger from "../utils/logger.js";

const isDev = process.env.NODE_ENV === "development";

// ── Custom error class routes can throw ──────────────────────────────────────
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes known errors from bugs
  }
}

// ── Express error middleware (4-arg signature required) ───────────────────────
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status  = err.statusCode || err.status || 500;
  const message = err.message || "An internal server error occurred";

  // Log everything, but only include stack in dev
  const logLine = `🔥 [${req.method}] ${req.originalUrl} → ${status}: ${message}`;
  if (status >= 500) {
    logger.error(logLine);
    if (isDev && err.stack) logger.error(err.stack);
  } else {
    logger.warn(logLine);
  }

  // Never leak internals in production for unexpected errors
  const responseMessage =
    isDev || err.isOperational ? message : "An internal server error occurred";

  res.status(status).json({ success: false, message: responseMessage });
}

// ── 404 catch-all — register BEFORE errorHandler, AFTER all routes ────────────
export function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// ── Process-level safety nets ─────────────────────────────────────────────────
// uncaughtException: fatal — emit SIGTERM so the graceful shutdown handler runs.
// unhandledRejection: non-fatal — log only; the request hits the error handler.
export function registerProcessHandlers() {
  process.on("uncaughtException", (err) => {
    logger.error("💥 Uncaught Exception:", { error: err?.message });
    if (isDev) logger.error(err.stack);
    // Delegate to the graceful shutdown path via SIGTERM
    process.kill(process.pid, "SIGTERM");
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error("💥 Unhandled Promise Rejection:", message);
    if (isDev && reason instanceof Error) logger.error(reason.stack);
  });
}
