import axios from "axios";
import { getCachedCenter } from "./utils/branding";
import { getAnalyticsUnlock, needsAnalyticsUnlock, ANALYTICS_UNLOCK_HEADER } from "./utils/analyticsPin";
import { deviceLoginHeaders, signRenewal } from "./utils/deviceKey";
import { wipeDeviceAndSignOut } from "./utils/deviceWipe";

const _apiUrl = import.meta.env.VITE_API_URL;
if (!_apiUrl && import.meta.env.PROD) {
  // Fail loudly in production rather than silently pointing at localhost
  console.error("❌ VITE_API_URL is not set. All API calls will fail in production. Set this environment variable in your build pipeline.");
}

const BASE_URL = (_apiUrl || "http://localhost:5000") + "/api/v1";

const api = axios.create({ baseURL: BASE_URL });

// Token helpers — tokens are written to sessionStorage on login so they are
// cleared when the tab closes (reducing XSS exposure vs. localStorage).
// localStorage is never read — if a legacy token exists there it gets wiped
// on the next removeToken call (logout / 401) to force a clean re-login.
const getToken = (key) => sessionStorage.getItem(key);

const removeToken = (key) => {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key); // wipe any legacy tokens from older app versions
};

// Every center role signs in with a short-lived token plus a device-bound
// session token used to renew it.
const SESSIONS = [
  { role: "admin",     tokenKey: "adminToken",    sessionKey: "adminSessionToken",    infoKey: "adminInfo",    loginPath: "/admin/login" },
  { role: "sub-admin", tokenKey: "subAdminToken", sessionKey: "subAdminSessionToken", infoKey: "subAdminInfo", loginPath: "/sub-admin/login" },
  { role: "teacher",   tokenKey: "teacherToken",  sessionKey: "teacherSessionToken",  infoKey: "teacherInfo",  loginPath: "/teacher/login" },
  { role: "student",   tokenKey: "studentToken",  sessionKey: "studentSessionToken",  infoKey: "studentInfo",  loginPath: "/student/login" },
  { role: "parent",    tokenKey: "parentToken",   sessionKey: "parentSessionToken",   infoKey: "parentInfo",   loginPath: "/parent/login" },
];

// Detect which role is currently logged in and return all relevant keys.
function getActiveSession() {
  return SESSIONS.find(s => sessionStorage.getItem(s.infoKey) && getToken(s.tokenKey))
      || SESSIONS.find(s => getToken(s.tokenKey)) // fallback: whichever token exists
      || null;
}

// Login requests carry this browser's device key so the session is bound to it
const LOGIN_URL_RE = /(\/auth\/(admin|teacher|student)\/login|\/auth\/verify-2fa-login|\/sub-admin-auth\/login|\/parents\/login)$/;

// Which center the request is for. Priority:
//   1. Super admin impersonation session (overrides everything)
//   2. Dev-only env var (only active during `vite dev`, never in prod builds)
//   3. Subdomain (mannie-english.clemify.com) — API calls go to clemify.com,
//      so the server can't detect the center from Host
//   4. Cached center slug (populated after first branding fetch)
// In production with custom domains the server reads the Host header instead,
// so we must NOT hardcode a slug that would override that routing.
function resolveCenterSlug() {
  const impersonationSlug = sessionStorage.getItem('impersonationCenterSlug');
  const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_CENTER_SLUG || null) : null;
  const h = window.location.hostname;
  const subdomainSlug = h.endsWith('.clemify.com') ? h.replace(/\.clemify\.com$/, '') : null;
  return impersonationSlug || devSlug || subdomainSlug || getCachedCenter()?.slug || null;
}

// Add token + center slug to all requests automatically.
// The interceptor is async so it can proactively refresh an expiring token
// before the request leaves — this eliminates the 401 console noise that the
// reactive-only approach produced.
api.interceptors.request.use(
  async (config) => {
    if (!config.headers.Authorization) {
      const session = getActiveSession();
      if (session) {
        let token = getToken(session.tokenKey);

        // Proactive refresh: token expires within 90 s AND we have a session key
        // (sub-admins use a 7-day token with no refresh endpoint, so skip them).
        if (token && session.sessionKey && getToken(session.sessionKey) && isTokenExpiringSoon(token)) {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              token = await attemptRefresh(session);
              processRefreshQueue(token, null);
            } catch (e) {
              processRefreshQueue(null, e);
              // Fall through — the response interceptor will handle the resulting 401
            } finally {
              isRefreshing = false;
            }
          } else {
            // Another request is already refreshing — wait for it
            try {
              token = await new Promise((resolve, reject) => {
                refreshQueue.push({ resolve, reject });
              });
            } catch {
              // Use whatever token we have; response interceptor is the safety net
            }
          }
          // Re-read in case attemptRefresh stored a new value but threw before returning
          token = token || getToken(session.tokenKey);
        }

        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    }

    // Send x-center-slug header so tenantMiddleware can identify the center.
    const slug = resolveCenterSlug();
    if (slug) config.headers["x-center-slug"] = slug;

    // Bind new login sessions to this browser's device key
    if (config.method === "post" && LOGIN_URL_RE.test(config.url || "")) {
      try { Object.assign(config.headers, await deviceLoginHeaders()); } catch { /* unbound session */ }
    }

    // Admin analytics PIN: attach the session unlock token to analytics calls
    if (needsAnalyticsUnlock(config.url)) {
      const unlock = getAnalyticsUnlock();
      if (unlock) config.headers[ANALYTICS_UNLOCK_HEADER] = unlock;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Token refresh logic ───────────────────────────────────────────────────────
// Strategy: PROACTIVE refresh in the request interceptor + REACTIVE fallback in
// the response interceptor.
//
// Proactive: before a request leaves, decode the JWT and check the exp field.
// If less than 90 seconds remain we refresh first so the request goes out with
// a fresh token — no 401 is ever generated and nothing appears in the console.
//
// Reactive (fallback): if a 401 still arrives (e.g. the clock drifted or the
// token was already expired when the tab was restored from the background) we
// refresh silently and retry once, exactly as before.

let isRefreshing = false;
let refreshQueue = []; // pending requests waiting for the new token

// Decode the JWT payload and return true if the token expires within thresholdMs.
function isTokenExpiringSoon(token, thresholdMs = 90_000) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && (payload.exp * 1000 - Date.now()) < thresholdMs;
  } catch {
    return false;
  }
}

