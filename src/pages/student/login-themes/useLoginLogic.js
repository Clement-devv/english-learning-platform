// src/pages/student/login-themes/useLoginLogic.js
// Shared hook — all login theme components use this for state + handlers.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import api from '../../../api';

const DASHBOARD = '/student/dashboard';

export function useLoginLogic() {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [requires2FA,  setRequires2FA]  = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();
  const { login, requireTerms } = useAuth();

  /** Shared: finish login or gate on T&C */
  const _completeLogin = (userInfo, authToken, sessionToken) => {
    if (!userInfo.hasAcceptedTerms) {
      requireTerms('student', userInfo, authToken, sessionToken, DASHBOARD);
      return;
    }
    sessionStorage.setItem('studentToken',        authToken);
    sessionStorage.setItem('studentSessionToken', sessionToken);
    sessionStorage.setItem('studentInfo',         JSON.stringify(userInfo));
    login('student', userInfo, authToken);
    navigate(DASHBOARD);
  };

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/student/login', { email: email.trim(), password });
      if (response.data.success) {
        _completeLogin(response.data.student, response.data.token, response.data.sessionToken);
      } else if (response.data.requires2FA) {
        setRequires2FA(true);
        setPendingToken(response.data.pendingToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Oops! Wrong email or password. Try again! 🙈');
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
    error,
    loading,
    requires2FA,
    focusedField, setFocusedField,
    handleInitialLogin,
    handle2FAVerification,
    handleCancel2FA,
    navigate,
  };
}
