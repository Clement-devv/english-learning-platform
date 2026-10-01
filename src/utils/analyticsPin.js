// src/utils/analyticsPin.js
// Session-scoped storage for the admin analytics-PIN unlock token.
// The token lives in sessionStorage so it disappears when the tab closes,
// and is cleared on logout (AuthContext) or when the server rejects it.

const KEY = "analyticsUnlock";
export const ANALYTICS_UNLOCK_HEADER = "x-analytics-unlock";

export function getAnalyticsUnlock() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (!token || Date.now() >= expiresAt) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function setAnalyticsUnlock(token, expiresInSeconds) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token, expiresAt: Date.now() + expiresInSeconds * 1000 }));
  } catch { /* storage unavailable — PIN will be asked again */ }
}

export function clearAnalyticsUnlock() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

// Only analytics-related requests carry the unlock token.
export const needsAnalyticsUnlock = (url = "") =>
  url.startsWith("/analytics") || url.startsWith("/admin/analytics-pin");
