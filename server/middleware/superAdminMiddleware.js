import jwt from 'jsonwebtoken';
import SuperAdmin from '../models/master/SuperAdmin.js';
import { config, JWT_VERIFY_OPTIONS } from '../config/config.js';
import { isTokenBlacklisted } from './authMiddleware.js';

export const verifySuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, config.jwtSecret, JWT_VERIFY_OPTIONS);

    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    // Blacklist check — ensures /super-admin/logout-session and
    // /super-admin/logout-all-devices actually revoke the JWT.  Without this,
    // a logged-out super-admin token would remain valid for its full 8h life.
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ success: false, message: 'Session has been revoked. Please log in again.' });
    }

    const superAdmin = await SuperAdmin.findById(decoded.id).select('-password');
    if (!superAdmin || !superAdmin.active) {
      return res.status(403).json({ success: false, message: 'Super admin account inactive' });
    }

    req.superAdmin = superAdmin;
    req.user = decoded;
    next();
  } catch (_err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
