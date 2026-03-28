// src/pages/admin/AdminResetPassword.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import api from '../../api';

export default function AdminResetPassword() {
  const { token }    = useParams();
  const navigate     = useNavigate();

  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [showPwd,     setShowPwd]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(false);
  const [focused,     setFocused]     = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/api/auth/admin/reset-password/${token}`, { newPassword: password });
      if (res.data.success) setDone(true);
      else setError(res.data.message || 'Reset failed.');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={s.root}>
        <div style={s.grid} />
        <div style={s.scanlines} />

        <div style={s.card} className="al-card">
          <div style={s.accentBar} />

          <div style={s.top}>
            <div style={s.shieldWrap} className="al-shield">
              <ShieldCheck size={28} color="#22d3ee" strokeWidth={1.5} />
            </div>
            <div>
              <p style={s.systemLabel}>ADMIN PORTAL</p>
              <h1 style={s.title}>Set New Password</h1>
              <p style={s.subtitle}>Choose a strong password</p>
            </div>
          </div>

          <div style={s.divider} />

          {done ? (
            <div style={{ padding: '36px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={28} color="#34d399" />
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f1f5f9' }}>Password Updated!</h2>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#6b7280', lineHeight: '1.6' }}>
                Your admin password has been reset. You can now log in with your new password.
              </p>
              <button onClick={() => navigate('/admin/login')} style={{ ...s.submitBtn, width: 'auto', padding: '12px 28px', marginTop: '8px' }} className="al-submit">
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Go to Login <ArrowRight size={16} /></span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={s.form}>
              {error && (
                <div style={s.errorBox} className="al-error">
                  <AlertCircle size={15} color="#f87171" />
                  <span style={s.errorText}>{error}</span>
                </div>
              )}

              <div style={s.fieldGroup}>
                <label style={s.label}>New Password</label>
                <div style={{ ...s.inputWrap, ...(focused === 'pwd' ? s.inputFocused : {}) }}>
                  <Lock size={16} color={focused === 'pwd' ? '#22d3ee' : '#374151'} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused('pwd')}
                    onBlur={() => setFocused(null)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    disabled={loading}
                    style={s.input}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={s.eyeBtn}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={s.fieldGroup}>
                <label style={s.label}>Confirm Password</label>
                <div style={{ ...s.inputWrap, ...(focused === 'confirm' ? s.inputFocused : {}) }}>
                  <Lock size={16} color={focused === 'confirm' ? '#22d3ee' : '#374151'} />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onFocus={() => setFocused('confirm')}
                    onBlur={() => setFocused(null)}
                    placeholder="Re-enter password"
                    required
                    disabled={loading}
                    style={s.input}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} style={s.submitBtn} className="al-submit">
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}><span className="al-spinner" /> Saving…</span>
                  : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>Reset Password <ArrowRight size={17} /></span>
                }
              </button>

              <button type="button" onClick={() => navigate('/admin/login')} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', textAlign: 'center' }}>
                ← Back to login
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

const s = {
  root: {
    minHeight: '100vh', background: '#080b14',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '24px', position: 'relative', overflow: 'hidden',
    fontFamily: "'Sora', 'Segoe UI', sans-serif",
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: `linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px)`,
    backgroundSize: '52px 52px', pointerEvents: 'none',
  },
  scanlines: {
    position: 'absolute', inset: 0,
    background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 10,
    background: 'linear-gradient(160deg, #0f1520 0%, #0c1120 100%)',
    border: '1px solid rgba(34,211,238,0.12)', borderRadius: '20px',
    width: '100%', maxWidth: '420px',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
    overflow: 'hidden',
  },
  accentBar: { height: '2px', background: 'linear-gradient(90deg, transparent, #22d3ee, #818cf8, transparent)' },
  top: { display: 'flex', alignItems: 'center', gap: '16px', padding: '28px 28px 20px' },
  shieldWrap: {
    width: '56px', height: '56px', flexShrink: 0,
    background: 'linear-gradient(135deg, #0c1a2e, #112240)',
    border: '1px solid rgba(34,211,238,0.2)', borderRadius: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(34,211,238,0.15)',
  },
  systemLabel: { margin: '0 0 2px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.2em', color: '#22d3ee', textTransform: 'uppercase' },
  title:       { margin: '0 0 2px', fontSize: '22px', fontWeight: '700', color: '#f1f5f9' },
  subtitle:    { margin: 0, fontSize: '12.5px', color: '#374151' },
  divider:     { height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.1), transparent)' },
  form:        { display: 'flex', flexDirection: 'column', gap: '18px', padding: '24px 28px 28px' },
  errorBox:    { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '11px 14px' },
  errorText:   { color: '#f87171', fontSize: '13px', fontWeight: '500' },
  fieldGroup:  { display: 'flex', flexDirection: 'column', gap: '8px' },
  label:       { fontSize: '11.5px', fontWeight: '600', color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase' },
  inputWrap:   { display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px', height: '50px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', transition: 'all 0.2s' },
  inputFocused:{ border: '1px solid rgba(34,211,238,0.5)', boxShadow: '0 0 0 3px rgba(34,211,238,0.08)', background: 'rgba(34,211,238,0.03)' },
  input:       { flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14.5px', color: '#e2e8f0', fontFamily: 'inherit' },
  eyeBtn:      { background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: 0, display: 'flex', alignItems: 'center' },
  submitBtn:   { width: '100%', height: '52px', background: 'linear-gradient(135deg, #0e7490, #22d3ee)', color: '#020617', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 6px 24px rgba(34,211,238,0.25)', transition: 'all 0.2s' },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&display=swap');
  * { box-sizing: border-box; }
  input::placeholder { color: #1f2937; }
  .al-card  { animation: al-rise 0.6s cubic-bezier(0.16,1,0.3,1) both; }
  .al-shield{ animation: al-shield-glow 3s ease-in-out infinite; }
  @keyframes al-rise         { from { opacity:0; transform:translateY(24px) scale(0.97); } to { opacity:1; transform:none; } }
  @keyframes al-shield-glow  { 0%,100%{box-shadow:0 4px 20px rgba(34,211,238,0.15);} 50%{box-shadow:0 4px 32px rgba(34,211,238,0.35);} }
  .al-submit:hover:not(:disabled) { opacity:0.9; transform:translateY(-1px); }
  .al-submit:disabled { opacity:0.5; cursor:not-allowed; }
  .al-spinner { display:inline-block; width:18px; height:18px; border:2px solid rgba(2,6,23,0.3); border-top-color:#020617; border-radius:50%; animation:al-spin 0.7s linear infinite; }
  @keyframes al-spin { to { transform:rotate(360deg); } }
  .al-error { animation:al-shake 0.4s ease both; }
  @keyframes al-shake { 0%,100%{transform:translateX(0);} 20%{transform:translateX(-6px);} 40%{transform:translateX(6px);} 60%{transform:translateX(-4px);} 80%{transform:translateX(4px);} }
`;
