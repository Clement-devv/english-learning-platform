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

// ── Map framework/library errors to clean HTTP responses ─────────────────────
function classifyError(err) {
  // Mongoose CastError: invalid ObjectId or type mismatch
  if (err.name === "CastError") {
    return { status: 400, message: `Invalid value for field: ${err.path}`, isOperational: true };
  }
  // Mongoose ValidationError: schema-level field validation failed
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map(e => e.message).join("; ");
    return { status: 422, message: messages, isOperational: true };
  }
  // MongoDB duplicate key (e.g. unique index violation)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return { status: 409, message: `Duplicate value for ${field}`, isOperational: true };
  }
  // JSON body parse error (SyntaxError from express.json())
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return { status: 400, message: "Invalid JSON in request body", isOperational: true };
  }
  // Multer errors (file upload validation: wrong type, size limit, etc.)
  if (err.name === "MulterError") {
    const multerMessages = {
      LIMIT_FILE_SIZE:      "File is too large",
      LIMIT_FILE_COUNT:     "Too many files uploaded",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field",
      LIMIT_PART_COUNT:     "Too many form parts",
      LIMIT_FIELD_KEY:      "Field name too long",
      LIMIT_FIELD_VALUE:    "Field value too long",
      LIMIT_FIELD_COUNT:    "Too many fields",
    };
    const msg = multerMessages[err.code] || err.message;
    return { status: 400, message: msg, isOperational: true };
  }
  // fileFilter rejection from multer (plain Error, not MulterError)
  if (err.message?.startsWith("File type not allowed") ||
      err.message?.startsWith("Only ") ||
      err.message?.startsWith("Invalid ")) {
    return { status: 400, message: err.message, isOperational: true };
  }
  // TypeError from calling .trim()/.slice()/.toLowerCase() on a non-string body field.
  // Happens when a client sends the wrong type (e.g. number instead of string).
  if (err instanceof TypeError && err.message?.includes("is not a function")) {
    return { status: 400, message: "Invalid input: one or more fields have the wrong type", isOperational: true };
  }
  // Errors explicitly thrown with statusCode: 400 by route input validators
  if (err.statusCode === 400) {
    return { status: 400, message: err.message, isOperational: true };
  }
  if (err.statusCode === 422) {
    return { status: 422, message: err.message, isOperational: true };
  }
  // RangeError or URIError from malformed user-supplied values
  if (err instanceof RangeError || err instanceof URIError) {
    return { status: 400, message: "Invalid input value", isOperational: true };
  }
  return null;
}

// ── Express error middleware (4-arg signature required) ───────────────────────
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Classify known framework errors first
  const classified = classifyError(err);
  const status  = classified?.status  ?? err.statusCode ?? err.status ?? 500;
  const isOp    = classified?.isOperational ?? err.isOperational ?? false;
  const rawMsg  = classified?.message ?? err.message ?? "An internal server error occurred";

  // Log everything, but only include stack in dev
  const logLine = `🔥 [${req.method}] ${req.originalUrl} → ${status}: ${rawMsg}`;
  if (status >= 500) {
    logger.error(logLine);
    if (isDev && err.stack) logger.error(err.stack);
  } else {
    logger.warn(logLine);
  }

  // Never leak internals in production for unexpected (non-operational) errors
  const responseMessage = isDev || isOp ? rawMsg : "An internal server error occurred";

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
