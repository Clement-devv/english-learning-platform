// src/pages/parent/login-themes/useParentLoginLogic.js
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import api from '../../../api';

export function useParentLoginLogic() {
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

  const DASHBOARD = '/parent/dashboard';

  /** Shared: finish login or gate on T&C */
  const _completeLogin = (userInfo, authToken, sessionToken) => {
    if (!userInfo.hasAcceptedTerms) {
      requireTerms('parent', userInfo, authToken, sessionToken, DASHBOARD);
      return;
    }
    sessionStorage.setItem('parentToken', authToken);
    sessionStorage.setItem('parentInfo',  JSON.stringify(userInfo));
    if (sessionToken) sessionStorage.setItem('parentSessionToken', sessionToken);
    login('parent', userInfo, authToken);
    navigate(DASHBOARD);
  };

  const handleInitialLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/parents/login', { email: email.trim().toLowerCase(), password });
      if (res.data.success !== false) {
        _completeLogin(res.data.parent, res.data.token, res.data.sessionToken);
      } else if (res.data.requires2FA) {
        setRequires2FA(true);
        setPendingToken(res.data.pendingToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
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
        _completeLogin(res.data.user, res.data.token, res.data.sessionToken);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid 2FA code');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel2FA = () => { setRequires2FA(false); setPendingToken(null); setError(''); };

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
