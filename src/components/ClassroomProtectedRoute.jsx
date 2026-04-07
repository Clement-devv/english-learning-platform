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
      const teacherToken  = sessionStorage.getItem('teacherToken')  || localStorage.getItem('teacherToken');
      const studentToken  = sessionStorage.getItem('studentToken')  || localStorage.getItem('studentToken');
      const subAdminToken = sessionStorage.getItem('subAdminToken') || localStorage.getItem('subAdminToken');

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
          await api.get('/auth/verify');
        } else if (studentToken) {
          await api.get('/auth/student/verify');
        } else if (subAdminToken) {
          await api.get('/sub-admin-auth/verify');
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Token verification failed:', error);

        // Clean up based on which token failed
        if (teacherToken) {
          sessionStorage.removeItem('teacherToken'); localStorage.removeItem('teacherToken');
          sessionStorage.removeItem('teacherInfo');  localStorage.removeItem('teacherInfo');
        }
        if (studentToken) {
          sessionStorage.removeItem('studentToken'); localStorage.removeItem('studentToken');
          sessionStorage.removeItem('studentInfo');  localStorage.removeItem('studentInfo');
        }
        if (subAdminToken) {
          sessionStorage.removeItem('subAdminToken'); localStorage.removeItem('subAdminToken');
          sessionStorage.removeItem('subAdminInfo');  localStorage.removeItem('subAdminInfo');
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
    const role = sessionStorage.getItem('role') || localStorage.getItem('role');
    const redirectPath = role === 'student' ? '/student/login' : '/teacher/login';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
}