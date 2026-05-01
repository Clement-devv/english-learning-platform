// src/pages/admin/login-themes/ExecutiveTheme.jsx
import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck, ArrowRight, Mail, CheckCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useAdminLoginLogic } from './useAdminLoginLogic';

export default function ExecutiveTheme() {
  const {
    username, setUsername,
    password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    focusedField, setFocusedField,
    view, setView,
    forgotEmail, setForgotEmail,
    forgotLoading, forgotError,
    handleInitialLogin, handle2FAVerification, handleCancel2FA,
    handleForgotPassword,
  } = useAdminLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  if (requires2FA) {
    return (
      <div className="ex-root">
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="ex-root" style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Sora', sans-serif` } : {}}>

        {branding.loginBackground && (
          <>
            <div className="ex-bg-img" style={{ backgroundImage: `url(${branding.loginBackground})` }} />
            <div className="ex-bg-overlay" style={{ opacity: Math.max(branding.loginBgOverlay ?? 0.7, 0.65) }} />
          </>
        )}

        <div className="ex-grid" />

        {/* Ambient glow orbs */}
        <div className="ex-orb ex-orb-1" />
        <div className="ex-orb ex-orb-2" />

        {/* Floating particles */}
        {[...Array(18)].map((_, i) => (
          <span key={i} className={`ex-particle ex-p${i % 5}`}
            style={{ left: `${(i * 53 + 7) % 100}%`, top: `${(i * 67 + 13) % 100}%`, animationDelay: `${(i * 0.9) % 7}s` }}
          />
        ))}

        {/* ── LEFT — Command Center Illustration ── */}
        <div className={`ex-left${mounted ? ' ex-in' : ''}`}>

          <div className="ex-logo-bar">
            {branding.logo
              ? <img src={branding.logo} alt={centerName} className="ex-logo-img" />
              : <div className="ex-logo-icon"><ShieldCheck size={18} color="#22d3ee" strokeWidth={1.5} /></div>
            }
            <span className="ex-logo-name">{centerName}</span>
          </div>

          {/* 3D scene */}
          <div className="ex-scene">

            {/* Dashed connection lines (SVG behind cards) */}
            <svg className="ex-lines" viewBox="0 0 420 340" fill="none">
              <line x1="75" y1="95"  x2="195" y2="165" stroke="rgba(34,211,238,0.18)"  strokeWidth="1" strokeDasharray="5 5" className="ex-dl" />
              <line x1="345" y1="85" x2="225" y2="165" stroke="rgba(99,102,241,0.18)"  strokeWidth="1" strokeDasharray="5 5" className="ex-dl ex-dl2" />
              <line x1="90"  y1="270" x2="195" y2="215" stroke="rgba(245,158,11,0.18)" strokeWidth="1" strokeDasharray="5 5" className="ex-dl ex-dl3" />
              <circle cx="75"  cy="95"  r="3.5" fill="rgba(34,211,238,0.5)" />
              <circle cx="345" cy="85"  r="3.5" fill="rgba(99,102,241,0.5)" />
              <circle cx="90"  cy="270" r="3.5" fill="rgba(245,158,11,0.5)" />
            </svg>

            {/* Central 3D monitor */}
            <div className="ex-monitor-wrap">
              <div className="ex-monitor">
                <div className="ex-screen">
                  <div className="ex-screen-topbar">
                    <div className="ex-screen-dots">
                      <span className="ex-sdot ex-sdot-g" />
                      <span className="ex-sdot ex-sdot-y" />
                      <span className="ex-sdot ex-sdot-r" />
                    </div>
                    <span className="ex-screen-title">Dashboard · Live</span>
                  </div>
                  <div className="ex-chart">
                    {[55, 72, 43, 88, 61, 95, 50, 78].map((h, i) => (
                      <div key={i} className="ex-bar" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                  <div className="ex-screen-hr" />
                  <div className="ex-mini-stats">
                    <span className="ex-mstat">Active: <b>12</b></span>
                    <span className="ex-mstat">Online: <b>247</b></span>
                  </div>
                </div>
                <div className="ex-stand" />
                <div className="ex-base" />
              </div>
            </div>

            {/* Floating stat cards */}
            <div className="ex-fcard ex-fc1">
              <div className="ex-fc-icon" style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="ex-fc-body">
                <div className="ex-fc-val">247</div>
                <div className="ex-fc-lbl">Students</div>
              </div>
              <div className="ex-fc-badge">↑ 12%</div>
            </div>

            <div className="ex-fcard ex-fc2">
              <div className="ex-fc-icon" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="ex-fc-body">
                <div className="ex-fc-val">18</div>
                <div className="ex-fc-lbl">Teachers</div>
              </div>
              <div className="ex-fc-badge" style={{ color: '#818cf8', background: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.2)' }}>↑ 3</div>
            </div>

            <div className="ex-fcard ex-fc3">
              <div className="ex-fc-icon" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="ex-fc-body">
                <div className="ex-fc-val">1,432</div>
                <div className="ex-fc-lbl">Sessions</div>
              </div>
              <div className="ex-fc-badge" style={{ color: '#fbbf24', background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.2)' }}>↑ 8%</div>
            </div>

          </div>

          <div className="ex-hero">
            <h2 className="ex-h2">Your Command<br /><span className="ex-h2-accent">Center</span></h2>
            <p className="ex-hp">Full visibility. Total control.<br />Manage your entire learning center from one place.</p>
            <div className="ex-badges">
              <span className="ex-chip">📊 Analytics</span>
              <span className="ex-chip">👥 Full roster</span>
              <span className="ex-chip">⚙️ Settings</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — Login Form ── */}
        <div className={`ex-right${mounted ? ' ex-in' : ''}`}>

          {view === 'forgot' ? (
            <div className="ex-card">
              <div className="ex-card-head">
                <div className="ex-shield"><Mail size={24} color="#22d3ee" strokeWidth={1.5} /></div>
                <div>
                  <p className="ex-center-tag">{centerName}</p>
                  <h1 className="ex-card-title">Reset Password</h1>
                  <p className="ex-card-sub">Enter your admin email address</p>
                </div>
              </div>
              <div className="ex-sep" />
              {forgotError && <div className="ex-err"><AlertCircle size={14} color="#f87171" /><span>{forgotError}</span></div>}
              <form onSubmit={handleForgotPassword} className="ex-form">
                <div className="ex-field">
                  <label className="ex-lbl">Admin Email</label>
                  <div className={`ex-inp-wrap${focusedField === 'forgot' ? ' ex-focused' : ''}`}>
                    <Mail size={14} color={focusedField === 'forgot' ? '#22d3ee' : '#4b5563'} />
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      onFocus={() => setFocusedField('forgot')} onBlur={() => setFocusedField(null)}
                      placeholder="admin@example.com" required disabled={forgotLoading} className="ex-inp" autoFocus />
                  </div>
                </div>
                <button type="submit" disabled={forgotLoading} className="ex-btn">
                  {forgotLoading
                    ? <span className="ex-btn-row"><span className="ex-spin" />Sending…</span>
                    : <span className="ex-btn-row"><Mail size={15} />Send Reset Link</span>}
                </button>
                <button type="button" onClick={() => setView('login')} className="ex-back">← Back to login</button>
              </form>
            </div>

          ) : view === 'forgot-sent' ? (
            <div className="ex-card">
              <div className="ex-sent">
                <div className="ex-sent-icon"><CheckCircle size={30} color="#34d399" /></div>
                <h2 className="ex-sent-h">Check your email</h2>
                <p className="ex-sent-p">
                  If <strong>{forgotEmail}</strong> is registered, a reset link has been sent. Check your inbox — expires in 1 hour.
                </p>
                <button onClick={() => { setView('login'); setForgotEmail(''); }} className="ex-btn" style={{ width: 'auto', padding: '12px 32px' }}>
                  Back to Login
                </button>
              </div>
            </div>

          ) : (
            <div className="ex-card">
              <div className="ex-card-head">
                {branding.logo && <img src={branding.logo} alt={centerName} className="ex-brand-logo" />}
                <div className="ex-shield"><ShieldCheck size={24} color="#22d3ee" strokeWidth={1.5} /></div>
                <div>
                  <p className="ex-center-tag">{centerName}</p>
                  <h1 className="ex-card-title">Admin Portal</h1>
                  <p className="ex-card-sub">Authorized personnel only</p>
                </div>
              </div>
              <div className="ex-sep" />
              {error && <div className="ex-err"><AlertCircle size={14} color="#f87171" /><span>{error}</span></div>}
              <form onSubmit={handleInitialLogin} className="ex-form">
                <div className="ex-field">
                  <label className="ex-lbl">Username or Email</label>
                  <div className={`ex-inp-wrap${focusedField === 'user' ? ' ex-focused' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={focusedField === 'user' ? '#22d3ee' : '#4b5563'} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('user')} onBlur={() => setFocusedField(null)}
                      placeholder="admin@example.com" required disabled={loading} className="ex-inp" />
                  </div>
                </div>
                <div className="ex-field">
                  <label className="ex-lbl">Password</label>
                  <div className={`ex-inp-wrap${focusedField === 'pass' ? ' ex-focused' : ''}`}>
                    <Lock size={14} color={focusedField === 'pass' ? '#22d3ee' : '#4b5563'} />
                    <input type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('pass')} onBlur={() => setFocusedField(null)}
                      placeholder="••••••••••••" required disabled={loading} className="ex-inp" />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="ex-eye" disabled={loading}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                  <button type="button" onClick={() => { setView('forgot'); }} className="ex-forgot">Forgot password?</button>
                </div>
                <button type="submit" disabled={loading} className="ex-btn">
                  {loading
                    ? <span className="ex-btn-row"><span className="ex-spin" />Authenticating…</span>
                    : <span className="ex-btn-row">Access Dashboard <ArrowRight size={15} /></span>}
                </button>
              </form>
              <div className="ex-sec-row">
                <span className="ex-sec-dot" />
                <span className="ex-sec-txt">256-bit encrypted · Secured connection</span>
              </div>
              <div className="ex-warn">
                <AlertCircle size={11} color="#92400e" />
                <span>Unauthorized access attempts are logged and may result in account lockout.</span>
              </div>
            </div>
          )}

          <p className="ex-ver">{centerName} Admin · {new Date().getFullYear()}</p>
        </div>
      </div>
    </>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; }

.ex-root {
  min-height: 100vh; display: flex;
  font-family: 'Sora','Segoe UI',sans-serif;
  background: #060a14; overflow: hidden; position: relative;
}

/* Background layers */
.ex-bg-img  { position:absolute; inset:0; background-size:cover; background-position:center; z-index:0; }
.ex-bg-overlay { position:absolute; inset:0; background:#060a14; z-index:1; }

/* Grid */
.ex-grid {
  position:absolute; inset:0; pointer-events:none; z-index:1;
  background-image:
    linear-gradient(rgba(34,211,238,.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34,211,238,.022) 1px, transparent 1px);
  background-size: 64px 64px;
}

/* Glow orbs */
.ex-orb { position:absolute; border-radius:50%; pointer-events:none; z-index:1; filter:blur(90px); }
.ex-orb-1 { width:500px; height:500px; background:radial-gradient(circle,rgba(34,211,238,.06) 0%,transparent 70%); top:-120px; right:-60px; animation:ex-drift1 14s ease-in-out infinite alternate; }
.ex-orb-2 { width:400px; height:400px; background:radial-gradient(circle,rgba(99,102,241,.06) 0%,transparent 70%); bottom:-80px; left:-80px; animation:ex-drift2 11s ease-in-out infinite alternate; }
@keyframes ex-drift1 { from{transform:translate(0,0)} to{transform:translate(30px,20px)} }
@keyframes ex-drift2 { from{transform:translate(0,0)} to{transform:translate(-25px,30px)} }

/* Particles */
.ex-particle { position:absolute; border-radius:50%; pointer-events:none; z-index:1; opacity:0; animation:ex-ptcl 8s ease-in-out infinite; }
.ex-p0{width:2px;height:2px;background:#22d3ee;} .ex-p1{width:2px;height:2px;background:#6366f1;} .ex-p2{width:2px;height:2px;background:#f59e0b;} .ex-p3{width:1px;height:1px;background:#a5b4fc;} .ex-p4{width:2px;height:2px;background:#34d399;}
@keyframes ex-ptcl { 0%,100%{opacity:0;transform:translateY(0)} 50%{opacity:.5;transform:translateY(-18px)} }

/* ── LEFT ── */
.ex-left {
  flex:1; min-height:100vh; position:relative; z-index:2;
  background:linear-gradient(155deg,#060a14 0%,#080f1e 55%,#06101c 100%);
  border-right:1px solid rgba(34,211,238,.05);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:56px 40px; overflow:hidden;
  opacity:0; transform:translateX(-28px);
  transition:opacity .7s ease, transform .7s ease;
}
.ex-left.ex-in { opacity:1; transform:translateX(0); }

/* Logo bar */
.ex-logo-bar { position:absolute; top:28px; left:36px; display:flex; align-items:center; gap:10px; }
.ex-logo-img  { height:32px; max-width:110px; object-fit:contain; }
.ex-logo-icon {
  width:34px; height:34px; border-radius:10px;
  background:rgba(34,211,238,.07); border:1px solid rgba(34,211,238,.14);
  display:flex; align-items:center; justify-content:center;
}
.ex-logo-name { font-size:12.5px; font-weight:700; color:#475569; letter-spacing:.02em; }

/* Scene container */
.ex-scene { position:relative; width:420px; height:340px; margin-bottom:28px; flex-shrink:0; }

/* SVG lines */
.ex-lines { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
.ex-dl  { animation:ex-dash 2.8s linear infinite; }
.ex-dl2 { animation:ex-dash 2.8s linear infinite; animation-delay:-.9s; }
.ex-dl3 { animation:ex-dash 2.8s linear infinite; animation-delay:-1.8s; }
@keyframes ex-dash { to { stroke-dashoffset:-18; } }

/* Monitor */
.ex-monitor-wrap {
  position:absolute; left:50%; top:50%; transform:translate(-50%,-54%);
  animation:ex-mfloat 5s ease-in-out infinite;
}
@keyframes ex-mfloat {
  0%,100%{ transform:translate(-50%,-54%) rotateX(3deg); }
  50%    { transform:translate(-50%,calc(-54% - 12px)) rotateX(-1deg); }
}
.ex-monitor { width:200px; display:flex; flex-direction:column; align-items:center; }

.ex-screen {
  width:200px; height:126px;
  background:linear-gradient(155deg,#09152a,#060e1e);
  border:1px solid rgba(34,211,238,.22); border-radius:10px 10px 0 0;
  padding:10px 12px 8px; position:relative; overflow:hidden;
  box-shadow:0 0 50px rgba(34,211,238,.08), inset 0 0 24px rgba(34,211,238,.03);
}
.ex-screen::after {
  content:''; position:absolute; inset:0;
  background:linear-gradient(180deg,rgba(34,211,238,.025) 0%,transparent 60%);
  pointer-events:none;
}

.ex-screen-topbar {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:8px;
}
.ex-screen-dots { display:flex; gap:4px; }
.ex-sdot { width:5px; height:5px; border-radius:50%; }
.ex-sdot-g { background:#34d399; box-shadow:0 0 5px #34d399; animation:ex-blink 2s ease-in-out infinite; }
.ex-sdot-y { background:#fbbf24; }
.ex-sdot-r { background:#f87171; }
@keyframes ex-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
.ex-screen-title { font-size:8px; font-weight:700; color:rgba(34,211,238,.5); letter-spacing:.08em; text-transform:uppercase; }

.ex-chart { display:flex; align-items:flex-end; gap:4px; height:60px; }
.ex-bar {
  flex:1; border-radius:3px 3px 0 0;
  background:linear-gradient(to top,rgba(34,211,238,.7),rgba(99,102,241,.5));
  animation:ex-grow 1.4s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes ex-grow { from{transform:scaleY(0);transform-origin:bottom;opacity:0} to{transform:scaleY(1);transform-origin:bottom;opacity:1} }

.ex-screen-hr { height:1px; background:rgba(34,211,238,.1); margin-top:6px; }
.ex-mini-stats { display:flex; gap:12px; margin-top:5px; }
.ex-mstat { font-size:8.5px; color:#374151; font-weight:600; letter-spacing:.04em; }
.ex-mstat b { color:rgba(34,211,238,.7); font-weight:800; }

.ex-stand {
  width:22px; height:18px;
  background:linear-gradient(180deg,#0c1830,#08111e);
  border:1px solid rgba(34,211,238,.1); border-top:none;
  clip-path:polygon(20% 0%,80% 0%,100% 100%,0% 100%);
}
.ex-base {
  width:70px; height:5px; border-radius:4px; margin-top:-1px;
  background:linear-gradient(90deg,transparent,rgba(34,211,238,.18),transparent);
}

/* Floating stat cards */
.ex-fcard {
  position:absolute; background:rgba(8,15,28,.88); backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.06); border-radius:12px;
  padding:9px 12px; display:flex; align-items:center; gap:9px;
  min-width:116px; box-shadow:0 10px 30px rgba(0,0,0,.5);
}
.ex-fc1 { top:14px;  left:8px;  animation:ex-fl1 4.8s ease-in-out infinite; }
.ex-fc2 { top:14px;  right:8px; animation:ex-fl2 5.2s ease-in-out infinite; }
.ex-fc3 { bottom:28px; left:50%; animation:ex-fl3 4.4s ease-in-out infinite; }
@keyframes ex-fl1 { 0%,100%{transform:translateY(0)}       50%{transform:translateY(-9px)} }
@keyframes ex-fl2 { 0%,100%{transform:translateY(0)}       50%{transform:translateY(-11px)} }
@keyframes ex-fl3 { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-8px)} }

.ex-fc-icon { width:28px; height:28px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.ex-fc-body { flex:1; }
.ex-fc-val  { font-size:14px; font-weight:800; color:#e2e8f0; letter-spacing:-.3px; }
.ex-fc-lbl  { font-size:9.5px; color:#374151; font-weight:700; text-transform:uppercase; letter-spacing:.06em; margin-top:1px; }
.ex-fc-badge { font-size:9.5px; font-weight:800; padding:2px 6px; border-radius:100px; color:#34d399; background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.18); white-space:nowrap; }

/* Hero text */
.ex-hero { text-align:center; position:relative; z-index:2; }
.ex-h2 { font-size:clamp(28px,3.5vw,42px); font-weight:800; color:#e2e8f0; margin:0 0 12px; line-height:1.2; letter-spacing:-.5px; }
.ex-h2-accent { background:linear-gradient(135deg,#22d3ee,#818cf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.ex-hp { font-size:13.5px; color:#374151; margin:0 0 22px; line-height:1.75; font-weight:500; max-width:380px; }
.ex-badges { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.ex-chip {
  background:rgba(255,255,255,.04); backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.07); color:#64748b;
  font-size:12px; font-weight:600; padding:5px 14px; border-radius:100px;
}

/* ── RIGHT ── */
.ex-right {
  width:470px; min-height:100vh; flex-shrink:0; position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:48px 44px;
  opacity:0; transform:translateX(28px);
  transition:opacity .7s ease .15s, transform .7s ease .15s;
}
.ex-right.ex-in { opacity:1; transform:translateX(0); }

/* Card */
.ex-card {
  width:100%; max-width:400px; position:relative;
  background:linear-gradient(155deg,#0c1422,#08101e);
  border:1px solid rgba(34,211,238,.1); border-radius:20px; overflow:hidden;
  box-shadow:0 28px 90px rgba(0,0,0,.65), 0 0 0 1px rgba(34,211,238,.04) inset;
  animation:ex-rise .65s cubic-bezier(.16,1,.3,1) both;
}
@keyframes ex-rise { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
.ex-card::before {
  content:''; position:absolute; top:0; left:0; right:0; height:2px;
  background:linear-gradient(90deg,transparent,#22d3ee 40%,#818cf8 70%,transparent);
}

/* Card header */
.ex-card-head { display:flex; align-items:center; gap:14px; padding:26px 26px 18px; }
.ex-brand-logo { height:34px; max-width:96px; object-fit:contain; margin-right:2px; }
.ex-shield {
  width:50px; height:50px; border-radius:13px; flex-shrink:0;
  background:linear-gradient(135deg,#0d1e36,#122646);
  border:1px solid rgba(34,211,238,.18);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 18px rgba(34,211,238,.12);
  animation:ex-sglow 3s ease-in-out infinite;
}
@keyframes ex-sglow { 0%,100%{box-shadow:0 4px 18px rgba(34,211,238,.12)} 50%{box-shadow:0 4px 28px rgba(34,211,238,.32)} }
.ex-center-tag { margin:0 0 2px; font-size:9.5px; font-weight:700; color:#22d3ee; text-transform:uppercase; letter-spacing:.18em; }
.ex-card-title  { margin:0 0 2px; font-size:21px; font-weight:800; color:#f1f5f9; letter-spacing:-.3px; }
.ex-card-sub    { margin:0; font-size:11.5px; color:#374151; font-weight:500; }

.ex-sep { height:1px; background:linear-gradient(90deg,transparent,rgba(34,211,238,.08),transparent); }

/* Error */
.ex-err {
  display:flex; align-items:center; gap:9px;
  background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.18);
  border-radius:10px; padding:11px 14px; margin:14px 26px 0;
  font-size:12.5px; color:#f87171; font-weight:500;
  animation:ex-shake .4s ease both;
}
@keyframes ex-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }

/* Form */
.ex-form { display:flex; flex-direction:column; gap:15px; padding:18px 26px 0; }
.ex-field { display:flex; flex-direction:column; gap:6px; }
.ex-lbl { font-size:10.5px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:.1em; }
.ex-inp-wrap {
  display:flex; align-items:center; gap:9px; height:48px; padding:0 13px;
  background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.07);
  border-radius:12px; transition:border-color .2s, box-shadow .2s, background .2s;
}
.ex-inp-wrap.ex-focused {
  border-color:rgba(34,211,238,.4); background:rgba(34,211,238,.025);
  box-shadow:0 0 0 3px rgba(34,211,238,.07);
}
.ex-inp { flex:1; background:transparent; border:none; outline:none; font-size:14px; color:#e2e8f0; font-family:inherit; font-weight:500; }
.ex-inp::placeholder { color:#1f2937; }
.ex-eye { background:none; border:none; cursor:pointer; color:#374151; padding:0; display:flex; align-items:center; transition:color .2s; }
.ex-eye:hover { color:#22d3ee; }
.ex-forgot { background:none; border:none; cursor:pointer; font-size:11.5px; color:#374151; font-weight:600; font-family:inherit; padding:0; transition:color .15s; }
.ex-forgot:hover { color:#22d3ee; }

/* Submit button */
.ex-btn {
  width:100%; height:50px;
  background:linear-gradient(135deg,var(--brand-primary,#22d3ee),var(--brand-secondary,#6366f1));
  color:white; border:none; border-radius:12px; font-size:14.5px; font-weight:700;
  cursor:pointer; font-family:inherit; margin-top:4px;
  box-shadow:0 6px 22px rgba(34,211,238,.2);
  transition:opacity .2s, transform .15s, box-shadow .2s;
}
.ex-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); box-shadow:0 10px 32px rgba(34,211,238,.3); }
.ex-btn:active:not(:disabled) { transform:translateY(0); }
.ex-btn:disabled { opacity:.5; cursor:not-allowed; }
.ex-btn-row { display:flex; align-items:center; justify-content:center; gap:8px; }
.ex-spin { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,.25); border-top-color:white; border-radius:50%; animation:ex-rot .7s linear infinite; }
@keyframes ex-rot { to{transform:rotate(360deg)} }
.ex-back { background:none; border:none; cursor:pointer; color:#374151; font-size:12px; font-family:inherit; text-align:center; padding:6px 0; transition:color .15s; }
.ex-back:hover { color:#94a3b8; }

/* Security row */
.ex-sec-row { display:flex; align-items:center; justify-content:center; gap:8px; margin:16px 26px 0; }
.ex-sec-dot { width:6px; height:6px; border-radius:50%; background:#22d3ee; flex-shrink:0; animation:ex-pulse 2s ease-in-out infinite; }
@keyframes ex-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,211,238,.4)} 50%{box-shadow:0 0 0 5px rgba(34,211,238,0)} }
.ex-sec-txt { font-size:11px; color:#374151; font-weight:500; }

/* Warning footer */
.ex-warn {
  display:flex; align-items:flex-start; gap:7px;
  background:rgba(120,53,15,.1); border:1px solid rgba(120,53,15,.22);
  border-radius:0 0 20px 20px; padding:10px 18px;
  margin:14px 0 0; font-size:10.5px; color:#92400e; line-height:1.5;
}

/* Forgot-sent */
.ex-sent { display:flex; flex-direction:column; align-items:center; gap:14px; padding:36px 26px; text-align:center; }
.ex-sent-icon { width:58px; height:58px; border-radius:50%; background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.2); display:flex; align-items:center; justify-content:center; }
.ex-sent-h { margin:0; font-size:19px; font-weight:800; color:#f1f5f9; }
.ex-sent-p { margin:0; font-size:13px; color:#4b5563; line-height:1.65; max-width:280px; }
.ex-sent-p strong { color:#e2e8f0; }

.ex-ver { font-size:11px; color:#1f2937; margin-top:18px; letter-spacing:.04em; position:relative; z-index:2; }

@media (max-width:960px) {
  .ex-root { flex-direction:column; }
  .ex-left { min-height:auto; padding:44px 28px 32px; }
  .ex-scene { width:340px; height:280px; }
  .ex-right { width:100%; min-height:auto; padding:32px 22px 48px; }
}
@media (max-width:540px) {
  .ex-scene { display:none; }
  .ex-logo-bar { position:relative; top:auto; left:auto; margin-bottom:12px; }
  .ex-h2 { font-size:26px; }
}
`;
