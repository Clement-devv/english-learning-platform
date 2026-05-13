import axios from "axios";
import { getCachedCenter } from "./utils/branding";

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

// Detect which role is currently logged in and return all relevant keys.
function getActiveSession() {
  if (sessionStorage.getItem("adminInfo") && getToken("adminToken")) {
    return { tokenKey: "adminToken", sessionKey: "adminSessionToken", infoKey: "adminInfo", loginPath: "/admin/login" };
  }
  if (sessionStorage.getItem("subAdminInfo") && getToken("subAdminToken")) {
    // Sub-admins use a long-lived 7-day token with no refresh mechanism
    return { tokenKey: "subAdminToken", sessionKey: null, infoKey: "subAdminInfo", loginPath: "/sub-admin/login" };
  }
  if (sessionStorage.getItem("teacherInfo") && getToken("teacherToken")) {
    return { tokenKey: "teacherToken", sessionKey: "teacherSessionToken", infoKey: "teacherInfo", loginPath: "/teacher/login" };
  }
  if (sessionStorage.getItem("studentInfo") && getToken("studentToken")) {
    return { tokenKey: "studentToken", sessionKey: "studentSessionToken", infoKey: "studentInfo", loginPath: "/student/login" };
  }
  if (sessionStorage.getItem("parentInfo") && getToken("parentToken")) {
    return { tokenKey: "parentToken", sessionKey: null, infoKey: "parentInfo", loginPath: "/parent/login" };
  }
  // Fallback: whichever token exists
  if (getToken("adminToken")) return { tokenKey: "adminToken", sessionKey: "adminSessionToken", infoKey: "adminInfo", loginPath: "/admin/login" };
  if (getToken("subAdminToken")) return { tokenKey: "subAdminToken", sessionKey: null, infoKey: "subAdminInfo", loginPath: "/sub-admin/login" };
  if (getToken("teacherToken")) return { tokenKey: "teacherToken", sessionKey: "teacherSessionToken", infoKey: "teacherInfo", loginPath: "/teacher/login" };
  if (getToken("studentToken")) return { tokenKey: "studentToken", sessionKey: "studentSessionToken", infoKey: "studentInfo", loginPath: "/student/login" };
  if (getToken("parentToken")) return { tokenKey: "parentToken", sessionKey: null, infoKey: "parentInfo", loginPath: "/parent/login" };
  return null;
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
    // Priority:
    //   1. Super admin impersonation session (overrides everything)
    //   2. Dev-only env var (only active during `vite dev`, never in prod builds)
    //   3. Cached center slug (populated after first branding fetch)
    // In production with custom domains the server reads the Host header instead,
    // so we must NOT hardcode a slug that would override that routing.
    const impersonationSlug = sessionStorage.getItem('impersonationCenterSlug');
    const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_CENTER_SLUG || null) : null;
    // On subdomains (mannie-english.clemify.com), API calls go to clemify.com
    // so the server can't detect the center from Host. Extract slug from subdomain.
    const subdomainSlug = (() => {
      const h = window.location.hostname;
      if (h.endsWith('.clemify.com')) return h.replace(/\.clemify\.com$/, '');
      return null;
    })();
    const slug = impersonationSlug || devSlug || subdomainSlug || getCachedCenter()?.slug;
    if (slug) config.headers["x-center-slug"] = slug;

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
  const impersonationSlug = sessionStorage.getItem('impersonationCenterSlug');
  const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_CENTER_SLUG || null) : null;
  const slug = impersonationSlug || devSlug || getCachedCenter()?.slug;

  const headers = {};
  if (slug) headers["x-center-slug"] = slug;

  const response = await axios.post(
    `${BASE_URL}/auth/refresh`,
    { sessionToken, expiredToken },
    { headers }
  );

  const newToken = response.data.token;
  sessionStorage.setItem(session.tokenKey, newToken);
  return newToken;
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
export async function refreshToken() {
  const session = getActiveSession();
  if (!session?.sessionKey || !getToken(session.sessionKey)) return null;
  try {
    return await attemptRefresh(session);
  } catch {
    return null;
  }
}

export default api;
