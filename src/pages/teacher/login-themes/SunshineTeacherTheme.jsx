// src/pages/teacher/login-themes/SunshineTeacherTheme.jsx
// Sunshine teacher login — matches the teacher Sunshine dashboard: warm colour glows,
// a rounded glass frame with the gradient border, the sunrise rings from the
// dashboard banner, and a few floating glass "classroom" cards. Grown-up sibling of
// the student Sunshine login (no stickers). Default teacher login slot.
//
// Motion: one entrance on load (panes rise 8px + fade, card children and the floating
// cards stagger 40–60ms). Button press scales to 0.97; hover only on mouse devices.
// No looping animation. prefers-reduced-motion (global rule in index.css) stops all.
import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, ArrowRight, Video, CheckCircle2, Star, CalendarDays } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useTeacherLoginLogic } from './useTeacherLoginLogic';
import { adminAccent, adminOnAccent } from '../../../utils/adminAccent';

const GLOWS = [
  { l: '-8%',  t: '-14%', s: 520, c: 'color-mix(in srgb, var(--a-pink) 50%, transparent)' },
  { l: '12%',  t: '58%',  s: 460, c: 'rgba(45,212,191,0.32)' },
  { l: '38%',  t: '-22%', s: 620, c: 'color-mix(in srgb, var(--a-accent) 45%, transparent)' },
  { l: '74%',  t: '4%',   s: 500, c: 'rgba(251,191,36,0.45)' },
  { l: '60%',  t: '64%',  s: 520, c: 'rgba(56,189,248,0.30)' },
  { l: '88%',  t: '74%',  s: 420, c: 'color-mix(in srgb, var(--a-pink) 42%, transparent)' },
];

