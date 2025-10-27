// middleware/rateLimiter.js
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

/**
 * Strict login rate limiter with progressive delays
 * Limits: 5 attempts per 15 minutes per IP/email
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  skipSuccessfulRequests: true, // Don't count successful logins
  standardHeaders: true,
  legacyHeaders: false,
  
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

/**
 * Password reset rate limiter
 * Limits: 3 attempts per hour
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  skipFailedRequests: false,
  
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

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', {
      type: 'api',
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

/**
 * Strict limiter for sensitive operations
 * Limits: 5 requests per hour
 * Use for: delete operations, admin actions, etc.
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  
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

/**
 * File upload rate limiter
 * Limits: 10 uploads per hour
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  
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

/**
 * Email sending rate limiter
 * Limits: 5 emails per hour per recipient
 */
export const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  
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

export default {
  loginLimiter,
  passwordResetLimiter,
  apiLimiter,
  strictLimiter,
  uploadLimiter,
  emailLimiter,
  trackFailedLogin,
  isAccountLocked,
  clearFailedAttempts,
  getRemainingAttempts
};