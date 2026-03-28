import jwt from 'jsonwebtoken';
import SuperAdmin from '../models/master/SuperAdmin.js';
import { config } from '../config/config.js';

export const verifySuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);

    if (decoded.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' });
    }

    const superAdmin = await SuperAdmin.findById(decoded.id).select('-password');
    if (!superAdmin || !superAdmin.active) {
      return res.status(403).json({ success: false, message: 'Super admin account inactive' });
    }

    req.superAdmin = superAdmin;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
