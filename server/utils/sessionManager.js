// utils/sessionManager.js
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import { SESSION_LIMIT, SESSION_EXPIRY_DAYS } from "../config/constants.js";

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
 * In-memory filter — removes inactive/expired sessions from a user's session array
 * before saving. Runs on login; O(n) where n ≤ SESSION_LIMIT (trivially fast).
 */
export const cleanExpiredSessions = (sessions) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SESSION_EXPIRY_DAYS);
  return sessions.filter(s => s.isActive && new Date(s.lastActivity) > cutoff);
};

/**
 * Keep only the N most recent sessions.
 * Call this after pushing the new session to prevent unbounded growth.
 */
export const pruneSessionsToLimit = (sessions, limit = SESSION_LIMIT) => {
  if (sessions.length <= limit) return sessions;
  return sessions
    .slice()
    .sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime))
    .slice(0, limit);
};

/**
 * Background DB sweep — pulls expired/inactive sessions from every user
 * document across the given center DB. Uses raw MongoDB collections so
 * Mongoose models don't need to be registered first.
 * Call hourly via setInterval for users who never log back in.
 */
export const sweepExpiredSessionsFromDb = async (db) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SESSION_EXPIRY_DAYS);
  const pull = { $pull: { sessions: { $or: [{ isActive: false }, { lastActivity: { $lt: cutoff } }] } } };

  await Promise.all([
    db.collection('teachers').updateMany({}, pull),
    db.collection('students').updateMany({}, pull),
    db.collection('admins').updateMany({},   pull),
  ]);
};