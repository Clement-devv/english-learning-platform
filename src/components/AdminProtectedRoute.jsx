import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

export default function AdminProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem('adminToken');
      
      console.log("Admin token from localStorage:", token ? "EXISTS" : "MISSING");
      
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        console.log("Verifying admin token...");
        
        // Set token in api headers
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Verify token with backend
        const response = await api.get('/api/auth/admin/verify');
        console.log("Admin verification response:", response.data);
        
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Admin token verification failed!');
        console.error('Error status:', error.response?.status);
        console.error('Error message:', error.response?.data?.message);
        console.error('Full error:', error);
        
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminInfo');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
}