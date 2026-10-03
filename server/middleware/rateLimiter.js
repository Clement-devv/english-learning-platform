// middleware/rateLimiter.js
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { logger } from "../utils/logger.js";
import LoginAttempt from "../models/master/LoginAttempt.js";
import redisClient from "../config/redis.js";
import { MAX_LOGIN_ATTEMPTS, ACCOUNT_LOCK_MS } from "../config/constants.js";

// Build a Redis-backed store so rate-limit counters are shared across all PM2
// cluster workers. Without this each worker keeps its own in-memory counter,
// multiplying effective limits by the number of CPU cores. Falls back to the
// default memory store when Redis isn't configured (single-process dev).
const makeStore = (prefix) => {
  if (!redisClient) return undefined;
  return new RedisStore({
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

const MAX_ATTEMPTS  = MAX_LOGIN_ATTEMPTS;
const LOCK_DURATION = ACCOUNT_LOCK_MS;

// Build a tenant-scoped identifier so failed logins in Center A
// don't lock out the same email in Center B.
const scopedId = (identifier, centerSlug) =>
  centerSlug ? `${identifier}:${centerSlug}` : identifier;

/**
 * Track failed login attempts per identifier (email/username) scoped by center.
 * Persisted in MongoDB so server restarts don't reset locks.
 */
export const trackFailedLogin = async (identifier, centerSlug = null) => {
  const key = scopedId(identifier, centerSlug);
  const now = new Date();
  const record = await LoginAttempt.findOneAndUpdate(
    { identifier: key },
    {
      $inc: { count: 1 },
      $setOnInsert: { firstAttemptAt: now },
    },
    { upsert: true, new: true }
  );

  if (record.count >= MAX_ATTEMPTS && !record.lockUntil) {
    record.lockUntil = new Date(Date.now() + LOCK_DURATION);
    await record.save();
    logger.security("ACCOUNT_LOCKED", { identifier: key, reason: "Too many failed login attempts" });
  }

  return record;
};

/**
 * Check if account is locked.
 */
export const isAccountLocked = async (identifier, centerSlug = null) => {
  const key = scopedId(identifier, centerSlug);
  const record = await LoginAttempt.findOne({ identifier: key });
  if (!record || !record.lockUntil) return { isLocked: false };

  if (Date.now() < record.lockUntil.getTime()) {
    return {
      isLocked: true,
      lockUntil: record.lockUntil,
      remainingTime: Math.ceil((record.lockUntil.getTime() - Date.now()) / 60000),
    };
  }

  // Lock expired — clean up
  await LoginAttempt.deleteOne({ identifier: key });
  return { isLocked: false };
};

/**
 * Clear failed login attempts on successful login.
 */
export const clearFailedAttempts = async (identifier, centerSlug = null) => {
  const key = scopedId(identifier, centerSlug);
  await LoginAttempt.deleteOne({ identifier: key });
  logger.info("FAILED_ATTEMPTS_CLEARED", { identifier: key });
};

/**
 * Get remaining attempts before lockout.
 */
export const getRemainingAttempts = async (identifier, centerSlug = null) => {
  const key = scopedId(identifier, centerSlug);
  const record = await LoginAttempt.findOne({ identifier: key });
  if (!record) return MAX_ATTEMPTS;
  return Math.max(0, MAX_ATTEMPTS - record.count);
};

// =========================================
// HELPER: Development bypass & User tracking
// =========================================
// Never key on anything the client chooses (e.g. req.body.email): a fresh value
// per request would give the caller a fresh bucket every time. Authenticated
// requests use the user id; everything else uses the IP (real client IP in
// production — TRUST_PROXY=true behind Caddy, see docker-compose.yml).
const createKeyGenerator = (useUser = true) => (req) => {
  if (useUser && req.user?.id) {
    return `u:${req.user.id}`;
  }
  return `ip:${req.ip}`;
};

/**
 * The account a login / reset / email request is about, normalised so
 * "A@x.com " and "a@x.com" share a bucket. null when absent or not a string.
 */
const accountOf = (req) => {
  const v = req.body?.email ?? req.body?.username;
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase().slice(0, 254) : null;
};
const centerScope = (req) => req.center?.slug || "platform";

/**
 * Two buckets per sensitive endpoint:
 *   • per account — protects one person from a targeted guess/flood
 *   • per IP      — stops one client from spraying many accounts (rotating
 *                   the email to get a fresh account bucket each time)
 * Returned as an array; Express flattens arrays of middleware in route args.
 */
const twoLayer = (ipLimiter, accountLimiter) => [ipLimiter, accountLimiter];

// Only bypass for real loopback IPs — never trust the Host header (spoofable).
// Works in both dev and production so a misconfigured NODE_ENV can't open limits.
const LOOPBACK_IPS = new Set(["::1", "::ffff:127.0.0.1", "127.0.0.1"]);
const shouldSkip = (req) => LOOPBACK_IPS.has(req.ip);

// =========================================
// 1. LOGIN LIMITER (Keep your existing strict security)
// =========================================
const loginLimitHandler = (scope) => (req, res) => {
  logger.security('RATE_LIMIT_EXCEEDED', {
    type: 'login', scope,
    identifier: accountOf(req),
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  res.status(429).json({
    success: false,
    message: "Too many login attempts from this IP address or email. Please try again after 15 minutes.",
    retryAfter: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    lockDuration: '15 minutes'
  });
};

// Failed attempts per account (scoped by center so one center can't lock
// the same email out of another).
const loginAccountLimiter = rateLimit({
  ...withStore("login"),
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => shouldSkip(req) || !accountOf(req),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `acct:${centerScope(req)}:${accountOf(req)}`,
  handler: loginLimitHandler('account'),
});

// Failed attempts per IP, across all accounts. Looser than per-account because
// a whole school computer lab can share one public IP.
const loginIpLimiter = rateLimit({
  ...withStore("login-ip"),
  windowMs: 15 * 60 * 1000,
  max: 100,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `ip:${req.ip}`,
  handler: loginLimitHandler('ip'),
});

export const loginLimiter = twoLayer(loginIpLimiter, loginAccountLimiter);

// =========================================
// 2. PASSWORD RESET LIMITER (Keep your strict security)
// =========================================
const passwordResetHandler = (scope) => (req, res) => {
  logger.security('RATE_LIMIT_EXCEEDED', {
    type: 'password_reset', scope,
    email: accountOf(req),
    ip: req.ip
  });
  res.status(429).json({
    success: false,
    message: "Too many password reset requests. Please try again after 1 hour.",
    retryAfter: new Date(Date.now() + 60 * 60 * 1000).toISOString()
  });
};

const passwordResetAccountLimiter = rateLimit({
  ...withStore("pwd-reset"),
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: (req) => shouldSkip(req) || !accountOf(req),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `acct:${centerScope(req)}:${accountOf(req)}`,
  handler: passwordResetHandler('account'),
});

// Also used by reset-password/:token and setup-account, which have no email —
// for those the IP bucket is the only limit.
const passwordResetIpLimiter = rateLimit({
  ...withStore("pwd-reset-ip"),
  windowMs: 60 * 60 * 1000,
  max: 20,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `ip:${req.ip}`,
  handler: passwordResetHandler('ip'),
});

export const passwordResetLimiter = twoLayer(passwordResetIpLimiter, passwordResetAccountLimiter);

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
  max: 600, // was 200 — 20-student classroom sends ~600 heartbeats/min
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
const emailLimitHandler = (scope) => (req, res) => {
  logger.security('RATE_LIMIT_EXCEEDED', {
    type: 'email', scope,
    recipient: accountOf(req),
    ip: req.ip
  });
  res.status(429).json({
    success: false,
    message: "Too many email requests. Please try again after 1 hour."
  });
};

const emailAccountLimiter = rateLimit({
  ...withStore("email"),
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: (req) => shouldSkip(req) || !accountOf(req),
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `acct:${accountOf(req)}`,
  handler: emailLimitHandler('recipient'),
});

const emailIpLimiter = rateLimit({
  ...withStore("email-ip"),
  windowMs: 60 * 60 * 1000,
  max: 30,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `ip:${req.ip}`,
  handler: emailLimitHandler('ip'),
});

export const emailLimiter = twoLayer(emailIpLimiter, emailAccountLimiter);

// =========================================
// 9. PUBLIC CONTACT FORM LIMITER
// =========================================
// The company contact form emails a real inbox and needs no login, so it gets
// its own small per-IP budget (the general API limit is 5000 / 15 min).
export const contactFormLimiter = rateLimit({
  ...withStore("contact"),
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: shouldSkip,
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => `ip:${req.ip}`,
  handler: (req, res) => {
    logger.security('RATE_LIMIT_EXCEEDED', { type: 'contact_form', ip: req.ip });
    res.status(429).json({
      success: false,
      message: "Too many messages sent. Please try again in an hour.",
    });
  },
});

// No manual cleanup needed — MongoDB TTL index on LoginAttempt.firstAttemptAt
// automatically removes records after 2 hours (see models/master/LoginAttempt.js).

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
  contactFormLimiter,
  trackFailedLogin,
  isAccountLocked,
  clearFailedAttempts,
  getRemainingAttempts
};