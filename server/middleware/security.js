// middleware/security.js
//
// CSRF POSTURE: This API authenticates exclusively via JWT Bearer tokens sent
// in the Authorization header. Browsers never automatically attach Authorization
// headers to cross-site requests, so CSRF tokens are not required. Any cookies
// set elsewhere (e.g. refresh tokens) MUST use SameSite=Strict + Secure + HttpOnly.
import helmet from "helmet";
import { sanitize as mongoSanitizeValue } from "express-mongo-sanitize";

// Inline XSS sanitizer — replaces the abandoned xss-clean package.
// Strips <script> blocks, event-handler attributes, and dangerous URI schemes
// without encoding benign HTML (which would corrupt stored content).
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:\s*text\/html/gi,
];

function xssClean(value) {
  if (typeof value === 'string') {
    return XSS_PATTERNS.reduce((str, pattern) => str.replace(pattern, ''), value);
  }
  if (Array.isArray(value)) return value.map(xssClean);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, xssClean(v)]));
  }
  return value;
}

/**
 * Security headers middleware
 * Protects against common web vulnerabilities
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://translate.google.com", "https://translate.googleapis.com", "https://translate-pa.googleapis.com"],
      imgSrc: ["'self'", "https:", "data:"],
      connectSrc: [
        "'self'",
        // Agora RTC / RTM servers
        "https://*.agora.io",
        "wss://*.agora.io",
        "https://*.sd-rtn.com",
        "wss://*.sd-rtn.com",
        // Google Translate API
        "https://translate.googleapis.com",
        "https://translate-pa.googleapis.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: [],
      // CSP violation reports — update this URL once you have a reporting endpoint
      // (e.g. /api/v1/csp-report, or a third-party service like report-uri.com)
      reportUri: ["/api/v1/csp-report"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

/**
 * Prevent NoSQL injection attacks.
 *
 * express-mongo-sanitize does `req[key] = sanitized` directly which throws on
 * Express 5 + Node 24 because req.query is a prototype getter. We call its
 * sanitize() function directly and apply the result safely via
 * Object.defineProperty for req.query.
 */
const MONGO_SANITIZE_OPTS = { replaceWith: '_' };

export const noSqlInjectionProtection = (req, res, next) => {
  if (req.body) req.body = mongoSanitizeValue(req.body, MONGO_SANITIZE_OPTS);
  if (req.params) req.params = mongoSanitizeValue(req.params, MONGO_SANITIZE_OPTS);
  if (req.headers) req.headers = mongoSanitizeValue(req.headers, MONGO_SANITIZE_OPTS);
  if (req.query) {
    const sanitized = mongoSanitizeValue(req.query, MONGO_SANITIZE_OPTS);
    Object.defineProperty(req, 'query', {
      value: sanitized,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  next();
};

/**
 * Prevent XSS attacks.
 *
 * xss-clean does `req.query = cleaned` directly, which throws on Express 5 +
 * Node 24 because req.query is a prototype getter. We use the underlying
 * xss cleaner directly and apply it safely via Object.defineProperty.
 */
export const xssProtection = (req, res, next) => {
  if (req.body) req.body = xssClean(req.body);
  if (req.params) req.params = xssClean(req.params);
  if (req.query) {
    Object.defineProperty(req, 'query', {
      value: xssClean(req.query),
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  next();
};

/**
 * Prevent HTTP parameter pollution (HPP).
 *
 * The `hpp` npm package does `req.query = cleaned` which throws on Express 5 +
 * Node 24 because req.query is a prototype getter and cannot be directly
 * assigned. This custom version uses Object.defineProperty to safely shadow
 * the getter with an own-property on the request instance instead.
 *
 * For whitelisted params (e.g. ?sort=name&sort=email) arrays are kept as-is.
 * For all other duplicated params, only the last value is kept.
 */
const HPP_WHITELIST = new Set(['sort', 'fields', 'page', 'limit', 'skip', 'search']);

export const parameterPollutionProtection = (req, res, next) => {
  const raw = req.query; // read via getter — fine
  if (!raw || typeof raw !== 'object') return next();

  const cleaned = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!Array.isArray(val) || HPP_WHITELIST.has(key)) {
      cleaned[key] = val;
    } else {
      // Duplicate non-whitelisted param: keep last value
      cleaned[key] = val[val.length - 1];
    }
  }

  // Shadow the prototype getter with a plain writable own-property
  Object.defineProperty(req, 'query', {
    value: cleaned,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  next();
};

/**
 * Request size limits
 * Prevents DoS attacks via large payloads
 */
export const requestLimits = {
  json: { limit: '2mb' },
  urlencoded: { extended: true, limit: '10kb', parameterLimit: 50 }
};

/**
 * Disable powered by header
 * Hides Express framework information
 */
export const disablePoweredBy = (req, res, next) => {
  res.removeHeader('X-Powered-By');
  next();
};

/**
 * Request sanitization
 * Additional layer of input cleaning
 */
export const sanitizeRequest = (req, res, next) => {
  // Trim all string inputs
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};