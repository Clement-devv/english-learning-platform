// middleware/validation.js
import { body, param, query, validationResult } from 'express-validator';

/**
 * Validation error handler
 * Processes validation errors and returns formatted response
 */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

/**
 * Email validation
 */
export const validateEmail = body('email')
  .trim()
  .isEmail()
  .normalizeEmail()
  .withMessage('Please provide a valid email address')
  .isLength({ max: 100 })
  .withMessage('Email must not exceed 100 characters');

/**
 * Password validation with strong complexity requirements
 */
export const validatePassword = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)');

/**
 * New password validation (for password changes)
 */
export const validateNewPassword = body('newPassword')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be between 8 and 128 characters')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)');

/**
 * Current password validation
 */
export const validateCurrentPassword = body('currentPassword')
  .notEmpty()
  .withMessage('Current password is required');

/**
 * MongoDB ObjectId validation
 */
export const validateObjectId = param('id')
  .isMongoId()
  .withMessage('Invalid ID format');

/**
 * Login validation
 */
export const validateLogin = [
  validateEmail,
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

/**
 * Teacher login validation (supports username or email)
 */
export const validateTeacherLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email or username is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

/**
 * Admin login validation
 */
export const validateAdminLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

/**
 * Change password validation
 */
export const validateChangePassword = [
  validateCurrentPassword,
  validateNewPassword,
  body('newPassword')
    .custom((value, { req }) => value !== req.body.currentPassword)
    .withMessage('New password must be different from current password'),
  validate
];

/**
 * Forgot password validation
 */
export const validateForgotPassword = [
  validateEmail,
  validate
];

/**
 * Reset password validation
 */
export const validateResetPassword = [
  param('token')
    .isLength({ min: 64, max: 64 })
    .withMessage('Invalid reset token'),
  validateNewPassword,
  validate
];

/**
 * Student validation
 */
export const validateStudent = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  body('surname')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Surname must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Surname can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  validateEmail,
  body('age')
    .optional()
    .isInt({ min: 5, max: 100 })
    .withMessage('Age must be between 5 and 100'),
  body('noOfClasses')
    .optional()
    .isInt({ min: 0, max: 1000 })
    .withMessage('Number of classes must be between 0 and 1000'),
  body('password')
    .optional()
    .custom((value) => {
      if (value) {
        if (value.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(value)) {
          throw new Error('Password must contain uppercase, lowercase, number, and special character');
        }
      }
      return true;
    }),
  validate
];

/**
 * Student update validation (partial)
 */
export const validateStudentUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .escape(),
  body('surname')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .escape(),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail(),
  body('age')
    .optional()
    .isInt({ min: 5, max: 100 }),
  body('noOfClasses')
    .optional()
    .isInt({ min: 0, max: 1000 }),
  body('active')
    .optional()
    .isBoolean(),
  validate
];

/**
 * Teacher validation
 */
export const validateTeacher = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes')
    .escape(),
  validateEmail,
  body('continent')
    .isIn(['Africa', 'Europe', 'Asia'])
    .withMessage('Continent must be Africa, Europe, or Asia'),
  body('ratePerClass')
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Rate per class must be between 0 and 10000'),
  body('password')
    .optional()
    .custom((value) => {
      if (value) {
        if (value.length < 8) {
          throw new Error('Password must be at least 8 characters');
        }
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(value)) {
          throw new Error('Password must contain uppercase, lowercase, number, and special character');
        }
      }
      return true;
    }),
  validate
];

/**
 * Teacher update validation (partial)
 */
export const validateTeacherUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .escape(),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Z\s'-]+$/)
    .escape(),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail(),
  body('continent')
    .optional()
    .isIn(['Africa', 'Europe', 'Asia']),
  body('ratePerClass')
    .optional()
    .isFloat({ min: 0, max: 10000 }),
  body('active')
    .optional()
    .isBoolean(),
  validate
];

/**
 * Payment validation
 */
export const validatePayment = [
  body('amount')
    .isFloat({ min: 0, max: 1000000 })
    .withMessage('Amount must be between 0 and 1,000,000'),
  body('classes')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Classes must be between 1 and 1000'),
  body('method')
    .optional()
    .isIn(['Manual', 'Bank Transfer', 'Credit Card', 'Other'])
    .withMessage('Invalid payment method'),
  body('status')
    .optional()
    .isIn(['completed', 'pending', 'failed'])
    .withMessage('Invalid payment status'),
  validate
];

/**
 * Lesson validation
 */
export const validateLesson = [
  body('teacher')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Teacher name must be between 2 and 100 characters')
    .escape(),
  validate
];

/**
 * Assignment validation
 */
export const validateAssignment = [
  body('teacherId')
    .isMongoId()
    .withMessage('Invalid teacher ID'),
  body('studentId')
    .isMongoId()
    .withMessage('Invalid student ID'),
  validate
];

/**
 * Pagination validation
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Page must be between 1 and 10000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate
];

/**
 * Search validation
 */
export const validateSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must not exceed 100 characters')
    .escape(),
  validate
];