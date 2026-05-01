// src/pages/student/login-themes/SpaceTheme.jsx
import React from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useLoginLogic } from './useLoginLogic';

export default function SpaceTheme({ loginHook } = {}) {
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
      <div className="sl-root">
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
        className="sl-root"
        style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Nunito', sans-serif` } : {}}
      >
        {/* ── LEFT — space illustration ── */}
        <div className="sl-left">
          {[...Array(28)].map((_, i) => (
            <span key={i} className={`sl-star sl-star-${i % 7}`}
              style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`, animationDelay: `${(i * 0.4) % 3}s` }}
            />
          ))}

          <div className="sl-scene">
            <div className="sl-planet-wrap">
              <div className="sl-planet"><div className="sl-planet-shine" /></div>
              <div className="sl-ring" />
              <div className="sl-ring sl-ring-2" />
            </div>

            <div className="sl-rocket-wrap">
              <div className="sl-flame"><div className="sl-flame-inner" /></div>
              <div className="sl-rocket-body">
                <div className="sl-window">
                  <div className="sl-window-face">
                    <div className="sl-wf-eyes"><div className="sl-wf-eye" /><div className="sl-wf-eye" /></div>
                    <div className="sl-wf-smile" />
                  </div>
                </div>
                <div className="sl-fin sl-fin-l" />
                <div className="sl-fin sl-fin-r" />
              </div>
              <div className="sl-nose" />
              <div className="sl-grad-cap">
                <div className="sl-cap-board" />
                <div className="sl-cap-tassel" />
              </div>
            </div>

            <div className="sl-orbit sl-orbit-1"><div className="sl-orb-item">📖</div></div>
            <div className="sl-orbit sl-orbit-2"><div className="sl-orb-item">⭐</div></div>
            <div className="sl-orbit sl-orbit-3"><div className="sl-orb-item">✏️</div></div>

            <span className="sl-sparkle sl-sp-1">✦</span>
            <span className="sl-sparkle sl-sp-2">✧</span>
            <span className="sl-sparkle sl-sp-3">✦</span>
            <span className="sl-sparkle sl-sp-4">✧</span>
          </div>

          <div className="sl-hero-text">
            <h2 className="sl-hero-h2">Learn.<br />Grow.<br />Shine.</h2>
            <p className="sl-hero-p">Your classroom adventure awaits!</p>
            <div className="sl-badge-row">
              <span className="sl-badge">🎓 Expert lessons</span>
              <span className="sl-badge">🌍 Live classes</span>
              <span className="sl-badge">🏆 Track progress</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT — login form ── */}
        <div className="sl-right">
          <div className="sl-card">
            <div className="sl-brand">
              {branding.logo
                ? <img src={branding.logo} alt={centerName} className="sl-logo-img" />
                : <div className="sl-logo-default"><span>🚀</span></div>
              }
            </div>

            <h1 className="sl-title">{centerName}</h1>
            <p className="sl-subtitle">Sign in to start your adventure!</p>

            {error && (
              <div className="sl-error">
                <AlertCircle size={16} color="#dc2626" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} className="sl-form">
              <div className="sl-field">
                <label className="sl-label"><Mail size={13} /> Email</label>
                <div className={`sl-input-wrap${focusedField === 'email' ? ' sl-focused' : ''}`}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                    placeholder="your.email@example.com" required disabled={loading} className="sl-input" />
                </div>
              </div>

              <div className="sl-field">
                <label className="sl-label"><Lock size={13} /> Password</label>
                <div className={`sl-input-wrap${focusedField === 'password' ? ' sl-focused' : ''}`}>
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                    placeholder="••••••••" required disabled={loading} className="sl-input" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="sl-eye-btn" disabled={loading}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'right', marginTop: '-6px' }}>
                <button type="button" onClick={() => navigate('/student/forgot-password')} className="sl-forgot">
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={loading} className="sl-submit">
                {loading
                  ? <span className="sl-loading-row"><span className="sl-spinner" />Signing in…</span>
                  : <span>Let's Go! 🚀</span>
                }
              </button>
            </form>

            <p className="sl-footer">Your account is managed by your school 🏫</p>
            <div className="sl-dots">
              {['#a855f7','#f97316','#facc15','#22d3ee'].map((c, i) => (
                <span key={i} className="sl-dot" style={{ background: c }} />
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

  .sl-root { min-height: 100vh; display: flex; font-family: 'Nunito','Segoe UI',sans-serif; background: #1a0533; overflow: hidden; position: relative; }

  .sl-left { flex: 1; min-height: 100vh; background: linear-gradient(160deg,#1a0533 0%,#3b0764 40%,#7c2d12 80%,#ea580c 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 32px; position: relative; overflow: hidden; }

  .sl-star { position: absolute; width: 3px; height: 3px; background: white; border-radius: 50%; opacity: 0; animation: sl-twinkle 2.5s ease-in-out infinite; }
  .sl-star-0{animation-duration:2.1s} .sl-star-1{animation-duration:3.2s;width:2px;height:2px} .sl-star-2{animation-duration:1.8s;width:4px;height:4px} .sl-star-3{animation-duration:2.7s} .sl-star-4{animation-duration:3.5s;width:2px;height:2px} .sl-star-5{animation-duration:2.3s;width:5px;height:5px} .sl-star-6{animation-duration:1.6s}
  @keyframes sl-twinkle { 0%,100%{opacity:0;transform:scale(1)} 50%{opacity:.9;transform:scale(1.4)} }

  .sl-scene { position: relative; width: 340px; height: 340px; perspective: 900px; transform-style: preserve-3d; margin-bottom: 24px; }

  .sl-planet-wrap { position: absolute; top: 10px; right: 10px; width: 90px; height: 90px; animation: sl-planet-float 6s ease-in-out infinite; }
  .sl-planet { width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(circle at 30% 30%,#f9a8d4,#9333ea 55%,#4c0080); box-shadow: 0 0 30px rgba(147,51,234,.6),inset -10px -10px 20px rgba(0,0,0,.3); position: relative; overflow: hidden; }
  .sl-planet-shine { position: absolute; top: 10px; left: 12px; width: 28px; height: 18px; background: rgba(255,255,255,.35); border-radius: 50%; transform: rotate(-30deg); }
  .sl-ring { position: absolute; top: 50%; left: 50%; width: 130px; height: 30px; border: 4px solid rgba(249,168,212,.45); border-radius: 50%; transform: translate(-50%,-50%) rotateX(75deg); }
  .sl-ring-2 { width: 110px; height: 24px; border-color: rgba(167,139,250,.35); transform: translate(-50%,-50%) rotateX(75deg) rotateZ(20deg); }
  @keyframes sl-planet-float { 0%,100%{transform:translateY(0) rotateZ(0deg)} 50%{transform:translateY(-12px) rotateZ(5deg)} }

  .sl-rocket-wrap { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 90px; display: flex; flex-direction: column; align-items: center; animation: sl-rocket-float 3.5s ease-in-out infinite; filter: drop-shadow(0 12px 24px rgba(234,88,12,.6)); }
  @keyframes sl-rocket-float { 0%,100%{transform:translate(-50%,-50%) rotate(-3deg)} 50%{transform:translate(-50%,calc(-50% - 16px)) rotate(3deg)} }

  .sl-grad-cap { position: relative; width: 60px; height: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: -2px; z-index: 2; }
  .sl-cap-board { width: 60px; height: 10px; background: linear-gradient(135deg,#1e1b4b,#312e81); border-radius: 3px; box-shadow: 0 4px 12px rgba(0,0,0,.5); position: relative; }
  .sl-cap-board::before { content: ''; position: absolute; top: -8px; left: 50%; transform: translateX(-50%); width: 20px; height: 8px; background: #312e81; border-radius: 2px 2px 0 0; }
  .sl-cap-tassel { position: absolute; right: 6px; top: 0; width: 3px; height: 22px; background: linear-gradient(to bottom,#facc15,#f97316); border-radius: 2px; }
  .sl-cap-tassel::after { content: ''; display: block; width: 10px; height: 10px; background: #facc15; border-radius: 50%; position: absolute; bottom: -5px; left: -3.5px; }

  .sl-nose { width: 0; height: 0; border-left: 22px solid transparent; border-right: 22px solid transparent; border-bottom: 40px solid #ef4444; filter: drop-shadow(0 -2px 6px rgba(239,68,68,.5)); position: relative; z-index: 1; }
  .sl-rocket-body { width: 56px; height: 80px; background: linear-gradient(180deg,#ef4444 0%,#dc2626 40%,#b91c1c 100%); border-radius: 4px; position: relative; overflow: visible; box-shadow: 2px 4px 16px rgba(0,0,0,.4); z-index: 1; }
  .sl-rocket-body::before { content: ''; position: absolute; top: 6px; left: 6px; width: 10px; height: 40px; background: rgba(255,255,255,.15); border-radius: 4px; }
  .sl-window { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); width: 36px; height: 36px; border-radius: 50%; background: radial-gradient(circle at 35% 35%,#bae6fd,#0284c7,#01579b); border: 3px solid #fbbf24; box-shadow: 0 0 14px rgba(251,191,36,.6),inset 0 2px 6px rgba(255,255,255,.2); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .sl-window-face { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .sl-wf-eyes { display: flex; gap: 6px; }
  .sl-wf-eye { width: 6px; height: 6px; background: white; border-radius: 50%; animation: sl-blink 4s ease-in-out infinite; }
  .sl-wf-eye:nth-child(2){animation-delay:.1s}
  @keyframes sl-blink { 0%,94%,100%{transform:scaleY(1)} 96%{transform:scaleY(.1)} }
  .sl-wf-smile { width: 12px; height: 6px; border-bottom: 2.5px solid white; border-left: 2.5px solid transparent; border-right: 2.5px solid transparent; border-radius: 0 0 8px 8px; }
  .sl-fin { position: absolute; bottom: 0; width: 0; height: 0; border-top: 30px solid transparent; }
  .sl-fin-l { left: -18px; border-right: 20px solid #b91c1c; }
  .sl-fin-r { right: -18px; border-left: 20px solid #b91c1c; }
  .sl-flame { width: 28px; height: 40px; position: relative; display: flex; align-items: flex-start; justify-content: center; z-index: 0; margin-top: -4px; }
  .sl-flame::before,.sl-flame-inner { content: ''; position: absolute; bottom: 0; border-radius: 50% 50% 30% 30%; animation: sl-flicker .15s ease-in-out infinite alternate; }
  .sl-flame::before { width: 28px; height: 40px; background: linear-gradient(to top,#fbbf24,#f97316,#ef4444,transparent); }
  .sl-flame-inner { width: 14px; height: 24px; background: linear-gradient(to top,#fef9c3,#fde047,#fbbf24,transparent); animation-delay: .07s; }
  @keyframes sl-flicker { from{transform:scaleX(1) scaleY(1)} to{transform:scaleX(.88) scaleY(1.08)} }

  .sl-orbit { position: absolute; top: 50%; left: 50%; border-radius: 50%; border: 1.5px dashed rgba(255,255,255,.15); }
  .sl-orbit-1 { width: 220px; height: 220px; margin: -110px 0 0 -110px; animation: sl-orbit-spin 8s linear infinite; }
  .sl-orbit-2 { width: 290px; height: 180px; margin: -90px 0 0 -145px; animation: sl-orbit-spin 12s linear infinite reverse; border-color: rgba(255,255,255,.1); }
  .sl-orbit-3 { width: 260px; height: 260px; margin: -130px 0 0 -130px; animation: sl-orbit-spin 10s linear infinite; border-color: rgba(255,255,255,.08); }
  @keyframes sl-orbit-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .sl-orb-item { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); font-size: 24px; filter: drop-shadow(0 4px 8px rgba(0,0,0,.4)); animation: sl-orb-counter 8s linear infinite; }
  .sl-orbit-2 .sl-orb-item{animation-duration:12s;animation-direction:reverse} .sl-orbit-3 .sl-orb-item{animation-duration:10s}
  @keyframes sl-orb-counter { from{transform:translateX(-50%) rotate(0deg)} to{transform:translateX(-50%) rotate(-360deg)} }

  .sl-sparkle { position: absolute; color: #facc15; font-size: 18px; animation: sl-sparkle-anim 2s ease-in-out infinite; pointer-events: none; }
  .sl-sp-1{top:15%;left:10%;animation-delay:0s;font-size:14px} .sl-sp-2{top:70%;left:20%;animation-delay:.8s;font-size:20px;color:#a78bfa} .sl-sp-3{top:20%;left:78%;animation-delay:1.4s;font-size:12px} .sl-sp-4{top:75%;left:75%;animation-delay:.4s;font-size:22px;color:#fb923c}
  @keyframes sl-sparkle-anim { 0%,100%{opacity:.2;transform:scale(.8) rotate(0deg)} 50%{opacity:1;transform:scale(1.3) rotate(20deg)} }

  .sl-hero-text { text-align: center; color: white; position: relative; z-index: 2; }
  .sl-hero-h2 { font-size: clamp(36px,5vw,52px); font-weight: 900; line-height: 1.15; margin: 0 0 12px; letter-spacing: -1px; background: linear-gradient(135deg,#fff 0%,#fde68a 50%,#f9a8d4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .sl-hero-p { font-size: 16px; color: rgba(255,255,255,.75); margin: 0 0 24px; font-weight: 600; }
  .sl-badge-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .sl-badge { background: rgba(255,255,255,.12); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,.2); color: white; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 100px; }

  .sl-right { width: 440px; min-height: 100vh; background: #fafafa; display: flex; align-items: center; justify-content: center; padding: 40px 32px; position: relative; flex-shrink: 0; }
  .sl-right::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg,rgba(168,85,247,.05) 0%,rgba(249,115,22,.05) 100%); pointer-events: none; }

  .sl-card { width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 6px; animation: sl-rise .55s cubic-bezier(.16,1,.3,1) both; }
  @keyframes sl-rise { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }

  .sl-brand { display: flex; justify-content: center; margin-bottom: 6px; animation: sl-bounce-in .7s cubic-bezier(.34,1.56,.64,1) .2s both; }
  @keyframes sl-bounce-in { from{opacity:0;transform:scale(.4)} to{opacity:1;transform:scale(1)} }
  .sl-logo-img { height: 56px; max-width: 160px; object-fit: contain; }
  .sl-logo-default { width: 72px; height: 72px; border-radius: 20px; background: linear-gradient(135deg,#7c3aed,#ea580c); display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 8px 24px rgba(124,58,237,.4); }

  .sl-title { font-size: 26px; font-weight: 900; color: #1e1b4b; margin: 4px 0 2px; text-align: center; letter-spacing: -.5px; }
  .sl-subtitle { font-size: 14px; color: #64748b; text-align: center; margin: 0 0 18px; font-weight: 600; }

  .sl-error { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 2px solid #fecaca; border-radius: 14px; padding: 11px 14px; color: #dc2626; font-size: 13.5px; font-weight: 700; margin-bottom: 8px; animation: sl-shake .45s ease both; }
  @keyframes sl-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }

  .sl-form { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; }
  .sl-field { display: flex; flex-direction: column; gap: 7px; }
  .sl-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: .06em; }
  .sl-input-wrap { display: flex; align-items: center; height: 52px; padding: 0 16px; background: white; border: 2.5px solid #e2e8f0; border-radius: 16px; transition: border-color .2s, box-shadow .2s, background .2s; }
  .sl-input-wrap.sl-focused { border-color: #7c3aed; background: #faf5ff; box-shadow: 0 0 0 4px rgba(124,58,237,.12); }
  .sl-input { flex: 1; border: none; outline: none; background: transparent; font-size: 15px; color: #1e293b; font-family: inherit; font-weight: 600; }
  .sl-eye-btn { background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center; }
  .sl-eye-btn:hover { color: #7c3aed; }
  .sl-forgot { background: none; border: none; cursor: pointer; font-size: 13px; color: #7c3aed; font-weight: 700; font-family: inherit; padding: 0; }
  .sl-forgot:hover { color: #ea580c; }

  .sl-submit { width: 100%; height: 56px; background: linear-gradient(135deg,#7c3aed 0%,#c026d3 50%,#ea580c 100%); background-size: 200% 200%; color: white; border: none; border-radius: 18px; font-size: 17px; font-weight: 800; cursor: pointer; font-family: inherit; margin-top: 4px; box-shadow: 0 6px 22px rgba(124,58,237,.4); transition: transform .15s, box-shadow .15s; animation: sl-btn-gradient 4s ease infinite; }
  @keyframes sl-btn-gradient { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
  .sl-submit:hover:not(:disabled) { transform: translateY(-3px) scale(1.01); box-shadow: 0 12px 32px rgba(124,58,237,.5); }
  .sl-submit:active:not(:disabled) { transform: translateY(0) scale(.98); }
  .sl-submit:disabled { opacity: .7; cursor: not-allowed; }

  .sl-loading-row { display: flex; align-items: center; gap: 10px; justify-content: center; }
  .sl-spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,.35); border-top-color: white; border-radius: 50%; animation: sl-spin .7s linear infinite; }
  @keyframes sl-spin { to{transform:rotate(360deg)} }

  .sl-footer { text-align: center; font-size: 12px; color: #94a3b8; margin: 14px 0 6px; font-weight: 600; }
  .sl-dots { display: flex; justify-content: center; gap: 8px; margin-top: 4px; }
  .sl-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; animation: sl-dot-bounce 1.4s ease-in-out infinite; }
  .sl-dot:nth-child(1){animation-delay:0s} .sl-dot:nth-child(2){animation-delay:.15s} .sl-dot:nth-child(3){animation-delay:.3s} .sl-dot:nth-child(4){animation-delay:.45s}
  @keyframes sl-dot-bounce { 0%,80%,100%{transform:scale(1)} 40%{transform:scale(1.6)} }

  @media (max-width:900px) {
    .sl-root{flex-direction:column} .sl-left{min-height:auto;padding:40px 24px 32px}
    .sl-scene{width:260px;height:260px;transform:scale(.85)} .sl-right{width:100%;min-height:auto;padding:32px 24px 48px}
  }
  @media (max-width:480px) { .sl-scene{display:none} .sl-left{padding:28px 20px} .sl-hero-h2{font-size:30px} }
`;
