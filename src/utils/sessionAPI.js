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
 * Fetch all active sessions for the current user.
 * @returns {Promise<object>} Server response containing the sessions array.
 * @throws {object} Error payload from the server, or `{ message: 'Failed to fetch sessions' }`.
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
 * Logout from a specific session by its token.
 * @param {string} sessionToken - The session token to invalidate.
 * @returns {Promise<object>} Server confirmation response.
 * @throws {object} Error payload from the server, or `{ message: 'Failed to logout session' }`.
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
 * Logout from all devices except the current one.
 * @returns {Promise<object>} Server confirmation response.
 * @throws {object} Error payload from the server, or `{ message: 'Failed to logout from all devices' }`.
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
 * Full logout: invalidates the current session on the server and clears all local storage.
 * Falls through to clear local storage even if the server call fails.
 * @returns {Promise<{ success: true }>}
 * @throws {object} Server error payload if the backend call fails.
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