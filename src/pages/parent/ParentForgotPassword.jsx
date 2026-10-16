// src/pages/parent/ParentForgotPassword.jsx
// Parent "forgot password": asks for the email and calls POST /parents/forgot-password,
// which emails a link to /parent/reset-password/:token. The server always answers the
// same way whether or not the email exists, so this page does too.
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, CheckCircle2 } from 'lucide-react';
import api from '../../api';
import { useBranding } from '../../context/BrandingContext';
import SunshineLoginShell, { LoginHeader, LoginError, LoginField, LoginSubmit } from '../../components/auth/SunshineLoginShell';

export default function ParentForgotPassword() {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const centerSlug = searchParams.get('center') || '';
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/parents/forgot-password', { email: email.trim() },
        centerSlug ? { headers: { 'x-center-slug': centerSlug } } : undefined);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SunshineLoginShell branding={branding} compact>
      {sent ? (
        <div className="lx-sent">
          <div className="lx-sent-icon"><CheckCircle2 size={28} strokeWidth={2.2} aria-hidden="true" /></div>
          <h1 className="lx-title">Check your email</h1>
          <p className="lx-sub" role="status">
            If <strong>{email.trim()}</strong> belongs to a parent account, we've sent a link to reset your password.
            It expires in 1 hour.
          </p>
          <button type="button" className="lx-link" onClick={() => navigate('/parent/login')}>Back to sign in</button>
        </div>
      ) : (
        <>
          <LoginHeader logo={branding.logo} mark={<Mail size={26} strokeWidth={2.2} />}
            tag="Parent portal" title="Forgot your password?" sub="Enter the email you use to sign in and we'll send you a reset link." />
          <LoginError>{error}</LoginError>
          <form onSubmit={handleSubmit} className="lx-form">
            <LoginField id="lx-email" label="Email address" type="email" inputMode="email" autoComplete="email"
              autoCapitalize="none" spellCheck={false} placeholder="you@example.com" autoFocus
              value={email} onChange={e => setEmail(e.target.value)} required disabled={loading}
              invalid={!!error} describedBy="lx-error" />
            <LoginSubmit loading={loading} loadingLabel="Sending…">
              <Mail size={17} strokeWidth={2.4} aria-hidden="true" /> Send reset link
            </LoginSubmit>
            <button type="button" className="lx-link is-center" onClick={() => navigate('/parent/login')}>← Back to sign in</button>
          </form>
        </>
      )}
    </SunshineLoginShell>
  );
}
