// src/components/SuperAdminProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

export default function SuperAdminProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      const token = localStorage.getItem('superAdminToken');
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await api.get('/super-admin/stats');
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('superAdminToken');
        localStorage.removeItem('superAdminInfo');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#09080e',
      }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid rgba(245,158,11,0.2)', borderTopColor: '#f59e0b',
          animation: 'spin 0.75s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/super-admin/login" replace />;
}
