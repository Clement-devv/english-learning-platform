// src/pages/admin/login-themes/useAdminLoginLogic.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import api from '../../../api';

export function useAdminLoginLogic() {
  const [username,      setUsername]      = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [error,         setError]         = useState('');
  const [loading,       setLoading]       = useState(false);
  const [requires2FA,   setRequires2FA]   = useState(false);
  const [pendingToken,  setPendingToken]  = useState(null);
  const [focusedField,  setFocusedField]  = useState(null);
  const [view,          setView]          = useState('login'); // 'login' | 'forgot' | 'forgot-sent'
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError,   setForgotError]   = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/login', { username: username.trim(), password });
      if (res.data.success) {
        sessionStorage.setItem('adminToken', res.data.token);
        sessionStorage.setItem('adminSessionToken', res.data.sessionToken);
        sessionStorage.setItem('adminInfo', JSON.stringify(res.data.admin));
        login('admin', res.data.admin, res.data.token);
        navigate('/admin');
      } else if (res.data.requires2FA) {
        setRequires2FA(true);
        setPendingToken(res.data.pendingToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async (twoFactorToken, backupCode) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-2fa-login', { pendingToken, twoFactorToken, backupCode });
      if (res.data.success) {
        sessionStorage.setItem('adminToken', res.data.token);
        sessionStorage.setItem('adminSessionToken', res.data.sessionToken);
        sessionStorage.setItem('adminInfo', JSON.stringify(res.data.user));
        login('admin', res.data.user, res.data.token);
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2FA = () => { setRequires2FA(false); setPendingToken(null); setError(''); };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError('');
    try {
      const res = await api.post('/auth/admin/forgot-password', { email: forgotEmail.trim() });
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
