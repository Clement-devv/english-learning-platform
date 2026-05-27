// src/context/AuthContext.jsx
// Global auth state — prevents 48+ scattered localStorage reads across components.
//
// Provides: user, role, token, login(), logout(), setUser()
//
// Usage:
//   const { user, role } = useAuth();                    // read current user
//   const { login } = useAuth(); login('admin', info, tok); // after successful API login
//   const { setUser } = useAuth(); setUser({ firstName: 'New' }); // after profile edit
//   const { logout } = useAuth();                         // clears storage + state
//
// AuthProvider must sit inside <Router> (login() navigates to the login page on logout).

import { createContext, useCallback, useContext, useState } from 'react';
import api from '../api.js';
import {
  detectActiveRole,
  getStoredUser,
  getStoredToken,
  saveUserInfo,
  clearAuth,
  ROLE_CONFIG,
} from '../utils/authStorage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role,  setRole]  = useState(detectActiveRole);
  const [user,  setUserState] = useState(() => getStoredUser(detectActiveRole()));
  const [token, setToken] = useState(() => getStoredToken(detectActiveRole()));

  /**
   * Call immediately after a successful login API response.
   * Stores the token/info (the login page does the actual write),
   * then syncs React state so every useAuth() consumer updates instantly.
   * @param {string} newRole
   * @param {object} userInfo - The parsed user info object.
   * @param {string} authToken
   */
  const login = useCallback((newRole, userInfo, authToken) => {
    setRole(newRole);
    setUserState(userInfo);
    setToken(authToken);
    localStorage.setItem('pwa-last-role', newRole);
  }, []);

  /**
   * Merge partial updates into the user object and persist to storage.
   * Use after profile edits so every component sees the update immediately
   * without needing to re-read from storage.
   * @param {object} updates - Fields to merge into the current user.
   */
  const setUser = useCallback((updates) => {
    setUserState((prev) => {
      const merged = { ...prev, ...updates };
      if (role) saveUserInfo(role, merged);
      return merged;
    });
  }, [role]);

  /**
   * Clear all auth storage for the current role and reset context state.
   * Also blacklists the JWT server-side (fire and forget).
   * Does NOT navigate — callers should redirect after calling logout().
   */
  const logout = useCallback(() => {
    if (role) {
      const cfg = ROLE_CONFIG[role];
      if (cfg?.sessionTokenKey) {
        const sessionToken = sessionStorage.getItem(cfg.sessionTokenKey) || localStorage.getItem(cfg.sessionTokenKey);
        const currentToken = getStoredToken(role);
        if (sessionToken && currentToken) {
          // Route to the per-role logout endpoint.  Teacher/student/admin/
          // sub-admin/parent share /auth/logout-session (center-scoped via
          // tenantMiddleware); super-admin uses /super-admin/logout-session
          // because it lives in the master DB.
          const endpoint = cfg.logoutEndpoint || '/auth/logout-session';
          // Explicitly set the Authorization header so the async request interceptor
          // doesn't try to read it from sessionStorage — clearAuth() below wipes
          // storage synchronously before the interceptor's microtask runs.
          api.post(endpoint, { sessionToken }, {
            headers: { Authorization: `Bearer ${currentToken}` },
          }).catch(() => {});
        }
      }
      clearAuth(role);
    }
    localStorage.removeItem('pwa-last-role');
    setRole(null);
    setUserState(null);
    setToken(null);
  }, [role]);

  return (
    <AuthContext.Provider value={{ user, role, token, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * @returns {{ user: object|null, role: string|null, token: string|null,
 *   login: (role: string, user: object, token: string) => void,
 *   logout: () => void,
 *   setUser: (updates: object) => void }}
 */
const AUTH_FALLBACK = {
  user: null, role: null, token: null,
  login: () => {}, logout: () => {}, setUser: () => {},
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  // Return safe defaults rather than throwing — prevents crashes during
  // React 19 error replays and Vite HMR dual-module-instance edge cases.
  // Components that strictly require auth should redirect via AuthGuard instead.
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn('[useAuth] AuthContext is null — AuthProvider may not be in the tree, or a Vite HMR dual-module issue occurred. Returning safe defaults.');
    }
    return AUTH_FALLBACK;
  }
  return ctx;
}

/** Convenience — true if the current user has any of the given roles */
export function useHasRole(...roles) {
  const { role } = useAuth();
  return roles.includes(role);
}

// Re-export for convenience — consumers can do:
//   import { useAuth, ROLE_CONFIG } from '../context/AuthContext';
export { ROLE_CONFIG };
