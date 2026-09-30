// server/middleware/validate.js
// Reusable express-validator rule sets for common input patterns.
// Usage:  router.post('/login', loginRules, validate, handler)

import { body, query, param, validationResult } from 'express-validator';

// ── Run accumulated rules and short-circuit on first error ───────────────────
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array({ onlyFirstError: true })[0];
    return res.status(422).json({
      success: false,
      message: first.msg,
    });
  }
  next();
};

// ── Auth ─────────────────────────────────────────────────────────────────────

// Used on all three login routes (teacher / student / admin).
// Admin may log in with username instead of email — allow either.
export const loginRules = [
  body('email')
    .optional()
    .isEmail().withMessage('Email must be a valid email address')
    // Not normalizeEmail(): it strips Gmail dots, so stored addresses stop matching
    .trim().toLowerCase()
    .isLength({ max: 254 }).withMessage('Email too long'),

  body('username')
    .optional()
    .isString().withMessage('Username must be a string')
    .trim()
    .isLength({ max: 100 }).withMessage('Username too long'),

  // At least one of email or username must be present — checked at route level,
  // but we still enforce that password is present and not absurdly long.
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password must be 128 characters or fewer'),

  body('twoFactorToken')
    .optional()
    .isString()
    .isLength({ min: 6, max: 8 }).withMessage('2FA token must be 6–8 characters'),

  body('backupCode')
    .optional()
    .isString()
    .isLength({ max: 50 }).withMessage('Backup code too long'),
];

// For POST /*/change-password
export const changePasswordRules = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required')
    .isLength({ max: 128 }).withMessage('Current password too long'),

  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8, max: 128 }).withMessage('New password must be 8–128 characters'),
];

// For POST /*/forgot-password
export const forgotPasswordRules = [
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    // Not normalizeEmail(): it strips Gmail dots, so stored addresses stop matching
    .trim().toLowerCase()
    .isLength({ max: 254 }).withMessage('Email too long'),
];

// For POST /*/reset-password/:token
export const resetPasswordRules = [
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8, max: 128 }).withMessage('New password must be 8–128 characters'),

  param('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 10, max: 200 }).withMessage('Invalid reset token'),
];

// For POST /verify-2fa-login
export const verify2faRules = [
  body('pendingToken')
    .notEmpty().withMessage('Pending session token is required')
    .isString()
    .isLength({ max: 600 }).withMessage('Pending token too long'),

  body('twoFactorToken')
    .optional()
    .isString()
    .isLength({ min: 6, max: 8 }).withMessage('2FA token must be 6 digits'),

  body('backupCode')
    .optional()
    .isString()
    .isLength({ max: 50 }).withMessage('Backup code too long'),
];

// ── People (teachers / students / parents / sub-admins) ──────────────────────

export const createPersonRules = [
  body('firstName')
    .notEmpty().withMessage('First name is required')
    .isString()
    .trim()
    .isLength({ max: 100 }).withMessage('First name must be 100 characters or fewer'),

  body('lastName')
    .notEmpty().withMessage('Last name is required')
    .isString()
    .trim()
    .isLength({ max: 100 }).withMessage('Last name must be 100 characters or fewer'),

  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    // Not normalizeEmail(): it strips Gmail dots, so stored addresses stop matching
    .trim().toLowerCase()
    .isLength({ max: 254 }).withMessage('Email too long'),
];

export const updatePersonRules = [
  body('firstName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }).withMessage('First name must be 100 characters or fewer'),

  body('lastName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }).withMessage('Last name must be 100 characters or fewer'),

  body('email')
    .optional()
    .isEmail().withMessage('Must be a valid email address')
    // Not normalizeEmail(): it strips Gmail dots, so stored addresses stop matching
    .trim().toLowerCase()
    .isLength({ max: 254 }).withMessage('Email too long'),

  body('phone')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 30 }).withMessage('Phone number too long'),

  body('bio')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 }).withMessage('Bio must be 2 000 characters or fewer'),

  body('displayName')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }).withMessage('Display name too long'),
];

// ── Bookings ─────────────────────────────────────────────────────────────────

export const createBookingRules = [
  body('teacherId')
    .notEmpty().withMessage('Teacher ID is required')
    .isMongoId().withMessage('Teacher ID must be a valid ID'),

  body('studentId')
    .notEmpty().withMessage('Student ID is required')
    .isMongoId().withMessage('Student ID must be a valid ID'),

  body('scheduledTime')
    .notEmpty().withMessage('Scheduled time is required')
    .isISO8601().withMessage('Scheduled time must be a valid date-time (ISO 8601)'),

  body('duration')
    .notEmpty().withMessage('Duration is required')
    .isInt({ min: 15, max: 480 }).withMessage('Duration must be between 15 and 480 minutes'),

  body('classTitle')
    .notEmpty().withMessage('Class title is required')
    .isString()
    .trim()
    .isLength({ max: 200 }).withMessage('Class title must be 200 characters or fewer'),

  body('topic')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }).withMessage('Topic must be 500 characters or fewer'),

  body('notes')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 }).withMessage('Notes must be 2 000 characters or fewer'),

  body('isTrial')
    .optional()
    .isBoolean().withMessage('isTrial must be true or false'),
];

// ── Messages / Chat ──────────────────────────────────────────────────────────

export const sendMessageRules = [
  body('message')
    .notEmpty().withMessage('Message cannot be empty')
    .isString()
    .isLength({ max: 10_000 }).withMessage('Message must be 10 000 characters or fewer'),
];

// ── Pagination ───────────────────────────────────────────────────────────────

export const paginationRules = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('limit must be an integer between 1 and 200')
    .toInt(),

  query('skip')
    .optional()
    .isInt({ min: 0 }).withMessage('skip must be a non-negative integer')
    .toInt(),

  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('offset must be a non-negative integer')
    .toInt(),
];

// ── Student payment ──────────────────────────────────────────────────────────

export const studentPaymentRules = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0 }).withMessage('Amount must be a positive number'),

  body('classes')
    .notEmpty().withMessage('Number of classes is required')
    .isInt({ min: 1, max: 10_000 }).withMessage('Classes must be between 1 and 10 000'),

  body('method')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 }).withMessage('Payment method too long'),
];

// ── URL / meeting links ──────────────────────────────────────────────────────

export const meetingLinkRules = (fieldName) => [
  body(fieldName)
    .notEmpty().withMessage(`${fieldName} is required`)
    .isURL({ protocols: ['https'], require_protocol: true })
    .withMessage(`${fieldName} must be a valid HTTPS URL`)
    .isLength({ max: 500 }).withMessage(`${fieldName} too long`),
];
