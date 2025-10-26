// utils/sessionManager.js
import { UAParser } from "ua-parser-js";  // Changed from default import
import crypto from "crypto";

/**
 * Extract device information from request
 */
export const getDeviceInfo = (req) => {
  const parser = new UAParser(req.headers['user-agent']);
  const result = parser.getResult();
  
  return {
    browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
    os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
    device: result.device.type || 'Desktop',
  };
};

/**
 * Get IP address from request
 */
export const getIpAddress = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'Unknown';
};

/**
 * Generate unique session token
 */
export const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create session object
 */
export const createSession = (req, jwtToken) => {
  return {
    token: generateSessionToken(),
    deviceInfo: getDeviceInfo(req),
    ipAddress: getIpAddress(req),
    location: 'Unknown',
    loginTime: new Date(),
    lastActivity: new Date(),
    isActive: true,
    jwtToken: jwtToken,
  };
};

/**
 * Clean up expired sessions (older than 7 days)
 */
export const cleanExpiredSessions = (sessions) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  return sessions.filter(session => 
    session.isActive && new Date(session.lastActivity) > sevenDaysAgo
  );
};