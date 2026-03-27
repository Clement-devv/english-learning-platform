import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
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

// Add token to all requests automatically
api.interceptors.request.use(
  (config) => {
    const token =
      getToken("adminToken") ||
      getToken("teacherToken") ||
      getToken("studentToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
