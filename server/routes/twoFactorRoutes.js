// server/routes/twoFactorRoutes.js
import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  generateTwoFactorSecret,
  verifyTwoFactorToken,
  generateBackupCodes,
  verifyBackupCode
} from '../utils/twoFactorAuth.js';
import { logger } from '../utils/logger.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import Admin from '../models/Admin.js';

const router = express.Router();

/**
 * Helper function to get user model based on role
 */
const getUserModel = (role) => {
  switch (role) {
    case 'teacher': return Teacher;
    case 'student': return Student;
    case 'admin': return Admin;
    default: return null;
  }
};

// ============================================
// SETUP 2FA (Step 1: Generate QR Code)
// ============================================

router.post('/setup', verifyToken, async (req, res) => {
  try {
    const { role, id, email } = req.user;
    const UserModel = getUserModel(role);
    
    if (!UserModel) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user role'
      });
    }

    const user = await UserModel.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is already enabled. Disable it first to set up again.'
      });
    }

    // Generate new secret and QR code
    const { secret, qrCode } = await generateTwoFactorSecret(email);
    
    // Store secret temporarily (not enabled yet)
    user.twoFactorSecret = secret;
    user.twoFactorVerified = false;
    await user.save();

    logger.info('2FA_SETUP_INITIATED', { 
      userId: id, 
      role, 
      email 
    });

    res.json({
      success: true,
      message: 'Scan this QR code with your authenticator app',
      qrCode,
      secret // Also send secret for manual entry
    });

  } catch (error) {
    logger.error('2FA_SETUP_ERROR', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to set up 2FA. Please try again.'
    });
  }
});

// ============================================
// VERIFY 2FA (Step 2: Verify code and enable)
// ============================================

router.post('/verify', [
  verifyToken,
  body('token')
    .isLength({ min: 6, max: 6 })
    .withMessage('Token must be 6 digits')
    .isNumeric()
    .withMessage('Token must be numeric'),
  validate
], async (req, res) => {
  try {
    const { token } = req.body;
    const { role, id } = req.user;
    const UserModel = getUserModel(role);
    
    const user = await UserModel.findById(id);
    
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: 'Please set up 2FA first'
      });
    }

    // Verify the token
    const isValid = verifyTwoFactorToken(token, user.twoFactorSecret);
    
    if (!isValid) {
      logger.warn('2FA_VERIFICATION_FAILED', { 
        userId: id, 
        role 
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.'
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    
    // Enable 2FA
    user.twoFactorEnabled = true;
    user.twoFactorVerified = true;
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    logger.info('2FA_ENABLED', { 
      userId: id, 
      role 
    });

    res.json({
      success: true,
      message: '2FA enabled successfully! Save your backup codes in a safe place.',
      backupCodes
    });

  } catch (error) {
    logger.error('2FA_VERIFY_ERROR', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to verify 2FA code. Please try again.'
    });
  }
});

// ============================================
// DISABLE 2FA
// ============================================

router.post('/disable', [
  verifyToken,
  body('password')
    .notEmpty()
    .withMessage('Password is required to disable 2FA'),
  validate
], async (req, res) => {
  try {
    const { password } = req.body;
    const { role, id } = req.user;
    const UserModel = getUserModel(role);
    
    const user = await UserModel.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const bcryptjs = await import('bcryptjs');
    const isValidPassword = await bcryptjs.default.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    user.twoFactorVerified = false;
    await user.save();

    logger.info('2FA_DISABLED', { 
      userId: id, 
      role 
    });

    res.json({
      success: false,
      message: '2FA has been disabled successfully'
    });

  } catch (error) {
    logger.error('2FA_DISABLE_ERROR', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to disable 2FA. Please try again.'
    });
  }
});

// ============================================
// GET 2FA STATUS
// ============================================

router.get('/status', verifyToken, async (req, res) => {
  try {
    const { role, id } = req.user;
    const UserModel = getUserModel(role);
    
    const user = await UserModel.findById(id).select('twoFactorEnabled twoFactorVerified');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      twoFactorEnabled: user.twoFactorEnabled || false,
      twoFactorVerified: user.twoFactorVerified || false
    });

  } catch (error) {
    logger.error('2FA_STATUS_ERROR', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get 2FA status'
    });
  }
});

// ============================================
// REGENERATE BACKUP CODES
// ============================================

router.post('/regenerate-backup-codes', [
  verifyToken,
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
], async (req, res) => {
  try {
    const { password } = req.body;
    const { role, id } = req.user;
    const UserModel = getUserModel(role);
    
    const user = await UserModel.findById(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: '2FA is not enabled'
      });
    }

    // Verify password
    const bcryptjs = await import('bcryptjs');
    const isValidPassword = await bcryptjs.default.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password'
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    user.twoFactorBackupCodes = backupCodes;
    await user.save();

    logger.info('2FA_BACKUP_CODES_REGENERATED', { 
      userId: id, 
      role 
    });

    res.json({
      success: true,
      message: 'New backup codes generated. Save them in a safe place.',
      backupCodes
    });

  } catch (error) {
    logger.error('2FA_REGENERATE_CODES_ERROR', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate backup codes. Please try again.'
    });
  }
});

export default router;