export default function SunshineTeacherTheme() {
  const {
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    handleInitialLogin, handle2FAVerification, handleCancel2FA,
  } = useTeacherLoginLogic();

  const { branding, center } = useBranding();
  const centerName = center?.centerName || 'English Learning Platform';
  const accent = adminAccent(branding);
  const rootStyle = {
    '--a-accent': accent,
    '--a-on-accent': adminOnAccent(accent),
    // 'Inter' is the untouched default (never downloaded) — only a font the center picked overrides Nunito
    ...(branding.fontFamily && branding.fontFamily !== 'Inter' ? { fontFamily: `'${branding.fontFamily}', 'Nunito', sans-serif` } : null),
  };

  const backdrop = (
    <div className="tx-glows" aria-hidden="true">
      {GLOWS.map((g, i) => (
        <div key={i} style={{ left: g.l, top: g.t, width: g.s, height: g.s, background: `radial-gradient(circle, ${g.c} 0%, transparent 68%)` }} />
      ))}
    </div>
  );

  if (requires2FA) {
    return (
      <div className="as-root as-glass tx-root" data-theme="light" style={rootStyle}>
        <style>{css}</style>
        {backdrop}
        <div className="tx-frame as-glass-ring">
          <div className="tx-2fa">
            <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="as-root as-glass tx-root" data-theme="light" style={rootStyle}>
      <style>{css}</style>
      {backdrop}

      <div className="tx-frame as-glass-ring">
        <main className="tx-wrap">
          {/* ── Welcome pane (desktop) — decorative ── */}
          <section className="tx-hero" aria-hidden="true" style={{ background: 'var(--as-glass-card)' }}>
            {/* sunrise: warm core + gradient rings, as on the dashboard banner */}
            <div className="tx-sun" />
            <svg className="tx-rings" width="460" height="460" viewBox="0 0 460 460">
              <defs>
                <linearGradient id="tx-ring" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="55%" stopColor="var(--a-accent)" />
                  <stop offset="100%" stopColor="var(--a-pink)" />
                </linearGradient>
              </defs>
              {[70, 120, 170, 220].map((r, i) => (
                <circle key={r} cx="230" cy="230" r={r} fill="none" stroke="url(#tx-ring)" strokeWidth="1.6" strokeOpacity={0.7 - i * 0.14} />
              ))}
              <circle cx="230" cy="110" r="4" fill="#f97316" />
              <circle cx="392" cy="260" r="3" fill="var(--a-pink)" />
              <circle cx="120" cy="320" r="3.5" fill="#f59e0b" />
            </svg>

            <div className="tx-hero-copy">
              <p className="tx-eyebrow">{centerName} · Teacher portal</p>
              <h2 className="tx-hero-title">Teach.<br />Inspire.<br /><span className="tx-grad">Transform.</span></h2>
              <p className="tx-hero-sub">Shape the future, one lesson at a time.</p>
            </div>

            {/* floating glass cards — a glimpse of the teacher's day (staggered 2×2 cluster) */}
            <div className="tx-floats">
            <div className="tx-float tx-f1">
              <span className="tx-f-icon cat-teal"><Video size={16} strokeWidth={2.2} /></span>
              <span><b>Live class</b><small>Starts in 10 min</small></span>
              <span className="tx-live" />
            </div>
            <div className="tx-float tx-f2">
              <span className="tx-f-icon cat-green"><CheckCircle2 size={16} strokeWidth={2.2} /></span>
              <span><b>Homework graded</b><small>All caught up</small></span>
            </div>
            <div className="tx-float tx-f3">
              <span className="tx-f-icon cat-amber"><Star size={16} strokeWidth={2.2} /></span>
              <span><b>New 5★ review</b><small>“Great lesson today!”</small></span>
            </div>
            <div className="tx-float tx-f4">
              <span className="tx-f-icon cat-sky"><CalendarDays size={16} strokeWidth={2.2} /></span>
              <span><b>Schedule</b><small>3 classes today</small></span>
            </div>
            </div>
          </section>

          {/* ── Sign-in card ── */}
          <section className="tx-card as-glass-ring" style={{ background: 'var(--as-glass-card)' }}>
            <div className="tx-stagger">
              <div className="tx-brand">
                {branding.logo
                  ? <img src={branding.logo} alt="" className="tx-logo-img" />
                  : <div className="tx-logo">{(centerName[0] || 'T').toUpperCase()}</div>}
              </div>

              <p className="tx-tag">Teacher portal</p>
              <h1 className="tx-title">Welcome back</h1>
              <p className="tx-sub">Sign in to your classroom</p>

              {error && (
                <div className="tx-error" role="alert" id="tx-error">
                  <AlertCircle size={17} strokeWidth={2.2} aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleInitialLogin} className="tx-form">
                <div className="tx-field">
                  <label htmlFor="tx-email" className="tx-label">Email address</label>
                  <input id="tx-email" className="tx-input" type="email" inputMode="email" autoComplete="email"
                    autoCapitalize="none" spellCheck={false}
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required disabled={loading}
                    aria-invalid={error ? true : undefined} aria-describedby={error ? 'tx-error' : undefined} />
                </div>

                <div className="tx-field">
                  <div className="tx-label-row">
                    <label htmlFor="tx-password" className="tx-label">Password</label>
                    <Link to="/teacher/forgot-password" className="tx-link">Forgot password?</Link>
                  </div>
                  <div className="tx-pw">
                    <input id="tx-password" className="tx-input" type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password} onChange={e => setPassword(e.target.value)}
                      required disabled={loading}
                      aria-invalid={error ? true : undefined} aria-describedby={error ? 'tx-error' : undefined} />
                    <button type="button" className="tx-eye" onClick={() => setShowPassword(v => !v)} disabled={loading}
                      aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="tx-submit" disabled={loading} aria-busy={loading || undefined}>
                  {/* both labels always rendered → the button never changes size */}
                  <span className={`tx-btn-label${loading ? ' is-hidden' : ''}`}>
                    Sign in <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <span className={`tx-btn-label${loading ? '' : ' is-hidden'}`} aria-hidden={!loading}>
                    <span className="tx-spinner" aria-hidden="true" /> Signing in…
                  </span>
                </button>
              </form>

              <p className="tx-foot">Your account is managed by {centerName}.</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

const css = `
  .tx-root { --tx-ease: cubic-bezier(0.23, 1, 0.32, 1);
    position: relative; min-height: 100vh; min-height: 100dvh; overflow-x: hidden; background: var(--a-bg);
    font-family: 'Nunito', system-ui, sans-serif; color: var(--a-ink); display: flex; padding: 14px; }
  .tx-root *, .tx-root *::before, .tx-root *::after { box-sizing: border-box; }
  .tx-glows { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .tx-glows > div { position: absolute; border-radius: 50%; }

  /* rounded glass frame around the page; gradient ring from .as-glass-ring (index.css) */
  .tx-frame { position: relative; flex: 1; min-height: calc(100dvh - 28px); border-radius: 32px; padding: 32px 24px;
    display: flex; align-items: center; justify-content: center;
    background: var(--as-glass-frame); box-shadow: inset 0 1px 0 var(--as-glass-edge), 0 24px 48px -24px var(--as-glass-glow); }
  .tx-wrap { position: relative; width: 100%; max-width: 1060px; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 20px; align-items: stretch; }
  .tx-2fa  { position: relative; width: 100%; max-width: 440px; }

  .tx-hero, .tx-card { position: relative; border-radius: 28px; border: 1px solid var(--as-glass-edge); }

  /* ── welcome pane ── */
  .tx-hero { min-height: 560px; padding: 48px 44px 40px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 32px;
    animation: tx-rise 520ms var(--tx-ease) both; }
  .tx-sun { position: absolute; right: -120px; top: -120px; width: 420px; height: 420px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(255,214,102,0.75) 0%, rgba(249,115,22,0.42) 32%, color-mix(in srgb, var(--a-pink) 22%, transparent) 55%, transparent 72%); }
  .tx-rings { position: absolute; right: -150px; top: -150px; pointer-events: none; filter: drop-shadow(0 0 6px rgba(249,115,22,0.35)); }
  .tx-hero-copy { position: relative; max-width: 380px; }
  .tx-eyebrow { margin: 0 0 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-accent-ink); }
  .tx-hero-title { margin: 0 0 14px; font-size: clamp(40px, 4.6vw, 56px); line-height: 1.04; font-weight: 900; letter-spacing: -0.03em; color: var(--a-ink); }
  .tx-grad { background: linear-gradient(120deg, var(--a-accent), var(--a-pink) 60%, #f59e0b); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tx-hero-sub { margin: 0; font-size: 17px; font-weight: 600; color: var(--a-ink-2); }

  .tx-floats { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; max-width: 460px; }
  .tx-float { position: relative; display: flex; min-width: 0; align-items: center; gap: 10px; padding: 10px 14px 10px 10px; border-radius: 16px;
    background: color-mix(in srgb, var(--a-surface) 70%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
    box-shadow: inset 0 0 0 1px var(--as-glass-edge), 0 14px 30px -16px rgba(90,45,15,0.35);
    animation: tx-rise 480ms var(--tx-ease) both; }
  .tx-float b { display: block; font-size: 13px; font-weight: 800; color: var(--a-ink); line-height: 1.2; }
  .tx-float small { display: block; font-size: 12px; font-weight: 600; color: var(--a-muted); }
  .tx-f-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    background: var(--cat); color: #fff; box-shadow: 0 6px 12px -6px var(--cat); }
  .tx-live { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,0.18); margin-left: 4px; }
  .tx-float > span:nth-child(2) { min-width: 0; }
  .tx-float small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* offset the right column so the cluster looks scattered, not tabular */
  .tx-f2, .tx-f4 { margin-top: 22px; margin-bottom: -22px; }
  .tx-f1 { animation-delay: 260ms; } .tx-f2 { animation-delay: 320ms; }
  .tx-f3 { animation-delay: 380ms; } .tx-f4 { animation-delay: 440ms; }

  /* ── sign-in card ── */
  .tx-card { padding: 40px 36px 30px; display: flex; flex-direction: column; justify-content: center;
    animation: tx-rise 520ms var(--tx-ease) 60ms both; }
  .tx-stagger > * { animation: tx-rise 420ms var(--tx-ease) both; }
  .tx-stagger > *:nth-child(1) { animation-delay: 140ms; }
  .tx-stagger > *:nth-child(2) { animation-delay: 170ms; }
  .tx-stagger > *:nth-child(3) { animation-delay: 200ms; }
  .tx-stagger > *:nth-child(4) { animation-delay: 230ms; }
  .tx-stagger > *:nth-child(5) { animation-delay: 270ms; }
  .tx-stagger > *:nth-child(6) { animation-delay: 310ms; }
  .tx-stagger > *:nth-child(7) { animation-delay: 350ms; }
  @keyframes tx-rise { from { opacity: 0; transform: translateY(8px); } }

  .tx-brand { display: flex; justify-content: center; margin-bottom: 14px; }
  .tx-logo { width: 60px; height: 60px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
    background: var(--a-accent-grad); color: var(--a-on-accent); font-size: 26px; font-weight: 900;
    box-shadow: 0 12px 26px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.3); }
  .tx-logo-img { height: 56px; max-width: 180px; object-fit: contain; }
  .tx-tag { margin: 0 0 4px; text-align: center; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-accent-ink); }
  .tx-title { margin: 0; text-align: center; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; color: var(--a-ink); }
  .tx-sub { margin: 6px 0 22px; text-align: center; font-size: 15px; font-weight: 600; color: var(--a-muted); }

  .tx-error { display: flex; align-items: flex-start; gap: 10px; margin: 0 0 16px; padding: 11px 14px; border-radius: 14px;
    background: #fef2f2; color: #b91c1c; box-shadow: inset 0 0 0 1px #fecaca; font-size: 14px; font-weight: 700; line-height: 1.4;
    animation: tx-rise 200ms var(--tx-ease) both; }
  .tx-error svg { flex-shrink: 0; margin-top: 1px; }

  .tx-form { display: flex; flex-direction: column; gap: 16px; }
  .tx-field { display: flex; flex-direction: column; gap: 7px; }
  .tx-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .tx-label { font-size: 14px; font-weight: 800; color: var(--a-ink-2); }
  .tx-input { width: 100%; height: 50px; padding: 0 16px; border-radius: 14px; border: 1px solid var(--a-line-strong);
    background: color-mix(in srgb, var(--a-surface) 82%, transparent); color: var(--a-ink);
    font-family: inherit; font-size: 16px; font-weight: 600; outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease; }
  .tx-input::placeholder { color: var(--a-muted); opacity: 0.75; font-weight: 500; }
  .tx-input:focus { border-color: var(--a-accent); background: var(--a-surface);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--a-accent) 16%, transparent); }
  .tx-input[aria-invalid="true"] { border-color: #f87171; }
  .tx-input:disabled { opacity: 0.7; }
  .tx-pw { position: relative; }
  .tx-pw .tx-input { padding-right: 52px; }
  .tx-eye { position: absolute; right: 5px; top: 5px; width: 40px; height: 40px; border-radius: 10px; border: none; background: none;
    color: var(--a-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 150ms ease, background-color 150ms ease, transform 160ms var(--tx-ease); }
  .tx-eye:active { transform: scale(0.94); }
  .tx-link { font-size: 13px; font-weight: 700; color: var(--a-accent-ink); text-decoration: none; border-radius: 4px; transition: color 150ms ease; }

  .tx-submit { position: relative; height: 52px; margin-top: 6px; border: none; border-radius: 16px; cursor: pointer;
    background: var(--a-accent-grad); color: var(--a-on-accent); font-family: inherit; font-size: 16px; font-weight: 800;
    box-shadow: 0 10px 24px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.25);
    transition: transform 160ms var(--tx-ease), filter 150ms ease, box-shadow 150ms ease; }
  .tx-submit:active:not(:disabled) { transform: scale(0.97); }
  .tx-submit:disabled { cursor: progress; }
  .tx-btn-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: opacity 150ms ease, transform 200ms var(--tx-ease); }
  .tx-btn-label.is-hidden { opacity: 0; transform: translateY(4px); pointer-events: none; }
  .tx-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid color-mix(in srgb, currentColor 35%, transparent);
    border-top-color: currentColor; animation: tx-spin 600ms linear infinite; }
  @keyframes tx-spin { to { transform: rotate(360deg); } }

  .tx-foot { margin: 22px 0 0; text-align: center; font-size: 13px; font-weight: 600; color: var(--a-muted); }
  .tx-root button:focus-visible, .tx-root a:focus-visible { outline: 2px solid var(--a-accent); outline-offset: 2px; }

  @media (hover: hover) and (pointer: fine) {
    .tx-submit:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 14px 28px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.25); }
    .tx-eye:hover:not(:disabled) { color: var(--a-accent-ink); background: color-mix(in srgb, var(--a-accent) 10%, transparent); }
    .tx-link:hover { color: var(--a-accent); }
    .tx-input:hover:not(:focus):not(:disabled) { border-color: color-mix(in srgb, var(--a-accent) 40%, var(--a-line-strong)); }
  }

  /* short laptop screens: tighter so the framed page fits */
  @media (min-width: 901px) and (max-height: 760px) {
    .tx-frame { padding: 20px 24px; }
    .tx-hero { min-height: 500px; }
    .tx-card { padding: 30px 32px 24px; }
  }
  /* tablet / phone: card only */
  @media (max-width: 900px) {
    .tx-root { padding: 10px; }
    .tx-frame { min-height: calc(100dvh - 20px); border-radius: 26px; padding: 36px 14px; }
    .tx-wrap { grid-template-columns: 1fr; max-width: 440px; }
    .tx-hero { display: none; }
    .tx-card { padding: 36px 24px 26px; }
  }
  /* phones: one border only — the page frame keeps its gradient ring, the card sits flat inside it
     (two rings 14px apart read as a broken double outline) */
  @media (max-width: 640px) {
    .tx-frame { padding: 28px 18px; align-items: center; }
    .tx-root .tx-card.as-glass-ring::before { display: none; }
    .tx-root .tx-card { background: transparent !important; border: 0; box-shadow: none !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; padding: 12px 4px 8px; }
  }
  @media (max-width: 380px) {
    .tx-root { padding: 8px; }
    .tx-frame { min-height: calc(100dvh - 16px); border-radius: 22px; padding: 28px 14px; }
    .tx-card { padding: 12px 2px 8px; } .tx-title { font-size: 25px; }
  }
`;
