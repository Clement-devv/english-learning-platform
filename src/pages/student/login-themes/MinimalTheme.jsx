// src/pages/student/login-themes/MinimalTheme.jsx
// Centered card — no illustration panel — clean elegant adult-oriented design
import React from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useLoginLogic } from './useLoginLogic';

export default function MinimalTheme() {
  const {
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    focusedField, setFocusedField,
    handleInitialLogin, handle2FAVerification, handleCancel2FA, navigate,
  } = useLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';

  if (requires2FA) {
    return (
      <div className="mn-root">
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div
        className="mn-root"
        style={{
          ...(branding.loginBackground ? {
            backgroundImage: `url(${branding.loginBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          } : {}),
          ...(branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Inter', sans-serif` } : {}),
        }}
      >
        {branding.loginBackground && (
          <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${branding.loginBgOverlay ?? 0.45})`, zIndex: 0 }} />
        )}

        {/* Subtle geometric background shapes */}
        <div className="mn-bg-circle mn-bgc-1" />
        <div className="mn-bg-circle mn-bgc-2" />
        <div className="mn-bg-circle mn-bgc-3" />

        <div className="mn-card">
          {/* Top accent bar */}
          <div className="mn-accent-bar" />

          {/* Logo */}
          <div className="mn-brand">
            {branding.logo
              ? <img src={branding.logo} alt={centerName} className="mn-logo-img" />
              : <div className="mn-logo-default"><span className="mn-logo-letter">{centerName[0] || 'E'}</span></div>
            }
          </div>

          <h1 className="mn-title">{centerName}</h1>
          <p className="mn-subtitle">Welcome back — sign in to continue</p>

          {error && (
            <div className="mn-error">
              <AlertCircle size={15} color="#dc2626" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleInitialLogin} className="mn-form">
            <div className="mn-field">
              <label className="mn-label"><Mail size={13} /> Email address</label>
              <div className={`mn-input-wrap${focusedField === 'email' ? ' mn-focused' : ''}`}>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                  placeholder="you@example.com" required disabled={loading} className="mn-input" />
              </div>
            </div>

            <div className="mn-field">
              <div className="mn-label-row">
                <label className="mn-label"><Lock size={13} /> Password</label>
                <button type="button" onClick={() => navigate('/student/forgot-password')} className="mn-forgot">
                  Forgot password?
                </button>
              </div>
              <div className={`mn-input-wrap${focusedField === 'password' ? ' mn-focused' : ''}`}>
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                  placeholder="••••••••" required disabled={loading} className="mn-input" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="mn-eye-btn" disabled={loading}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="mn-submit">
              {loading
                ? <span className="mn-loading-row"><span className="mn-spinner" />Signing in…</span>
                : <span>Sign In →</span>
              }
            </button>
          </form>

          <div className="mn-divider"><span>your account is managed by your school</span></div>

          <div className="mn-dots">
            {['#6366f1','#8b5cf6','#a78bfa','#c4b5fd'].map((c, i) => (
              <span key={i} className="mn-dot" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  .mn-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg,#f8fafc 0%,#e2e8f0 50%,#eef2ff 100%);
    font-family: 'Inter','Segoe UI',sans-serif;
    padding: 32px 20px;
    position: relative;
    overflow: hidden;
  }

  /* Background geometry */
  .mn-bg-circle { position: absolute; border-radius: 50%; pointer-events: none; }
  .mn-bgc-1 { width: 600px; height: 600px; background: radial-gradient(circle,rgba(99,102,241,.07),transparent 70%); top: -200px; right: -200px; }
  .mn-bgc-2 { width: 400px; height: 400px; background: radial-gradient(circle,rgba(139,92,246,.06),transparent 70%); bottom: -100px; left: -100px; }
  .mn-bgc-3 { width: 300px; height: 300px; background: radial-gradient(circle,rgba(236,72,153,.04),transparent 70%); top: 50%; left: 20%; animation: mn-drift 12s ease-in-out infinite alternate; }
  @keyframes mn-drift { from{transform:translate(0,0)} to{transform:translate(30px,-20px)} }

  /* Card */
  .mn-card {
    position: relative;
    z-index: 1;
    background: white;
    border-radius: 24px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0,0,0,.10), 0 4px 16px rgba(0,0,0,.06);
    overflow: hidden;
    animation: mn-rise .5s cubic-bezier(.16,1,.3,1) both;
  }
  @keyframes mn-rise { from{opacity:0;transform:translateY(24px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }

  /* Accent top bar */
  .mn-accent-bar { height: 5px; background: linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899,#6366f1); background-size: 200% 100%; animation: mn-bar-slide 3s linear infinite; }
  @keyframes mn-bar-slide { from{background-position:0% 0%} to{background-position:200% 0%} }

  /* Inner padding wrapper */
  .mn-brand,.mn-title,.mn-subtitle,.mn-error,.mn-form,.mn-divider,.mn-dots { padding-left: 40px; padding-right: 40px; }
  .mn-brand { padding-top: 36px; padding-bottom: 0; display: flex; justify-content: center; animation: mn-bounce .6s cubic-bezier(.34,1.56,.64,1) .15s both; }
  @keyframes mn-bounce { from{opacity:0;transform:scale(.5)} to{opacity:1;transform:scale(1)} }
  .mn-logo-img { height: 52px; max-width: 150px; object-fit: contain; }
  .mn-logo-default { width: 64px; height: 64px; border-radius: 18px; background: linear-gradient(135deg,#6366f1,#8b5cf6); display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(99,102,241,.3); }
  .mn-logo-letter { font-size: 28px; font-weight: 800; color: white; }

  .mn-title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 18px 0 4px; text-align: center; letter-spacing: -.3px; }
  .mn-subtitle { font-size: 13.5px; color: #64748b; text-align: center; margin: 0 0 22px; font-weight: 500; }

  /* Error */
  .mn-error { display: flex; align-items: center; gap: 9px; background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 10px 12px; color: #dc2626; font-size: 13px; font-weight: 600; margin-bottom: 14px; animation: mn-shake .4s ease both; }
  @keyframes mn-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }

  /* Form */
  .mn-form { display: flex; flex-direction: column; gap: 16px; margin-bottom: 4px; }
  .mn-field { display: flex; flex-direction: column; gap: 6px; }
  .mn-label-row { display: flex; align-items: center; justify-content: space-between; }
  .mn-label { display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .07em; }
  .mn-input-wrap { display: flex; align-items: center; height: 50px; padding: 0 14px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; transition: border-color .2s, box-shadow .2s, background .2s; }
  .mn-input-wrap.mn-focused { border-color: #6366f1; background: #f5f3ff; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
  .mn-input { flex: 1; border: none; outline: none; background: transparent; font-size: 15px; color: #1e293b; font-family: inherit; font-weight: 500; }
  .mn-eye-btn { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center; transition: color .15s; }
  .mn-eye-btn:hover { color: #6366f1; }
  .mn-forgot { background: none; border: none; cursor: pointer; font-size: 12px; color: #6366f1; font-weight: 600; font-family: inherit; padding: 0; transition: color .15s; }
  .mn-forgot:hover { color: #8b5cf6; }

  .mn-submit { width: 100%; height: 52px; background: #1e293b; color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 4px; letter-spacing: .02em; transition: background .2s, transform .15s, box-shadow .15s; box-shadow: 0 4px 14px rgba(30,41,59,.25); }
  .mn-submit:hover:not(:disabled) { background: #6366f1; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(99,102,241,.35); }
  .mn-submit:active:not(:disabled) { transform: translateY(0); }
  .mn-submit:disabled { opacity: .65; cursor: not-allowed; }

  .mn-loading-row { display: flex; align-items: center; gap: 10px; justify-content: center; }
  .mn-spinner { display: inline-block; width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: mn-spin .7s linear infinite; }
  @keyframes mn-spin { to{transform:rotate(360deg)} }

  /* Divider */
  .mn-divider { margin: 20px 0 16px; text-align: center; position: relative; }
  .mn-divider::before { content:''; position:absolute; top:50%;left:40px;right:40px;height:1px;background:#f1f5f9; }
  .mn-divider span { position:relative; font-size:11px; color:#94a3b8; font-weight:500; background:white; padding:0 10px; }

  /* Dots */
  .mn-dots { display: flex; justify-content: center; gap: 7px; padding-bottom: 28px; }
  .mn-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; animation: mn-db 1.4s ease-in-out infinite; }
  .mn-dot:nth-child(1){animation-delay:0s} .mn-dot:nth-child(2){animation-delay:.15s} .mn-dot:nth-child(3){animation-delay:.3s} .mn-dot:nth-child(4){animation-delay:.45s}
  @keyframes mn-db { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.5)} }

  @media (max-width:480px) {
    .mn-brand,.mn-title,.mn-subtitle,.mn-error,.mn-form,.mn-divider,.mn-dots { padding-left:28px;padding-right:28px; }
    .mn-card { border-radius: 20px; }
  }
`;
