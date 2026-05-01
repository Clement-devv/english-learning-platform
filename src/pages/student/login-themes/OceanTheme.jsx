// src/pages/student/login-themes/OceanTheme.jsx
import React from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useLoginLogic } from './useLoginLogic';

export default function OceanTheme({ loginHook } = {}) {
  const {
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    focusedField, setFocusedField,
    handleInitialLogin, handle2FAVerification, handleCancel2FA, navigate,
  } = (loginHook || useLoginLogic)();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';

  if (requires2FA) {
    return (
      <div className="oc-root">
        <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
      </div>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="oc-root" style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Nunito', sans-serif` } : {}}>

        {/* ── LEFT — ocean illustration ── */}
        <div className="oc-left">
          {/* Bubbles */}
          {[...Array(18)].map((_, i) => (
            <span key={i} className="oc-bubble"
              style={{
                left: `${(i * 41 + 5) % 90}%`,
                width: `${6 + (i % 5) * 4}px`,
                height: `${6 + (i % 5) * 4}px`,
                animationDelay: `${(i * 0.6) % 5}s`,
                animationDuration: `${4 + (i % 4)}s`,
              }}
            />
          ))}

          {/* Wave layers */}
          <div className="oc-wave oc-wave-1" />
          <div className="oc-wave oc-wave-2" />
          <div className="oc-wave oc-wave-3" />

          {/* ── Submarine mascot ── */}
          <div className="oc-scene">
            <div className="oc-sub-wrap">
              {/* Propeller */}
              <div className="oc-propeller">
                <div className="oc-prop-blade" />
                <div className="oc-prop-blade oc-pb2" />
                <div className="oc-prop-hub" />
              </div>
              {/* Body */}
              <div className="oc-sub-body">
                {/* Periscope */}
                <div className="oc-periscope" />
                {/* Portholes */}
                <div className="oc-porthole oc-ph-main">
                  <div className="oc-ph-face">
                    <div className="oc-ph-eyes"><div className="oc-ph-eye" /><div className="oc-ph-eye" /></div>
                    <div className="oc-ph-smile" />
                  </div>
                </div>
                <div className="oc-porthole oc-ph-small" />
                {/* Fin */}
                <div className="oc-fin-top" />
                <div className="oc-fin-bot" />
              </div>
              {/* Nose cone */}
              <div className="oc-nose" />
            </div>

            {/* Fish */}
            <div className="oc-fish oc-fish-1">🐠</div>
            <div className="oc-fish oc-fish-2">🐟</div>
            <div className="oc-fish oc-fish-3">🦑</div>

            {/* Sparkle bubbles */}
            <span className="oc-sp oc-sp-1">✦</span>
            <span className="oc-sp oc-sp-2">✧</span>
            <span className="oc-sp oc-sp-3">✦</span>
          </div>

          <div className="oc-hero-text">
            <h2 className="oc-hero-h2">Dive Into<br />Learning.</h2>
            <p className="oc-hero-p">Explore the depths of English!</p>
            <div className="oc-badge-row">
              <span className="oc-badge">🎓 Expert lessons</span>
              <span className="oc-badge">🌍 Live classes</span>
              <span className="oc-badge">🏆 Track progress</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — login form ── */}
        <div className="oc-right">
          <div className="oc-card">
            <div className="oc-brand">
              {branding.logo
                ? <img src={branding.logo} alt={centerName} className="oc-logo-img" />
                : <div className="oc-logo-default"><span>🌊</span></div>
              }
            </div>

            <h1 className="oc-title">{centerName}</h1>
            <p className="oc-subtitle">Sign in to start exploring!</p>

            {error && (
              <div className="oc-error">
                <AlertCircle size={16} color="#dc2626" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} className="oc-form">
              <div className="oc-field">
                <label className="oc-label"><Mail size={13} /> Email</label>
                <div className={`oc-input-wrap${focusedField === 'email' ? ' oc-focused' : ''}`}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                    placeholder="your.email@example.com" required disabled={loading} className="oc-input" />
                </div>
              </div>

              <div className="oc-field">
                <label className="oc-label"><Lock size={13} /> Password</label>
                <div className={`oc-input-wrap${focusedField === 'password' ? ' oc-focused' : ''}`}>
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    placeholder="••••••••" required disabled={loading} className="oc-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="oc-eye-btn" disabled={loading}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-6px' }}>
                <button type="button" onClick={() => navigate('/student/forgot-password')} className="oc-forgot">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="oc-submit">
                {loading
                  ? <span className="oc-loading-row"><span className="oc-spinner" />Signing in…</span>
                  : <span>Dive In! 🌊</span>
                }
              </button>
            </form>

            <p className="oc-footer">Your account is managed by your school 🏫</p>
            <div className="oc-dots">
              {['#0891b2','#06b6d4','#22d3ee','#67e8f9'].map((c, i) => (
                <span key={i} className="oc-dot" style={{ background: c }} />
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

  .oc-root { min-height: 100vh; display: flex; font-family: 'Nunito','Segoe UI',sans-serif; background: #0c1445; overflow: hidden; }

  /* ── LEFT ── */
  .oc-left { flex: 1; min-height: 100vh; background: linear-gradient(180deg,#0c1445 0%,#0a2a6b 30%,#0369a1 70%,#0891b2 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 32px; position: relative; overflow: hidden; }

  /* Bubbles */
  .oc-bubble { position: absolute; bottom: -20px; border-radius: 50%; background: rgba(186,230,253,.25); border: 1px solid rgba(186,230,253,.4); animation: oc-rise linear infinite; }
  @keyframes oc-rise { 0%{transform:translateY(0) scale(1);opacity:.7} 100%{transform:translateY(-100vh) scale(1.3);opacity:0} }

  /* Waves */
  .oc-wave { position: absolute; bottom: 0; left: -50%; width: 200%; border-radius: 50% 50% 0 0; opacity: .15; animation: oc-wave-anim ease-in-out infinite alternate; }
  .oc-wave-1 { height: 80px; background: #7dd3fc; animation-duration: 4s; }
  .oc-wave-2 { height: 60px; background: #38bdf8; animation-duration: 6s; animation-delay: 1s; bottom: 10px; }
  .oc-wave-3 { height: 40px; background: #bae6fd; animation-duration: 5s; animation-delay: 2s; bottom: 20px; }
  @keyframes oc-wave-anim { from{transform:translateX(-5%)} to{transform:translateX(5%)} }

  /* ── Submarine ── */
  .oc-scene { position: relative; width: 320px; height: 280px; margin-bottom: 24px; }
  .oc-sub-wrap { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); display: flex; align-items: center; animation: oc-sub-float 4s ease-in-out infinite; filter: drop-shadow(0 16px 32px rgba(0,0,0,.4)); }
  @keyframes oc-sub-float { 0%,100%{transform:translate(-50%,-50%) rotate(-2deg)} 50%{transform:translate(-50%,calc(-50% - 12px)) rotate(2deg)} }

  .oc-sub-body { width: 160px; height: 80px; background: linear-gradient(135deg,#fbbf24,#f59e0b,#d97706); border-radius: 40px; position: relative; box-shadow: 0 8px 24px rgba(0,0,0,.3),inset 0 3px 0 rgba(255,255,255,.2); }
  .oc-sub-body::before { content:''; position:absolute; top:6px;left:16px; width:60px;height:8px; background:rgba(255,255,255,.2);border-radius:4px; }

  .oc-periscope { position: absolute; top: -30px; left: 30px; width: 10px; height: 30px; background: linear-gradient(to bottom,#92400e,#d97706); border-radius: 5px 5px 0 0; }
  .oc-periscope::after { content:''; position:absolute; top:-8px;right:-6px; width:20px;height:10px; background:#92400e; border-radius:5px 5px 0 0; }

  .oc-porthole { border-radius: 50%; background: radial-gradient(circle at 35% 35%,#bae6fd,#0284c7,#0c4a6e); border: 3px solid #fef3c7; box-shadow: 0 0 10px rgba(251,191,36,.5),inset 0 2px 4px rgba(255,255,255,.2); }
  .oc-ph-main { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; }
  .oc-ph-small { position: absolute; top: 12px; right: 20px; width: 22px; height: 22px; }
  .oc-ph-face { display: flex; flex-direction: column; align-items: center; gap: 5px; }
  .oc-ph-eyes { display: flex; gap: 7px; }
  .oc-ph-eye { width: 7px; height: 7px; background: white; border-radius: 50%; animation: oc-blink 3.5s ease-in-out infinite; }
  .oc-ph-eye:nth-child(2){animation-delay:.08s}
  @keyframes oc-blink { 0%,92%,100%{transform:scaleY(1)} 95%{transform:scaleY(.1)} }
  .oc-ph-smile { width: 14px; height: 7px; border-bottom: 2.5px solid white; border-left: 2.5px solid transparent; border-right: 2.5px solid transparent; border-radius: 0 0 8px 8px; }

  .oc-fin-top { position: absolute; top: -20px; left: 40px; width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent; border-bottom: 22px solid #b45309; }
  .oc-fin-bot { position: absolute; bottom: -20px; left: 40px; width: 0; height: 0; border-left: 15px solid transparent; border-right: 15px solid transparent; border-top: 22px solid #92400e; }

  .oc-nose { width: 0; height: 0; border-top: 40px solid transparent; border-bottom: 40px solid transparent; border-left: 50px solid #d97706; filter: drop-shadow(4px 0 8px rgba(0,0,0,.3)); }

  .oc-propeller { position: relative; width: 20px; height: 60px; display: flex; align-items: center; justify-content: center; animation: oc-spin .4s linear infinite; margin-right: -4px; }
  .oc-prop-blade { position: absolute; width: 8px; height: 28px; background: linear-gradient(to bottom,#d97706,#92400e); border-radius: 4px; }
  .oc-pb2 { transform: rotate(90deg); }
  .oc-prop-hub { width: 10px; height: 10px; background: #fbbf24; border-radius: 50%; position: absolute; box-shadow: 0 0 6px rgba(251,191,36,.6); }
  @keyframes oc-spin { to{transform:rotate(360deg)} }

  /* Fish */
  .oc-fish { position: absolute; font-size: 26px; animation: oc-fish-swim linear infinite; filter: drop-shadow(0 4px 8px rgba(0,0,0,.3)); }
  .oc-fish-1 { top: 20%; animation-duration: 7s; animation-delay: 0s; left: -10%; }
  .oc-fish-2 { top: 65%; animation-duration: 9s; animation-delay: 2s; left: -10%; }
  .oc-fish-3 { top: 40%; animation-duration: 11s; animation-delay: 4s; right: -10%; transform: scaleX(-1); }
  @keyframes oc-fish-swim { 0%{transform:translateX(0)} 50%{transform:translateX(380px)} 100%{transform:translateX(0)} }

  .oc-sp { position: absolute; color: #7dd3fc; font-size: 16px; animation: oc-sparkle 2.5s ease-in-out infinite; pointer-events: none; }
  .oc-sp-1{top:15%;left:12%;animation-delay:0s} .oc-sp-2{top:72%;left:22%;animation-delay:1s;color:#bae6fd;font-size:20px} .oc-sp-3{top:22%;left:80%;animation-delay:1.8s}
  @keyframes oc-sparkle { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:1;transform:scale(1.4)} }

  .oc-hero-text { text-align: center; color: white; position: relative; z-index: 2; }
  .oc-hero-h2 { font-size: clamp(34px,5vw,50px); font-weight: 900; line-height: 1.15; margin: 0 0 12px; letter-spacing: -1px; background: linear-gradient(135deg,#fff 0%,#bae6fd 50%,#67e8f9 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .oc-hero-p { font-size: 15px; color: rgba(255,255,255,.75); margin: 0 0 24px; font-weight: 600; }
  .oc-badge-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .oc-badge { background: rgba(255,255,255,.12); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.2); color: white; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 100px; }

  /* ── RIGHT ── */
  .oc-right { width: 440px; min-height: 100vh; background: #f0f9ff; display: flex; align-items: center; justify-content: center; padding: 40px 32px; position: relative; flex-shrink: 0; }
  .oc-right::before { content:''; position:absolute; inset:0; background: linear-gradient(180deg,rgba(8,145,178,.06) 0%,rgba(6,182,212,.04) 100%); pointer-events:none; }

  .oc-card { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 6px; animation: oc-rise-card .55s cubic-bezier(.16,1,.3,1) both; }
  @keyframes oc-rise-card { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }

  .oc-brand { display: flex; justify-content: center; margin-bottom: 6px; animation: oc-bounce .7s cubic-bezier(.34,1.56,.64,1) .2s both; }
  @keyframes oc-bounce { from{opacity:0;transform:scale(.4)} to{opacity:1;transform:scale(1)} }
  .oc-logo-img { height: 56px; max-width: 160px; object-fit: contain; }
  .oc-logo-default { width: 72px; height: 72px; border-radius: 20px; background: linear-gradient(135deg,#0891b2,#0369a1); display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 8px 24px rgba(8,145,178,.4); }

  .oc-title { font-size: 26px; font-weight: 900; color: #0c4a6e; margin: 4px 0 2px; text-align: center; letter-spacing: -.5px; }
  .oc-subtitle { font-size: 14px; color: #475569; text-align: center; margin: 0 0 18px; font-weight: 600; }

  .oc-error { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 2px solid #fecaca; border-radius: 14px; padding: 11px 14px; color: #dc2626; font-size: 13.5px; font-weight: 700; margin-bottom: 8px; animation: oc-shake .45s ease both; }
  @keyframes oc-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }

  .oc-form { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; }
  .oc-field { display: flex; flex-direction: column; gap: 7px; }
  .oc-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
  .oc-input-wrap { display: flex; align-items: center; height: 52px; padding: 0 16px; background: white; border: 2.5px solid #bae6fd; border-radius: 16px; transition: border-color .2s, box-shadow .2s; }
  .oc-input-wrap.oc-focused { border-color: #0891b2; background: #f0f9ff; box-shadow: 0 0 0 4px rgba(8,145,178,.12); }
  .oc-input { flex: 1; border: none; outline: none; background: transparent; font-size: 15px; color: #0c4a6e; font-family: inherit; font-weight: 600; }
  .oc-eye-btn { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center; }
  .oc-eye-btn:hover { color: #0891b2; }
  .oc-forgot { background: none; border: none; cursor: pointer; font-size: 13px; color: #0891b2; font-weight: 700; font-family: inherit; padding: 0; }

  .oc-submit { width: 100%; height: 56px; background: linear-gradient(135deg,#0369a1,#0891b2,#06b6d4); color: white; border: none; border-radius: 18px; font-size: 17px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 4px; box-shadow: 0 6px 22px rgba(8,145,178,.45); transition: transform .15s, box-shadow .15s; }
  .oc-submit:hover:not(:disabled) { transform: translateY(-3px) scale(1.01); box-shadow: 0 12px 32px rgba(8,145,178,.5); }
  .oc-submit:active:not(:disabled) { transform: translateY(0) scale(.98); }
  .oc-submit:disabled { opacity: .7; cursor: not-allowed; }

  .oc-loading-row { display: flex; align-items: center; gap: 10px; justify-content: center; }
  .oc-spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,.35); border-top-color: white; border-radius: 50%; animation: oc-spin-anim .7s linear infinite; }
  @keyframes oc-spin-anim { to{transform:rotate(360deg)} }

  .oc-footer { text-align: center; font-size: 12px; color: #94a3b8; margin: 14px 0 6px; font-weight: 600; }
  .oc-dots { display: flex; justify-content: center; gap: 8px; margin-top: 4px; }
  .oc-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; animation: oc-dot-b 1.4s ease-in-out infinite; }
  .oc-dot:nth-child(1){animation-delay:0s} .oc-dot:nth-child(2){animation-delay:.15s} .oc-dot:nth-child(3){animation-delay:.3s} .oc-dot:nth-child(4){animation-delay:.45s}
  @keyframes oc-dot-b { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.6)} }

  @media (max-width:900px) { .oc-root{flex-direction:column} .oc-left{min-height:auto;padding:40px 24px 32px} .oc-right{width:100%;min-height:auto;padding:32px 24px 48px} }
  @media (max-width:480px) { .oc-scene{display:none} .oc-hero-h2{font-size:30px} }
`;
