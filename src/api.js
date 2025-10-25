import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000",
});

// Add token to all requests automatically
api.interceptors.request.use(
  (config) => {
    // Check for admin, teacher, or student tokens
    const adminToken = localStorage.getItem('adminToken');
    const teacherToken = localStorage.getItem('teacherToken');
    const studentToken = localStorage.getItem('studentToken');
    
    // Use whichever token exists (priority: admin > teacher > student)
    const token = adminToken || teacherToken || studentToken;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check which type of user is logged in and redirect accordingly
      const adminToken = localStorage.getItem('adminToken');
      const teacherToken = localStorage.getItem('teacherToken');
      const studentToken = localStorage.getItem('studentToken');
      
      if (adminToken) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminInfo');
        window.location.href = '/admin/login';
      } else if (teacherToken) {
        localStorage.removeItem('teacherToken');
        localStorage.removeItem('teacherInfo');
        window.location.href = '/teacher/login';
      } else if (studentToken) {
        localStorage.removeItem('studentToken');
        localStorage.removeItem('studentInfo');
        window.location.href = '/student/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;