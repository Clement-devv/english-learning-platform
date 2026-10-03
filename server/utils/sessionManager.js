// utils/sessionManager.js
import { UAParser } from "ua-parser-js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { SESSION_LIMIT, SESSION_EXPIRY_DAYS } from "../config/constants.js";
import { addToLocalBlacklist } from "../middleware/authMiddleware.js";
import redisClient from "../config/redis.js";
import logger from "./logger.js";

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
// req.ip honours Express "trust proxy" (TRUST_PROXY=true behind Caddy), so it
// is the real client IP. Reading X-Forwarded-For directly let any client put a
// fake IP in its session list and in the new-device alert email.
export const getIpAddress = (req) => {
  return req.ip ||
         req.socket?.remoteAddress ||
         'Unknown';
};

/**
 * Generate unique session token
 */
export const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// ── Device binding ────────────────────────────────────────────────────────────

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const B64URL_RE    = /^[A-Za-z0-9_-]{40,48}$/; // 32-byte P-256 coordinate
const PROOF_MAX_SKEW_MS = 2 * 60 * 1000;

/**
 * Read the device identity the browser sends with a login request:
 *   x-device-id  — random id (not secret)
 *   x-device-key — base64url(JSON) of an EC P-256 public JWK
 * Returns { deviceId, devicePublicKey } with nulls when absent/invalid
 * (insecure http, very old browser) — the session is then "unbound".
 */
export const readDeviceBinding = (req) => {
  const deviceId = String(req.headers['x-device-id'] || '');
  const raw      = String(req.headers['x-device-key'] || '');
  let devicePublicKey = null;
  if (raw && raw.length < 1000) {
    try {
      const jwk = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
      if (jwk?.kty === 'EC' && jwk.crv === 'P-256' && B64URL_RE.test(jwk.x || '') && B64URL_RE.test(jwk.y || '') && !jwk.d) {
        devicePublicKey = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
      }
    } catch { /* ignore malformed key */ }
  }
  return {
    deviceId: DEVICE_ID_RE.test(deviceId) ? deviceId : null,
    devicePublicKey,
  };
};

/**
 * Check that a renewal request comes from the device the session was created
 * on.
 *  - Bound session: body.deviceProof = { ts, sig } where sig is the device
 *    key's ECDSA P-256/SHA-256 signature (raw r||s, base64url) over
 *    `${sessionToken}.${ts}`. The private key cannot be exported from the
 *    browser, so a copied session cannot produce it elsewhere.
 *  - Unbound (legacy) session: same browser + operating system as at login.
 * @returns {{ ok: boolean, reason?: string }}
 */
export const verifyDeviceProof = (session, req, sessionToken) => {
  if (session.devicePublicKey) {
    const proof = req.body?.deviceProof;
    const ts    = Number(proof?.ts);
    if (!proof?.sig || !Number.isFinite(ts)) return { ok: false, reason: 'missing-proof' };
    if (Math.abs(Date.now() - ts) > PROOF_MAX_SKEW_MS) return { ok: false, reason: 'stale-proof' };
    try {
      const key = crypto.createPublicKey({ key: session.devicePublicKey, format: 'jwk' });
      const ok  = crypto.verify(
        'sha256',
        Buffer.from(`${sessionToken}.${ts}`),
        { key, dsaEncoding: 'ieee-p1363' },
        Buffer.from(String(proof.sig), 'base64url'),
      );
      return ok ? { ok: true } : { ok: false, reason: 'bad-signature' };
    } catch {
      return { ok: false, reason: 'bad-signature' };
    }
  }

  // Unbound: compare browser + OS names (versions change with updates)
  const now  = getDeviceInfo(req);
  const name = (s) => String(s || '').replace(/\s+[\d.]+$/, '').trim().toLowerCase();
  const was  = session.deviceInfo || {};
  if (name(now.browser) !== name(was.browser) || name(now.os) !== name(was.os)) {
    return { ok: false, reason: 'device-changed' };
  }
  return { ok: true };
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
    ...readDeviceBinding(req),
  };
};

/**
 * Start a new device session for a user and sign its JWT.
 * The session id is created first so it can go into the JWT as `sid` — that
 * lets the server and the live connection tell which device a token belongs
 * to (current-device marker, remote logout).
 *
 * @param {object}   req
 * @param {object}   user     Mongoose user doc with a `sessions` array
 * @param {Function} signJwt  (sid: string) => signed JWT
 * @returns {{ token: string, session: object }}  caller must `await user.save()`
 */
export const startSession = (req, user, signJwt) => {
  const _id   = new mongoose.Types.ObjectId();
  const token = signJwt(_id.toString());
  const session = { _id, ...createSession(req, token) };
  user.sessions = cleanExpiredSessions(user.sessions || []);
  user.sessions.push(session);
  user.sessions = pruneSessionsToLimit(user.sessions);
  const isNewDevice = rememberDevice(user, session);
  return { token, session, isNewDevice };
};

// ── Known devices / new-device alert ─────────────────────────────────────────

const MAX_KNOWN_DEVICES = 20;
const uaName = (s) => String(s || '').replace(/\s+[\d.]+$/, '').trim().toLowerCase();

