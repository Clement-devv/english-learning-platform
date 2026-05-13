// src/pages/sub-admin/login-themes/ExecutiveTheme.jsx
// Same visual design as admin ExecutiveTheme — different copy and auth endpoint.
import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, Shield, ArrowRight, Mail, CheckCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useSubAdminLoginLogic } from './useSubAdminLoginLogic';

export default function SubAdminExecutiveTheme() {
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
    handleForgotPassword, navigate,
  } = useSubAdminLoginLogic();

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
        <div className="ex-orb ex-orb-1" />
        <div className="ex-orb ex-orb-2" />

        {[...Array(18)].map((_, i) => (
          <span key={i} className={`ex-particle ex-p${i % 5}`}
            style={{ left: `${(i * 53 + 7) % 100}%`, top: `${(i * 67 + 13) % 100}%`, animationDelay: `${(i * 0.9) % 7}s` }}
          />
        ))}

        {/* ── LEFT — Illustration ── */}
        <div className={`ex-left${mounted ? ' ex-in' : ''}`}>

          <div className="ex-logo-bar">
            {branding.logo
              ? <img src={branding.logo} alt={centerName} className="ex-logo-img" />
              : <div className="ex-logo-icon"><Shield size={16} color="#818cf8" strokeWidth={1.5} /></div>
            }
            <span className="ex-logo-name">{centerName}</span>
          </div>

          <div className="ex-scene">
            <svg className="ex-lines" viewBox="0 0 420 340" fill="none">
              <line x1="75"  y1="95"  x2="195" y2="165" stroke="rgba(99,102,241,0.18)"  strokeWidth="1" strokeDasharray="5 5" className="ex-dl" />
              <line x1="345" y1="85"  x2="225" y2="165" stroke="rgba(168,85,247,0.18)"  strokeWidth="1" strokeDasharray="5 5" className="ex-dl ex-dl2" />
              <line x1="90"  y1="270" x2="195" y2="215" stroke="rgba(245,158,11,0.18)"  strokeWidth="1" strokeDasharray="5 5" className="ex-dl ex-dl3" />
              <circle cx="75"  cy="95"  r="3.5" fill="rgba(99,102,241,0.5)" />
              <circle cx="345" cy="85"  r="3.5" fill="rgba(168,85,247,0.5)" />
              <circle cx="90"  cy="270" r="3.5" fill="rgba(245,158,11,0.5)" />
            </svg>

            <div className="ex-monitor-wrap">
              <div className="ex-monitor">
                <div className="ex-screen ex-screen-indigo">
                  <div className="ex-screen-topbar">
                    <div className="ex-screen-dots">
                      <span className="ex-sdot ex-sdot-g" />
                      <span className="ex-sdot ex-sdot-y" />
                      <span className="ex-sdot ex-sdot-r" />
                    </div>
                    <span className="ex-screen-title">My Assigned Team</span>
                  </div>
                  <div className="ex-chart ex-chart-indigo">
                    {[40, 65, 52, 78, 45, 82, 55, 70].map((h, i) => (
                      <div key={i} className="ex-bar ex-bar-indigo" style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                  <div className="ex-screen-hr" />
                  <div className="ex-live-badge"><span className="ex-live-dot-sm" />LIVE</div>
                </div>
                <div className="ex-stand" />
                <div className="ex-base" />
              </div>
            </div>

            {/* Floating cards — sub-admin scope */}
            <div className="ex-fcard ex-fc1">
              <div className="ex-fc-icon" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="ex-fc-body">
                <div className="ex-fc-feat">My Team</div>
                <div className="ex-fc-status"><span className="ex-live-dot" style={{ background: '#818cf8' }} />Live</div>
              </div>
            </div>

            <div className="ex-fcard ex-fc2">
              <div className="ex-fc-icon" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="ex-fc-body">
                <div className="ex-fc-feat">Track Progress</div>
                <div className="ex-fc-status"><span className="ex-live-dot" style={{ background: '#c084fc' }} />Active</div>
              </div>
            </div>

            <div className="ex-fcard ex-fc3">
              <div className="ex-fc-icon" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div className="ex-fc-body">
                <div className="ex-fc-feat">Live Sessions</div>
                <div className="ex-fc-status"><span className="ex-live-dot" style={{ background: '#fbbf24' }} />Running</div>
              </div>
            </div>
          </div>

          <div className="ex-hero">
            <h2 className="ex-h2">Manage Your<br /><span className="ex-h2-accent ex-h2-indigo">Assigned Team</span></h2>
            <p className="ex-hp">View and support the teachers and students assigned to you. Your scoped dashboard, fully under control.</p>
            <div className="ex-badges">
              <span className="ex-chip">👨‍🏫 Assigned teachers</span>
              <span className="ex-chip">📈 Track progress</span>
              <span className="ex-chip">💬 Direct messages</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — Login Form ── */}
        <div className={`ex-right${mounted ? ' ex-in' : ''}`}>

          {view === 'forgot' ? (
            <div className="ex-card">
              <div className="ex-card-head">
                <div className="ex-shield ex-shield-indigo"><Mail size={24} color="#818cf8" strokeWidth={1.5} /></div>
                <div>
                  <p className="ex-center-tag ex-tag-indigo">{centerName}</p>
                  <h1 className="ex-card-title">Reset Password</h1>
                  <p className="ex-card-sub">Enter your sub-admin email</p>
                </div>
              </div>
              <div className="ex-sep" />
              {forgotError && <div className="ex-err"><AlertCircle size={14} color="#f87171" /><span>{forgotError}</span></div>}
              <form onSubmit={handleForgotPassword} className="ex-form">
                <div className="ex-field">
                  <label className="ex-lbl">Email Address</label>
                  <div className={`ex-inp-wrap${focusedField === 'forgot' ? ' ex-focused-indigo' : ''}`}>
                    <Mail size={14} color={focusedField === 'forgot' ? '#818cf8' : '#4b5563'} />
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      onFocus={() => setFocusedField('forgot')} onBlur={() => setFocusedField(null)}
                      placeholder="you@example.com" required disabled={forgotLoading} className="ex-inp" autoFocus />
                  </div>
                </div>
                <button type="submit" disabled={forgotLoading} className="ex-btn ex-btn-indigo">
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
                  If <strong>{forgotEmail}</strong> is registered, a reset link has been sent. Expires in 1 hour.
                </p>
                <button onClick={() => { setView('login'); setForgotEmail(''); }} className="ex-btn ex-btn-indigo" style={{ width: 'auto', padding: '12px 32px' }}>
                  Back to Login
                </button>
              </div>
            </div>

          ) : (
            <div className="ex-card">
              <div className="ex-card-head">
                {branding.logo && <img src={branding.logo} alt={centerName} className="ex-brand-logo" />}
                <div className="ex-shield ex-shield-indigo"><Shield size={24} color="#818cf8" strokeWidth={1.5} /></div>
                <div>
                  <p className="ex-center-tag ex-tag-indigo">{centerName}</p>
                  <h1 className="ex-card-title">Sub-Admin Portal</h1>
                  <p className="ex-card-sub">Manage your assigned team</p>
                </div>
              </div>
              <div className="ex-sep" />
              {error && <div className="ex-err"><AlertCircle size={14} color="#f87171" /><span>{error}</span></div>}
              <form onSubmit={handleInitialLogin} className="ex-form">
                <div className="ex-field">
                  <label className="ex-lbl">Email Address</label>
                  <div className={`ex-inp-wrap${focusedField === 'user' ? ' ex-focused-indigo' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={focusedField === 'user' ? '#818cf8' : '#4b5563'} strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('user')} onBlur={() => setFocusedField(null)}
                      placeholder="you@example.com" required disabled={loading} className="ex-inp" />
                  </div>
                </div>
                <div className="ex-field">
                  <label className="ex-lbl">Password</label>
                  <div className={`ex-inp-wrap${focusedField === 'pass' ? ' ex-focused-indigo' : ''}`}>
                    <Lock size={14} color={focusedField === 'pass' ? '#818cf8' : '#4b5563'} />
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
                  <button type="button" onClick={() => setView('forgot')} className="ex-forgot ex-forgot-indigo">Forgot password?</button>
                </div>
                <button type="submit" disabled={loading} className="ex-btn ex-btn-indigo">
                  {loading
                    ? <span className="ex-btn-row"><span className="ex-spin" />Signing In…</span>
                    : <span className="ex-btn-row">Access Dashboard <ArrowRight size={15} /></span>}
                </button>
              </form>

              {/* Other portal links */}
              <div className="ex-portals">
                <div className="ex-portals-hr"><div /><span>Other portals</span><div /></div>
                {[
                  { label: 'Main Admin Portal', path: '/admin/login' },
                  { label: 'Teacher Portal', path: '/teacher/login' },
                ].map(({ label, path }) => (
                  <button key={path} onClick={() => navigate(path)} className="ex-portal-btn">{label}</button>
                ))}
              </div>
            </div>
          )}

          <p className="ex-ver">{centerName} Sub-Admin · {new Date().getFullYear()}</p>
        </div>
      </div>
    </>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; }

.ex-root {
  min-height:100vh; display:flex;
  font-family:'Sora','Segoe UI',sans-serif;
  background:#060a14; overflow:hidden; position:relative;
}
.ex-bg-img  { position:absolute; inset:0; background-size:cover; background-position:center; z-index:0; }
.ex-bg-overlay { position:absolute; inset:0; background:#060a14; z-index:1; }
.ex-grid {
  position:absolute; inset:0; pointer-events:none; z-index:1;
  background-image:linear-gradient(rgba(99,102,241,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.022) 1px,transparent 1px);
  background-size:64px 64px;
}
.ex-orb { position:absolute; border-radius:50%; pointer-events:none; z-index:1; filter:blur(90px); }
.ex-orb-1 { width:500px;height:500px;background:radial-gradient(circle,rgba(99,102,241,.07) 0%,transparent 70%);top:-120px;right:-60px;animation:ex-drift1 14s ease-in-out infinite alternate; }
.ex-orb-2 { width:400px;height:400px;background:radial-gradient(circle,rgba(168,85,247,.06) 0%,transparent 70%);bottom:-80px;left:-80px;animation:ex-drift2 11s ease-in-out infinite alternate; }
@keyframes ex-drift1 { from{transform:translate(0,0)} to{transform:translate(30px,20px)} }
@keyframes ex-drift2 { from{transform:translate(0,0)} to{transform:translate(-25px,30px)} }
.ex-particle { position:absolute; border-radius:50%; pointer-events:none; z-index:1; opacity:0; animation:ex-ptcl 8s ease-in-out infinite; }
.ex-p0{width:2px;height:2px;background:#818cf8;} .ex-p1{width:2px;height:2px;background:#c084fc;} .ex-p2{width:2px;height:2px;background:#f59e0b;} .ex-p3{width:1px;height:1px;background:#a5b4fc;} .ex-p4{width:2px;height:2px;background:#34d399;}
@keyframes ex-ptcl { 0%,100%{opacity:0;transform:translateY(0)} 50%{opacity:.5;transform:translateY(-18px)} }

.ex-left {
  flex:1; min-height:100vh; position:relative; z-index:2;
  background:linear-gradient(155deg,#060a14 0%,#080d1e 55%,#070b1a 100%);
  border-right:1px solid rgba(99,102,241,.05);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:56px 40px; overflow:hidden;
  opacity:0; transform:translateX(-28px);
  transition:opacity .7s ease, transform .7s ease;
}
.ex-left.ex-in { opacity:1; transform:translateX(0); }

.ex-logo-bar { position:absolute; top:28px; left:36px; display:flex; align-items:center; gap:10px; }
.ex-logo-img  { height:32px; max-width:110px; object-fit:contain; }
.ex-logo-icon { width:34px;height:34px;border-radius:10px;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.14);display:flex;align-items:center;justify-content:center; }
.ex-logo-name { font-size:12.5px; font-weight:700; color:#475569; }

.ex-scene { position:relative; width:560px; height:460px; margin-bottom:16px; flex-shrink:0; }
.ex-lines { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
.ex-dl  { animation:ex-dash 2.8s linear infinite; }
.ex-dl2 { animation:ex-dash 2.8s linear infinite; animation-delay:-.9s; }
.ex-dl3 { animation:ex-dash 2.8s linear infinite; animation-delay:-1.8s; }
@keyframes ex-dash { to{stroke-dashoffset:-18} }

.ex-monitor-wrap { position:absolute; left:50%; top:50%; transform:translate(-50%,-54%); animation:ex-mfloat 5s ease-in-out infinite; }
@keyframes ex-mfloat { 0%,100%{transform:translate(-50%,-54%) rotateX(3deg)} 50%{transform:translate(-50%,calc(-54% - 16px)) rotateX(-1deg)} }
.ex-monitor { width:280px; display:flex; flex-direction:column; align-items:center; }
.ex-screen { width:280px;height:176px;background:linear-gradient(155deg,#09152a,#060e1e);border:1px solid rgba(99,102,241,.22);border-radius:12px 12px 0 0;padding:13px 15px 10px;position:relative;overflow:hidden;box-shadow:0 0 70px rgba(99,102,241,.10),inset 0 0 32px rgba(99,102,241,.04); }
.ex-screen-indigo { border-color:rgba(99,102,241,.25) !important; }
.ex-screen-topbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:11px; }
.ex-screen-dots { display:flex; gap:5px; }
.ex-sdot { width:7px;height:7px;border-radius:50%; }
.ex-sdot-g { background:#34d399;box-shadow:0 0 7px #34d399;animation:ex-blink 2s ease-in-out infinite; }
.ex-sdot-y { background:#fbbf24; } .ex-sdot-r { background:#f87171; }
@keyframes ex-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
.ex-screen-title { font-size:10px;font-weight:700;color:rgba(99,102,241,.6);letter-spacing:.08em;text-transform:uppercase; }
.ex-chart { display:flex; align-items:flex-end; gap:5px; height:96px; }
.ex-bar { flex:1;border-radius:4px 4px 0 0;background:linear-gradient(to top,rgba(34,211,238,.7),rgba(99,102,241,.5));animation:ex-grow 1.4s cubic-bezier(.34,1.56,.64,1) both; }
.ex-bar-indigo { background:linear-gradient(to top,rgba(99,102,241,.7),rgba(168,85,247,.5)) !important; }
@keyframes ex-grow { from{transform:scaleY(0);transform-origin:bottom;opacity:0} to{transform:scaleY(1);transform-origin:bottom;opacity:1} }
.ex-screen-hr { height:1px;background:rgba(99,102,241,.1);margin-top:9px; }
.ex-live-badge { display:flex; align-items:center; gap:6px; margin-top:7px; font-size:9px; font-weight:800; color:rgba(99,102,241,.6); letter-spacing:.12em; }
.ex-live-dot-sm { width:5px; height:5px; border-radius:50%; background:#34d399; flex-shrink:0; animation:ex-blink 2s ease-in-out infinite; }
.ex-stand { width:32px;height:26px;background:linear-gradient(180deg,#0c1830,#08111e);border:1px solid rgba(99,102,241,.1);border-top:none;clip-path:polygon(20% 0%,80% 0%,100% 100%,0% 100%); }
.ex-base { width:96px;height:6px;border-radius:4px;margin-top:-1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,.22),transparent); }

.ex-fcard { position:absolute;background:rgba(8,15,28,.88);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:12px;min-width:142px;box-shadow:0 12px 36px rgba(0,0,0,.55); }
.ex-fc1 { top:18px;left:10px;animation:ex-fl1 4.8s ease-in-out infinite; }
.ex-fc2 { top:18px;right:10px;animation:ex-fl2 5.2s ease-in-out infinite; }
.ex-fc3 { bottom:36px;left:50%;animation:ex-fl3 4.4s ease-in-out infinite; }
@keyframes ex-fl1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
@keyframes ex-fl2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
@keyframes ex-fl3 { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-9px)} }
.ex-fc-icon { width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.ex-fc-body { flex:1; }
.ex-fc-val  { font-size:14px;font-weight:800;color:#e2e8f0;letter-spacing:-.3px; }
.ex-fc-lbl  { font-size:9.5px;color:#374151;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:1px; }
.ex-fc-badge { font-size:9.5px;font-weight:800;padding:2px 6px;border-radius:100px;color:#34d399;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.18);white-space:nowrap; }
.ex-fc-feat { font-size:13px; font-weight:700; color:#e2e8f0; letter-spacing:-.2px; white-space:nowrap; }
.ex-fc-status { display:flex; align-items:center; gap:5px; margin-top:3px; font-size:10px; color:#4b5563; font-weight:600; }
.ex-live-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; animation:ex-live-pulse 2s ease-in-out infinite; }
@keyframes ex-live-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.ex-fc-badge-indigo { color:#818cf8 !important;background:rgba(99,102,241,.1) !important;border-color:rgba(99,102,241,.2) !important; }
.ex-fc-badge-purple  { color:#c084fc !important;background:rgba(168,85,247,.1) !important;border-color:rgba(168,85,247,.2) !important; }

.ex-hero { text-align:center; position:relative; z-index:2; }
.ex-h2 { font-size:clamp(28px,3.5vw,42px);font-weight:800;color:#e2e8f0;margin:0 0 12px;line-height:1.2;letter-spacing:-.5px; }
.ex-h2-accent { background:linear-gradient(135deg,#22d3ee,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.ex-h2-indigo  { background:linear-gradient(135deg,#818cf8,#c084fc) !important;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text; }
.ex-hp { font-size:13.5px;color:#374151;margin:0 0 22px;line-height:1.75;font-weight:500;max-width:380px; }
.ex-badges { display:flex;flex-wrap:wrap;gap:8px;justify-content:center; }
.ex-chip { background:rgba(255,255,255,.04);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.07);color:#64748b;font-size:12px;font-weight:600;padding:5px 14px;border-radius:100px; }

.ex-right {
  width:470px; min-height:100vh; flex-shrink:0; position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:48px 44px;
  opacity:0; transform:translateX(28px);
  transition:opacity .7s ease .15s, transform .7s ease .15s;
}
.ex-right.ex-in { opacity:1; transform:translateX(0); }

.ex-card { width:100%;max-width:400px;position:relative;background:linear-gradient(155deg,#0c1422,#08101e);border:1px solid rgba(99,102,241,.1);border-radius:20px;overflow:hidden;box-shadow:0 28px 90px rgba(0,0,0,.65),0 0 0 1px rgba(99,102,241,.04) inset;animation:ex-rise .65s cubic-bezier(.16,1,.3,1) both; }
@keyframes ex-rise { from{opacity:0;transform:translateY(24px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
.ex-card::before { content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#818cf8 40%,#c084fc 70%,transparent); }

.ex-card-head { display:flex;align-items:center;gap:14px;padding:26px 26px 18px; }
.ex-brand-logo { height:34px;max-width:96px;object-fit:contain;margin-right:2px; }
.ex-shield { width:50px;height:50px;border-radius:13px;flex-shrink:0;background:linear-gradient(135deg,#0d1e36,#122646);border:1px solid rgba(34,211,238,.18);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(34,211,238,.12);animation:ex-sglow 3s ease-in-out infinite; }
.ex-shield-indigo { border-color:rgba(99,102,241,.2) !important;box-shadow:0 4px 18px rgba(99,102,241,.12) !important; }
@keyframes ex-sglow { 0%,100%{box-shadow:0 4px 18px rgba(99,102,241,.12)} 50%{box-shadow:0 4px 28px rgba(99,102,241,.32)} }
.ex-center-tag { margin:0 0 2px;font-size:9.5px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:.18em; }
.ex-tag-indigo  { color:#818cf8 !important; }
.ex-card-title { margin:0 0 2px;font-size:21px;font-weight:800;color:#f1f5f9;letter-spacing:-.3px; }
.ex-card-sub   { margin:0;font-size:11.5px;color:#374151;font-weight:500; }
.ex-sep { height:1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,.08),transparent); }

.ex-err { display:flex;align-items:center;gap:9px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.18);border-radius:10px;padding:11px 14px;margin:14px 26px 0;font-size:12.5px;color:#f87171;font-weight:500;animation:ex-shake .4s ease both; }
@keyframes ex-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }

.ex-form { display:flex;flex-direction:column;gap:15px;padding:18px 26px 0; }
.ex-field { display:flex;flex-direction:column;gap:6px; }
.ex-lbl { font-size:10.5px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.1em; }
.ex-inp-wrap { display:flex;align-items:center;gap:9px;height:48px;padding:0 13px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:12px;transition:border-color .2s,box-shadow .2s,background .2s; }
.ex-inp-wrap.ex-focused-indigo { border-color:rgba(99,102,241,.4);background:rgba(99,102,241,.025);box-shadow:0 0 0 3px rgba(99,102,241,.07); }
.ex-inp { flex:1;background:transparent;border:none;outline:none;font-size:14px;color:#e2e8f0;font-family:inherit;font-weight:500; }
.ex-inp::placeholder { color:#1f2937; }
.ex-eye { background:none;border:none;cursor:pointer;color:#374151;padding:0;display:flex;align-items:center;transition:color .2s; }
.ex-eye:hover { color:#818cf8; }
.ex-forgot { background:none;border:none;cursor:pointer;font-size:11.5px;color:#374151;font-weight:600;font-family:inherit;padding:0;transition:color .15s; }
.ex-forgot-indigo:hover { color:#818cf8 !important; }

.ex-btn { width:100%;height:50px;background:linear-gradient(135deg,var(--brand-primary,#818cf8),var(--brand-secondary,#c084fc));color:white;border:none;border-radius:12px;font-size:14.5px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:4px;box-shadow:0 6px 22px rgba(99,102,241,.2);transition:opacity .2s,transform .15s,box-shadow .2s; }
.ex-btn-indigo { background:linear-gradient(135deg,#6366f1,#a855f7) !important;box-shadow:0 6px 22px rgba(99,102,241,.25) !important; }
.ex-btn:hover:not(:disabled) { opacity:.9;transform:translateY(-1px);box-shadow:0 10px 32px rgba(99,102,241,.35) !important; }
.ex-btn:active:not(:disabled) { transform:translateY(0); }
.ex-btn:disabled { opacity:.5;cursor:not-allowed; }
.ex-btn-row { display:flex;align-items:center;justify-content:center;gap:8px; }
.ex-spin { display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.25);border-top-color:white;border-radius:50%;animation:ex-rot .7s linear infinite; }
@keyframes ex-rot { to{transform:rotate(360deg)} }
.ex-back { background:none;border:none;cursor:pointer;color:#374151;font-size:12px;font-family:inherit;text-align:center;padding:6px 0;transition:color .15s; }
.ex-back:hover { color:#94a3b8; }

.ex-portals { padding:18px 26px 26px; }
.ex-portals-hr { display:flex;align-items:center;gap:10px;margin-bottom:12px; }
.ex-portals-hr div { flex:1;height:1px;background:rgba(255,255,255,.05); }
.ex-portals-hr span { font-size:11px;color:#1f2937;white-space:nowrap; }
.ex-portal-btn { width:100%;padding:9px 14px;border-radius:10px;background:transparent;border:1px solid rgba(255,255,255,.05);color:#374151;font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;margin-bottom:6px;display:block; }
.ex-portal-btn:hover { background:rgba(255,255,255,.04);color:#9ca3af; }

.ex-sent { display:flex;flex-direction:column;align-items:center;gap:14px;padding:36px 26px;text-align:center; }
.ex-sent-icon { width:58px;height:58px;border-radius:50%;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2);display:flex;align-items:center;justify-content:center; }
.ex-sent-h { margin:0;font-size:19px;font-weight:800;color:#f1f5f9; }
.ex-sent-p { margin:0;font-size:13px;color:#4b5563;line-height:1.65;max-width:280px; }
.ex-sent-p strong { color:#e2e8f0; }
.ex-ver { font-size:11px;color:#1f2937;margin-top:18px;letter-spacing:.04em;position:relative;z-index:2; }

@media (max-width:960px) {
  .ex-root { flex-direction:column; }
  .ex-left { min-height:auto; padding:44px 28px 32px; }
  .ex-scene { width:460px; height:380px; }
  .ex-right { width:100%; min-height:auto; padding:32px 22px 48px; }
}
@media (max-width:540px) {
  .ex-scene { display:none; }
  .ex-logo-bar { position:relative; top:auto; left:auto; margin-bottom:12px; }
  .ex-h2 { font-size:26px; }
}
`;
