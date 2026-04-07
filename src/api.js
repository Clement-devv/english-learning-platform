import axios from "axios";
import { getCachedCenter } from "./utils/branding";

const _apiUrl = import.meta.env.VITE_API_URL;
if (!_apiUrl && import.meta.env.PROD) {
  // Fail loudly in production rather than silently pointing at localhost
  console.error("❌ VITE_API_URL is not set. All API calls will fail in production. Set this environment variable in your build pipeline.");
}

const api = axios.create({
  baseURL: (_apiUrl || "http://localhost:5000") + "/api/v1",
});

// Token helpers — tokens are written to sessionStorage on login so they are
// cleared when the tab closes (reducing XSS exposure vs. localStorage).
// The localStorage fallback handles tokens that were stored by an older
// version of the app; new logins always use sessionStorage.
const getToken = (key) =>
  sessionStorage.getItem(key) || localStorage.getItem(key);

const removeToken = (key) => {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
};

// Add token + center slug to all requests automatically
api.interceptors.request.use(
  (config) => {
    const token =
      getToken("adminToken") ||
      getToken("teacherToken") ||
      getToken("studentToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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

// Handle token expiration — but never auto-logout on auth endpoints themselves
// (login returning 401 for wrong password must not redirect to login page)
const AUTH_PATHS = ["/login", "/forgot-password", "/reset-password", "/verify-invite", "/setup-account", "/verify-2fa"];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isAuthEndpoint = AUTH_PATHS.some((p) => url.includes(p));
    const status = error.response?.status;

    // 401 — session expired or token revoked: clear storage and redirect to login
    if (status === 401 && !isAuthEndpoint) {
      if (getToken("adminToken")) {
        removeToken("adminToken");
        removeToken("adminSessionToken");
        removeToken("adminInfo");
        window.location.href = "/admin/login";
      } else if (getToken("teacherToken")) {
        removeToken("teacherToken");
        removeToken("teacherSessionToken");
        removeToken("teacherInfo");
        window.location.href = "/teacher/login";
      } else if (getToken("studentToken")) {
        removeToken("studentToken");
        removeToken("studentSessionToken");
        removeToken("studentInfo");
        window.location.href = "/student/login";
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
