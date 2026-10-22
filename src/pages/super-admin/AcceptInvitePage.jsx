// src/pages/super-admin/AcceptInvitePage.jsx
// Opened from a super-admin invite email: shows who the invite is for and lets them set
// their password. Afterwards they sign in at /super-admin/login like everyone else
// (password + emailed code). Server: server/routes/superAdminTeamRoutes.js
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Crown, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const S = {
  root: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'radial-gradient(circle at 30% 20%, #1e1b4b 0%, #0a0d1f 60%)', color: '#e5e7eb', fontFamily: 'Inter, system-ui, sans-serif' },
  card: { width: '100%', maxWidth: 420, background: 'rgba(17,24,39,0.92)', border: '1px solid rgba(217,119,6,0.35)', borderRadius: 18, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.45)' },
  label: { display: 'block', fontSize: 12, fontWeight: 700, color: '#d1d5db', margin: '14px 0 6px' },
  input: { width: '100%', boxSizing: 'border-box', padding: '11px 40px 11px 12px', borderRadius: 10, border: '1px solid #374151', background: '#0b1020', color: '#f9fafb', fontSize: 14 },
  btn: { width: '100%', marginTop: 18, padding: '12px 16px', borderRadius: 10, border: 'none', background: '#d97706', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' },
  error: { marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5', fontSize: 13 },
};

export default function AcceptInvitePage() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [state, setState] = useState('loading'); // loading | form | gone | done
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/super-admin/team/invite/${token}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
      .then(({ ok, body }) => {
        if (ok) { setInvite(body.data); setState('form'); }
        else { setMessage(body.message || 'This invite link is not valid.'); setState('gone'); }
      })
      .catch(() => { setMessage("Couldn't reach the server. Please try again."); setState('gone'); });
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError("The two passwords don't match"); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/super-admin/team/invite/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body.message || 'Could not set the password'); return; }
      setState('done');
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <div style={S.root}>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Crown size={22} color="#d97706" />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Super admin invite</h1>
        </div>

        {state === 'loading' && <p style={{ opacity: 0.8 }}>Checking your invite…</p>}

        {state === 'gone' && (
          <>
            <p style={{ lineHeight: 1.6, opacity: 0.9 }}>{message}</p>
            <Link to="/super-admin/login" style={{ color: '#fbbf24', fontWeight: 700 }}>Go to sign in</Link>
          </>
        )}

        {state === 'form' && invite && (
          <form onSubmit={submit}>
            <p style={{ margin: '0 0 4px', lineHeight: 1.6, fontSize: 14, opacity: 0.9 }}>
              Hello <strong>{invite.firstName}</strong>{invite.invitedBy ? <> — {invite.invitedBy} invited you</> : null}.
              Set a password for <strong>{invite.email}</strong>.
            </p>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>
              At least {invite.minLength} characters, with upper- and lower-case letters and a number.
            </p>
            <label style={S.label} htmlFor="ai-pw">New password</label>
            <div style={{ position: 'relative' }}>
              <input id="ai-pw" style={S.input} type={show ? 'text' : 'password'} autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required minLength={invite.minLength} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <label style={S.label} htmlFor="ai-pw2">Type it again</label>
            <input id="ai-pw2" style={S.input} type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} required />
            {error && <div role="alert" style={S.error}>{error}</div>}
            <button type="submit" style={{ ...S.btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
          </form>
        )}

        {state === 'done' && (
          <>
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#34d399' }}>
              <CheckCircle2 size={18} /> Your password is set.
            </p>
            <p style={{ lineHeight: 1.6, opacity: 0.9, fontSize: 14 }}>
              Sign in with your email and password. Each time, we'll email you a 6-digit code to finish signing in.
            </p>
            <Link to="/super-admin/login" style={{ ...S.btn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Go to sign in</Link>
          </>
        )}
      </div>
    </div>
  );
}
