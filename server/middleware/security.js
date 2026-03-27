// middleware/security.js
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import hpp from "hpp";

/**
 * Security headers middleware
 * Protects against common web vulnerabilities
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "https:", "data:"],
      connectSrc: [
        "'self'",
        // Agora RTC / RTM servers
        "https://*.agora.io",
        "wss://*.agora.io",
        "https://*.sd-rtn.com",
        "wss://*.sd-rtn.com",
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
      upgradeInsecureRequests: [],
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
 * Prevent NoSQL injection attacks
 * Sanitizes user input to prevent MongoDB operator injection
 */
export const noSqlInjectionProtection = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`🚨 NoSQL injection attempt detected: ${key} in ${req.path}`);
  },
});

/**
 * Prevent XSS attacks
 * Cleans user input from malicious scripts
 */
export const xssProtection = xss();

/**
 * Prevent HTTP parameter pollution
 * Protects against duplicate parameters
 */
export const parameterPollutionProtection = hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'search']
});

/**
 * Request size limits
 * Prevents DoS attacks via large payloads
 */
export const requestLimits = {
  json: { limit: '10kb' },
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