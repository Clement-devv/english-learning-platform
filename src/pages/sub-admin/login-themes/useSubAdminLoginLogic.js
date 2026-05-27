// src/pages/sub-admin/login-themes/useSubAdminLoginLogic.js
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import api from '../../../api';

export function useSubAdminLoginLogic() {
  const [username,      setUsername]      = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [focusedField,  setFocusedField]  = useState(null);
  const [view,          setView]          = useState('login'); // 'login' | 'forgot' | 'forgot-sent'
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError,   setForgotError]   = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    if (sessionStorage.getItem('subAdminToken')) navigate('/sub-admin/dashboard');
  }, []);

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/sub-admin-auth/login', { email: username.trim(), password });
      if (res.data.success) {
        sessionStorage.setItem('subAdminToken', res.data.token);
        sessionStorage.setItem('subAdminInfo', JSON.stringify(res.data.subAdmin));
        // Required for /auth/logout-session to revoke this JWT server-side.
        if (res.data.sessionToken) {
          sessionStorage.setItem('subAdminSessionToken', res.data.sessionToken);
        }
        login('sub-admin', res.data.subAdmin, res.data.token);
        navigate('/sub-admin/dashboard');
      } else {
        setError(res.data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  // Sub-admins don't have 2FA — stubs to keep prop interface compatible
  const requires2FA = false;
  const handle2FAVerification = () => {};
  const handleCancel2FA = () => {};

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await api.post('/sub-admin-auth/forgot-password', { email: forgotEmail.trim() });
      if (res.data.success) setView('forgot-sent');
      else setForgotError(res.data.message || 'Something went wrong.');
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Failed to send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return {
    username, setUsername,
    password, setPassword,
    showPassword, setShowPassword,
    error,
    loading,
    requires2FA,
    focusedField, setFocusedField,
    view, setView,
    forgotEmail, setForgotEmail,
    forgotLoading, forgotError,
    handleInitialLogin,
    handle2FAVerification,
    handleCancel2FA,
    handleForgotPassword,
    navigate,
  };
}
