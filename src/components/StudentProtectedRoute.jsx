// src/components/StudentProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api'; // Use your api instance

export default function StudentProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const token = sessionStorage.getItem('studentToken') || localStorage.getItem('studentToken');
      
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        // Verify the token against the backend — checks expiry, revocation, and active status
        await api.get('/api/auth/student/verify');
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Student token verification failed:', error);
        sessionStorage.removeItem('studentToken');
        localStorage.removeItem('studentToken');
        sessionStorage.removeItem('studentInfo');
        localStorage.removeItem('studentInfo');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/student/login" replace />;
}