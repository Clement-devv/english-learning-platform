// src/pages/parent/ParentResetPassword.jsx
// Page behind the emailed link /parent/reset-password/:token.
// Calls POST /parents/reset-password/:token with { newPassword }. The server enforces
// 8+ chars with upper, lower, number and symbol, so the checklist below mirrors that.
import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { KeyRound, CheckCircle2, Check, ArrowRight } from 'lucide-react';
import api from '../../api';
import { useBranding } from '../../context/BrandingContext';
import SunshineLoginShell, { LoginHeader, LoginError, LoginPasswordField, LoginSubmit } from '../../components/auth/SunshineLoginShell';

const RULES = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'An uppercase letter',   test: p => /[A-Z]/.test(p) },
  { label: 'A lowercase letter',    test: p => /[a-z]/.test(p) },
  { label: 'A number',              test: p => /\d/.test(p) },
  { label: 'A symbol (e.g. ! @ #)', test: p => /[^A-Za-z0-9]/.test(p) },
];

export default function ParentResetPassword() {
  const { branding } = useBranding();
  const navigate = useNavigate();
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const centerSlug = searchParams.get('center') || '';

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [show,     setShow]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);

  const allOk = RULES.every(r => r.test(password));
  const matches = password.length > 0 && password === confirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!allOk) return setError('Your new password doesn’t meet all the requirements yet.');
    if (!matches) return setError('The two passwords don’t match.');
    setLoading(true);
    try {
      await api.post(`/parents/reset-password/${token}`, { newPassword: password },
        centerSlug ? { headers: { 'x-center-slug': centerSlug } } : undefined);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset your password. The link may have expired — please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SunshineLoginShell branding={branding} compact>
      {done ? (
        <div className="lx-sent">
          <div className="lx-sent-icon"><CheckCircle2 size={28} strokeWidth={2.2} aria-hidden="true" /></div>
          <h1 className="lx-title">Password updated</h1>
          <p className="lx-sub" role="status">You can now sign in with your new password. For your security, any other devices have been signed out.</p>
          <button type="button" className="lx-submit" style={{ width: '100%' }} onClick={() => navigate('/parent/login')}>
            <span className="lx-btn-label">Go to sign in <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" /></span>
          </button>
        </div>
      ) : (
        <>
          <LoginHeader logo={branding.logo} mark={<KeyRound size={26} strokeWidth={2.2} />}
            tag="Parent portal" title="Choose a new password" sub="Pick something you don't use anywhere else." />
          <LoginError>{error}</LoginError>
          <form onSubmit={handleSubmit} className="lx-form">
            <LoginPasswordField id="lx-new" label="New password" autoComplete="new-password" autoFocus
              show={show} onToggle={() => setShow(v => !v)}
              value={password} onChange={e => setPassword(e.target.value)} required disabled={loading}
              aria-describedby="lx-reqs" />
            <ul className="lx-reqs" id="lx-reqs" aria-label="Password requirements">
              {RULES.map(r => {
                const ok = r.test(password);
                return (
                  <li key={r.label} className={ok ? 'is-ok' : ''}>
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                    <span>{r.label}</span>
                    <span className="lx-sr">{ok ? ' — done' : ' — not yet'}</span>
                  </li>
                );
              })}
            </ul>
            <LoginPasswordField id="lx-confirm" label="Confirm new password" autoComplete="new-password"
              show={show} onToggle={() => setShow(v => !v)}
              value={confirm} onChange={e => setConfirm(e.target.value)} required disabled={loading}
              invalid={confirm.length > 0 && !matches} describedBy="lx-match" />
            {confirm.length > 0 && !matches && <p className="lx-hint" id="lx-match">The passwords don't match yet.</p>}
            <LoginSubmit loading={loading} loadingLabel="Saving…">
              Save new password <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
            </LoginSubmit>
            <button type="button" className="lx-link is-center" onClick={() => navigate('/parent/forgot-password')}>Link expired? Request a new one</button>
          </form>
        </>
      )}
    </SunshineLoginShell>
  );
}
