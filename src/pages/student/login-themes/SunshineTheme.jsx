// src/pages/student/login-themes/SunshineTheme.jsx
// Sunshine login — same look as the student Sunshine dashboard: warm colour glows,
// frosted glass panes with the gradient border, the student stickers, the center's
// accent. Default student login when a center has no theme assigned.
//
// Motion: one entrance on page load (card rises 8px + fades, children stagger 40ms),
// stickers pop in once. Button press scales to 0.97. Hover only on mouse devices.
// No looping animations. prefers-reduced-motion (global rule in index.css) stops all.
import React from 'react';
import { Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import TwoFactorLogin from '../../../components/TwoFactorLogin';
import { useBranding } from '../../../context/BrandingContext';
import { useLoginLogic } from './useLoginLogic';
import { useTranslation } from 'react-i18next';
import { adminAccent, adminOnAccent } from '../../../utils/adminAccent';
import { Sticker } from '../../../components/dashboard/DoodleArt';

const GLOWS = [
  { l: '-8%',  t: '-14%', s: 520, c: 'color-mix(in srgb, var(--a-pink) 55%, transparent)' },
  { l: '10%',  t: '55%',  s: 460, c: 'rgba(56,189,248,0.38)' },
  { l: '40%',  t: '-20%', s: 600, c: 'color-mix(in srgb, var(--a-accent) 42%, transparent)' },
  { l: '74%',  t: '6%',   s: 500, c: 'rgba(251,191,36,0.45)' },
  { l: '58%',  t: '62%',  s: 540, c: 'rgba(45,212,191,0.30)' },
  { l: '86%',  t: '72%',  s: 420, c: 'color-mix(in srgb, var(--a-pink) 45%, transparent)' },
];

// audience='parent' (ParentLogin reuses this theme): parent wording. The forgot-password
// link goes to loginHook's forgotPath (parents → /parent/forgot-password).
export default function SunshineTheme({ loginHook, audience = 'student' } = {}) {
  const isParent = audience === 'parent';
  const { t: tr } = useTranslation('student');
  const {
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    error, loading, requires2FA,
    handleInitialLogin, handle2FAVerification, handleCancel2FA, navigate, forgotPath = '/student/forgot-password',
  } = (loginHook || useLoginLogic)();

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
    <div className="sx-glows" aria-hidden="true">
      {GLOWS.map((g, i) => (
        <div key={i} style={{ left: g.l, top: g.t, width: g.s, height: g.s, background: `radial-gradient(circle, ${g.c} 0%, transparent 68%)` }} />
      ))}
    </div>
  );

  if (requires2FA) {
    return (
      <div className="as-root as-glass sx-root" data-theme="light" style={rootStyle}>
        <style>{css}</style>
        {backdrop}
        <div className="sx-frame as-glass-ring">
        <div className="sx-2fa">
          <TwoFactorLogin onVerify={handle2FAVerification} onCancel={handleCancel2FA} loading={loading} error={error} />
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="as-root as-glass sx-root" data-theme="light" style={rootStyle}>
      <style>{css}</style>
      {backdrop}

      {/* Rounded frame around the whole page — same gradient border as the dashboards */}
      <div className="sx-frame as-glass-ring">
      <main className="sx-wrap">
        {/* ── Welcome pane (desktop) ── */}
        <section className="sx-hero" aria-hidden="true" style={{ background: 'var(--as-glass-card)' }}>
          {/* stickers live in the right-hand strip and along the bottom, clear of the copy */}
          <Sticker name="rocket"   size={88} style={{ right: 34, top: 30 }}     rotate={14}  delay={0.25} />
          <Sticker name="star"     size={40} style={{ right: 132, top: 34 }}    rotate={-10} delay={0.4} />
          <Sticker name="heart"    size={32} style={{ right: 118, top: 128 }}   rotate={-12} delay={0.8} />
          <Sticker name="book"     size={60} style={{ right: 40, top: 200 }}    rotate={8}   delay={0.55} />
          <Sticker name="sparkle"  size={24} style={{ right: 128, top: 250 }}                delay={0.9} />
          <Sticker name="speech"   size={50} style={{ right: 118, bottom: 142 }} rotate={-8} delay={0.7} />
          <Sticker name="owl"      size={84} style={{ right: 30, bottom: 70 }}  rotate={-6}  delay={0.5} />
          <Sticker name="pencil"   size={66} style={{ right: 150, bottom: 30 }} rotate={-14} delay={0.65} />
          <Sticker name="blockA"   size={40} style={{ left: 40, bottom: 28 }}   rotate={-8}  delay={0.6} />
          <Sticker name="blockB"   size={40} style={{ left: 84, bottom: 40 }}   rotate={6}   delay={0.7} />
          <Sticker name="blockC"   size={40} style={{ left: 128, bottom: 26 }}  rotate={-4}  delay={0.8} />

          <div className="sx-hero-copy">
            <p className="sx-eyebrow">{isParent ? `${centerName} · ${tr('sunshineTheme.parentPortal', 'Parent portal')}` : centerName}</p>
            <h2 className="sx-hero-title">
              {tr('spaceTheme.learn')}<br />{tr('spaceTheme.grow')}<br /><span className="sx-grad">{tr('spaceTheme.shine')}</span>
            </h2>
            <p className="sx-hero-sub">{isParent
              ? tr('sunshineTheme.parentHeroSub', "Follow your child's classes, homework and progress.")
              : tr('spaceTheme.yourClassroomAdventureAwaits')}</p>
            <ul className="sx-chips">
              {isParent ? (
                <>
                  <li>{tr('sunshineTheme.parentChipClasses', '📅 Classes')}</li>
                  <li>{tr('sunshineTheme.parentChipHomework', '📝 Homework')}</li>
                  <li>{tr('sunshineTheme.parentChipCertificates', '🏆 Certificates')}</li>
                </>
              ) : (
                <>
                  <li>{tr('spaceTheme.expertLessons')}</li>
                  <li>{tr('spaceTheme.liveClasses')}</li>
                  <li>{tr('spaceTheme.trackProgress')}</li>
                </>
              )}
            </ul>
          </div>
        </section>

        {/* ── Sign-in card ── */}
        <section className="sx-card as-glass-ring" style={{ background: 'var(--as-glass-card)' }}>
          {/* phone-only stickers so the small screen still feels like the student app */}
          <Sticker name="star"    size={34} style={{ right: 22, top: -14 }} rotate={-10} delay={0.4} />
          <Sticker name="rocket"  size={46} style={{ left: -10, top: -20 }} rotate={14}  delay={0.3} />

          <div className="sx-stagger">
            <div className="sx-brand">
              {branding.logo
                ? <img src={branding.logo} alt="" className="sx-logo-img" />
                : <div className="sx-logo"><Sticker name="smiley" size={40} style={{ position: 'static' }} delay={0.35} /></div>}
            </div>

            <h1 className="sx-title">{tr('sunshineTheme.welcomeBack', 'Welcome back!')}</h1>
            <p className="sx-sub">{isParent
              ? tr('sunshineTheme.parentSub', "Sign in to follow your child's learning")
              : tr('spaceTheme.signInToStartYour')}</p>

            {error && (
              <div className="sx-error" role="alert" id="sx-error">
                <AlertCircle size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInitialLogin} className="sx-form" noValidate={false}>
              <div className="sx-field">
                <label htmlFor="sx-email" className="sx-label">{tr('spaceTheme.email')}</label>
                <input id="sx-email" className="sx-input" type="email" inputMode="email" autoComplete="email"
                  autoCapitalize="none" spellCheck={false}
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder={tr('spaceTheme.yourEmailExampleCom')}
                  required disabled={loading}
                  aria-invalid={error ? true : undefined} aria-describedby={error ? 'sx-error' : undefined} />
              </div>

              <div className="sx-field">
                <div className="sx-label-row">
                  <label htmlFor="sx-password" className="sx-label">{tr('spaceTheme.password')}</label>
                  <button type="button" className="sx-link" onClick={() => navigate(forgotPath)}>
                    {tr('spaceTheme.forgotPassword')}
                  </button>
                </div>
                <div className="sx-pw">
                  <input id="sx-password" className="sx-input" type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password} onChange={e => setPassword(e.target.value)}
                    required disabled={loading}
                    aria-invalid={error ? true : undefined} aria-describedby={error ? 'sx-error' : undefined} />
                  <button type="button" className="sx-eye" onClick={() => setShowPassword(v => !v)} disabled={loading}
                    aria-label={showPassword ? tr('sunshineTheme.hidePassword', 'Hide password') : tr('sunshineTheme.showPassword', 'Show password')}
                    aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button type="submit" className="sx-submit" disabled={loading} aria-busy={loading || undefined}>
                {/* both labels always rendered → button never changes size */}
                <span className={`sx-btn-label${loading ? ' is-hidden' : ''}`}>
                  {tr('sunshineTheme.signIn', 'Sign in')} <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span className={`sx-btn-label sx-btn-loading${loading ? '' : ' is-hidden'}`} aria-hidden={!loading}>
                  <span className="sx-spinner" aria-hidden="true" /> {tr('spaceTheme.signingIn')}
                </span>
              </button>
            </form>

            <p className="sx-foot">{tr('spaceTheme.yourAccountIsManagedBy')}</p>
          </div>
        </section>
      </main>
      </div>
    </div>
  );
}

const css = `
  .sx-root { --sx-ease: cubic-bezier(0.23, 1, 0.32, 1);
    position: relative; min-height: 100vh; min-height: 100dvh; overflow-x: hidden; background: var(--a-bg);
    font-family: 'Nunito', system-ui, sans-serif; color: var(--a-ink); display: flex;
    padding: 14px; }
  /* the frame: translucent glass, rounded, gradient ring from .as-glass-ring (index.css) */
  .sx-frame { position: relative; flex: 1; min-height: calc(100dvh - 28px); border-radius: 32px; padding: 32px 24px;
    display: flex; align-items: center; justify-content: center;
    background: var(--as-glass-frame); box-shadow: inset 0 1px 0 var(--as-glass-edge), 0 24px 48px -24px var(--as-glass-glow); }
  .sx-root *, .sx-root *::before, .sx-root *::after { box-sizing: border-box; }
  .sx-glows { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .sx-glows > div { position: absolute; border-radius: 50%; }

  .sx-wrap { position: relative; width: 100%; max-width: 1040px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 20px; align-items: stretch; }
  .sx-2fa  { position: relative; width: 100%; max-width: 440px; }

  /* ── panes (glass comes from .as-glass in index.css) ── */
  .sx-hero, .sx-card { position: relative; border-radius: 28px; border: 1px solid var(--as-glass-edge); }
  .sx-hero { min-height: 560px; padding: 44px; display: flex; align-items: center; overflow: hidden;
    animation: sx-rise 520ms var(--sx-ease) both; }
  .sx-hero-copy { position: relative; max-width: 420px; }
  .sx-eyebrow { margin: 0 0 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-accent-ink); }
  .sx-hero-title { margin: 0 0 14px; font-size: clamp(40px, 4.6vw, 56px); line-height: 1.04; font-weight: 900; letter-spacing: -0.03em; color: var(--a-ink); }
  .sx-grad { background: linear-gradient(120deg, var(--a-accent), var(--a-pink) 60%, #f59e0b); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sx-hero-sub { margin: 0 0 22px; font-size: 17px; font-weight: 600; color: var(--a-ink-2); }
  .sx-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .sx-chips li { font-size: 13px; font-weight: 700; color: var(--a-ink-2); padding: 7px 13px; border-radius: 999px;
    background: color-mix(in srgb, var(--a-surface) 55%, transparent); box-shadow: inset 0 0 0 1px var(--as-glass-edge); }

  .sx-card { padding: 40px 36px 30px; display: flex; flex-direction: column; justify-content: center;
    animation: sx-rise 520ms var(--sx-ease) 60ms both; }
  .sx-card > .as-sticker { display: none; }

  /* children cascade in, 40ms apart */
  .sx-stagger > * { animation: sx-rise 420ms var(--sx-ease) both; }
  .sx-stagger > *:nth-child(1) { animation-delay: 140ms; }
  .sx-stagger > *:nth-child(2) { animation-delay: 180ms; }
  .sx-stagger > *:nth-child(3) { animation-delay: 220ms; }
  .sx-stagger > *:nth-child(4) { animation-delay: 260ms; }
  .sx-stagger > *:nth-child(5) { animation-delay: 300ms; }
  .sx-stagger > *:nth-child(6) { animation-delay: 340ms; }
  @keyframes sx-rise { from { opacity: 0; transform: translateY(8px); } }

  .sx-brand { display: flex; justify-content: center; margin-bottom: 16px; }
  .sx-logo { width: 64px; height: 64px; border-radius: 20px; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--a-surface) 65%, transparent); box-shadow: inset 0 0 0 1px var(--as-glass-edge), 0 10px 24px -12px var(--a-accent); }
  .sx-logo-img { height: 56px; max-width: 180px; object-fit: contain; }
  .sx-title { margin: 0; text-align: center; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; color: var(--a-ink); }
  .sx-sub { margin: 6px 0 22px; text-align: center; font-size: 15px; font-weight: 600; color: var(--a-muted); }

  .sx-error { display: flex; align-items: flex-start; gap: 10px; margin: 0 0 16px; padding: 11px 14px; border-radius: 14px;
    background: #fef2f2; color: #b91c1c; box-shadow: inset 0 0 0 1px #fecaca; font-size: 14px; font-weight: 700; line-height: 1.4;
    animation: sx-rise 200ms var(--sx-ease) both; }
  .sx-error svg { flex-shrink: 0; margin-top: 1px; }

  .sx-form { display: flex; flex-direction: column; gap: 16px; }
  .sx-field { display: flex; flex-direction: column; gap: 7px; }
  .sx-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .sx-label { font-size: 14px; font-weight: 800; color: var(--a-ink-2); }
  .sx-input { width: 100%; height: 50px; padding: 0 16px; border-radius: 14px; border: 1px solid var(--a-line-strong);
    background: color-mix(in srgb, var(--a-surface) 82%, transparent); color: var(--a-ink);
    font-family: inherit; font-size: 16px; font-weight: 600; outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease; }
  .sx-input::placeholder { color: var(--a-muted); opacity: 0.75; font-weight: 500; }
  .sx-input:focus { border-color: var(--a-accent); background: var(--a-surface);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--a-accent) 16%, transparent); }
  .sx-input[aria-invalid="true"] { border-color: #f87171; }
  .sx-input:disabled { opacity: 0.7; }
  .sx-pw { position: relative; }
  .sx-pw .sx-input { padding-right: 52px; }
  .sx-eye { position: absolute; right: 5px; top: 5px; width: 40px; height: 40px; border-radius: 10px; border: none; background: none;
    color: var(--a-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 150ms ease, background-color 150ms ease, transform 160ms var(--sx-ease); }
  .sx-eye:active { transform: scale(0.94); }
  .sx-link { border: none; background: none; padding: 2px 0; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; line-height: 1.2;
    color: var(--a-accent-ink); border-radius: 4px; transition: color 150ms ease; }

  .sx-submit { position: relative; height: 52px; margin-top: 6px; border: none; border-radius: 16px; cursor: pointer;
    background: var(--a-accent-grad); color: var(--a-on-accent); font-family: inherit; font-size: 16px; font-weight: 800;
    box-shadow: 0 10px 24px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.25);
    transition: transform 160ms var(--sx-ease), filter 150ms ease, box-shadow 150ms ease; }
  .sx-submit:active:not(:disabled) { transform: scale(0.97); }
  .sx-submit:disabled { cursor: progress; }
  .sx-btn-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: opacity 150ms ease, transform 200ms var(--sx-ease); }
  .sx-btn-label.is-hidden { opacity: 0; transform: translateY(4px); pointer-events: none; }
  .sx-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid color-mix(in srgb, currentColor 35%, transparent);
    border-top-color: currentColor; animation: sx-spin 600ms linear infinite; }
  @keyframes sx-spin { to { transform: rotate(360deg); } }

  .sx-foot { margin: 22px 0 0; text-align: center; font-size: 13px; font-weight: 600; color: var(--a-muted); }

  .sx-root button:focus-visible, .sx-root a:focus-visible { outline: 2px solid var(--a-accent); outline-offset: 2px; }

  @media (hover: hover) and (pointer: fine) {
    .sx-submit:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 14px 28px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.25); }
    .sx-eye:hover:not(:disabled) { color: var(--a-accent-ink); background: color-mix(in srgb, var(--a-accent) 10%, transparent); }
    .sx-link:hover { color: var(--a-accent); }
    .sx-input:hover:not(:focus):not(:disabled) { border-color: color-mix(in srgb, var(--a-accent) 40%, var(--a-line-strong)); }
  }

  /* ── tablet / phone: card only ── */
  @media (max-width: 900px) {
    .sx-root { padding: 10px; }
    .sx-frame { min-height: calc(100dvh - 20px); border-radius: 26px; padding: 36px 14px; }
    .sx-wrap { grid-template-columns: 1fr; max-width: 440px; }
    .sx-hero { display: none; }
    .sx-card { padding: 36px 24px 26px; overflow: visible; }
    .sx-card > .as-sticker { display: block; }
  }
  /* phones: one border only — the page frame keeps its gradient ring, the card sits flat inside it
     (two rings 14px apart read as a broken double outline) */
  @media (max-width: 640px) {
    .sx-frame { padding: 28px 18px; align-items: center; }
    .sx-root .sx-card.as-glass-ring::before { display: none; }
    /* stickers pin to the frame corners instead of floating beside the logo */
    .sx-root .sx-wrap, .sx-root .sx-card { position: static; }
    .sx-root .sx-card { animation: none; } /* its transform would trap the stickers; the fields still stagger in */
    .sx-card > svg.as-sticker:nth-of-type(1) { right: 22px !important; top: 18px !important; left: auto !important; }
    .sx-card > svg.as-sticker:nth-of-type(2) { left: 16px !important; top: 14px !important; }
    .sx-root .sx-card { background: transparent !important; border: 0; box-shadow: none !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; padding: 12px 4px 8px; }
  }
  @media (max-width: 380px) { .sx-root { padding: 8px; } .sx-frame { min-height: calc(100dvh - 16px); border-radius: 22px; padding: 28px 14px; } .sx-card { padding: 12px 2px 8px; } .sx-title { font-size: 25px; } }
`;
