// server/utils/twoFactorAuth.js
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate a new 2FA secret for a user
 * @param {string} email - User's email
 * @param {string} appName - App name (e.g., "English Learning Platform")
 * @returns {object} - Secret and QR code data URL
 */
export const generateTwoFactorSecret = async (email, appName = 'English Learning Platform') => {
  const secret = speakeasy.generateSecret({
    name: `${appName} (${email})`,
    length: 32
  });

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32, // This will be stored in database
    qrCode: qrCodeDataUrl, // This will be shown to user
    otpauthUrl: secret.otpauth_url
  };
};

/**
 * Verify a TOTP token
 * @param {string} token - 6-digit code from authenticator app
 * @param {string} secret - User's secret from database
 * @returns {boolean} - True if token is valid
 */
export const verifyTwoFactorToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 60 seconds time drift
  });
};

/**
 * Generate backup codes for account recovery
 * @returns {array} - Array of 10 backup codes
 */
export const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Verify a backup code
 * @param {string} code - Backup code entered by user
 * @param {array} backupCodes - Array of user's backup codes
 * @returns {object} - { valid: boolean, remainingCodes: array }
 */
export const verifyBackupCode = (code, backupCodes) => {
  const codeUpper = code.toUpperCase().trim();
  const index = backupCodes.indexOf(codeUpper);
  
  if (index === -1) {
    return { valid: false, remainingCodes: backupCodes };
  }
  
  // Remove used backup code
  const remainingCodes = backupCodes.filter((_, i) => i !== index);
  
  return { valid: true, remainingCodes };
};

/**
 * Format backup codes for display
 * @param {array} codes - Array of backup codes
 * @returns {string} - Formatted codes (4 per line)
 */
export const formatBackupCodes = (codes) => {
  let formatted = '';
  for (let i = 0; i < codes.length; i++) {
    formatted += codes[i];
    if ((i + 1) % 4 === 0) {
      formatted += '\n';
    } else {
      formatted += '  ';
    }
  }
  return formatted.trim();
};

export default {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  generateBackupCodes,
  verifyBackupCode,
  formatBackupCodes
};