/** Stable key for "this device": its device id, else browser + OS names */
const deviceKeyOf = (session) =>
  session.deviceId || `ua:${uaName(session.deviceInfo?.browser)}|${uaName(session.deviceInfo?.os)}`;

/**
 * Record the device on the user doc. Returns true when it is a device this
 * account has not used before. The very first device we ever record is NOT
 * "new" (that's just the account's normal device — also avoids emailing
 * everyone the first time they log in after this feature shipped).
 */
const rememberDevice = (user, session) => {
  const key   = deviceKeyOf(session);
  const list  = Array.isArray(user.knownDevices) ? user.knownDevices : [];
  const known = list.find(d => d.key === key);
  const now   = new Date();
  if (known) {
    known.lastSeen = now;
    return false;
  }
  const firstEver = list.length === 0;
  list.push({ key, firstSeen: now, lastSeen: now });
  user.knownDevices = list
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen))
    .slice(0, MAX_KNOWN_DEVICES);
  return !firstEver;
};

/**
 * Email the user about a sign-in from a new device (fire-and-forget).
 * Call after the user doc is saved.
 */
export const alertNewDevice = ({ req, user, role, session, isNewDevice }) => {
  if (!isNewDevice || !user?.email) return;
  import('./emailService.js')
    .then(({ sendNewDeviceSignInEmail }) => sendNewDeviceSignInEmail({
      email:      user.email,
      name:       user.firstName || user.name || '',
      role,
      center:     req.center,
      centerName: req.center?.centerName || '',
      device:     session.deviceInfo,
      ipAddress:  session.ipAddress,
      when:       session.loginTime,
    }))
    .catch(err => logger.warn('New-device email failed:', { error: err?.message }));
};

/** Add a JWT to the revocation blacklist (in-memory now, Redis for other instances) */
export const blacklistJwt = async (jwtToken) => {
  if (!jwtToken) return;
  addToLocalBlacklist(jwtToken);
  if (!redisClient) return;
  try {
    const decoded = jwt.decode(jwtToken);
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;
    if (ttl > 0) await redisClient.setex(`bl:${jwtToken.split('.')[2]}`, ttl, '1');
  } catch (err) {
    logger.warn('blacklistJwt redis error:', { error: err?.message });
  }
};

/**
 * End one session: mark it inactive, revoke its JWT and drop its push
 * subscription. Does NOT save — caller saves the user doc.
 */
export const endSession = async (session, reason) => {
  session.isActive         = false;
  session.revokedAt        = new Date();
  session.revokedReason    = reason;
  session.pushSubscription = null;
  await blacklistJwt(session.jwtToken);
};

/** Id of the device session the request's bearer token belongs to (or null). */
export const currentSessionIdOf = (user, req) => {
  const token = req.headers?.authorization?.split(' ')[1];
  if (!token) return null;
  const sid = jwt.decode(token)?.sid;
  const s = (sid && (user.sessions || []).find(x => String(x._id) === String(sid)))
         || (user.sessions || []).find(x => x.jwtToken === token);
  return s ? String(s._id) : null;
};

/**
 * After a password change or reset, end every signed-in device so a stolen
 * session (refresh token) stops working — otherwise it keeps renewing for
 * SESSION_EXPIRY_DAYS even though the password changed.
 *
 *   keepCurrent: true  → the person changed their own password while logged
 *                        in; their current device stays signed in.
 *
 * Marks sessions inactive and revokes their JWTs. Does NOT save — call
 * `await user.save()` then `notifySessionsRevoked(io, slug, user._id, ended)`.
 * @returns {Promise<string[]>} ids of the sessions that were ended
 */
export const endSessionsAfterPasswordChange = async (user, req, { keepCurrent = false } = {}) => {
  const keep  = keepCurrent ? currentSessionIdOf(user, req) : null;
  const ended = [];
  for (const s of user.sessions || []) {
    if (!s.isActive || (keep && String(s._id) === keep)) continue;
    await endSession(s, 'password-changed');
    ended.push(String(s._id));
  }
  return ended;
};

/**
 * Tell the signed-out device(s) over the live connection so they wipe their
 * data and return to the login page right away, then drop those sockets.
 * Safe to call when sockets are not available.
 */
export const notifySessionsRevoked = async (io, centerSlug, userId, sessionIds) => {
  if (!io || !sessionIds?.length) return;
  const sids = new Set(sessionIds.map(String));
  const room = `user-room:${centerSlug}:${userId}`;
  try {
    const sockets = await io.in(room).fetchSockets();
    for (const s of sockets) {
      if (s.data?.sid && sids.has(String(s.data.sid))) {
        s.emit('session-revoked', { sid: s.data.sid });
        s.disconnect(true);
      }
    }
  } catch (err) {
    logger.warn('notifySessionsRevoked error:', { error: err?.message });
  }
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
    db.collection('teachers').updateMany({},  pull),
    db.collection('students').updateMany({},  pull),
    db.collection('admins').updateMany({},    pull),
    db.collection('subadmins').updateMany({}, pull),
    db.collection('parents').updateMany({},   pull),
  ]);
};