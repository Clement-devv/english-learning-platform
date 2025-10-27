// utils/passwordUtils.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { config } from "../config/config.js";

/**
 * Validate password complexity against requirements
 * @param {string} password - Password to validate
 * @returns {object} - Validation result with isValid and errors array
 */
export const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ['Password is required']
    };
  }
  
  if (password.length < config.passwordMinLength) {
    errors.push(`Password must be at least ${config.passwordMinLength} characters long`);
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  if (config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter (A-Z)');
  }
  
  if (config.passwordRequireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter (a-z)');
  }
  
  if (config.passwordRequireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number (0-9)');
  }
  
  if (config.passwordRequireSpecialChars && !/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }
  
  // Check for common weak passwords
  const weakPasswords = [
    'password', 'password123', '12345678', 'qwerty', 'abc123',
    'password1', '123456789', '1234567890', 'admin', 'admin123'
  ];
  
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('This password is too common. Please choose a stronger password');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Hash password with bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
export const hashPassword = async (password) => {
  // Validate password strength first
  const validation = validatePasswordStrength(password);
  if (!validation.isValid) {
    const error = new Error('Password does not meet requirements');
    error.details = validation.errors;
    throw error;
  }
  
  try {
    return await bcrypt.hash(password, config.bcryptRounds);
  } catch (error) {
    throw new Error('Error hashing password');
  }
};

/**
 * Compare plain text password with hashed password
 * @param {string} plainPassword - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} - True if passwords match
 */
export const comparePassword = async (plainPassword, hashedPassword) => {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
};

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 12)
 * @returns {string} - Generated password
 */
export const generateSecurePassword = (length = 12) => {
  if (length < 8 || length > 128) {
    throw new Error('Password length must be between 8 and 128 characters');
  }
  
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one character from each required set
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += special[crypto.randomInt(0, special.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => crypto.randomInt(0, 2) - 0.5).join('');
};

/**
 * Check if password was recently used (password history)
 * @param {string} userId - User ID
 * @param {string} newPassword - New password to check
 * @param {Model} userModel - Mongoose model (Teacher, Student, or Admin)
 * @returns {Promise<boolean>} - True if password was recently used
 */
export const isPasswordReused = async (userId, newPassword, userModel) => {
  try {
    const user = await userModel.findById(userId);
    if (!user || !user.passwordHistory) return false;
    
    // Check against last 5 passwords
    const historyToCheck = user.passwordHistory.slice(-5);
    
    for (const oldHash of historyToCheck) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking password history:', error);
    return false;
  }
};

/**
 * Add password to history
 * @param {object} user - User document
 * @param {string} hashedPassword - Hashed password to add
 */
export const addToPasswordHistory = (user, hashedPassword) => {
  if (!user.passwordHistory) {
    user.passwordHistory = [];
  }
  
  user.passwordHistory.push(hashedPassword);
  
  // Keep only last 5 passwords
  if (user.passwordHistory.length > 5) {
    user.passwordHistory = user.passwordHistory.slice(-5);
  }
};

/**
 * Calculate password strength score (0-100)
 * @param {string} password - Password to evaluate
 * @returns {object} - Score and strength level
 */
export const calculatePasswordStrength = (password) => {
  let score = 0;
  
  if (!password) return { score: 0, level: 'Very Weak' };
  
  // Length bonus
  score += Math.min(password.length * 4, 40); // Max 40 points
  
  // Character variety bonus
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[@$!%*?&]/.test(password)) score += 10;
  
  // Additional complexity bonus
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;
  
  // Penalty for repeating characters
  if (/(.)\1{2,}/.test(password)) score -= 10;
  
  // Penalty for sequential characters
  if (/abc|bcd|cde|def|efg|fgh|123|234|345|456|567|678|789/.test(password.toLowerCase())) {
    score -= 10;
  }
  
  score = Math.max(0, Math.min(100, score));
  
  let level;
  if (score < 30) level = 'Very Weak';
  else if (score < 50) level = 'Weak';
  else if (score < 70) level = 'Fair';
  else if (score < 85) level = 'Strong';
  else level = 'Very Strong';
  
  return { score, level };
};

/**
 * Generate password reset token
 * @returns {object} - Token and hashed token
 */
export const generateResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  return {
    resetToken, // Send this in email
    hashedToken // Store this in database
  };
};

/**
 * Verify reset token
 * @param {string} token - Token from URL
 * @returns {string} - Hashed token to compare with database
 */
export const hashResetToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Check if password reset token is expired
 * @param {Date} expiryDate - Token expiry date from database
 * @returns {boolean} - True if token is expired
 */
export const isResetTokenExpired = (expiryDate) => {
  return !expiryDate || Date.now() > expiryDate.getTime();
};

export default {
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  generateSecurePassword,
  isPasswordReused,
  addToPasswordHistory,
  calculatePasswordStrength,
  generateResetToken,
  hashResetToken,
  isResetTokenExpired
};