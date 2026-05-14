// src/utils/authStorage.js
// Single source of truth for auth storage keys and helpers.
// Used by AuthGuard (verification) and AuthContext (state).
// Never import localStorage/sessionStorage auth keys from anywhere else.

/** Per-role storage and routing config */
export const ROLE_CONFIG = {
  teacher: {
    tokenKey:        'teacherToken',
    sessionTokenKey: 'teacherSessionToken',
    infoKey:         'teacherInfo',
    loginPath:       '/teacher/login',
    verifyPath:      '/auth/verify',
  },
  student: {
    tokenKey:        'studentToken',
    sessionTokenKey: 'studentSessionToken',
    infoKey:         'studentInfo',
    loginPath:       '/student/login',
    verifyPath:      '/auth/student/verify',
  },
  admin: {
    tokenKey:        'adminToken',
    sessionTokenKey: 'adminSessionToken',
    infoKey:         'adminInfo',
    loginPath:       '/admin/login',
    verifyPath:      '/auth/admin/verify',
  },
  'sub-admin': {
    tokenKey:   'subAdminToken',
    infoKey:    'subAdminInfo',
    loginPath:  '/sub-admin/login',
    clientSide: true, // verified via JWT exp decode — no network request
  },
  'super-admin': {
    tokenKey:  'superAdminToken',
    infoKey:   'superAdminInfo',
    loginPath: '/super-admin/login',
    verifyPath: '/super-admin/stats',
    localOnly:  true, // token stored in localStorage only (not sessionStorage)
  },
  parent: {
    tokenKey:  'parentToken',
    infoKey:   'parentInfo',
    loginPath: '/parent/login',
    verifyPath: '/parents/verify',
  },
};

/**
 * Read a value from sessionStorage with localStorage fallback.
 * @param {string} key
 * @param {boolean} [localOnly] - Skip sessionStorage (super-admin pattern).
 * @returns {string|null}
 */
export function readStorage(key, localOnly = false) {
  if (localOnly) return localStorage.getItem(key);
  return sessionStorage.getItem(key) || localStorage.getItem(key) || null;
}

/**
 * Get the stored auth token for a role.
 * @param {string} role
 * @returns {string|null}
 */
export function getStoredToken(role) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return null;
  return readStorage(cfg.tokenKey, cfg.localOnly);
}

/**
 * Get the parsed user info object for a role.
 * @param {string} role
 * @returns {object|null}
 */
export function getStoredUser(role) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return null;
  try {
    const raw = readStorage(cfg.infoKey, cfg.localOnly);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Detect which role is currently logged in by checking all token keys.
 * @returns {string|null} Role string, or null if no active session.
 */
export function detectActiveRole() {
  for (const [role, cfg] of Object.entries(ROLE_CONFIG)) {
    if (readStorage(cfg.tokenKey, cfg.localOnly)) return role;
  }
  return null;
}

/**
 * Persist updated user info to the same storage tier already in use.
 * @param {string} role
 * @param {object} info
 */
export function saveUserInfo(role, info) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return;
  const value = JSON.stringify(info);
  // Keep localOnly roles in localStorage; others keep their current tier
  if (cfg.localOnly || !sessionStorage.getItem(cfg.infoKey)) {
    localStorage.setItem(cfg.infoKey, value);
  } else {
    sessionStorage.setItem(cfg.infoKey, value);
  }
}

/**
 * Remove all auth storage for a role (both tiers), including session token.
 * @param {string} role
 */
export function clearAuth(role) {
  const cfg = ROLE_CONFIG[role];
  if (!cfg) return;
  sessionStorage.removeItem(cfg.tokenKey);
  sessionStorage.removeItem(cfg.infoKey);
  localStorage.removeItem(cfg.tokenKey);
  localStorage.removeItem(cfg.infoKey);
  if (cfg.sessionTokenKey) {
    sessionStorage.removeItem(cfg.sessionTokenKey);
    localStorage.removeItem(cfg.sessionTokenKey);
  }
}
