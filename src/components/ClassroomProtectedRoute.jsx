// src/components/ClassroomProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

export default function ClassroomProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      // Check for ANY valid token (teacher, student, or sub-admin spectator)
      const teacherToken  = localStorage.getItem('teacherToken');
      const studentToken  = localStorage.getItem('studentToken');
      const subAdminToken = localStorage.getItem('subAdminToken');

      const token = teacherToken || studentToken || subAdminToken;
      
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Verify the token against the correct backend endpoint based on role
        if (teacherToken) {
          await api.get('/api/auth/verify');
        } else if (studentToken) {
          await api.get('/api/auth/student/verify');
        } else if (subAdminToken) {
          await api.get('/api/sub-admin-auth/verify');
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Token verification failed:', error);

        // Clean up based on which token failed
        if (teacherToken) {
          localStorage.removeItem('teacherToken');
          localStorage.removeItem('teacherInfo');
        }
        if (studentToken) {
          localStorage.removeItem('studentToken');
          localStorage.removeItem('studentInfo');
        }
        if (subAdminToken) {
          localStorage.removeItem('subAdminToken');
          localStorage.removeItem('subAdminInfo');
        }

        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading classroom...</p>
        </div>
      </div>
    );
  }

  // Redirect based on which login page they came from
  if (!isAuthenticated) {
    const role = localStorage.getItem('role');
    const redirectPath = role === 'student' ? '/student/login' : '/teacher/login';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}