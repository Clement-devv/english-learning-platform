import { isValidObjectId } from "mongoose";

/**
 * Validates one or more URL params are valid MongoDB ObjectIds.
 * Returns 400 immediately if any param fails — prevents Mongoose CastError 500s.
 *
 * Usage: router.get("/:id", validateObjectId("id"), handler)
 *        router.get("/:bookingId/:studentId", validateObjectId("bookingId", "studentId"), handler)
 */
export const validateObjectId = (...paramNames) => (req, res, next) => {
  for (const param of paramNames) {
    if (!isValidObjectId(req.params[param])) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${param}: must be a valid ID`,
      });
    }
  }
  next();
};

/**
 * Wraps a multer upload middleware with an explicit error handler so that
 * file-type rejections, size-limit errors, and unexpected-field errors always
 * return a clean 400 JSON response instead of hitting the global error handler.
 *
 * Usage:
 *   import { wrapUpload } from '../middleware/validateObjectId.js';
 *   router.post('/upload', wrapUpload(upload.single('pdf')), async (req, res) => { ... });
 *
 * @param {Function} uploadMiddleware - multer upload instance (single, array, fields)
 * @returns {Function} Express middleware
 */
export const wrapUpload = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();

    // Multer-specific errors
    if (err.name === "MulterError") {
      const messages = {
        LIMIT_FILE_SIZE:       "File is too large",
        LIMIT_FILE_COUNT:      "Too many files uploaded at once",
        LIMIT_UNEXPECTED_FILE: `Unexpected field: ${err.field || "unknown"}`,
        LIMIT_PART_COUNT:      "Too many form parts",
        LIMIT_FIELD_VALUE:     "A field value is too large",
      };
      return res.status(400).json({
        success: false,
        message: messages[err.code] || err.message,
      });
    }

    // fileFilter rejections (plain Error thrown inside fileFilter callback)
    if (err instanceof Error) {
      return res.status(400).json({ success: false, message: err.message });
    }

    next(err);
  });
};
