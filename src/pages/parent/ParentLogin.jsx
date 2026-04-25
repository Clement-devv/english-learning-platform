// src/pages/parent/ParentLogin.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../../api';

const F = "'Nunito','Inter',sans-serif";

export default function ParentLogin() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return setError('Please enter your email and password.');
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/parents/login', { email: email.trim().toLowerCase(), password });
      sessionStorage.setItem('parentToken', res.data.token);
      sessionStorage.setItem('parentInfo', JSON.stringify(res.data.parent));
      navigate('/parent/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#fff8f0 0%,#ffedd5 100%)', fontFamily: F, padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 28, boxShadow: '0 20px 60px rgba(249,115,22,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#f97316,#f43f5e)', padding: '36px 32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍👩‍👧</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>Parent Portal</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0 }}>Monitor your child's progress</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ padding: '28px 32px 32px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#a89480', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Email Address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="parent@example.com" autoComplete="email"
              style={{ width: '100%', background: '#fff8f0', border: '2px solid #ffe8cc', borderRadius: 14, padding: '11px 14px', fontSize: 15, fontFamily: F, outline: 'none', color: '#3d2e20' }}
            />
          </div>

          <div style={{ marginBottom: 22, position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#a89480', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Password</label>
            <input
              type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete="current-password"
              style={{ width: '100%', background: '#fff8f0', border: '2px solid #ffe8cc', borderRadius: 14, padding: '11px 44px 11px 14px', fontSize: 15, fontFamily: F, outline: 'none', color: '#3d2e20' }}
            />
            <button type="button" onClick={() => setShowPw(p => !p)}
              style={{ position: 'absolute', right: 12, top: 34, background: 'none', border: 'none', cursor: 'pointer', color: '#a89480' }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', background: loading ? '#f5f0ec' : 'linear-gradient(135deg,#f97316,#f43f5e)', color: loading ? '#a89480' : '#fff', border: 'none', borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 900, cursor: loading ? 'default' : 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Signing in…</> : 'Sign In'}
          </button>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#a89480' }}>
            No account? Contact your child's school to receive an invite.
          </p>
        </form>
      </div>
    </div>
  );
}
