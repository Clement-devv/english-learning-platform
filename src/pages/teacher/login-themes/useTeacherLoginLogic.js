// src/pages/teacher/login-themes/useTeacherLoginLogic.js
// Shared login logic for all teacher login themes.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import api from '../../../api';

const DASHBOARD = '/teacher/dashboard';

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
  const { login, requireTerms } = useAuth();

  /** Shared: finish login or gate on T&C */
  const _completeLogin = (userInfo, authToken, sessionToken) => {
    if (!userInfo.hasAcceptedTerms) {
      requireTerms('teacher', userInfo, authToken, sessionToken, DASHBOARD);
      return;
    }
    sessionStorage.setItem('teacherToken',        authToken);
    sessionStorage.setItem('teacherSessionToken', sessionToken);
    sessionStorage.setItem('teacherInfo',         JSON.stringify(userInfo));
    login('teacher', userInfo, authToken);
    navigate(DASHBOARD);
  };

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
        _completeLogin(response.data.teacher, response.data.token, response.data.sessionToken);
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
        _completeLogin(response.data.user, response.data.token, response.data.sessionToken);
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
