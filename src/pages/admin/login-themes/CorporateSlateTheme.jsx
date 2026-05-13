// src/pages/admin/login-themes/CorporateSlateTheme.jsx
// Corporate Slate admin login — dark slate, flowing org-chart nodes, indigo accent.
import React, { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, LayoutDashboard, ArrowRight, Mail, CheckCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useAdminLoginLogic } from './useAdminLoginLogic';

export default function CorporateSlateTheme() {
  const {
    username, setUsername, password, setPassword,
    showPassword, setShowPassword, error, loading, requires2FA,
    focusedField, setFocusedField, view, setView,
    forgotEmail, setForgotEmail, forgotLoading, forgotError,
    handleInitialLogin, handle2FAVerification, handleCancel2FA, handleForgotPassword,
  } = useAdminLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 60); return () => clearTimeout(t); }, []);

  if (requires2FA) {
    return <div className="cs-root"><TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} /></div>;
  }

  // Org chart nodes
  const nodes = [
    { label: 'Admin', x: 50, y: 12, accent: '#818cf8' },
    { label: 'Teachers', x: 20, y: 40, accent: '#38bdf8' },
    { label: 'Students', x: 50, y: 40, accent: '#34d399' },
    { label: 'Classes', x: 80, y: 40, accent: '#f59e0b' },
    { label: 'Reports', x: 20, y: 68, accent: '#38bdf8' },
    { label: 'Homework', x: 50, y: 68, accent: '#34d399' },
    { label: 'Schedule', x: 80, y: 68, accent: '#f59e0b' },
  ];
  const edges = [
    [0,1],[0,2],[0,3],[1,4],[2,5],[3,6],
  ];

  return (
    <>
      <style>{css}</style>
      <div className="cs-root" style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Plus Jakarta Sans', sans-serif` } : {}}>

        {branding.loginBackground && (
          <>
            <div className="cs-bg-img" style={{ backgroundImage: `url(${branding.loginBackground})` }} />
            <div className="cs-bg-overlay" style={{ opacity: Math.max(branding.loginBgOverlay ?? 0.75, 0.70) }} />
          </>
        )}

        {/* Animated grid */}
        <div className="cs-grid" />

        {/* Glow orbs */}
        <div className="cs-orb cs-orb-1" />
        <div className="cs-orb cs-orb-2" />
        <div className="cs-orb cs-orb-3" />

        {/* Flowing data particles */}
        {[...Array(20)].map((_, i) => (
          <span key={i} className={`cs-dot cs-dt${i % 4}`}
            style={{ left: `${(i * 47 + 5) % 100}%`, top: `${(i * 61 + 11) % 100}%`, animationDelay: `${(i * 0.7) % 6}s` }} />
        ))}

        {/* ── LEFT PANEL ── */}
        <div className={`cs-left${mounted ? ' cs-in' : ''}`}>

          <div className="cs-logo-bar">
            {branding.logo
              ? <img src={branding.logo} alt={centerName} className="cs-logo-img" />
              : <div className="cs-logo-icon"><LayoutDashboard size={16} color="#818cf8" strokeWidth={1.5} /></div>
            }
            <span className="cs-logo-name">{centerName}</span>
          </div>

          {/* Org chart SVG */}
          <div className="cs-org-wrap">
            <svg className="cs-org-svg" viewBox="0 0 100 82" fill="none">
              {/* Edges */}
              {edges.map(([a, b], i) => (
                <line key={i}
                  x1={`${nodes[a].x}%`} y1={`${nodes[a].y + 4}%`}
                  x2={`${nodes[b].x}%`} y2={`${nodes[b].y - 4}%`}
                  stroke="rgba(129,140,248,0.18)" strokeWidth="0.6"
                  strokeDasharray="2 2"
                  className={`cs-edge cs-e${i}`}
                />
              ))}
              {/* Flow dots on edges */}
              {edges.map(([a, b], i) => (
                <circle key={`f${i}`} r="0.9" fill="#818cf8"
                  className={`cs-flow cs-f${i % 3}`}
                  opacity="0.7">
                  <animateMotion dur={`${1.8 + i * 0.3}s`} repeatCount="indefinite" begin={`${i * 0.4}s`}>
                    <mpath href={`#ep${i}`} />
                  </animateMotion>
                </circle>
              ))}
              {/* Invisible paths for animateMotion */}
              {edges.map(([a, b], i) => (
                <path key={`ep${i}`} id={`ep${i}`}
                  d={`M ${nodes[a].x} ${nodes[a].y + 4} L ${nodes[b].x} ${nodes[b].y - 4}`}
                  stroke="none" />
              ))}
              {/* Nodes */}
              {nodes.map((n, i) => (
                <g key={i} transform={`translate(${n.x}, ${n.y})`}>
                  <rect x="-8" y="-3.5" width="16" height="7" rx="1.8"
                    fill="rgba(15,23,42,0.9)" stroke={n.accent} strokeWidth="0.5"
                    className={`cs-node cs-n${i}`} />
                  <text x="0" y="1.2" textAnchor="middle" fontSize="2.6" fill={n.accent} fontWeight="600"
                    fontFamily="inherit" className="cs-nlbl">
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Hero text */}
          <div className="cs-hero">
            <h2 className="cs-h2">Manage with<br /><span className="cs-h2-accent">Clarity</span></h2>
            <p className="cs-hp">One dashboard.<br />Full visibility over every class, teacher, and student.</p>
            <div className="cs-chips">
              {['📊 Analytics', '👥 Team', '📅 Schedule', '🔒 Secure'].map(t => (
                <span key={t} className="cs-chip">{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={`cs-right${mounted ? ' cs-in' : ''}`}>
          {view === 'forgot' ? (
            <div className="cs-card">
              <div className="cs-card-head">
                <div className="cs-icon-box"><Mail size={22} color="#818cf8" strokeWidth={1.5} /></div>
                <div>
                  <p className="cs-center-tag">{centerName}</p>
                  <h1 className="cs-card-title">Reset Password</h1>
                  <p className="cs-card-sub">Enter your admin email address</p>
                </div>
              </div>
              <div className="cs-sep" />
              {forgotError && <div className="cs-err"><AlertCircle size={14} color="#f87171" /><span>{forgotError}</span></div>}
              <form onSubmit={handleForgotPassword} className="cs-form">
                <div className="cs-field">
                  <label htmlFor="cs-forgot-email" className="cs-lbl">Admin Email</label>
                  <div className={`cs-inp-wrap${focusedField === 'forgot' ? ' cs-focused' : ''}`}>
                    <Mail size={14} color={focusedField === 'forgot' ? '#818cf8' : '#4b5563'} />
                    <input id="cs-forgot-email" name="email" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      onFocus={() => setFocusedField('forgot')} onBlur={() => setFocusedField(null)}
                      placeholder="admin@example.com" required disabled={forgotLoading} className="cs-inp" autoFocus />
                  </div>
                </div>
                <button type="submit" disabled={forgotLoading} className="cs-btn">
                  {forgotLoading
                    ? <span className="cs-btn-row"><span className="cs-spin" />Sending…</span>
                    : <span className="cs-btn-row"><Mail size={15} />Send Reset Link</span>}
                </button>
                <button type="button" onClick={() => setView('login')} className="cs-back">← Back to login</button>
              </form>
            </div>

          ) : view === 'forgot-sent' ? (
            <div className="cs-card">
              <div className="cs-sent">
                <div className="cs-sent-icon"><CheckCircle size={30} color="#34d399" /></div>
                <h2 className="cs-sent-h">Check your email</h2>
                <p className="cs-sent-p">If <strong>{forgotEmail}</strong> is registered, a reset link has been sent. Expires in 1 hour.</p>
                <button onClick={() => { setView('login'); setForgotEmail(''); }} className="cs-btn" style={{ width: 'auto', padding: '12px 32px' }}>
                  Back to Login
                </button>
              </div>
            </div>

          ) : (
            <div className="cs-card">
              <div className="cs-card-head">
                {branding.logo && <img src={branding.logo} alt={centerName} className="cs-brand-logo" />}
                <div className="cs-icon-box"><LayoutDashboard size={22} color="#818cf8" strokeWidth={1.5} /></div>
                <div>
                  <p className="cs-center-tag">{centerName}</p>
                  <h1 className="cs-card-title">Admin Portal</h1>
                  <p className="cs-card-sub">Authorized personnel only</p>
                </div>
              </div>
              <div className="cs-sep" />
              {error && <div className="cs-err"><AlertCircle size={14} color="#f87171" /><span>{error}</span></div>}
              <form onSubmit={handleInitialLogin} className="cs-form">
                <div className="cs-field">
                  <label htmlFor="cs-username" className="cs-lbl">Username or Email</label>
                  <div className={`cs-inp-wrap${focusedField === 'user' ? ' cs-focused' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={focusedField === 'user' ? '#818cf8' : '#4b5563'} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <input id="cs-username" name="username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('user')} onBlur={() => setFocusedField(null)}
                      placeholder="admin@example.com" required disabled={loading} className="cs-inp" />
                  </div>
                </div>
                <div className="cs-field">
                  <label htmlFor="cs-password" className="cs-lbl">Password</label>
                  <div className={`cs-inp-wrap${focusedField === 'pass' ? ' cs-focused' : ''}`}>
                    <Lock size={14} color={focusedField === 'pass' ? '#818cf8' : '#4b5563'} />
                    <input id="cs-password" name="password" type={showPassword ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('pass')} onBlur={() => setFocusedField(null)}
                      placeholder="••••••••••••" required disabled={loading} className="cs-inp" />
                    <button type="button" onClick={() => setShowPassword(p => !p)} className="cs-eye" disabled={loading}>
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                  <button type="button" onClick={() => setView('forgot')} className="cs-forgot">Forgot password?</button>
                </div>
                <button type="submit" disabled={loading} className="cs-btn">
                  {loading
                    ? <span className="cs-btn-row"><span className="cs-spin" />Authenticating…</span>
                    : <span className="cs-btn-row">Access Dashboard <ArrowRight size={15} /></span>}
                </button>
              </form>
              <div className="cs-sec-row">
                <span className="cs-sec-dot" />
                <span className="cs-sec-txt">256-bit encrypted · Secured connection</span>
              </div>
              <div className="cs-warn">
                <AlertCircle size={11} color="#92400e" />
                <span>Unauthorized access attempts are logged and may result in account lockout.</span>
              </div>
            </div>
          )}
          <p className="cs-ver">{centerName} Admin · {new Date().getFullYear()}</p>
        </div>
      </div>
    </>
  );
}

const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; }

.cs-root {
  min-height:100vh; display:flex;
  font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;
  background:#0f172a; overflow:hidden; position:relative;
}
.cs-bg-img     { position:absolute; inset:0; background-size:cover; background-position:center; z-index:0; }
.cs-bg-overlay { position:absolute; inset:0; background:#0f172a; z-index:1; }

.cs-grid {
  position:absolute; inset:0; pointer-events:none; z-index:1;
  background-image:
    linear-gradient(rgba(129,140,248,.018) 1px, transparent 1px),
    linear-gradient(90deg, rgba(129,140,248,.018) 1px, transparent 1px);
  background-size:52px 52px;
}

.cs-orb { position:absolute; border-radius:50%; pointer-events:none; z-index:1; filter:blur(100px); }
.cs-orb-1 { width:480px; height:480px; background:radial-gradient(circle,rgba(129,140,248,.07) 0%,transparent 70%); top:-100px; right:-80px; animation:cs-d1 16s ease-in-out infinite alternate; }
.cs-orb-2 { width:360px; height:360px; background:radial-gradient(circle,rgba(56,189,248,.05) 0%,transparent 70%); bottom:-60px; left:-60px; animation:cs-d2 12s ease-in-out infinite alternate; }
.cs-orb-3 { width:260px; height:260px; background:radial-gradient(circle,rgba(52,211,153,.04) 0%,transparent 70%); top:40%; left:30%; animation:cs-d3 18s ease-in-out infinite alternate; }
@keyframes cs-d1 { from{transform:translate(0,0)} to{transform:translate(28px,18px)} }
@keyframes cs-d2 { from{transform:translate(0,0)} to{transform:translate(-22px,26px)} }
@keyframes cs-d3 { from{transform:translate(0,0)} to{transform:translate(14px,-20px)} }

.cs-dot { position:absolute; border-radius:50%; pointer-events:none; z-index:1; opacity:0; animation:cs-ptcl 7s ease-in-out infinite; }
.cs-dt0{width:2px;height:2px;background:#818cf8;}
.cs-dt1{width:1.5px;height:1.5px;background:#38bdf8;}
.cs-dt2{width:2px;height:2px;background:#34d399;}
.cs-dt3{width:1.5px;height:1.5px;background:#f59e0b;}
@keyframes cs-ptcl { 0%,100%{opacity:0;transform:translateY(0)} 50%{opacity:.45;transform:translateY(-16px)} }

/* ── LEFT ── */
.cs-left {
  flex:1; min-height:100vh; position:relative; z-index:2;
  background:linear-gradient(155deg,#0f172a 0%,#131f38 55%,#0e1a30 100%);
  border-right:1px solid rgba(129,140,248,.06);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:56px 36px;
  opacity:0; transform:translateX(-24px);
  transition:opacity .65s ease, transform .65s ease;
}
.cs-left.cs-in { opacity:1; transform:translateX(0); }

.cs-logo-bar { position:absolute; top:28px; left:36px; display:flex; align-items:center; gap:10px; }
.cs-logo-img  { height:32px; max-width:110px; object-fit:contain; }
.cs-logo-icon { width:34px; height:34px; border-radius:10px; background:rgba(129,140,248,.07); border:1px solid rgba(129,140,248,.14); display:flex; align-items:center; justify-content:center; }
.cs-logo-name { font-size:12.5px; font-weight:700; color:#475569; letter-spacing:.02em; }

/* Org chart */
.cs-org-wrap { width:340px; height:260px; margin-bottom:24px; position:relative; }
.cs-org-svg  { width:100%; height:100%; overflow:visible; }

.cs-node { animation:cs-npop .6s cubic-bezier(.34,1.56,.64,1) both; }
.cs-n0 { animation-delay:.1s; } .cs-n1 { animation-delay:.22s; } .cs-n2 { animation-delay:.3s; }
.cs-n3 { animation-delay:.38s; } .cs-n4 { animation-delay:.5s; } .cs-n5 { animation-delay:.58s; } .cs-n6 { animation-delay:.66s; }
@keyframes cs-npop { from{opacity:0;transform:scale(.5)} to{opacity:1;transform:scale(1)} }

.cs-edge { animation:cs-efade .8s ease both; }
.cs-e0{animation-delay:.4s;} .cs-e1{animation-delay:.5s;} .cs-e2{animation-delay:.6s;}
.cs-e3{animation-delay:.7s;} .cs-e4{animation-delay:.8s;} .cs-e5{animation-delay:.9s;}
@keyframes cs-efade { from{opacity:0;stroke-dashoffset:10} to{opacity:1;stroke-dashoffset:0} }

/* Hero */
.cs-hero { text-align:center; }
.cs-h2 { font-size:clamp(26px,3vw,38px); font-weight:800; color:#e2e8f0; margin:0 0 10px; line-height:1.18; letter-spacing:-.4px; }
.cs-h2-accent { background:linear-gradient(135deg,#818cf8,#38bdf8); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
.cs-hp { font-size:13px; color:#4b5563; margin:0 0 20px; line-height:1.8; font-weight:500; }
.cs-chips { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
.cs-chip { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); color:#64748b; font-size:11.5px; font-weight:600; padding:5px 13px; border-radius:100px; }

/* ── RIGHT ── */
.cs-right {
  width:460px; min-height:100vh; flex-shrink:0; position:relative; z-index:2;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:48px 40px;
  opacity:0; transform:translateX(24px);
  transition:opacity .65s ease .12s, transform .65s ease .12s;
}
.cs-right.cs-in { opacity:1; transform:translateX(0); }

.cs-card {
  width:100%; max-width:390px;
  background:linear-gradient(155deg,#131a2e,#0e1524);
  border:1px solid rgba(129,140,248,.12); border-radius:20px; overflow:hidden;
  box-shadow:0 24px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(129,140,248,.04) inset;
  animation:cs-rise .6s cubic-bezier(.16,1,.3,1) both;
}
@keyframes cs-rise { from{opacity:0;transform:translateY(22px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
.cs-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#818cf8 40%,#38bdf8 70%,transparent); }

.cs-card-head { display:flex; align-items:center; gap:14px; padding:24px 24px 16px; }
.cs-brand-logo { height:32px; max-width:90px; object-fit:contain; margin-right:2px; }
.cs-icon-box {
  width:48px; height:48px; border-radius:13px; flex-shrink:0;
  background:linear-gradient(135deg,#131e38,#1a2a4a);
  border:1px solid rgba(129,140,248,.2);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 16px rgba(129,140,248,.14);
  animation:cs-iglow 3s ease-in-out infinite;
}
@keyframes cs-iglow { 0%,100%{box-shadow:0 4px 16px rgba(129,140,248,.14)} 50%{box-shadow:0 4px 24px rgba(129,140,248,.32)} }
.cs-center-tag  { margin:0 0 2px; font-size:9.5px; font-weight:700; color:#818cf8; text-transform:uppercase; letter-spacing:.18em; }
.cs-card-title  { margin:0 0 2px; font-size:20px; font-weight:800; color:#f1f5f9; letter-spacing:-.3px; }
.cs-card-sub    { margin:0; font-size:11px; color:#374151; font-weight:500; }

.cs-sep { height:1px; background:linear-gradient(90deg,transparent,rgba(129,140,248,.08),transparent); }

.cs-err {
  display:flex; align-items:center; gap:9px;
  background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.18);
  border-radius:10px; padding:10px 14px; margin:12px 24px 0;
  font-size:12.5px; color:#f87171; font-weight:500;
  animation:cs-shake .4s ease both;
}
@keyframes cs-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }

.cs-form { display:flex; flex-direction:column; gap:14px; padding:16px 24px 0; }
.cs-field { display:flex; flex-direction:column; gap:6px; }
.cs-lbl { font-size:10.5px; font-weight:700; color:#374151; text-transform:uppercase; letter-spacing:.1em; }
.cs-inp-wrap {
  display:flex; align-items:center; gap:9px; height:48px; padding:0 13px;
  background:rgba(255,255,255,.022); border:1px solid rgba(255,255,255,.07);
  border-radius:12px; transition:border-color .2s, box-shadow .2s;
}
.cs-inp-wrap.cs-focused { border-color:rgba(129,140,248,.4); background:rgba(129,140,248,.025); box-shadow:0 0 0 3px rgba(129,140,248,.07); }
.cs-inp { flex:1; background:transparent; border:none; outline:none; font-size:14px; color:#e2e8f0; font-family:inherit; font-weight:500; }
.cs-inp::placeholder { color:#1f2937; }
.cs-eye  { background:none; border:none; cursor:pointer; color:#374151; padding:0; display:flex; align-items:center; transition:color .2s; }
.cs-eye:hover { color:#818cf8; }
.cs-forgot { background:none; border:none; cursor:pointer; font-size:11.5px; color:#374151; font-weight:600; font-family:inherit; padding:0; transition:color .15s; }
.cs-forgot:hover { color:#818cf8; }

.cs-btn {
  width:100%; height:50px;
  background:linear-gradient(135deg,#818cf8,#38bdf8);
  color:white; border:none; border-radius:12px; font-size:14px; font-weight:700;
  cursor:pointer; font-family:inherit; margin-top:4px;
  box-shadow:0 6px 20px rgba(129,140,248,.25);
  transition:opacity .2s, transform .15s, box-shadow .2s;
}
.cs-btn:hover:not(:disabled) { opacity:.9; transform:translateY(-1px); box-shadow:0 10px 30px rgba(129,140,248,.35); }
.cs-btn:active:not(:disabled) { transform:translateY(0); }
.cs-btn:disabled { opacity:.5; cursor:not-allowed; }
.cs-btn-row { display:flex; align-items:center; justify-content:center; gap:8px; }
.cs-spin { display:inline-block; width:15px; height:15px; border:2px solid rgba(255,255,255,.25); border-top-color:white; border-radius:50%; animation:cs-rot .7s linear infinite; }
@keyframes cs-rot { to{transform:rotate(360deg)} }
.cs-back { background:none; border:none; cursor:pointer; color:#374151; font-size:12px; font-family:inherit; text-align:center; padding:6px 0; transition:color .15s; }
.cs-back:hover { color:#94a3b8; }

.cs-sec-row { display:flex; align-items:center; justify-content:center; gap:8px; margin:14px 24px 0; }
.cs-sec-dot { width:6px; height:6px; border-radius:50%; background:#818cf8; flex-shrink:0; animation:cs-pulse 2s ease-in-out infinite; }
@keyframes cs-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(129,140,248,.4)} 50%{box-shadow:0 0 0 5px rgba(129,140,248,0)} }
.cs-sec-txt { font-size:11px; color:#374151; font-weight:500; }

.cs-warn {
  display:flex; align-items:flex-start; gap:7px;
  background:rgba(120,53,15,.1); border:1px solid rgba(120,53,15,.22);
  border-radius:0 0 20px 20px; padding:10px 16px;
  margin:12px 0 0; font-size:10.5px; color:#92400e; line-height:1.5;
}

.cs-sent { display:flex; flex-direction:column; align-items:center; gap:14px; padding:34px 24px; text-align:center; }
.cs-sent-icon { width:56px; height:56px; border-radius:50%; background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.2); display:flex; align-items:center; justify-content:center; }
.cs-sent-h { margin:0; font-size:18px; font-weight:800; color:#f1f5f9; }
.cs-sent-p { margin:0; font-size:12.5px; color:#4b5563; line-height:1.65; max-width:270px; }
.cs-sent-p strong { color:#e2e8f0; }

.cs-ver { font-size:11px; color:#1f2937; margin-top:16px; letter-spacing:.04em; }

@media (max-width:920px) {
  .cs-root { flex-direction:column; }
  .cs-left { min-height:auto; padding:40px 24px 28px; }
  .cs-org-wrap { width:280px; height:220px; }
  .cs-right { width:100%; min-height:auto; padding:28px 20px 44px; }
}
@media (max-width:480px) {
  .cs-org-wrap { display:none; }
  .cs-logo-bar { position:relative; top:auto; left:auto; margin-bottom:10px; }
}
`;
