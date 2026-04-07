import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const token = sessionStorage.getItem('teacherToken') || localStorage.getItem('teacherToken');

      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await api.get('/auth/verify');
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Token verification failed:', error);
        sessionStorage.removeItem('teacherToken');
        sessionStorage.removeItem('teacherInfo');
        localStorage.removeItem('teacherToken');
        localStorage.removeItem('teacherInfo');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/teacher/login" replace />;
}