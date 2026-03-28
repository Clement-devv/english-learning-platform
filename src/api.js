import axios from "axios";
import { getCachedCenter } from "./utils/branding";

const _apiUrl = import.meta.env.VITE_API_URL;
if (!_apiUrl && import.meta.env.PROD) {
  // Fail loudly in production rather than silently pointing at localhost
  console.error("❌ VITE_API_URL is not set. All API calls will fail in production. Set this environment variable in your build pipeline.");
}

const api = axios.create({
  baseURL: _apiUrl || "http://localhost:5000",
});

// Token helpers — prefer sessionStorage (cleared on tab close), fall back to
// localStorage for users who chose "remember me". Never store in cookies
// without the HttpOnly flag.
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

    // Always send the center slug so tenantMiddleware can identify the center.
    // In production this is also derived from the subdomain, but sending the
    // header is the reliable fallback for dev, mobile apps, and API clients.
    const slug = import.meta.env.VITE_CENTER_SLUG || getCachedCenter()?.slug;
    if (slug) {
      config.headers["x-center-slug"] = slug;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (getToken("adminToken")) {
        removeToken("adminToken");
        removeToken("adminInfo");
        window.location.href = "/admin/login";
      } else if (getToken("teacherToken")) {
        removeToken("teacherToken");
        removeToken("teacherInfo");
        window.location.href = "/teacher/login";
      } else if (getToken("studentToken")) {
        removeToken("studentToken");
        removeToken("studentInfo");
        window.location.href = "/student/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
