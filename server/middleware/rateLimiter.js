// middleware/rateLimiter.js
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { logger } from "../utils/logger.js";
import LoginAttempt from "../models/LoginAttempt.js";
import redisClient from "../config/redis.js";

// Build a RedisStore for the given prefix when Redis is available,
// otherwise return undefined so express-rate-limit uses its memory store.
const makeStore = (prefix) => {
  if (!redisClient) return undefined;
  return new RedisStore({
    // ioredis exposes a generic .call() method that rate-limit-redis uses
    // to send arbitrary Redis commands (INCR, EXPIRE, etc.)
    sendCommand: (...args) => redisClient.call(...args),
    prefix: `rl:${prefix}:`,
  });
};

// Spread helper — only adds { store } when Redis is available so we don't
// override the default memory store with an explicit undefined.
const withStore = (prefix) => {
  const store = makeStore(prefix);
  return store ? { store } : {};
};

const MAX_ATTEMPTS  = 10;
const LOCK_DURATION = 60 * 60 * 1000; // 1 hour in ms

/**
 * Track failed login attempts per identifier (email/username).
 * Persisted in MongoDB so server restarts don't reset locks.
 */
export const trackFailedLogin = async (identifier) => {
  const now = new Date();
  const record = await LoginAttempt.findOneAndUpdate(
    { identifier },
    {
      $inc: { count: 1 },
      $setOnInsert: { firstAttemptAt: now },
    },
    { upsert: true, new: true }
  );

  if (record.count >= MAX_ATTEMPTS && !record.lockUntil) {
    record.lockUntil = new Date(Date.now() + LOCK_DURATION);
    await record.save();
    logger.security("ACCOUNT_LOCKED", { identifier, reason: "Too many failed login attempts" });
  }

  return record;
};

/**
 * Check if account is locked.
 */
export const isAccountLocked = async (identifier) => {
  const record = await LoginAttempt.findOne({ identifier });
  if (!record || !record.lockUntil) return { isLocked: false };

  if (Date.now() < record.lockUntil.getTime()) {
    return {
      isLocked: true,
      lockUntil: record.lockUntil,
      remainingTime: Math.ceil((record.lockUntil.getTime() - Date.now()) / 60000),
    };
  }

  // Lock expired — clean up
  await LoginAttempt.deleteOne({ identifier });
  return { isLocked: false };
};

/**
 * Clear failed login attempts on successful login.
 */
export const clearFailedAttempts = async (identifier) => {
  await LoginAttempt.deleteOne({ identifier });
  logger.info("FAILED_ATTEMPTS_CLEARED", { identifier });
};

/**
 * Get remaining attempts before lockout.
 */
export const getRemainingAttempts = async (identifier) => {
  const record = await LoginAttempt.findOne({ identifier });
  if (!record) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - record.count);
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
  return req.body?.email || req.body?.username || req.ip;
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
  ...withStore("login"),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },

  // Use email if provided, otherwise IP
  keyGenerator: (req) => {
    return req.body?.email || req.body?.username || req.ip;
  },

  // Custom handler with detailed message
  handler: (req, res) => {
    const identifier = req.body?.email || req.body?.username || req.ip;
    
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
  ...withStore("pwd-reset"),
  windowMs: 60 * 60 * 1000,
  max: 5,
  skipFailedRequests: false,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },

  keyGenerator: (req) => {
    return req.body?.email || req.ip;
  },

  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'password_reset',
      email: req.body?.email,
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
  ...withStore("api"),
  windowMs: 15 * 60 * 1000,
  max: 5000,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: createKeyGenerator(true),
  
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
  ...withStore("realtime"),
  windowMs: 1 * 60 * 1000,
  max: 200,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },
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
  ...withStore("polling"),
  windowMs: 1 * 60 * 1000,
  max: 100,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },
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
  ...withStore("strict"),
  windowMs: 60 * 60 * 1000,
  max: 50,
  skip: shouldSkip,
  
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
  ...withStore("upload"),
  windowMs: 60 * 60 * 1000,
  max: 50,
  skip: shouldSkip,
  
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
  ...withStore("email"),
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },

  keyGenerator: (req) => {
    return req.body?.email || req.ip;
  },

  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'email',
      recipient: req.body?.email,
      ip: req.ip
    });
    
    res.status(429).json({
      success: false,
      message: "Too many email requests. Please try again after 1 hour."
    });
  }
});

// No manual cleanup needed — MongoDB TTL index on LoginAttempt.firstAttemptAt
// automatically removes records after 2 hours (see models/LoginAttempt.js).

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