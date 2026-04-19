// src/pages/teacher/login-themes/useTeacherLoginLogic.js
// Shared login logic for all teacher login themes.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../api';

export function useTeacherLoginLogic() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [requires2FA, setRequires2FA]   = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/teacher/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      if (response.data.success) {
        sessionStorage.setItem('teacherToken', response.data.token);
        sessionStorage.setItem('teacherSessionToken', response.data.sessionToken);
        sessionStorage.setItem('teacherInfo', JSON.stringify(response.data.teacher));
        navigate('/teacher/dashboard');
      } else if (response.data.requires2FA) {
        setRequires2FA(true);
        setPendingToken(response.data.pendingToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FAVerification = async (twoFactorToken, backupCode) => {
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/verify-2fa-login', {
        pendingToken, twoFactorToken, backupCode,
      });
      if (response.data.success) {
        sessionStorage.setItem('teacherToken', response.data.token);
        sessionStorage.setItem('teacherSessionToken', response.data.sessionToken);
        sessionStorage.setItem('teacherInfo', JSON.stringify(response.data.user));
        navigate('/teacher/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2FA = () => {
    setRequires2FA(false);
    setPendingToken(null);
    setError('');
  };

  return {
    email, setEmail,
    password, setPassword,
    showPassword, setShowPassword,
    error, loading,
    requires2FA,
    focusedField, setFocusedField,
    handleInitialLogin,
    handle2FAVerification,
    handleCancel2FA,
    navigate,
  };
}
