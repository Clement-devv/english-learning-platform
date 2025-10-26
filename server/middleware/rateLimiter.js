import rateLimit from "express-rate-limit";

// Limit login attempts: 5 attempts per 15 minutes
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many login attempts. Please try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  // Store based on email if provided, otherwise IP
  keyGenerator: (req) => {
    return req.body.email || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many login attempts. Please try again after 15 minutes.",
      retryAfter: req.rateLimit.resetTime
    });
  }
});

// Limit password reset requests: 3 per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: "Too many password reset requests. Please try again after 1 hour.",
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many password reset requests. Please try again later."
    });
  }
});

// General API rate limit: 100 requests per minute
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests
  message: "Too many requests from this IP, please try again later."
});

// Strict limiter for sensitive operations: 10 per hour
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: "Too many requests. Please try again later."
});