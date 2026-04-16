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
  if (sessionStorage.getItem("teacherInfo") && getToken("teacherToken")) {
    return { tokenKey: "teacherToken", sessionKey: "teacherSessionToken", infoKey: "teacherInfo", loginPath: "/teacher/login" };
  }
  if (sessionStorage.getItem("studentInfo") && getToken("studentToken")) {
    return { tokenKey: "studentToken", sessionKey: "studentSessionToken", infoKey: "studentInfo", loginPath: "/student/login" };
  }
  // Fallback: whichever token exists
  if (getToken("adminToken"))   return { tokenKey: "adminToken",   sessionKey: "adminSessionToken",   infoKey: "adminInfo",   loginPath: "/admin/login" };
  if (getToken("teacherToken")) return { tokenKey: "teacherToken", sessionKey: "teacherSessionToken", infoKey: "teacherInfo", loginPath: "/teacher/login" };
  if (getToken("studentToken")) return { tokenKey: "studentToken", sessionKey: "studentSessionToken", infoKey: "studentInfo", loginPath: "/student/login" };
  return null;
}

// Add token + center slug to all requests automatically
api.interceptors.request.use(
  (config) => {
    const session = getActiveSession();
    if (session) {
      config.headers.Authorization = `Bearer ${getToken(session.tokenKey)}`;
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
    const slug = impersonationSlug || devSlug || getCachedCenter()?.slug;
    if (slug) {
      config.headers["x-center-slug"] = slug;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Token refresh logic ───────────────────────────────────────────────────────
// When the 15-min access token expires the server returns 401.
// We silently call /auth/refresh with the long-lived sessionToken and retry
// the original request once. If refresh also fails, we clear storage and
// redirect to the login page.

let isRefreshing = false;
let refreshQueue = []; // pending requests waiting for the new token

function processRefreshQueue(newToken, error) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newToken);
  });
  refreshQueue = [];
}

async function attemptRefresh(session) {
  const expiredToken   = getToken(session.tokenKey);
  const sessionToken   = getToken(session.sessionKey);
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

// Handle token expiration — but never auto-logout on auth endpoints themselves
// (login returning 401 for wrong password must not redirect to login page)
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

export default api;
