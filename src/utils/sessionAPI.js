// src/utils/sessionAPI.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Get authorization headers with token
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

/**
 * Fetch all active sessions for current user
 */
export const fetchActiveSessions = async () => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/auth/sessions`,
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to fetch sessions' };
  }
};

/**
 * Logout from a specific session
 */
export const logoutSession = async (sessionToken) => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/logout-session`,
      { sessionToken },
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to logout session' };
  }
};

/**
 * Logout from all devices except current
 */
export const logoutAllDevices = async () => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/logout-all-devices`,
      {},
      getAuthHeaders()
    );
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: 'Failed to logout from all devices' };
  }
};

/**
 * Logout from current session (complete logout)
 */
export const logout = async () => {
  try {
    const sessionToken = localStorage.getItem('sessionToken');
    
    if (sessionToken) {
      // Logout from current session on backend
      await logoutSession(sessionToken);
    }
    
    // Clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('studentInfo');
    localStorage.removeItem('teacherInfo');
    localStorage.removeItem('adminInfo');
    
    return { success: true };
  } catch (error) {
    // Even if backend call fails, clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('studentInfo');
    localStorage.removeItem('teacherInfo');
    localStorage.removeItem('adminInfo');
    
    throw error;
  }
};