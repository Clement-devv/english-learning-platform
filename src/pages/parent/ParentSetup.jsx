// src/pages/parent/ParentSetup.jsx
// Parent sets their password from the invite link.
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import api from '../../api';

const F = "'Nunito','Inter',sans-serif";

export default function ParentSetup() {
  const { token }   = useParams();
  const navigate    = useNavigate();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) return setError('Password is required.');
    if (password !== confirm) return setError('Passwords do not match.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    setLoading(true);
    setError('');
    try {
      await api.post(`/parents/setup/${token}`, { password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Setup failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#fff8f0,#ffedd5)', fontFamily: F, padding: 16 }}>
        <div style={{ textAlign: 'center', background: '#fff', borderRadius: 28, padding: '48px 40px', boxShadow: '0 20px 60px rgba(249,115,22,0.18)', maxWidth: 420 }}>
          <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#3d2e20', margin: '0 0 10px' }}>Account Ready!</h2>
          <p style={{ color: '#a89480', fontSize: 14, marginBottom: 28 }}>Your parent account is set up. You can now log in and monitor your child's progress.</p>
          <button onClick={() => navigate('/parent/login')}
            style={{ background: 'linear-gradient(135deg,#f97316,#f43f5e)', color: '#fff', border: 'none', borderRadius: 14, padding: '12px 32px', fontSize: 15, fontWeight: 900, cursor: 'pointer', fontFamily: F }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#fff8f0,#ffedd5)', fontFamily: F, padding: 16 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 28, boxShadow: '0 20px 60px rgba(249,115,22,0.18)', overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#f97316,#f43f5e)', padding: '36px 32px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍👩‍👧</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '0 0 6px' }}>Set Up Your Account</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, margin: 0 }}>Choose a password to get started</p>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
          {error && (
            <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#a89480', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>New Password</label>
            <input
              type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              style={{ width: '100%', background: '#fff8f0', border: '2px solid #ffe8cc', borderRadius: 14, padding: '11px 44px 11px 14px', fontSize: 15, fontFamily: F, outline: 'none', color: '#3d2e20' }}
            />
            <button type="button" onClick={() => setShowPw(p => !p)}
              style={{ position: 'absolute', right: 12, top: 34, background: 'none', border: 'none', cursor: 'pointer', color: '#a89480' }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#a89480', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Confirm Password</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              style={{ width: '100%', background: '#fff8f0', border: '2px solid #ffe8cc', borderRadius: 14, padding: '11px 14px', fontSize: 15, fontFamily: F, outline: 'none', color: '#3d2e20' }}
            />
          </div>

          <button type="submit" disabled={loading}
            style={{ width: '100%', background: loading ? '#f5f0ec' : 'linear-gradient(135deg,#f97316,#f43f5e)', color: loading ? '#a89480' : '#fff', border: 'none', borderRadius: 14, padding: '13px', fontSize: 15, fontWeight: 900, cursor: loading ? 'default' : 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin .7s linear infinite' }} /> Setting up…</> : 'Set Up Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
