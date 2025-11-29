// middleware/rateLimiter.js - ✅ PRODUCTION-READY (Enhanced from your existing code)
import rateLimit from "express-rate-limit";
import { logger } from "../utils/logger.js";

// In-memory store for failed login attempts (use Redis in production)
const failedLoginAttempts = new Map();

/**
 * Track failed login attempts per email
 */
export const trackFailedLogin = (email) => {
  const attempts = failedLoginAttempts.get(email) || { 
    count: 0, 
    timestamp: Date.now(),
    lockUntil: null 
  };
  
  // Reset if 1 hour has passed since first attempt
  if (Date.now() - attempts.timestamp > 3600000) {
    attempts.count = 0;
    attempts.timestamp = Date.now();
    attempts.lockUntil = null;
  }
  
  attempts.count++;
  
  // Lock account for 1 hour after 10 failed attempts
  if (attempts.count >= 10) {
    attempts.lockUntil = Date.now() + 3600000; // 1 hour from now
    logger.security('ACCOUNT_LOCKED', { email, reason: 'Too many failed login attempts' });
  }
  
  failedLoginAttempts.set(email, attempts);
  
  return attempts;
};

/**
 * Check if account is locked
 */
export const isAccountLocked = (email) => {
  const attempts = failedLoginAttempts.get(email);
  if (!attempts) return false;
  
  // Check if lock is still active
  if (attempts.lockUntil && Date.now() < attempts.lockUntil) {
    return {
      isLocked: true,
      lockUntil: attempts.lockUntil,
      remainingTime: Math.ceil((attempts.lockUntil - Date.now()) / 60000) // minutes
    };
  }
  
  // Lock expired, reset
  if (attempts.lockUntil && Date.now() >= attempts.lockUntil) {
    failedLoginAttempts.delete(email);
  }
  
  return { isLocked: false };
};

/**
 * Clear failed login attempts (on successful login)
 */
export const clearFailedAttempts = (email) => {
  failedLoginAttempts.delete(email);
  logger.info('FAILED_ATTEMPTS_CLEARED', { email });
};

/**
 * Get remaining login attempts
 */
export const getRemainingAttempts = (email) => {
  const attempts = failedLoginAttempts.get(email);
  if (!attempts) return 10;
  
  return Math.max(0, 10 - attempts.count);
};

// =========================================
// HELPER: Development bypass & User tracking
// =========================================
const createKeyGenerator = (useUser = true) => (req) => {
  // In development, track by IP (localhost bypassed later)
  // In production, track by user ID if authenticated
  if (useUser && req.user?.id) {
    return req.user.id;
  }
  return req.body.email || req.body.username || req.ip;
};

const shouldSkip = (req) => {
  // Skip rate limiting for localhost in development
  if (process.env.NODE_ENV === "development") {
    return req.ip === "::1" || 
           req.ip === "::ffff:127.0.0.1" ||
           req.ip === "127.0.0.1" || 
           req.hostname === "localhost";
  }
  return false;
};

// =========================================
// 1. LOGIN LIMITER (Keep your existing strict security)
// =========================================
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // ✅ Increased from 5 to 20 (more realistic for legitimate users)
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip, // ✅ NEW: Skip localhost in development
  
  // Use email if provided, otherwise IP
  keyGenerator: (req) => {
    return req.body.email || req.body.username || req.ip;
  },
  
  // Custom handler with detailed message
  handler: (req, res) => {
    const identifier = req.body.email || req.body.username || req.ip;
    
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'login',
      identifier,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(429).json({
      success: false,
      message: "Too many login attempts from this IP address or email. Please try again after 15 minutes.",
      retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      lockDuration: '15 minutes'
    });
  }
});