function processRefreshQueue(newToken, error) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newToken);
  });
  refreshQueue = [];
}

async function attemptRefresh(session) {
  const expiredToken = getToken(session.tokenKey);
  const sessionToken = getToken(session.sessionKey);
  // Same center resolution as every other request — previously the subdomain
  // was missing here, so refreshes failed on *.clemify.com
  const slug = resolveCenterSlug();

  const headers = {};
  if (slug) headers["x-center-slug"] = slug;

  // Prove the renewal comes from the device this session was created on
  let deviceProof = null;
  try { deviceProof = await signRenewal(sessionToken); } catch { /* unbound session */ }

  try {
    const response = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { sessionToken, expiredToken, deviceProof },
      { headers }
    );
    const newToken = response.data.token;
    sessionStorage.setItem(session.tokenKey, newToken);
    return newToken;
  } catch (err) {
    // Signed out from another device, or the session belongs to another
    // device: erase this app's data here and go to the login page.
    if (err?.response?.data?.code === "SESSION_REVOKED") {
      wipeDeviceAndSignOut({ role: session.role, reason: "remote" });
    }
    throw err;
  }
}

// Reactive fallback: handle any 401 that still slips through (clock skew, tab
// restored from background with an already-expired token, etc.).
// Never auto-logout on auth endpoints — a login 401 for wrong password must not
// redirect to the login page.
const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password", "/verify-invite", "/setup-account", "/verify-2fa", "/auth/refresh"];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url || "";
    const isAuthEndpoint = AUTH_PATHS.some((p) => url.includes(p));
    const status = error.response?.status;

    // 401 on a non-auth endpoint — try to refresh the access token silently
    if (status === 401 && !isAuthEndpoint && !error.config._isRetry) {
      const session = getActiveSession();

      if (session && getToken(session.sessionKey)) {
        // If another request is already refreshing, queue this one
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          }).then((newToken) => {
            error.config._isRetry = true;
            error.config.headers.Authorization = `Bearer ${newToken}`;
            return api(error.config);
          });
        }

        isRefreshing = true;
        try {
          const newToken = await attemptRefresh(session);
          processRefreshQueue(newToken, null);
          error.config._isRetry = true;
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return api(error.config);
        } catch (_refreshError) {
          processRefreshQueue(null, _refreshError);
          // Session ended from another device — attemptRefresh is already
          // erasing this device's data and will redirect when done.
          if (_refreshError?.response?.data?.code === "SESSION_REVOKED") {
            return Promise.reject(error);
          }
          // Refresh failed — clear storage and redirect to login
          removeToken(session.tokenKey);
          removeToken(session.sessionKey);
          removeToken(session.infoKey);
          localStorage.removeItem('pwa-last-role');
          window.location.href = session.loginPath;
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      }

      // No session token available — just redirect
      if (session) {
        removeToken(session.tokenKey);
        removeToken(session.sessionKey);
        removeToken(session.infoKey);
        localStorage.removeItem('pwa-last-role');
        window.location.href = session.loginPath;
      }
      return Promise.reject(error);
    }

    // 403 — authenticated but not authorised for this resource
    if (status === 403) {
      error.userMessage = "You don't have permission to perform this action.";
      return Promise.reject(error);
    }

    // 429 — rate limited
    if (status === 429) {
      error.userMessage = "Too many requests. Please wait a moment and try again.";
      return Promise.reject(error);
    }

    // 500 / 502 / 503 — server-side failure; don't expose raw message
    if (status >= 500) {
      error.userMessage = "A server error occurred. Please try again later.";
      return Promise.reject(error);
    }

    // Network error (no response at all — offline, DNS failure, CORS block)
    if (!error.response) {
      error.userMessage = "Unable to reach the server. Check your internet connection.";
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// Exported so RingContext (and other non-HTTP clients) can silently refresh
// the access token without duplicating the refresh logic.
// Concurrent callers share one in-flight refresh.
let externalRefresh = null;
export async function refreshToken() {
  const session = getActiveSession();
  if (!session?.sessionKey || !getToken(session.sessionKey)) return null;
  if (!externalRefresh) {
    externalRefresh = attemptRefresh(session)
      .catch(() => null)
      .finally(() => { externalRefresh = null; });
  }
  return externalRefresh;
}

/** True when the JWT expires within thresholdMs (or can't be read). */
export function tokenExpiresSoon(token, thresholdMs = 90_000) {
  return !token || isTokenExpiringSoon(token, thresholdMs);
}

export default api;
