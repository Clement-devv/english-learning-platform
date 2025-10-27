// utils/logger.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Log levels enum
 */
const LogLevels = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  SECURITY: 'SECURITY',
  DEBUG: 'DEBUG'
};

/**
 * Format log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 * @returns {object} - Formatted log entry
 */
const formatLogEntry = (level, message, meta = {}) => {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
    environment: process.env.NODE_ENV || 'development'
  };
};

/**
 * Write log to file
 * @param {string} level - Log level
 * @param {object} logEntry - Log entry object
 */
const writeToFile = (level, logEntry) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logsDir, `${level.toLowerCase()}-${date}.log`);
    const logLine = JSON.stringify(logEntry) + '\n';
    
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error('Failed to write log:', error);
  }
};

/**
 * Console output with colors (development only)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
const consoleOutput = (level, message, meta) => {
  if (process.env.NODE_ENV !== 'development') return;
  
  const colors = {
    ERROR: '\x1b[31m',   // Red
    WARN: '\x1b[33m',    // Yellow
    INFO: '\x1b[36m',    // Cyan
    SECURITY: '\x1b[35m', // Magenta
    DEBUG: '\x1b[90m',   // Gray
    RESET: '\x1b[0m'
  };
  
  const timestamp = new Date().toISOString();
  const color = colors[level] || colors.RESET;
  
  console.log(
    `${color}[${timestamp}] ${level}:${colors.RESET}`,
    message,
    Object.keys(meta).length > 0 ? meta : ''
  );
};

/**
 * Main log function
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
const log = (level, message, meta = {}) => {
  const logEntry = formatLogEntry(level, message, meta);
  
  // Write to file
  writeToFile(level, logEntry);
  
  // Console output in development
  consoleOutput(level, message, meta);
  
  // Also write security logs to separate security log file
  if (level === LogLevels.SECURITY) {
    writeToFile('all-security', logEntry);
  }
  
  // Write all errors to error log
  if (level === LogLevels.ERROR) {
    writeToFile('all-errors', logEntry);
  }
};

/**
 * Logger object with methods for each log level
 */
export const logger = {
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {object} meta - Additional metadata
   */
  error: (message, meta = {}) => {
    log(LogLevels.ERROR, message, {
      ...meta,
      stack: meta.stack || new Error().stack
    });
  },
  
  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {object} meta - Additional metadata
   */
  warn: (message, meta = {}) => {
    log(LogLevels.WARN, message, meta);
  },
  
  /**
   * Log info message
   * @param {string} message - Info message
   * @param {object} meta - Additional metadata
   */
  info: (message, meta = {}) => {
    log(LogLevels.INFO, message, meta);
  },
  
  /**
   * Log security event
   * @param {string} message - Security event message
   * @param {object} meta - Additional metadata
   */
  security: (message, meta = {}) => {
    log(LogLevels.SECURITY, message, meta);
  },
  
  /**
   * Log debug message (development only)
   * @param {string} message - Debug message
   * @param {object} meta - Additional metadata
   */
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      log(LogLevels.DEBUG, message, meta);
    }
  }
};

/**
 * Log security events with predefined structure
 * @param {string} event - Event type
 * @param {object} details - Event details
 */
export const logSecurityEvent = (event, details = {}) => {
  logger.security(event, {
    event,
    ...details,
    timestamp: new Date().toISOString()
  });
};

/**
 * Security event types (for consistent logging)
 */
export const SecurityEvents = {
  // Authentication events
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  LOGOUT_ALL: 'LOGOUT_ALL',
  
  // Account events
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'ACCOUNT_UNLOCKED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  
  // Password events
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  PASSWORD_RESET_FAILED: 'PASSWORD_RESET_FAILED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Suspicious activity
  INVALID_TOKEN: 'INVALID_TOKEN',
  EXPIRED_TOKEN: 'EXPIRED_TOKEN',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  
  // Data access
  SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS',
  DATA_EXPORT: 'DATA_EXPORT',
  
  // Administrative actions
  ADMIN_ACTION: 'ADMIN_ACTION',
  PERMISSION_CHANGED: 'PERMISSION_CHANGED'
};

/**
 * Log authentication event
 * @param {string} event - Event type
 * @param {object} details - Event details
 */
export const logAuthEvent = (event, details = {}) => {
  logSecurityEvent(event, {
    category: 'authentication',
    ...details
  });
};

/**
 * Log data access event
 * @param {string} userId - User ID
 * @param {string} resource - Resource accessed
 * @param {string} action - Action performed
 * @param {object} details - Additional details
 */
export const logDataAccess = (userId, resource, action, details = {}) => {
  logSecurityEvent(SecurityEvents.SENSITIVE_DATA_ACCESS, {
    userId,
    resource,
    action,
    ...details
  });
};

/**
 * Log failed request with details
 * @param {object} req - Express request object
 * @param {Error} error - Error object
 */
export const logFailedRequest = (req, error) => {
  logger.error('REQUEST_FAILED', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    error: error.message,
    stack: error.stack
  });
};

/**
 * Clean old log files (older than 30 days)
 */
export const cleanOldLogs = () => {
  try {
    const files = fs.readdirSync(logsDir);
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime.getTime() < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        logger.info('LOG_FILE_DELETED', { file });
      }
    });
  } catch (error) {
    logger.error('LOG_CLEANUP_FAILED', { error: error.message });
  }
};

// Schedule log cleanup (daily at 2 AM)
const scheduleLogCleanup = () => {
  const now = new Date();
  const tomorrow2AM = new Date(now);
  tomorrow2AM.setDate(tomorrow2AM.getDate() + 1);
  tomorrow2AM.setHours(2, 0, 0, 0);
  
  const timeUntil2AM = tomorrow2AM.getTime() - now.getTime();
  
  setTimeout(() => {
    cleanOldLogs();
    // Schedule next cleanup (every 24 hours)
    setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);
  }, timeUntil2AM);
};

// Start log cleanup scheduler
scheduleLogCleanup();

/**
 * Middleware to log all requests
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Next middleware
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('REQUEST', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    
    logger[level.toLowerCase()]('RESPONSE', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
};

export default logger;