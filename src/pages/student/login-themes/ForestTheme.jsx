// src/pages/student/login-themes/ForestTheme.jsx
import React from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useLoginLogic } from './useLoginLogic';

export default function ForestTheme() {
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
      <div className="ft-root">
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="ft-root" style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Nunito', sans-serif` } : {}}>

        {/* ── LEFT — forest illustration ── */}
        <div className="ft-left">
          {/* Fireflies */}
          {[...Array(16)].map((_, i) => (
            <span key={i} className="ft-firefly"
              style={{
                left: `${(i * 43 + 8) % 88}%`,
                top:  `${(i * 31 + 12) % 80}%`,
                animationDelay: `${(i * 0.5) % 4}s`,
                animationDuration: `${2 + (i % 3)}s`,
              }}
            />
          ))}

          {/* Ground */}
          <div className="ft-ground" />
          <div className="ft-grass" />

          {/* ── Tree with reading character ── */}
          <div className="ft-scene">
            {/* Background trees */}
            <div className="ft-tree ft-tree-bg ft-tb-1" />
            <div className="ft-tree ft-tree-bg ft-tb-2" />

            {/* Main tree */}
            <div className="ft-main-tree">
              <div className="ft-trunk" />
              <div className="ft-canopy ft-c-back" />
              <div className="ft-canopy ft-c-mid" />
              <div className="ft-canopy ft-c-front" />
              {/* Hanging lantern */}
              <div className="ft-lantern-string" />
              <div className="ft-lantern">
                <div className="ft-lantern-glow" />
              </div>
            </div>

            {/* Reading character under tree */}
            <div className="ft-reader">
              {/* Body */}
              <div className="ft-reader-body" />
              {/* Head */}
              <div className="ft-reader-head">
                <div className="ft-reader-eyes">
                  <div className="ft-reader-eye" /><div className="ft-reader-eye" />
                </div>
                {/* Graduation cap */}
                <div className="ft-rcap-brim" />
                <div className="ft-rcap-top" />
                <div className="ft-rcap-tassel" />
              </div>
              {/* Open book */}
              <div className="ft-book">
                <div className="ft-book-l" />
                <div className="ft-book-spine" />
                <div className="ft-book-r" />
              </div>
            </div>

            {/* Mushrooms */}
            <div className="ft-shroom ft-sh-1"><div className="ft-sh-cap" /><div className="ft-sh-stem" /></div>
            <div className="ft-shroom ft-sh-2"><div className="ft-sh-cap" /><div className="ft-sh-stem" /></div>

            {/* Sparkles */}
            <span className="ft-sp ft-sp-1">✦</span>
            <span className="ft-sp ft-sp-2">✧</span>
            <span className="ft-sp ft-sp-3">✦</span>
          </div>

          <div className="ft-hero-text">
            <h2 className="ft-hero-h2">Grow With<br />Every Lesson.</h2>
            <p className="ft-hero-p">Knowledge blooms here!</p>
            <div className="ft-badge-row">
              <span className="ft-badge">🎓 Expert lessons</span>
              <span className="ft-badge">🌍 Live classes</span>
              <span className="ft-badge">🏆 Track progress</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — login form ── */}
        <div className="ft-right">
          <div className="ft-card">
            <div className="ft-brand">
              {branding.logo
                ? <img src={branding.logo} alt={centerName} className="ft-logo-img" />
                : <div className="ft-logo-default"><span>🌿</span></div>
              }
            </div>

            <h1 className="ft-title">{centerName}</h1>
            <p className="ft-subtitle">Sign in and start growing!</p>

            {error && (
              <div className="ft-error">
                <AlertCircle size={16} color="#dc2626" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} className="ft-form">
              <div className="ft-field">
                <label className="ft-label"><Mail size={13} /> Email</label>
                <div className={`ft-input-wrap${focusedField === 'email' ? ' ft-focused' : ''}`}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                    placeholder="your.email@example.com" required disabled={loading} className="ft-input" />
                </div>
              </div>

              <div className="ft-field">
                <label className="ft-label"><Lock size={13} /> Password</label>
                <div className={`ft-input-wrap${focusedField === 'password' ? ' ft-focused' : ''}`}>
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    placeholder="••••••••" required disabled={loading} className="ft-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="ft-eye-btn" disabled={loading}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-6px' }}>
                <button type="button" onClick={() => navigate('/student/forgot-password')} className="ft-forgot">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="ft-submit">
                {loading
                  ? <span className="ft-loading-row"><span className="ft-spinner" />Signing in…</span>
                  : <span>Let's Grow! 🌱</span>
                }
              </button>
            </form>

            <p className="ft-footer">Your account is managed by your school 🏫</p>
            <div className="ft-dots">
              {['#16a34a','#4ade80','#fbbf24','#86efac'].map((c, i) => (
                <span key={i} className="ft-dot" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  .ft-root { min-height: 100vh; display: flex; font-family: 'Nunito','Segoe UI',sans-serif; background: #052e16; overflow: hidden; }

  /* ── LEFT ── */
  .ft-left { flex: 1; min-height: 100vh; background: linear-gradient(180deg,#052e16 0%,#14532d 40%,#15803d 75%,#166534 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 32px; position: relative; overflow: hidden; }

  /* Ground */
  .ft-ground { position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: linear-gradient(to top,#14532d,#166534); }
  .ft-grass { position: absolute; bottom: 55px; left: 0; right: 0; height: 12px; background: repeating-linear-gradient(90deg,#4ade80 0 6px,transparent 6px 12px); opacity: .4; }

  /* Fireflies */
  .ft-firefly { position: absolute; width: 5px; height: 5px; background: #fde68a; border-radius: 50%; box-shadow: 0 0 8px 3px #fbbf24, 0 0 16px 6px rgba(251,191,36,.4); animation: ft-glow ease-in-out infinite; }
  @keyframes ft-glow { 0%,100%{opacity:0;transform:translate(0,0) scale(.8)} 50%{opacity:1;transform:translate(8px,-12px) scale(1.2)} }

  /* Scene */
  .ft-scene { position: relative; width: 300px; height: 280px; margin-bottom: 24px; }

  /* Background trees */
  .ft-tree-bg { position: absolute; bottom: 0; }
  .ft-tree-bg::before { content:''; position:absolute; bottom:0; left:50%; transform:translateX(-50%); width:10px; background:#92400e; border-radius:3px; }
  .ft-tree-bg::after { content:''; position:absolute; width:0; height:0; border-left:25px solid transparent; border-right:25px solid transparent; border-bottom:60px solid #166534; left:50%;transform:translateX(-50%); }
  .ft-tb-1 { left: 15px; height: 80px; }
  .ft-tb-1::before { height: 20px; }
  .ft-tb-2 { right: 20px; height: 70px; }
  .ft-tb-2::before { height: 18px; }

  /* Main tree */
  .ft-main-tree { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); }
  .ft-trunk { width: 22px; height: 100px; background: linear-gradient(to right,#92400e,#b45309,#78350f); border-radius: 4px; margin: 0 auto; position: relative; }
  .ft-trunk::before { content:''; position:absolute; top:20px;left:4px; width:6px;height:30px; background:rgba(255,255,255,.1);border-radius:3px; }
  .ft-canopy { position: absolute; left: 50%; transform: translateX(-50%); border-radius: 50%; }
  .ft-c-back { width: 120px; height: 100px; background: #14532d; bottom: 80px; box-shadow: 0 10px 20px rgba(0,0,0,.3); }
  .ft-c-mid  { width: 100px; height: 90px; background: #16a34a; bottom: 95px; }
  .ft-c-front{ width: 80px;  height: 80px; background: #4ade80; bottom: 108px; box-shadow: 0 -4px 12px rgba(74,222,128,.3); }

  /* Lantern */
  .ft-lantern-string { position: absolute; width: 2px; height: 30px; background: rgba(255,255,255,.4); left: 50%; transform: translateX(-50%); top: -22px; }
  .ft-lantern { position: absolute; width: 20px; height: 28px; background: linear-gradient(135deg,#fef08a,#fbbf24); border-radius: 4px; left: 50%; transform: translateX(-50%); top: -52px; box-shadow: 0 0 16px 6px rgba(251,191,36,.5); }
  .ft-lantern-glow { position: absolute; inset: 3px; background: #fef9c3; border-radius: 2px; animation: ft-lantern-flicker 1.5s ease-in-out infinite; }
  @keyframes ft-lantern-flicker { 0%,100%{opacity:.9} 50%{opacity:.5} }

  /* Reader character */
  .ft-reader { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; animation: ft-read-bob 3s ease-in-out infinite; }
  @keyframes ft-read-bob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-5px)} }
  .ft-reader-body { width: 30px; height: 28px; background: linear-gradient(135deg,#3b82f6,#1d4ed8); border-radius: 6px 6px 0 0; }
  .ft-reader-head { width: 28px; height: 28px; background: linear-gradient(135deg,#fde68a,#fbbf24); border-radius: 50%; position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: -2px; }
  .ft-reader-eyes { display: flex; gap: 6px; margin-top: 6px; }
  .ft-reader-eye { width: 5px; height: 5px; background: #1e293b; border-radius: 50%; }
  .ft-rcap-brim { position: absolute; top: -5px; left: -4px; right: -4px; height: 5px; background: #1e1b4b; border-radius: 2px; }
  .ft-rcap-top  { position: absolute; top: -14px; left: 50%; transform: translateX(-50%); width: 16px; height: 10px; background: #312e81; border-radius: 2px 2px 0 0; }
  .ft-rcap-tassel { position: absolute; top: -14px; right: 0; width: 2px; height: 16px; background: linear-gradient(to bottom,#fbbf24,#f97316); border-radius: 1px; }

  /* Book */
  .ft-book { display: flex; align-items: flex-end; gap: 0; margin-top: 2px; filter: drop-shadow(0 4px 6px rgba(0,0,0,.3)); }
  .ft-book-l { width: 22px; height: 16px; background: linear-gradient(135deg,#ef4444,#b91c1c); border-radius: 2px 0 0 2px; transform: perspective(80px) rotateY(8deg); }
  .ft-book-spine { width: 4px; height: 18px; background: #7f1d1d; }
  .ft-book-r { width: 22px; height: 16px; background: linear-gradient(135deg,#fca5a5,#ef4444); border-radius: 0 2px 2px 0; transform: perspective(80px) rotateY(-8deg); }

  /* Mushrooms */
  .ft-shroom { position: absolute; bottom: 0; display: flex; flex-direction: column; align-items: center; }
  .ft-sh-1 { left: 15%; }
  .ft-sh-2 { right: 20%; transform: scale(.7); }
  .ft-sh-cap { width: 22px; height: 14px; background: radial-gradient(circle at 40% 30%,#fca5a5,#ef4444,#b91c1c); border-radius: 50% 50% 0 0; position: relative; }
  .ft-sh-cap::after { content:''; position:absolute; top:3px;left:3px; width:6px;height:4px; background:rgba(255,255,255,.4);border-radius:50%; }
  .ft-sh-stem { width: 8px; height: 12px; background: #fef9c3; border-radius: 0 0 3px 3px; }

  .ft-sp { position: absolute; color: #4ade80; font-size: 16px; animation: ft-sp-anim 2s ease-in-out infinite; pointer-events: none; }
  .ft-sp-1{top:10%;left:10%;animation-delay:0s} .ft-sp-2{top:60%;left:82%;animation-delay:1s;color:#fbbf24;font-size:20px} .ft-sp-3{top:30%;left:85%;animation-delay:1.8s}
  @keyframes ft-sp-anim { 0%,100%{opacity:.2;transform:scale(.8) rotate(0)} 50%{opacity:1;transform:scale(1.3) rotate(15deg)} }

  .ft-hero-text { text-align: center; color: white; position: relative; z-index: 2; }
  .ft-hero-h2 { font-size: clamp(34px,5vw,50px); font-weight: 900; line-height: 1.15; margin: 0 0 12px; letter-spacing: -1px; background: linear-gradient(135deg,#fff 0%,#bbf7d0 50%,#fde68a 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .ft-hero-p { font-size: 15px; color: rgba(255,255,255,.75); margin: 0 0 24px; font-weight: 600; }
  .ft-badge-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .ft-badge { background: rgba(255,255,255,.12); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.2); color: white; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 100px; }

  /* ── RIGHT ── */
  .ft-right { width: 440px; min-height: 100vh; background: #f0fdf4; display: flex; align-items: center; justify-content: center; padding: 40px 32px; position: relative; flex-shrink: 0; }
  .ft-right::before { content:''; position:absolute; inset:0; background: linear-gradient(180deg,rgba(22,163,74,.06) 0%,rgba(74,222,128,.04) 100%); pointer-events:none; }

  .ft-card { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 6px; animation: ft-rise .55s cubic-bezier(.16,1,.3,1) both; }
  @keyframes ft-rise { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }

  .ft-brand { display: flex; justify-content: center; margin-bottom: 6px; animation: ft-bounce .7s cubic-bezier(.34,1.56,.64,1) .2s both; }
  @keyframes ft-bounce { from{opacity:0;transform:scale(.4)} to{opacity:1;transform:scale(1)} }
  .ft-logo-img { height: 56px; max-width: 160px; object-fit: contain; }
  .ft-logo-default { width: 72px; height: 72px; border-radius: 20px; background: linear-gradient(135deg,#16a34a,#15803d); display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 8px 24px rgba(22,163,74,.4); }

  .ft-title { font-size: 26px; font-weight: 900; color: #14532d; margin: 4px 0 2px; text-align: center; letter-spacing: -.5px; }
  .ft-subtitle { font-size: 14px; color: #475569; text-align: center; margin: 0 0 18px; font-weight: 600; }

  .ft-error { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 2px solid #fecaca; border-radius: 14px; padding: 11px 14px; color: #dc2626; font-size: 13.5px; font-weight: 700; margin-bottom: 8px; animation: ft-shake .45s ease both; }
  @keyframes ft-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }

  .ft-form { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; }
  .ft-field { display: flex; flex-direction: column; gap: 7px; }
  .ft-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
  .ft-input-wrap { display: flex; align-items: center; height: 52px; padding: 0 16px; background: white; border: 2.5px solid #bbf7d0; border-radius: 16px; transition: border-color .2s, box-shadow .2s; }
  .ft-input-wrap.ft-focused { border-color: #16a34a; background: #f0fdf4; box-shadow: 0 0 0 4px rgba(22,163,74,.12); }
  .ft-input { flex: 1; border: none; outline: none; background: transparent; font-size: 15px; color: #14532d; font-family: inherit; font-weight: 600; }
  .ft-eye-btn { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center; }
  .ft-eye-btn:hover { color: #16a34a; }
  .ft-forgot { background: none; border: none; cursor: pointer; font-size: 13px; color: #16a34a; font-weight: 700; font-family: inherit; padding: 0; }

  .ft-submit { width: 100%; height: 56px; background: linear-gradient(135deg,#15803d,#16a34a,#4ade80); color: white; border: none; border-radius: 18px; font-size: 17px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 4px; box-shadow: 0 6px 22px rgba(22,163,74,.45); transition: transform .15s, box-shadow .15s; }
  .ft-submit:hover:not(:disabled) { transform: translateY(-3px) scale(1.01); box-shadow: 0 12px 32px rgba(22,163,74,.5); }
  .ft-submit:active:not(:disabled) { transform: translateY(0) scale(.98); }
  .ft-submit:disabled { opacity: .7; cursor: not-allowed; }

  .ft-loading-row { display: flex; align-items: center; gap: 10px; justify-content: center; }
  .ft-spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,.35); border-top-color: white; border-radius: 50%; animation: ft-spin .7s linear infinite; }
  @keyframes ft-spin { to{transform:rotate(360deg)} }

  .ft-footer { text-align: center; font-size: 12px; color: #94a3b8; margin: 14px 0 6px; font-weight: 600; }
  .ft-dots { display: flex; justify-content: center; gap: 8px; margin-top: 4px; }
  .ft-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; animation: ft-db 1.4s ease-in-out infinite; }
  .ft-dot:nth-child(1){animation-delay:0s} .ft-dot:nth-child(2){animation-delay:.15s} .ft-dot:nth-child(3){animation-delay:.3s} .ft-dot:nth-child(4){animation-delay:.45s}
  @keyframes ft-db { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.6)} }

  @media (max-width:900px) { .ft-root{flex-direction:column} .ft-left{min-height:auto;padding:40px 24px 32px} .ft-right{width:100%;min-height:auto;padding:32px 24px 48px} }
  @media (max-width:480px) { .ft-scene{display:none} .ft-hero-h2{font-size:30px} }
`;
