// src/pages/teacher/login-themes/ClassroomSpaceTheme.jsx
import React from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useTeacherLoginLogic } from './useTeacherLoginLogic';

export default function ClassroomSpaceTheme() {
  const {
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    focusedField, setFocusedField,
    handleInitialLogin, handle2FAVerification, handleCancel2FA,
  } = useTeacherLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';

  if (requires2FA) {
    return (
      <div className="tl-root">
        <TwoFactorLogin
          onVerify={handle2FAVerification}
          onCancel={handleCancel2FA}
          loading={loading}
          error={error}
        />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div
        className="tl-root"
        style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Inter', sans-serif` } : {}}
      >
        {/* ── LEFT — Classroom in the Cosmos ── */}
        <div className="tl-left">

          {/* Star field */}
          {[...Array(34)].map((_, i) => (
            <span
              key={i}
              className={`tl-star tl-star-${i % 7}`}
              style={{
                left: `${(i * 41 + 7) % 100}%`,
                top:  `${(i * 61 + 13) % 100}%`,
                animationDelay: `${(i * 0.37) % 3.5}s`,
              }}
            />
          ))}

          {/* Nebula glows */}
          <div className="tl-nebula tl-neb-1" />
          <div className="tl-nebula tl-neb-2" />
          <div className="tl-nebula tl-neb-3" />

          {/* ── Central floating scene ── */}
          <div className="tl-scene">

            {/* Orbiting items */}
            <div className="tl-orbit tl-orbit-1"><div className="tl-orb-item">📖</div></div>
            <div className="tl-orbit tl-orbit-2"><div className="tl-orb-item">✏️</div></div>
            <div className="tl-orbit tl-orbit-3"><div className="tl-orb-item">💡</div></div>
            <div className="tl-orbit tl-orbit-4"><div className="tl-orb-item">🎓</div></div>

            {/* Floating desk assembly */}
            <div className="tl-desk-wrap">

              {/* Glow island under desk */}
              <div className="tl-island-glow" />

              {/* Monitor */}
              <div className="tl-monitor-wrap">
                <div className="tl-monitor">
                  <div className="tl-monitor-screen">
                    <div className="tl-screen-dots">
                      <span className="tl-dot tl-dot-r" />
                      <span className="tl-dot tl-dot-y" />
                      <span className="tl-dot tl-dot-g" />
                    </div>
                    <div className="tl-bars">
                      <div className="tl-bar tl-b1" />
                      <div className="tl-bar tl-b2" />
                      <div className="tl-bar tl-b3" />
                      <div className="tl-bar tl-b4" />
                      <div className="tl-bar tl-b5" />
                    </div>
                    <div className="tl-scan-line" />
                    <div className="tl-scan-line tl-scan-2" />
                  </div>
                </div>
                <div className="tl-mon-stand" />
                <div className="tl-mon-base" />
              </div>

              {/* Teacher figure */}
              <div className="tl-teacher-fig">
                <svg className="tl-teacher-svg" viewBox="0 0 64 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Grad cap board */}
                  <rect x="11" y="7" width="42" height="5" rx="2" fill="#0f172a"/>
                  {/* Cap top */}
                  <rect x="23" y="2" width="18" height="9" rx="2" fill="#0f172a"/>
                  {/* Tassel string */}
                  <line x1="47" y1="10" x2="47" y2="22" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
                  {/* Tassel ball */}
                  <circle cx="47" cy="24" r="3.5" fill="#f59e0b"/>
                  {/* Head */}
                  <circle cx="32" cy="26" r="14" fill="#fed7aa"/>
                  {/* Hair */}
                  <path d="M18 22 Q20 13 32 12 Q44 13 46 22" fill="#78350f"/>
                  {/* Left eye */}
                  <ellipse cx="27" cy="24" rx="2.5" ry="3" fill="#1e1b4b"/>
                  {/* Right eye */}
                  <ellipse cx="37" cy="24" rx="2.5" ry="3" fill="#1e1b4b"/>
                  {/* Eye glints */}
                  <circle cx="27.8" cy="22.8" r="1" fill="white"/>
                  <circle cx="37.8" cy="22.8" r="1" fill="white"/>
                  {/* Glasses left */}
                  <circle cx="27" cy="24" r="6.5" stroke="#0891b2" strokeWidth="1.5" fill="none"/>
                  {/* Glasses right */}
                  <circle cx="37" cy="24" r="6.5" stroke="#0891b2" strokeWidth="1.5" fill="none"/>
                  {/* Glasses bridge */}
                  <line x1="33.5" y1="24" x2="30.5" y2="24" stroke="#0891b2" strokeWidth="1.5"/>
                  {/* Glasses left arm */}
                  <line x1="20.5" y1="24" x2="18" y2="22" stroke="#0891b2" strokeWidth="1.5"/>
                  {/* Glasses right arm */}
                  <line x1="43.5" y1="24" x2="46" y2="22" stroke="#0891b2" strokeWidth="1.5"/>
                  {/* Smile */}
                  <path d="M26 31 Q32 36 38 31" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  {/* Body / jacket */}
                  <path d="M16 44 L20 38 L32 42 L44 38 L48 44 L48 84 L16 84 Z" fill="#1e3a5f"/>
                  {/* Shirt collar V */}
                  <path d="M27 38 L32 50 L37 38" fill="white" opacity="0.9"/>
                  {/* Jacket lapels */}
                  <path d="M20 38 L27 38 L32 50" fill="#0f2040"/>
                  <path d="M44 38 L37 38 L32 50" fill="#0f2040"/>
                  {/* Left arm to keyboard */}
                  <path d="M16 48 L3 68 L15 72" stroke="#1e3a5f" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Left hand */}
                  <ellipse cx="12" cy="74" rx="5" ry="4" fill="#fed7aa"/>
                  {/* Right arm to keyboard */}
                  <path d="M48 48 L61 68 L49 72" stroke="#1e3a5f" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Right hand */}
                  <ellipse cx="52" cy="74" rx="5" ry="4" fill="#fed7aa"/>
                  {/* Jacket button */}
                  <circle cx="32" cy="62" r="2" fill="rgba(255,255,255,0.25)"/>
                  <circle cx="32" cy="72" r="2" fill="rgba(255,255,255,0.25)"/>
                </svg>

                {/* Chair */}
                <div className="tl-chair">
                  <div className="tl-chair-back" />
                  <div className="tl-chair-seat" />
                  <div className="tl-chair-stem" />
                  <div className="tl-chair-foot" />
                </div>
              </div>

              {/* Desk surface */}
              <div className="tl-desk">
                <div className="tl-keyboard" />
                {/* Coffee */}
                <div className="tl-mug-wrap">
                  <div className="tl-steam tl-st1" />
                  <div className="tl-steam tl-st2" />
                  <div className="tl-steam tl-st3" />
                  <div className="tl-mug">
                    <div className="tl-mug-handle" />
                  </div>
                </div>
                {/* Papers */}
                <div className="tl-paper tl-paper-a" />
                <div className="tl-paper tl-paper-b" />
              </div>
            </div>

            {/* Sparkles */}
            <span className="tl-sp tl-sp1">✦</span>
            <span className="tl-sp tl-sp2">✧</span>
            <span className="tl-sp tl-sp3">✦</span>
            <span className="tl-sp tl-sp4">✧</span>
            <span className="tl-sp tl-sp5">⋆</span>
          </div>

          {/* Hero text */}
          <div className="tl-hero">
            <h2 className="tl-hero-h2">Teach.<br/>Inspire.<br/>Transform.</h2>
            <p className="tl-hero-p">Shape the future, one lesson at a time.</p>
            <div className="tl-badges">
              <span className="tl-badge">🎓 Expert Educator</span>
              <span className="tl-badge">📊 Live Analytics</span>
              <span className="tl-badge">🌍 Global Reach</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — login form ── */}
        <div className="tl-right">
          <div className="tl-card">

            <div className="tl-brand">
              {branding.logo
                ? <img src={branding.logo} alt={centerName} className="tl-logo-img" />
                : <div className="tl-logo-default"><span>🏫</span></div>
              }
            </div>

            <p className="tl-portal-tag">{centerName} — TEACHER PORTAL</p>
            <h1 className="tl-title">Welcome back, Professor</h1>
            <p className="tl-subtitle">Sign in to your classroom</p>

            {error && (
              <div className="tl-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} className="tl-form">
              <div className="tl-field">
                <label className="tl-label"><Mail size={13} /> Email address</label>
                <div className={`tl-input-wrap${focusedField === 'email' ? ' tl-focused' : ''}`}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    className="tl-input"
                  />
                </div>
              </div>

              <div className="tl-field">
                <div className="tl-label-row">
                  <label className="tl-label"><Lock size={13} /> Password</label>
                  <Link to="/teacher/forgot-password" className="tl-forgot">Forgot password?</Link>
                </div>
                <div className={`tl-input-wrap${focusedField === 'password' ? ' tl-focused' : ''}`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••••"
                    required
                    disabled={loading}
                    className="tl-input"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="tl-eye-btn" disabled={loading}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="tl-submit">
                {loading
                  ? <span className="tl-load-row"><span className="tl-spinner" />Signing in…</span>
                  : <span className="tl-btn-inner">Sign In <ArrowRight size={18} /></span>
                }
              </button>
            </form>

            <p className="tl-footer">
              Having trouble?{' '}
              <a href="mailto:support@yourdomain.com" className="tl-footer-link">Contact support</a>
            </p>

            <div className="tl-dots">
              {['#22d3ee','#7c3aed','#f59e0b','#34d399'].map((c, i) => (
                <span key={i} className="tl-dot-dec" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  /* ── ROOT ── */
  .tl-root {
    min-height: 100vh;
    display: flex;
    font-family: 'Inter', 'Segoe UI', sans-serif;
    background: #06091a;
    overflow: hidden;
    position: relative;
  }

  /* ── LEFT PANEL ── */
  .tl-left {
    flex: 1;
    min-height: 100vh;
    background: linear-gradient(160deg, #06091a 0%, #0d1b4b 45%, #071a30 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 32px;
    position: relative;
    overflow: hidden;
  }

  /* ── STARS ── */
  .tl-star {
    position: absolute;
    border-radius: 50%;
    opacity: 0;
    animation: tl-twinkle 2.5s ease-in-out infinite;
    background: white;
    width: 3px; height: 3px;
  }
  .tl-star-0{animation-duration:2.1s}
  .tl-star-1{animation-duration:3.2s;width:2px;height:2px}
  .tl-star-2{animation-duration:1.8s;width:4px;height:4px;background:#a5f3fc}
  .tl-star-3{animation-duration:2.7s}
  .tl-star-4{animation-duration:3.5s;width:2px;height:2px;background:#c4b5fd}
  .tl-star-5{animation-duration:2.3s;width:5px;height:5px;background:#fde68a}
  .tl-star-6{animation-duration:1.6s;width:2px;height:2px}
  @keyframes tl-twinkle {
    0%,100%{opacity:0;transform:scale(1)}
    50%{opacity:.9;transform:scale(1.5)}
  }

  /* ── NEBULAS ── */
  .tl-nebula { position:absolute; border-radius:50%; pointer-events:none; }
  .tl-neb-1 {
    width:360px; height:360px;
    top:-80px; right:-80px;
    background: radial-gradient(circle, rgba(34,211,238,.1) 0%, transparent 70%);
  }
  .tl-neb-2 {
    width:280px; height:280px;
    bottom:-40px; left:-60px;
    background: radial-gradient(circle, rgba(168,85,247,.09) 0%, transparent 70%);
  }
  .tl-neb-3 {
    width:200px; height:200px;
    top:45%; right:10%;
    background: radial-gradient(circle, rgba(251,191,36,.06) 0%, transparent 70%);
  }

  /* ── SCENE CONTAINER ── */
  .tl-scene {
    position: relative;
    width: 340px;
    height: 380px;
    margin-bottom: 20px;
  }

  /* ── ORBITS ── */
  .tl-orbit {
    position: absolute;
    top: 50%; left: 50%;
    border-radius: 50%;
    border: 1px dashed rgba(255,255,255,.1);
  }
  .tl-orbit-1 {
    width: 220px; height: 220px;
    margin: -110px 0 0 -110px;
    animation: tl-ospin 9s linear infinite;
  }
  .tl-orbit-2 {
    width: 296px; height: 200px;
    margin: -100px 0 0 -148px;
    animation: tl-ospin 13s linear infinite reverse;
    border-color: rgba(34,211,238,.1);
  }
  .tl-orbit-3 {
    width: 170px; height: 170px;
    margin: -85px 0 0 -85px;
    animation: tl-ospin 7s linear infinite;
    border-color: rgba(168,85,247,.12);
  }
  .tl-orbit-4 {
    width: 330px; height: 330px;
    margin: -165px 0 0 -165px;
    animation: tl-ospin 18s linear infinite;
    border-color: rgba(255,255,255,.05);
  }
  @keyframes tl-ospin { from{transform:rotate(0)} to{transform:rotate(360deg)} }

  .tl-orb-item {
    position: absolute;
    top: -14px; left: 50%;
    transform: translateX(-50%);
    font-size: 22px;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,.5));
  }
  .tl-orbit-1 .tl-orb-item { animation: tl-counter  9s linear infinite; }
  .tl-orbit-2 .tl-orb-item { animation: tl-counter 13s linear infinite reverse; }
  .tl-orbit-3 .tl-orb-item { animation: tl-counter  7s linear infinite; }
  .tl-orbit-4 .tl-orb-item { animation: tl-counter 18s linear infinite; }
  @keyframes tl-counter {
    from{transform:translateX(-50%) rotate(0)} to{transform:translateX(-50%) rotate(-360deg)}
  }

  /* ── DESK ASSEMBLY ── */
  .tl-desk-wrap {
    position: absolute;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    height: 120px;
    animation: tl-float 4s ease-in-out infinite;
  }
  @keyframes tl-float {
    0%,100%{ transform: translateX(-50%) translateY(0) rotate(0deg); }
    50%{     transform: translateX(-50%) translateY(-16px) rotate(.8deg); }
  }

  /* Floating island glow */
  .tl-island-glow {
    position: absolute;
    bottom: -14px; left: 50%;
    transform: translateX(-50%);
    width: 220px; height: 24px;
    background: radial-gradient(ellipse, rgba(34,211,238,.35), transparent 70%);
    border-radius: 50%;
    filter: blur(6px);
    pointer-events: none;
  }

  /* ── MONITOR ── */
  .tl-monitor-wrap {
    position: absolute;
    bottom: 14px; left: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 3;
  }
  .tl-monitor {
    width: 116px; height: 80px;
    background: #070e20;
    border-radius: 6px 6px 4px 4px;
    border: 2px solid rgba(34,211,238,.55);
    box-shadow:
      0 0 18px rgba(34,211,238,.3),
      0 0 50px rgba(34,211,238,.12),
      inset 0 0 16px rgba(34,211,238,.05);
    overflow: hidden;
    position: relative;
  }
  .tl-monitor-screen {
    position: absolute;
    inset: 4px;
    background: #040b18;
    border-radius: 3px;
    overflow: hidden;
  }
  .tl-screen-dots {
    display: flex;
    gap: 3px;
    padding: 4px 5px 2px;
  }
  .tl-dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
  .tl-dot-r { background: #ef4444; }
  .tl-dot-y { background: #f59e0b; }
  .tl-dot-g { background: #22c55e; }

  .tl-bars {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    padding: 2px 6px 0;
    height: 38px;
  }
  .tl-bar {
    flex: 1;
    border-radius: 2px 2px 0 0;
    background: linear-gradient(to top, #0891b2, #22d3ee);
    animation: tl-bar-pulse 2.2s ease-in-out infinite alternate;
  }
  .tl-b1{height:55%;animation-delay:0s}
  .tl-b2{height:80%;animation-delay:.18s}
  .tl-b3{height:40%;animation-delay:.35s}
  .tl-b4{height:92%;animation-delay:.1s}
  .tl-b5{height:65%;animation-delay:.27s}
  @keyframes tl-bar-pulse {
    from{opacity:.55;transform:scaleY(.85)} to{opacity:1;transform:scaleY(1)}
  }
  .tl-scan-line {
    position: absolute; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(34,211,238,.5), transparent);
    animation: tl-scan 2.8s linear infinite;
  }
  .tl-scan-2 { animation-delay: 1.4s; opacity: .4; }
  @keyframes tl-scan {
    0%  { top: 10%; opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100%{ top: 90%; opacity: 0; }
  }

  .tl-mon-stand {
    width: 4px; height: 12px;
    background: rgba(34,211,238,.4);
  }
  .tl-mon-base {
    width: 30px; height: 4px;
    background: rgba(34,211,238,.35);
    border-radius: 2px;
  }

  /* ── TEACHER FIGURE ── */
  .tl-teacher-fig {
    position: absolute;
    bottom: 14px; right: 6px;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 2;
  }
  .tl-teacher-svg {
    width: 62px; height: 84px;
    position: relative; z-index: 2;
    filter: drop-shadow(0 10px 18px rgba(0,0,0,.6));
    animation: tl-nod 5s ease-in-out infinite;
  }
  @keyframes tl-nod {
    0%,100%{ transform: translateY(0) rotate(0deg); }
    35%{     transform: translateY(-3px) rotate(-1.5deg); }
    70%{     transform: translateY(-2px) rotate(1.5deg); }
  }
  .tl-chair {
    position: absolute;
    bottom: -2px; left: 50%;
    transform: translateX(-50%);
    z-index: 1;
  }
  .tl-chair-back {
    width: 36px; height: 28px;
    background: linear-gradient(180deg,#1e3a5f,#0d2135);
    border-radius: 4px 4px 0 0;
    border: 1px solid rgba(34,211,238,.2);
    position: absolute;
    bottom: 24px; left: 50%; transform: translateX(-50%);
  }
  .tl-chair-seat {
    width: 44px; height: 8px;
    background: linear-gradient(180deg,#1e3a5f,#0d2135);
    border-radius: 4px;
    border: 1px solid rgba(34,211,238,.2);
    position: absolute;
    bottom: 18px; left: 50%; transform: translateX(-50%);
  }
  .tl-chair-stem {
    width: 4px; height: 18px;
    background: rgba(34,211,238,.3);
    position: absolute;
    bottom: 0; left: 50%; transform: translateX(-50%);
  }
  .tl-chair-foot {
    width: 28px; height: 4px;
    background: rgba(34,211,238,.2);
    border-radius: 2px;
    position: absolute;
    bottom: -2px; left: 50%; transform: translateX(-50%);
  }

  /* ── DESK SURFACE ── */
  .tl-desk {
    position: absolute;
    bottom: 0; left: 0;
    width: 260px; height: 14px;
    background: linear-gradient(180deg, #1e3a5f 0%, #0d2135 100%);
    border-radius: 8px;
    border-top: 2px solid rgba(34,211,238,.4);
    box-shadow:
      0 6px 24px rgba(0,0,0,.6),
      0 0 30px rgba(34,211,238,.08);
    z-index: 4;
  }
  .tl-keyboard {
    position: absolute;
    top: -7px; left: 50%; transform: translateX(-50%);
    width: 64px; height: 7px;
    background: #0a1628;
    border-radius: 3px;
    border: 1px solid rgba(34,211,238,.25);
    z-index: 5;
  }
  /* Keyboard key rows hint */
  .tl-keyboard::before {
    content: '';
    position: absolute;
    top: 1px; left: 4px; right: 4px; height: 2px;
    background: repeating-linear-gradient(90deg,
      rgba(34,211,238,.2) 0px, rgba(34,211,238,.2) 3px,
      transparent 3px, transparent 6px
    );
    border-radius: 1px;
  }

  /* ── COFFEE MUG ── */
  .tl-mug-wrap {
    position: absolute;
    right: 26px; top: -34px;
    width: 18px;
    z-index: 5;
  }
  .tl-mug {
    width: 18px; height: 22px;
    background: linear-gradient(180deg, #be4b00, #7c2d12);
    border-radius: 2px 2px 5px 5px;
    position: relative;
  }
  .tl-mug-handle {
    position: absolute;
    right: -7px; top: 5px;
    width: 7px; height: 10px;
    border: 2px solid #7c2d12;
    border-left: none;
    border-radius: 0 5px 5px 0;
  }
  .tl-steam {
    position: absolute;
    width: 2px;
    background: rgba(255,255,255,.45);
    border-radius: 2px;
    bottom: 100%;
    animation: tl-steam 1.8s ease-in-out infinite;
  }
  .tl-st1{left: 3px;height:8px;animation-delay:0s}
  .tl-st2{left: 8px;height:13px;animation-delay:.35s}
  .tl-st3{left:13px;height:8px;animation-delay:.7s}
  @keyframes tl-steam {
    0%  { opacity:0;transform:translateY(0)   scaleX(1); }
    50% { opacity:.7;transform:translateY(-9px)  scaleX(1.6); }
    100%{ opacity:0;transform:translateY(-18px) scaleX(2.2); }
  }

  /* ── PAPERS ── */
  .tl-paper {
    position: absolute;
    background: white;
    border-radius: 2px;
    z-index: 5;
  }
  .tl-paper-a {
    width: 24px; height: 30px;
    top: -32px; left: 118px;
    transform: rotate(-16deg);
    box-shadow: 1px 2px 8px rgba(0,0,0,.45);
    background: linear-gradient(135deg,#fff 70%,#e0f2fe 100%);
  }
  .tl-paper-b {
    width: 20px; height: 26px;
    top: -28px; left: 130px;
    transform: rotate(9deg);
    box-shadow: 1px 2px 8px rgba(0,0,0,.4);
    background: #f0fdf4;
  }

  /* ── SPARKLES ── */
  .tl-sp {
    position: absolute;
    pointer-events: none;
    animation: tl-sparkle 2.5s ease-in-out infinite;
  }
  .tl-sp1{top:10%;left:7%; font-size:15px;color:#22d3ee;animation-delay:0s}
  .tl-sp2{top:72%;left:12%;font-size:22px;color:#a855f7;animation-delay:.9s}
  .tl-sp3{top:14%;left:82%;font-size:12px;color:#f59e0b;animation-delay:1.7s}
  .tl-sp4{top:80%;left:82%;font-size:20px;color:#22d3ee;animation-delay:.4s}
  .tl-sp5{top:48%;left:3%; font-size:10px;color:#f59e0b;animation-delay:2.1s}
  @keyframes tl-sparkle {
    0%,100%{opacity:.1;transform:scale(.7) rotate(0deg)}
    50%    {opacity:1;  transform:scale(1.4) rotate(25deg)}
  }

  /* ── HERO TEXT ── */
  .tl-hero { text-align:center; color:white; position:relative; z-index:2; }
  .tl-hero-h2 {
    font-size: clamp(34px,4.5vw,50px);
    font-weight: 900;
    line-height: 1.12;
    margin: 0 0 12px;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #fff 0%, #a5f3fc 45%, #c4b5fd 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .tl-hero-p {
    font-size: 15px;
    color: rgba(255,255,255,.65);
    margin: 0 0 22px;
    font-weight: 500;
  }
  .tl-badges { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
  .tl-badge {
    background: rgba(34,211,238,.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(34,211,238,.22);
    color: rgba(255,255,255,.88);
    font-size: 12px;
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 100px;
  }

  /* ── RIGHT PANEL ── */
  .tl-right {
    width: 440px;
    min-height: 100vh;
    background: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 32px;
    position: relative;
    flex-shrink: 0;
  }
  .tl-right::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(8,145,178,.04) 0%, rgba(124,58,237,.04) 100%);
    pointer-events: none;
  }

  /* ── CARD ── */
  .tl-card {
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    animation: tl-rise .55s cubic-bezier(.16,1,.3,1) both;
  }
  @keyframes tl-rise {
    from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)}
  }

  .tl-brand { display:flex; justify-content:center; margin-bottom:10px; }
  .tl-logo-img { height:52px; max-width:160px; object-fit:contain; }
  .tl-logo-default {
    width: 70px; height: 70px;
    border-radius: 20px;
    background: linear-gradient(135deg, #0891b2, #7c3aed);
    display: flex; align-items: center; justify-content: center;
    font-size: 34px;
    box-shadow: 0 8px 24px rgba(8,145,178,.4);
    animation: tl-bounce-in .7s cubic-bezier(.34,1.56,.64,1) .2s both;
  }
  @keyframes tl-bounce-in {
    from{opacity:0;transform:scale(.4)} to{opacity:1;transform:scale(1)}
  }

  .tl-portal-tag {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: .16em;
    color: #0891b2;
    text-transform: uppercase;
    text-align: center;
    margin: 0 0 6px;
  }
  .tl-title {
    font-size: 25px;
    font-weight: 900;
    color: #0f172a;
    text-align: center;
    margin: 2px 0;
    letter-spacing: -.5px;
  }
  .tl-subtitle {
    font-size: 13.5px;
    color: #64748b;
    text-align: center;
    margin: 0 0 18px;
    font-weight: 500;
  }

  /* ── ERROR ── */
  .tl-error {
    display: flex; align-items: center; gap: 10px;
    background: #fef2f2;
    border: 2px solid #fecaca;
    border-radius: 12px;
    padding: 11px 14px;
    color: #dc2626;
    font-size: 13px; font-weight: 700;
    margin-bottom: 10px;
    animation: tl-shake .45s ease both;
  }
  @keyframes tl-shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-7px)} 40%{transform:translateX(7px)}
    60%{transform:translateX(-4px)} 80%{transform:translateX(4px)}
  }

  /* ── FORM ── */
  .tl-form { display:flex; flex-direction:column; gap:16px; margin-top:2px; }
  .tl-field { display:flex; flex-direction:column; gap:6px; }
  .tl-label-row { display:flex; justify-content:space-between; align-items:center; }
  .tl-label {
    display: flex; align-items: center; gap: 5px;
    font-size: 11.5px; font-weight: 800;
    color: #475569;
    text-transform: uppercase; letter-spacing: .07em;
  }
  .tl-input-wrap {
    display: flex; align-items: center;
    height: 52px; padding: 0 16px;
    background: white;
    border: 2px solid #e2e8f0;
    border-radius: 14px;
    transition: border-color .2s, box-shadow .2s, background .2s;
  }
  .tl-input-wrap.tl-focused {
    border-color: #0891b2;
    background: #ecfeff;
    box-shadow: 0 0 0 4px rgba(8,145,178,.12);
  }
  .tl-input {
    flex: 1; border: none; outline: none;
    background: transparent;
    font-size: 15px; color: #0f172a;
    font-family: inherit; font-weight: 600;
  }
  .tl-eye-btn {
    background: none; border: none; cursor: pointer;
    color: #94a3b8; padding: 0;
    display: flex; align-items: center;
  }
  .tl-eye-btn:hover { color: #0891b2; }
  .tl-forgot {
    font-size: 12.5px; color: #0891b2; font-weight: 700;
    font-family: inherit; text-decoration: none;
  }
  .tl-forgot:hover { color: #7c3aed; }

  /* ── SUBMIT ── */
  .tl-submit {
    width: 100%; height: 54px;
    background: linear-gradient(135deg, #0891b2 0%, #0e7490 40%, #7c3aed 100%);
    background-size: 200% 200%;
    color: white; border: none; border-radius: 16px;
    font-size: 16px; font-weight: 800;
    cursor: pointer; font-family: inherit;
    margin-top: 4px;
    box-shadow: 0 6px 22px rgba(8,145,178,.4);
    transition: transform .15s, box-shadow .15s;
    animation: tl-btn-grad 4s ease infinite;
  }
  @keyframes tl-btn-grad {
    0%,100%{background-position:0% 50%} 50%{background-position:100% 50%}
  }
  .tl-submit:hover:not(:disabled) {
    transform: translateY(-3px) scale(1.01);
    box-shadow: 0 12px 32px rgba(8,145,178,.5);
  }
  .tl-submit:active:not(:disabled) { transform: translateY(0) scale(.98); }
  .tl-submit:disabled { opacity:.7; cursor:not-allowed; }

  .tl-load-row { display:flex; align-items:center; gap:10px; justify-content:center; }
  .tl-btn-inner { display:flex; align-items:center; justify-content:center; gap:8px; }
  .tl-spinner {
    display: inline-block; width: 20px; height: 20px;
    border: 3px solid rgba(255,255,255,.3);
    border-top-color: white; border-radius: 50%;
    animation: tl-spin .7s linear infinite;
  }
  @keyframes tl-spin { to{transform:rotate(360deg)} }

  /* ── FOOTER ── */
  .tl-footer { text-align:center; font-size:12px; color:#94a3b8; margin:14px 0 6px; font-weight:500; }
  .tl-footer-link { color:#0891b2; text-decoration:none; font-weight:700; }
  .tl-footer-link:hover { color:#7c3aed; }

  .tl-dots { display:flex; justify-content:center; gap:8px; margin-top:4px; }
  .tl-dot-dec {
    width: 9px; height: 9px; border-radius: 50%; display: inline-block;
    animation: tl-dot-bounce 1.4s ease-in-out infinite;
  }
  .tl-dot-dec:nth-child(1){animation-delay:0s}
  .tl-dot-dec:nth-child(2){animation-delay:.16s}
  .tl-dot-dec:nth-child(3){animation-delay:.32s}
  .tl-dot-dec:nth-child(4){animation-delay:.48s}
  @keyframes tl-dot-bounce {
    0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.7)}
  }

  /* ── RESPONSIVE ── */
  @media (max-width:900px) {
    .tl-root{flex-direction:column}
    .tl-left{min-height:auto;padding:40px 24px 28px}
    .tl-scene{width:280px;height:300px}
    .tl-right{width:100%;min-height:auto;padding:28px 24px 48px}
  }
  @media (max-width:480px) {
    .tl-scene{display:none}
    .tl-hero-h2{font-size:28px}
    .tl-left{padding:24px 20px}
  }
`;
