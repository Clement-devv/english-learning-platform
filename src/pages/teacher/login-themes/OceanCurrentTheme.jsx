// src/pages/teacher/login-themes/OceanCurrentTheme.jsx
import React from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useTeacherLoginLogic } from './useTeacherLoginLogic';

export default function OceanCurrentTheme() {
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
      <div className="oc-root">
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
        className="oc-root"
        style={branding.fontFamily ? { fontFamily: `'${branding.fontFamily}', 'Inter', sans-serif` } : {}}
      >
        {/* ── LEFT — Deep Ocean ── */}
        <div className="oc-left">

          {/* Animated wave surface at top */}
          <div className="oc-wave-surf oc-ws-1" />
          <div className="oc-wave-surf oc-ws-2" />
          <div className="oc-wave-surf oc-ws-3" />

          {/* Light rays piercing down from surface */}
          <div className="oc-ray oc-ray-0" />
          <div className="oc-ray oc-ray-1" />
          <div className="oc-ray oc-ray-2" />
          <div className="oc-ray oc-ray-3" />
          <div className="oc-ray oc-ray-4" />
          <div className="oc-ray oc-ray-5" />

          {/* Bubbles rising */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`oc-bubble oc-bub-${i % 5}`}
              style={{
                left: `${(i * 47 + 9) % 92}%`,
                bottom: `${(i * 29 + 5) % 55}%`,
                animationDelay: `${(i * 0.75) % 7}s`,
                animationDuration: `${4.5 + (i * 0.55) % 5}s`,
              }}
            />
          ))}

          {/* ── Teaching materials sailing through the current ── */}
          {/* Sailing left → right */}
          <div className="oc-item oc-sail-lr oc-sail-s1">📖</div>
          <div className="oc-item oc-sail-lr oc-sail-s3">🎓</div>
          <div className="oc-item oc-sail-lr oc-sail-s5">📏</div>
          {/* Sailing right → left */}
          <div className="oc-item oc-sail-rl oc-sail-s2">✏️</div>
          <div className="oc-item oc-sail-rl oc-sail-s4">📝</div>
          <div className="oc-item oc-sail-rl oc-sail-s6">🔤</div>
          {/* Gently drifting in place */}
          <div className="oc-item oc-drift oc-drift-a">🖊️</div>
          <div className="oc-item oc-drift oc-drift-b">📚</div>
          <div className="oc-item oc-drift oc-drift-c">🧲</div>

          {/* ── Jellyfish ── */}
          <div className="oc-jelly oc-jelly-a">
            <div className="oc-jbell oc-jbell-teal">
              <div className="oc-jshine" />
              <div className="oc-jinner" />
            </div>
            <div className="oc-jtentacles">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="oc-jt oc-jt-teal" style={{ animationDelay: `${i * 0.18}s`, height: `${26 + (i % 3) * 8}px` }} />
              ))}
            </div>
          </div>

          <div className="oc-jelly oc-jelly-b">
            <div className="oc-jbell oc-jbell-purple">
              <div className="oc-jshine" />
              <div className="oc-jinner oc-jinner-purple" />
            </div>
            <div className="oc-jtentacles">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="oc-jt oc-jt-purple" style={{ animationDelay: `${i * 0.22}s`, height: `${18 + (i % 3) * 6}px` }} />
              ))}
            </div>
          </div>

          <div className="oc-jelly oc-jelly-c">
            <div className="oc-jbell oc-jbell-gold">
              <div className="oc-jshine" />
            </div>
            <div className="oc-jtentacles">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="oc-jt oc-jt-gold" style={{ animationDelay: `${i * 0.2}s`, height: `${14 + (i % 3) * 5}px` }} />
              ))}
            </div>
          </div>

          {/* ── Fish ── */}
          <div className="oc-fish oc-fish-1">
            <div className="oc-fbody"><div className="oc-feye" /></div>
            <div className="oc-ftail" />
          </div>
          <div className="oc-fish oc-fish-2">
            <div className="oc-fbody oc-fbody-sm"><div className="oc-feye" /></div>
            <div className="oc-ftail oc-ftail-sm" />
          </div>
          <div className="oc-fish oc-fish-3">
            <div className="oc-fbody oc-fbody-sm"><div className="oc-feye" /></div>
            <div className="oc-ftail oc-ftail-sm" />
          </div>

          {/* ── Seaweed ── */}
          <div className="oc-seaweed oc-sw-1">
            {[...Array(6)].map((_, i) => <div key={i} className={`oc-seg oc-seg-${i % 2}`} style={{ animationDelay: `${i * 0.15}s` }} />)}
          </div>
          <div className="oc-seaweed oc-sw-2">
            {[...Array(5)].map((_, i) => <div key={i} className={`oc-seg oc-seg-${(i + 1) % 2}`} style={{ animationDelay: `${i * 0.2}s` }} />)}
          </div>
          <div className="oc-seaweed oc-sw-3">
            {[...Array(7)].map((_, i) => <div key={i} className={`oc-seg oc-seg-${i % 2}`} style={{ animationDelay: `${i * 0.12}s` }} />)}
          </div>

          {/* ── Coral ── */}
          <div className="oc-coral oc-coral-a">
            <div className="oc-cbranch oc-cb-1" />
            <div className="oc-cbranch oc-cb-2" />
            <div className="oc-cbranch oc-cb-3" />
          </div>
          <div className="oc-coral oc-coral-b">
            <div className="oc-cbranch oc-cb-1" />
            <div className="oc-cbranch oc-cb-2" />
          </div>

          {/* ── Ocean floor sand ripples ── */}
          <div className="oc-floor" />

          {/* ── Bioluminescent plankton particles ── */}
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className={`oc-plankton oc-pl-${i % 4}`}
              style={{
                left: `${(i * 41 + 13) % 94}%`,
                top:  `${(i * 59 + 7)  % 88}%`,
                animationDelay: `${(i * 0.38) % 4.5}s`,
              }}
            />
          ))}

          {/* ── Hero text ── */}
          <div className="oc-hero">
            <h2 className="oc-hero-h2">Explore.<br/>Teach.<br/>Inspire.</h2>
            <p className="oc-hero-p">Navigate the currents of knowledge.</p>
            <div className="oc-badge-row">
              <span className="oc-badge">🌊 Fluid Lessons</span>
              <span className="oc-badge">📊 Deep Analytics</span>
              <span className="oc-badge">🐋 Wide Reach</span>
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

            <p className="oc-portal-tag">{centerName} — TEACHER PORTAL</p>
            <h1 className="oc-title">Dive In, Professor</h1>
            <p className="oc-subtitle">Sign in to your classroom</p>

            {error && (
              <div className="oc-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} className="oc-form">
              <div className="oc-field">
                <label className="oc-label"><Mail size={13} /> Email address</label>
                <div className={`oc-input-wrap${focusedField === 'email' ? ' oc-focused' : ''}`}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="you@example.com"
                    required disabled={loading}
                    className="oc-input"
                  />
                </div>
              </div>

              <div className="oc-field">
                <div className="oc-label-row">
                  <label className="oc-label"><Lock size={13} /> Password</label>
                  <Link to="/teacher/forgot-password" className="oc-forgot">Forgot password?</Link>
                </div>
                <div className={`oc-input-wrap${focusedField === 'password' ? ' oc-focused' : ''}`}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="••••••••••"
                    required disabled={loading}
                    className="oc-input"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="oc-eye-btn" disabled={loading}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="oc-submit">
                {loading
                  ? <span className="oc-load-row"><span className="oc-spinner" />Signing in…</span>
                  : <span className="oc-btn-inner">Sign In <ArrowRight size={18} /></span>
                }
              </button>
            </form>

            <p className="oc-footer">
              Having trouble?{' '}
              <a href="mailto:support@yourdomain.com" className="oc-footer-link">Contact support</a>
            </p>

            {/* Decorative ocean wave */}
            <svg className="oc-wave-dec" viewBox="0 0 300 24" fill="none">
              <path d="M0,12 C50,2 100,22 150,12 C200,2 250,22 300,12" stroke="rgba(8,145,178,0.25)" strokeWidth="2.5" fill="none"/>
              <path d="M0,18 C60,8 120,26 180,16 C240,6 280,24 300,18" stroke="rgba(34,211,238,0.15)" strokeWidth="1.5" fill="none"/>
            </svg>
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
  .oc-root {
    min-height: 100vh;
    display: flex;
    font-family: 'Inter','Segoe UI',sans-serif;
    background: #010d1f;
    overflow: hidden;
  }

  /* ── LEFT PANEL — deep ocean ── */
  .oc-left {
    flex: 1;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    padding: 0 32px 48px;
    /* Surface bright → depths dark */
    background: linear-gradient(180deg,
      #0ea5e9 0%,
      #0369a1 6%,
      #075985 18%,
      #0c3d5e 40%,
      #062236 65%,
      #030f1e 100%
    );
  }

  /* ── WAVE SURFACE ── */
  .oc-wave-surf {
    position: absolute;
    top: 0; left: -8%; right: -8%;
    pointer-events: none;
    z-index: 8;
  }
  .oc-ws-1 {
    height: 70px;
    background: rgba(255,255,255,.18);
    animation: oc-wave-clip-1 5s ease-in-out infinite;
  }
  .oc-ws-2 {
    height: 56px;
    background: rgba(255,255,255,.1);
    animation: oc-wave-clip-2 7s ease-in-out infinite;
    animation-delay: -1.5s;
  }
  .oc-ws-3 {
    height: 42px;
    background: rgba(56,189,248,.12);
    animation: oc-wave-clip-1 9s ease-in-out infinite;
    animation-delay: -3s;
  }
  @keyframes oc-wave-clip-1 {
    0%,100% { clip-path: polygon(0 0,100% 0,100% 52%,92% 44%,80% 58%,68% 42%,56% 56%,44% 42%,32% 58%,20% 44%,8% 56%,0 46%); }
    50%     { clip-path: polygon(0 0,100% 0,100% 44%,92% 56%,80% 44%,68% 58%,56% 44%,44% 56%,32% 44%,20% 58%,8% 44%,0 54%); }
  }
  @keyframes oc-wave-clip-2 {
    0%,100% { clip-path: polygon(0 0,100% 0,100% 55%,88% 46%,76% 60%,62% 45%,48% 60%,34% 46%,22% 60%,10% 46%,0 54%); }
    50%     { clip-path: polygon(0 0,100% 0,100% 46%,88% 58%,76% 45%,62% 58%,48% 45%,34% 58%,22% 45%,10% 58%,0 48%); }
  }

  /* ── LIGHT RAYS ── */
  .oc-ray {
    position: absolute;
    top: 0;
    width: 80px;
    height: 85%;
    background: linear-gradient(180deg,
      rgba(56,189,248,.28) 0%,
      rgba(34,211,238,.12) 50%,
      transparent 100%
    );
    filter: blur(14px);
    transform-origin: top center;
    pointer-events: none;
    z-index: 2;
  }
  .oc-ray-0 { left: 4%;  transform: rotate(-18deg); animation: oc-ray 7s ease-in-out infinite; animation-delay:0s; }
  .oc-ray-1 { left: 16%; transform: rotate(-9deg);  animation: oc-ray 9s ease-in-out infinite; animation-delay:1.2s; width:55px; }
  .oc-ray-2 { left: 30%; transform: rotate(0deg);   animation: oc-ray 6s ease-in-out infinite; animation-delay:2.5s; }
  .oc-ray-3 { left: 50%; transform: rotate(-6deg);  animation: oc-ray 8s ease-in-out infinite; animation-delay:0.8s; width:60px; }
  .oc-ray-4 { left: 66%; transform: rotate(11deg);  animation: oc-ray 10s ease-in-out infinite;animation-delay:3.5s; }
  .oc-ray-5 { left: 82%; transform: rotate(20deg);  animation: oc-ray 7.5s ease-in-out infinite;animation-delay:1.8s; width:50px; }
  @keyframes oc-ray {
    0%,100% { opacity:.55; }
    50%     { opacity:1; }
  }

  /* ── BUBBLES ── */
  .oc-bubble {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    z-index: 3;
    animation: oc-rise linear infinite;
  }
  .oc-bub-0 { width:7px;  height:7px;  border:1.5px solid rgba(34,211,238,.55); background:rgba(34,211,238,.06); }
  .oc-bub-1 { width:13px; height:13px; border:1.5px solid rgba(34,211,238,.4);  background:rgba(34,211,238,.04); }
  .oc-bub-2 { width:5px;  height:5px;  border:1px   solid rgba(165,243,252,.5); background:rgba(165,243,252,.06); }
  .oc-bub-3 { width:18px; height:18px; border:1.5px solid rgba(56,189,248,.35); background:rgba(56,189,248,.03); }
  .oc-bub-4 { width:9px;  height:9px;  border:1.5px solid rgba(192,132,252,.4); background:rgba(192,132,252,.04); }
  @keyframes oc-rise {
    0%   { transform: translateY(0)    translateX(0);   opacity:0; }
    8%   { opacity:.85; }
    85%  { opacity:.6; }
    100% { transform: translateY(-88vh) translateX(18px); opacity:0; }
  }

  /* ── TEACHING ITEMS ── */
  .oc-item {
    position: absolute;
    font-size: 30px;
    filter: drop-shadow(0 6px 18px rgba(0,0,0,.55));
    pointer-events: none;
    user-select: none;
    z-index: 4;
  }
  /* Sail left → right */
  .oc-sail-lr { animation: oc-lr linear infinite; }
  .oc-sail-s1 { top:24%; font-size:36px; animation-duration:24s; animation-delay:-2s; }
  .oc-sail-s3 { top:52%; font-size:30px; animation-duration:28s; animation-delay:-10s; }
  .oc-sail-s5 { top:68%; font-size:26px; animation-duration:20s; animation-delay:-5s; }
  @keyframes oc-lr {
    0%   { transform: translateX(-90px) translateY(0)    rotate(-10deg); opacity:0; }
    6%   { opacity:1; }
    50%  { transform: translateX(38vw)  translateY(-30px) rotate(8deg);  opacity:.9; }
    94%  { opacity:1; }
    100% { transform: translateX(90vw)  translateY(10px)  rotate(-5deg); opacity:0; }
  }
  /* Sail right → left */
  .oc-sail-rl { animation: oc-rl linear infinite; }
  .oc-sail-s2 { top:16%; font-size:28px; animation-duration:21s; animation-delay:-7s; }
  .oc-sail-s4 { top:38%; font-size:26px; animation-duration:25s; animation-delay:-14s; }
  .oc-sail-s6 { top:60%; font-size:24px; animation-duration:18s; animation-delay:-3s; }
  @keyframes oc-rl {
    0%   { transform: translateX(90px)  translateY(0)    rotate(12deg);  opacity:0; }
    6%   { opacity:1; }
    50%  { transform: translateX(-38vw) translateY(-25px) rotate(-9deg); opacity:.9; }
    94%  { opacity:1; }
    100% { transform: translateX(-90vw) translateY(8px)   rotate(6deg);  opacity:0; }
  }
  /* Gentle drift in place */
  .oc-drift { animation: oc-drift-anim ease-in-out infinite; }
  .oc-drift-a { top:30%; left:22%; font-size:22px; animation-duration:10s; animation-delay:-1s; }
  .oc-drift-b { top:48%; left:60%; font-size:28px; animation-duration:13s; animation-delay:-5s; }
  .oc-drift-c { top:72%; left:38%; font-size:20px; animation-duration:8s;  animation-delay:-3s; }
  @keyframes oc-drift-anim {
    0%,100% { transform: translateY(0)    rotate(0deg); }
    25%     { transform: translateY(-18px) rotate(12deg); }
    75%     { transform: translateY(14px)  rotate(-10deg); }
  }

  /* ── JELLYFISH ── */
  .oc-jelly {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 5;
  }
  .oc-jelly-a {
    top: 18%; right: 10%;
    animation: oc-jfloat 5.5s ease-in-out infinite;
  }
  .oc-jelly-b {
    top: 48%; left: 6%;
    animation: oc-jfloat 7s ease-in-out infinite;
    animation-delay: -2.5s;
  }
  .oc-jelly-c {
    top: 30%; left: 35%;
    animation: oc-jfloat 6s ease-in-out infinite;
    animation-delay: -4s;
  }
  @keyframes oc-jfloat {
    0%,100% { transform: translateY(0)    scaleX(1); }
    50%     { transform: translateY(-24px) scaleX(1.05); }
  }

  .oc-jbell {
    position: relative;
    border-radius: 50% 50% 35% 35%;
    overflow: hidden;
  }
  .oc-jbell-teal {
    width: 62px; height: 44px;
    background: radial-gradient(ellipse at 38% 38%,
      rgba(34,211,238,.75) 0%,
      rgba(8,145,178,.4)   50%,
      rgba(6,182,212,.08)  100%
    );
    border: 1.5px solid rgba(34,211,238,.7);
    box-shadow:
      0 0 28px rgba(34,211,238,.5),
      0 0 70px rgba(34,211,238,.2),
      inset 0 0 22px rgba(34,211,238,.12);
  }
  .oc-jbell-purple {
    width: 40px; height: 28px;
    background: radial-gradient(ellipse at 38% 38%,
      rgba(192,132,252,.7) 0%,
      rgba(139,92,246,.4)  50%,
      rgba(109,40,217,.06) 100%
    );
    border: 1.5px solid rgba(192,132,252,.65);
    box-shadow:
      0 0 20px rgba(192,132,252,.5),
      0 0 50px rgba(139,92,246,.2),
      inset 0 0 15px rgba(192,132,252,.1);
  }
  .oc-jbell-gold {
    width: 28px; height: 20px;
    background: radial-gradient(ellipse at 38% 38%,
      rgba(251,191,36,.7)  0%,
      rgba(245,158,11,.4)  50%,
      rgba(217,119,6,.06)  100%
    );
    border: 1.5px solid rgba(251,191,36,.6);
    box-shadow:
      0 0 16px rgba(251,191,36,.5),
      0 0 40px rgba(251,191,36,.15),
      inset 0 0 12px rgba(251,191,36,.1);
  }
  .oc-jshine {
    position: absolute;
    top: 20%; left: 18%;
    width: 32%; height: 28%;
    background: rgba(255,255,255,.4);
    border-radius: 50%;
    transform: rotate(-35deg);
  }
  .oc-jinner {
    position: absolute;
    bottom: 10%; left: 50%;
    transform: translateX(-50%);
    width: 50%; height: 30%;
    background: rgba(34,211,238,.2);
    border-radius: 50%;
    filter: blur(3px);
  }
  .oc-jinner-purple {
    background: rgba(192,132,252,.2);
  }
  .oc-jtentacles {
    display: flex;
    gap: 3px;
    padding-top: 1px;
  }
  .oc-jt {
    width: 1.5px;
    border-radius: 1px;
    animation: oc-tentacle 2.8s ease-in-out infinite;
  }
  .oc-jt-teal   { background: linear-gradient(to bottom, rgba(34,211,238,.7), transparent); }
  .oc-jt-purple { background: linear-gradient(to bottom, rgba(192,132,252,.7), transparent); }
  .oc-jt-gold   { background: linear-gradient(to bottom, rgba(251,191,36,.7),  transparent); }
  @keyframes oc-tentacle {
    0%,100% { transform: translateX(0)   skewX(0); }
    30%     { transform: translateX(3px)  skewX(10deg); }
    70%     { transform: translateX(-3px) skewX(-10deg); }
  }

  /* ── FISH ── */
  .oc-fish {
    position: absolute;
    display: flex;
    align-items: center;
    z-index: 4;
    animation: oc-fish-swim linear infinite;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,.4));
  }
  .oc-fish-1 { top:55%; animation-duration:20s; animation-delay:-3s; }
  .oc-fish-2 { top:45%; animation-duration:15s; animation-delay:-8s; transform:scale(.7) scaleX(-1); }
  .oc-fish-3 { top:63%; animation-duration:24s; animation-delay:-16s; transform:scale(.5); }
  @keyframes oc-fish-swim {
    from { transform: translateX(-100px); opacity:0; }
    5%   { opacity:1; }
    95%  { opacity:1; }
    to   { transform: translateX(calc(100vw + 100px)); opacity:0; }
  }
  .oc-fish-2, .oc-fish-3 {
    animation-name: oc-fish-swim-r;
  }
  @keyframes oc-fish-swim-r {
    from { transform: translateX(calc(100vw + 100px)) scaleX(-1); opacity:0; }
    5%   { opacity:1; }
    95%  { opacity:1; }
    to   { transform: translateX(-100px) scaleX(-1); opacity:0; }
  }
  .oc-fbody {
    width: 40px; height: 18px;
    background: linear-gradient(100deg, #0e7490, #22d3ee 60%, #7dd3fc);
    border-radius: 50% 50% 50% 50% / 65% 65% 35% 35%;
    position: relative;
  }
  .oc-fbody-sm { width: 28px; height: 12px; }
  .oc-feye {
    position: absolute;
    top: 4px; right: 9px;
    width: 5px; height: 5px;
    background: #0f172a;
    border-radius: 50%;
    box-shadow: 1px 0 0 1px rgba(255,255,255,.5);
  }
  .oc-ftail {
    width: 0; height: 0;
    border-top: 10px solid transparent;
    border-bottom: 10px solid transparent;
    border-right: 14px solid #0e7490;
    margin-right: -2px;
  }
  .oc-ftail-sm {
    border-top-width: 7px;
    border-bottom-width: 7px;
    border-right-width: 10px;
  }

  /* ── SEAWEED ── */
  .oc-seaweed {
    position: absolute;
    bottom: 0;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
    transform-origin: bottom center;
    animation: oc-sway-plant 4.5s ease-in-out infinite;
    z-index: 3;
  }
  .oc-sw-1 { left: 7%;  animation-delay: 0s;    }
  .oc-sw-2 { left: 20%; animation-delay: 0.9s;  }
  .oc-sw-3 { right: 9%; animation-delay: 1.7s;  }
  @keyframes oc-sway-plant {
    0%,100% { transform: rotate(0deg); }
    30%     { transform: rotate(7deg); }
    70%     { transform: rotate(-9deg); }
  }
  .oc-seg {
    animation: oc-seg-pulse 4.5s ease-in-out infinite;
  }
  .oc-seg-0 {
    width: 16px; height: 24px;
    background: linear-gradient(135deg, #065f46, #047857);
    border-radius: 50% 0 50% 0;
    margin-bottom: -7px;
    box-shadow: 0 0 8px rgba(4,120,87,.35);
  }
  .oc-seg-1 {
    width: 14px; height: 20px;
    background: linear-gradient(135deg, #047857, #059669);
    border-radius: 0 50% 0 50%;
    margin-bottom: -6px;
    box-shadow: 0 0 6px rgba(5,150,105,.3);
  }
  @keyframes oc-seg-pulse {
    0%,100% { transform: scaleX(1); }
    50%     { transform: scaleX(1.2); }
  }

  /* ── CORAL ── */
  .oc-coral {
    position: absolute;
    bottom: 0;
    z-index: 3;
  }
  .oc-coral-a { left: 28%; }
  .oc-coral-b { right: 20%; }
  .oc-cbranch {
    position: absolute;
    bottom: 0;
    border-radius: 4px 4px 0 0;
    animation: oc-coral-sway 3.5s ease-in-out infinite;
    transform-origin: bottom center;
  }
  .oc-cb-1 {
    width: 7px; height: 38px;
    background: linear-gradient(to top, #be123c, #f43f5e);
    left: 0;
    box-shadow: 0 0 10px rgba(244,63,94,.4);
    animation-delay: 0s;
  }
  .oc-cb-2 {
    width: 5px; height: 28px;
    background: linear-gradient(to top, #9f1239, #e11d48);
    left: 10px;
    box-shadow: 0 0 8px rgba(225,29,72,.35);
    animation-delay: .4s;
  }
  .oc-cb-3 {
    width: 6px; height: 22px;
    background: linear-gradient(to top, #c2410c, #fb923c);
    left: -8px;
    box-shadow: 0 0 8px rgba(251,146,60,.3);
    animation-delay: .8s;
  }
  @keyframes oc-coral-sway {
    0%,100% { transform: rotate(0deg); }
    40%     { transform: rotate(5deg); }
    80%     { transform: rotate(-6deg); }
  }

  /* ── OCEAN FLOOR ── */
  .oc-floor {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 28px;
    background: linear-gradient(180deg, transparent, rgba(8,28,54,.9));
    z-index: 2;
  }
  .oc-floor::before {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 10px;
    background: #040f1f;
  }

  /* ── BIOLUMINESCENT PLANKTON ── */
  .oc-plankton {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
    z-index: 3;
    animation: oc-glow ease-in-out infinite;
  }
  .oc-pl-0 { width:4px;  height:4px;  background:rgba(34,211,238,.9); }
  .oc-pl-1 { width:3px;  height:3px;  background:rgba(165,243,252,.8); }
  .oc-pl-2 { width:5px;  height:5px;  background:rgba(192,132,252,.7); }
  .oc-pl-3 { width:3px;  height:3px;  background:rgba(251,191,36,.8); }
  @keyframes oc-glow {
    0%,100% { opacity:0;   transform:scale(.5); box-shadow:none; }
    50%     { opacity:1;   transform:scale(1.6); }
    45%,55% { box-shadow: 0 0 10px 3px currentColor; }
  }

  /* ── HERO TEXT ── */
  .oc-hero {
    position: relative;
    z-index: 6;
    text-align: center;
    color: white;
    padding-bottom: 12px;
  }
  .oc-hero-h2 {
    font-size: clamp(34px,4.5vw,50px);
    font-weight: 900;
    line-height: 1.12;
    margin: 0 0 12px;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #fff 0%, #bae6fd 45%, #a5b4fc 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .oc-hero-p { font-size:15px; color:rgba(255,255,255,.7); margin:0 0 22px; font-weight:500; }
  .oc-badge-row { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
  .oc-badge {
    background: rgba(34,211,238,.12);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(34,211,238,.25);
    color: rgba(255,255,255,.9);
    font-size: 12px; font-weight:700;
    padding: 6px 14px;
    border-radius: 100px;
  }

  /* ── RIGHT PANEL ── */
  .oc-right {
    width: 440px;
    min-height: 100vh;
    background: #f0f9ff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 32px;
    position: relative;
    flex-shrink: 0;
  }
  .oc-right::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg,rgba(14,116,144,.07) 0%,rgba(7,89,133,.03) 100%);
    pointer-events: none;
  }

  /* ── CARD ── */
  .oc-card {
    width: 100%; max-width: 360px;
    display: flex; flex-direction: column; gap: 5px;
    animation: oc-card-in .55s cubic-bezier(.16,1,.3,1) both;
  }
  @keyframes oc-card-in {
    from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)}
  }

  .oc-brand { display:flex; justify-content:center; margin-bottom:10px; }
  .oc-logo-img { height:52px; max-width:160px; object-fit:contain; }
  .oc-logo-default {
    width:70px; height:70px; border-radius:20px;
    background: linear-gradient(135deg,#0891b2,#0369a1);
    display:flex; align-items:center; justify-content:center; font-size:34px;
    box-shadow:0 8px 24px rgba(8,145,178,.45);
    animation: oc-logo-in .7s cubic-bezier(.34,1.56,.64,1) .2s both;
  }
  @keyframes oc-logo-in { from{opacity:0;transform:scale(.4)} to{opacity:1;transform:scale(1)} }

  .oc-portal-tag { font-size:10px; font-weight:800; letter-spacing:.16em; color:#0891b2; text-transform:uppercase; text-align:center; margin:0 0 6px; }
  .oc-title { font-size:26px; font-weight:900; color:#0c4a6e; text-align:center; margin:2px 0; letter-spacing:-.5px; }
  .oc-subtitle { font-size:13.5px; color:#64748b; text-align:center; margin:0 0 18px; font-weight:500; }

  /* ERROR */
  .oc-error {
    display:flex; align-items:center; gap:10px;
    background:#fef2f2; border:2px solid #fecaca;
    border-radius:12px; padding:11px 14px;
    color:#dc2626; font-size:13px; font-weight:700;
    margin-bottom:10px;
    animation: oc-shake .45s ease both;
  }
  @keyframes oc-shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-7px)} 40%{transform:translateX(7px)}
    60%{transform:translateX(-4px)} 80%{transform:translateX(4px)}
  }

  /* FORM */
  .oc-form { display:flex; flex-direction:column; gap:16px; margin-top:2px; }
  .oc-field { display:flex; flex-direction:column; gap:6px; }
  .oc-label-row { display:flex; justify-content:space-between; align-items:center; }
  .oc-label { display:flex; align-items:center; gap:5px; font-size:11.5px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:.07em; }
  .oc-input-wrap {
    display:flex; align-items:center;
    height:52px; padding:0 16px;
    background:white;
    border:2px solid #e0f2fe;
    border-radius:14px;
    transition:border-color .2s, box-shadow .2s, background .2s;
  }
  .oc-input-wrap.oc-focused { border-color:#0891b2; background:#ecfeff; box-shadow:0 0 0 4px rgba(8,145,178,.12); }
  .oc-input { flex:1; border:none; outline:none; background:transparent; font-size:15px; color:#0c4a6e; font-family:inherit; font-weight:600; }
  .oc-eye-btn { background:none; border:none; cursor:pointer; color:#94a3b8; padding:0; display:flex; align-items:center; }
  .oc-eye-btn:hover { color:#0891b2; }
  .oc-forgot { font-size:12.5px; color:#0891b2; font-weight:700; font-family:inherit; text-decoration:none; }
  .oc-forgot:hover { color:#0369a1; }

  /* SUBMIT */
  .oc-submit {
    width:100%; height:54px;
    background: linear-gradient(135deg,#0369a1 0%,#0891b2 45%,#06b6d4 100%);
    background-size:200% 200%;
    color:white; border:none; border-radius:16px;
    font-size:16px; font-weight:800; cursor:pointer; font-family:inherit;
    margin-top:4px;
    box-shadow: 0 6px 22px rgba(8,145,178,.45);
    transition:transform .15s, box-shadow .15s;
    animation: oc-btn-wave 4s ease infinite;
  }
  @keyframes oc-btn-wave {
    0%,100%{background-position:0% 50%} 50%{background-position:100% 50%}
  }
  .oc-submit:hover:not(:disabled) { transform:translateY(-3px) scale(1.01); box-shadow:0 12px 32px rgba(8,145,178,.55); }
  .oc-submit:active:not(:disabled) { transform:translateY(0) scale(.98); }
  .oc-submit:disabled { opacity:.7; cursor:not-allowed; }

  .oc-load-row { display:flex; align-items:center; gap:10px; justify-content:center; }
  .oc-btn-inner { display:flex; align-items:center; justify-content:center; gap:8px; }
  .oc-spinner { display:inline-block; width:20px; height:20px; border:3px solid rgba(255,255,255,.3); border-top-color:white; border-radius:50%; animation:oc-spin .7s linear infinite; }
  @keyframes oc-spin { to{transform:rotate(360deg)} }

  .oc-footer { text-align:center; font-size:12px; color:#94a3b8; margin:14px 0 6px; font-weight:500; }
  .oc-footer-link { color:#0891b2; text-decoration:none; font-weight:700; }
  .oc-footer-link:hover { color:#0369a1; }

  .oc-wave-dec { display:block; width:180px; margin:6px auto 0; }

  /* ── RESPONSIVE ── */
  @media (max-width:900px) {
    .oc-root{flex-direction:column}
    .oc-left{min-height:55vh;padding:0 24px 32px}
    .oc-right{width:100%;min-height:auto;padding:28px 24px 48px}
  }
  @media (max-width:480px) {
    .oc-hero-h2{font-size:28px}
    .oc-left{padding:0 16px 24px}
  }
`;