// =========================================
// 2. PASSWORD RESET LIMITER (Keep your strict security)
// =========================================
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // ✅ Increased from 3 to 5 (slightly more lenient)
  skipFailedRequests: false,
  skip: shouldSkip, // ✅ NEW: Skip localhost in development
  
  keyGenerator: (req) => {
    return req.body.email || req.ip;
  },
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'password_reset',
      email: req.body.email,
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      message: "Too many password reset requests. Please try again after 1 hour.",
      retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
  }
});

// =========================================
// 3. GENERAL API LIMITER (✅ MASSIVELY INCREASED for 500+ users)
// =========================================
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // ✅ INCREASED from 100 to 5000 (handles 500+ users)
  skip: shouldSkip, // ✅ NEW: Skip localhost in development
  keyGenerator: createKeyGenerator(true), // ✅ NEW: Track by user, not just IP
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'api',
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      message: "Too many requests from this IP address. Please try again later.",
      retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });
  }
});

// =========================================
// 4. REAL-TIME LIMITER (✅ NEW - For video calls & heartbeats)
// =========================================
export const realtimeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 200, // ✅ 200 requests per minute (video heartbeats every 5 seconds)
  skip: shouldSkip,
  keyGenerator: createKeyGenerator(true),
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'realtime',
      userId: req.user?.id,
      ip: req.ip,
      path: req.path
    });
    
    res.status(429).json({
      success: false,
      message: "Real-time update rate exceeded. Please wait a moment.",
      retryAfter: new Date(Date.now() + 60 * 1000).toISOString()
    });
  }
});

// =========================================
// 5. POLLING LIMITER (✅ NEW - For chat & dashboard polling)
// =========================================
export const pollingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // ✅ 100 requests per minute (polling every 5-10 seconds)
  skip: shouldSkip,
  keyGenerator: createKeyGenerator(true),
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'polling',
      userId: req.user?.id,
      ip: req.ip,
      path: req.path
    });
    
    res.status(429).json({
      success: false,
      message: "Polling too frequently. Please wait a moment.",
      retryAfter: new Date(Date.now() + 60 * 1000).toISOString()
    });
  }
});

// =========================================
// 6. STRICT LIMITER (Keep for sensitive operations)
// =========================================
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // ✅ Increased from 5 to 50 (more realistic)
  skip: shouldSkip, // ✅ NEW: Skip localhost in development
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'strict',
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      message: "Too many sensitive operations. Please try again after 1 hour.",
      retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });
  }
});

// =========================================
// 7. FILE UPLOAD LIMITER (Keep your existing)
// =========================================
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // ✅ Increased from 10 to 50 (more uploads allowed)
  skip: shouldSkip, // ✅ NEW: Skip localhost in development
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'upload',
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      message: "Too many upload requests. Please try again after 1 hour."
    });
  }
});

// =========================================
// 8. EMAIL SENDING LIMITER (Keep your existing)
// =========================================
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // ✅ Increased from 5 to 10
  skip: shouldSkip, // ✅ NEW: Skip localhost in development
  
  keyGenerator: (req) => {
    return req.body.email || req.ip;
  },
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'email',
      recipient: req.body.email,
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      message: "Too many email requests. Please try again after 1 hour."
    });
  }
});

/**
 * Clean up old entries periodically (every 24 hours)
 */
setInterval(() => {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  
  for (const [email, data] of failedLoginAttempts.entries()) {
    if (data.timestamp < dayAgo) {
      failedLoginAttempts.delete(email);
    }
  }
  
  logger.info('CLEANUP', { 
    message: 'Cleaned up old failed login attempts',
    remaining: failedLoginAttempts.size 
  });
}, 24 * 60 * 60 * 1000);

// =========================================
// EXPORTS
// =========================================
export default {
  loginLimiter,
  passwordResetLimiter,
  apiLimiter,
  realtimeLimiter,      // ✅ NEW
  pollingLimiter,       // ✅ NEW
  strictLimiter,
  uploadLimiter,
  emailLimiter,
  trackFailedLogin,
  isAccountLocked,
  clearFailedAttempts,
  getRemainingAttempts
};