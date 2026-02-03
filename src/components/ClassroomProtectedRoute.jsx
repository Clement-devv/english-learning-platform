// src/components/ClassroomProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

export default function ClassroomProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      // Check for ANY valid token (teacher or student)
      const teacherToken = localStorage.getItem('teacherToken');
      const studentToken = localStorage.getItem('studentToken');
      
      const token = teacherToken || studentToken;
      
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        // Set token in api headers
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Just verify token exists (api.js already handles adding it to requests)
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