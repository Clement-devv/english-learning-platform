// src/components/auth/SunshineLoginShell.jsx
// Shared Sunshine login layout for the admin-side portals (center admin + super admin).
// Same look as the Sunshine dashboards: warm colour glows, a rounded glass frame with
// the gradient border, the sunrise rings from the dashboard banner, floating glass
// "status" cards — and a glass sign-in card. Each page passes its own wording and
// renders its own form inside, so logic (2FA, reset password, emailed codes) stays put.
//
// Motion: one entrance on load (panes rise 8px + fade, card children + floating cards
// stagger 30–60ms). Button press scales to 0.97; hover only on mouse devices. No looping
// animation; prefers-reduced-motion (global rule in index.css) stops everything.
import React from 'react';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { adminAccent, adminOnAccent } from '../../utils/adminAccent';

const GLOWS = [
  { l: '-8%',  t: '-14%', s: 520, c: 'color-mix(in srgb, var(--a-pink) 48%, transparent)' },
  { l: '12%',  t: '58%',  s: 460, c: 'rgba(56,189,248,0.32)' },
  { l: '38%',  t: '-22%', s: 620, c: 'color-mix(in srgb, var(--a-accent) 45%, transparent)' },
  { l: '74%',  t: '4%',   s: 500, c: 'rgba(251,191,36,0.45)' },
  { l: '60%',  t: '64%',  s: 520, c: 'rgba(45,212,191,0.28)' },
  { l: '88%',  t: '74%',  s: 420, c: 'color-mix(in srgb, var(--a-pink) 40%, transparent)' },
];

/**
 * @param branding    center branding (accent + font) — omit for the super admin
 * @param hero        { eyebrow, lines: [..], highlight, sub, chips: [..], floats: [{ Icon, cat, title, sub, live }] }
 * @param compact     render only the card (used for the 2FA step)
 */
export default function SunshineLoginShell({ branding, hero, compact = false, children }) {
  const accent = adminAccent(branding);
  const rootStyle = {
    '--a-accent': accent,
    '--a-on-accent': adminOnAccent(accent),
    // 'Inter' is the untouched default (never downloaded) — only a font the center picked overrides Nunito
    ...(branding?.fontFamily && branding.fontFamily !== 'Inter' ? { fontFamily: `'${branding.fontFamily}', 'Nunito', sans-serif` } : null),
  };

  return (
    <div className="as-root as-glass lx-root" data-theme="light" style={rootStyle}>
      <style>{css}</style>
      <div className="lx-glows" aria-hidden="true">
        {GLOWS.map((g, i) => (
          <div key={i} style={{ left: g.l, top: g.t, width: g.s, height: g.s, background: `radial-gradient(circle, ${g.c} 0%, transparent 68%)` }} />
        ))}
      </div>

      {/* Rounded frame around the whole page — same gradient border as the dashboards */}
      <div className="lx-frame as-glass-ring">
        <main className={`lx-wrap${compact ? ' is-compact' : ''}`}>
          {!compact && hero && (
            <section className="lx-hero" aria-hidden="true" style={{ background: 'var(--as-glass-card)' }}>
              <div className="lx-sun" />
              <svg className="lx-rings" width="460" height="460" viewBox="0 0 460 460">
                <defs>
                  <linearGradient id="lx-ring" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="55%" stopColor="var(--a-accent)" />
                    <stop offset="100%" stopColor="var(--a-pink)" />
                  </linearGradient>
                </defs>
                {[70, 120, 170, 220].map((r, i) => (
                  <circle key={r} cx="230" cy="230" r={r} fill="none" stroke="url(#lx-ring)" strokeWidth="1.6" strokeOpacity={0.7 - i * 0.14} />
                ))}
                <circle cx="230" cy="110" r="4" fill="#f97316" />
                <circle cx="392" cy="260" r="3" fill="var(--a-pink)" />
                <circle cx="120" cy="320" r="3.5" fill="#f59e0b" />
              </svg>

              <div className="lx-hero-copy">
                {hero.eyebrow && <p className="lx-eyebrow">{hero.eyebrow}</p>}
                <h2 className="lx-hero-title">
                  {hero.lines.map((l, i) => <React.Fragment key={i}>{l}<br /></React.Fragment>)}
                  {hero.highlight && <span className="lx-grad">{hero.highlight}</span>}
                </h2>
                {hero.sub && <p className="lx-hero-sub">{hero.sub}</p>}
                {hero.chips?.length > 0 && (
                  <ul className="lx-chips">{hero.chips.map(c => <li key={c}>{c}</li>)}</ul>
                )}
              </div>

              {hero.floats?.length > 0 && (
                <div className="lx-floats">
                  {hero.floats.map(({ Icon, cat, title, sub, live }, i) => (
                    <div key={title} className="lx-float" style={{ animationDelay: `${260 + i * 60}ms` }}>
                      <span className={`lx-f-icon cat-${cat}`}><Icon size={16} strokeWidth={2.2} /></span>
                      <span className="lx-f-text"><b>{title}</b>{sub && <small>{sub}</small>}</span>
                      {live && <span className="lx-live" />}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="lx-card as-glass-ring" style={{ background: 'var(--as-glass-card)' }}>
            <div className="lx-stagger">{children}</div>
          </section>
        </main>
      </div>
    </div>
  );
}

// ── Building blocks for the card ──────────────────────────────────────────────

/** Logo (center logo, or an initial / icon on the accent fill) + tag + title + subtitle */
export function LoginHeader({ logo, mark, tag, title, sub }) {
  return (
    <>
      <div className="lx-brand">
        {logo ? <img src={logo} alt="" className="lx-logo-img" /> : <div className="lx-logo">{mark}</div>}
      </div>
      <div className="lx-head">
        {tag && <p className="lx-tag">{tag}</p>}
        <h1 className="lx-title">{title}</h1>
        {sub && <p className="lx-sub">{sub}</p>}
      </div>
    </>
  );
}

export function LoginError({ id = 'lx-error', children }) {
  if (!children) return null;
  return (
    <div className="lx-error" role="alert" id={id}>
      <AlertCircle size={17} strokeWidth={2.2} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Labelled input. `aside` renders on the label row's right (e.g. "Forgot password?"). */
export function LoginField({ id, label, aside, invalid, describedBy, className = '', ...input }) {
  return (
    <div className="lx-field">
      <div className="lx-label-row">
        <label htmlFor={id} className="lx-label">{label}</label>
        {aside}
      </div>
      <input id={id} className={`lx-input ${className}`} aria-invalid={invalid || undefined} aria-describedby={invalid ? describedBy : undefined} {...input} />
    </div>
  );
}

export function LoginPasswordField({ id, label, aside, show, onToggle, invalid, describedBy, disabled, showLabel = 'Show password', hideLabel = 'Hide password', ...input }) {
  return (
    <div className="lx-field">
      <div className="lx-label-row">
        <label htmlFor={id} className="lx-label">{label}</label>
        {aside}
      </div>
      <div className="lx-pw">
        <input id={id} className="lx-input" type={show ? 'text' : 'password'} autoComplete="current-password" disabled={disabled}
          aria-invalid={invalid || undefined} aria-describedby={invalid ? describedBy : undefined} {...input} />
        <button type="button" className="lx-eye" onClick={onToggle} disabled={disabled}
          aria-label={show ? hideLabel : showLabel} aria-pressed={show}>
          {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

/** Both labels are always rendered so the button never changes size while loading. */
export function LoginSubmit({ loading, disabled, children, loadingLabel }) {
  return (
    <button type="submit" className="lx-submit" disabled={loading || disabled} aria-busy={loading || undefined}>
      <span className={`lx-btn-label${loading ? ' is-hidden' : ''}`}>{children}</span>
      <span className={`lx-btn-label${loading ? '' : ' is-hidden'}`} aria-hidden={!loading}>
        <span className="lx-spinner" aria-hidden="true" /> {loadingLabel}
      </span>
    </button>
  );
}

export function LoginNote({ icon: Icon, tone = 'muted', children }) {
  return (
    <p className={`lx-note is-${tone}`}>
      {Icon && <Icon size={14} strokeWidth={2.2} aria-hidden="true" />}
      <span>{children}</span>
    </p>
  );
}

const css = `
  .lx-root { --lx-ease: cubic-bezier(0.23, 1, 0.32, 1);
    position: relative; min-height: 100vh; min-height: 100dvh; overflow-x: hidden; background: var(--a-bg);
    font-family: 'Nunito', system-ui, sans-serif; color: var(--a-ink); display: flex; padding: 14px; }
  .lx-root *, .lx-root *::before, .lx-root *::after { box-sizing: border-box; }
  .lx-glows { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .lx-glows > div { position: absolute; border-radius: 50%; }

  .lx-frame { position: relative; flex: 1; min-height: calc(100dvh - 28px); border-radius: 32px; padding: 32px 24px;
    display: flex; align-items: center; justify-content: center;
    background: var(--as-glass-frame); box-shadow: inset 0 1px 0 var(--as-glass-edge), 0 24px 48px -24px var(--as-glass-glow); }
  .lx-wrap { position: relative; width: 100%; max-width: 1060px; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 20px; align-items: stretch; }
  .lx-wrap.is-compact { grid-template-columns: 1fr; max-width: 440px; }

  .lx-hero, .lx-card { position: relative; border-radius: 28px; border: 1px solid var(--as-glass-edge); }

  /* ── welcome pane ── */
  .lx-hero { min-height: 560px; padding: 48px 44px 40px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; gap: 32px;
    animation: lx-rise 520ms var(--lx-ease) both; }
  .lx-sun { position: absolute; right: -120px; top: -120px; width: 420px; height: 420px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(255,214,102,0.75) 0%, rgba(249,115,22,0.42) 32%, color-mix(in srgb, var(--a-pink) 22%, transparent) 55%, transparent 72%); }
  .lx-rings { position: absolute; right: -150px; top: -150px; pointer-events: none; filter: drop-shadow(0 0 6px rgba(249,115,22,0.35)); }
  .lx-hero-copy { position: relative; max-width: 390px; }
  .lx-eyebrow { margin: 0 0 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-accent-ink); }
  .lx-hero-title { margin: 0 0 14px; font-size: clamp(38px, 4.4vw, 54px); line-height: 1.04; font-weight: 900; letter-spacing: -0.03em; color: var(--a-ink); }
  .lx-grad { background: linear-gradient(120deg, var(--a-accent), var(--a-pink) 60%, #f59e0b); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .lx-hero-sub { margin: 0 0 18px; font-size: 17px; font-weight: 600; color: var(--a-ink-2); line-height: 1.45; }
  .lx-chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .lx-chips li { font-size: 13px; font-weight: 700; color: var(--a-ink-2); padding: 7px 13px; border-radius: 999px;
    background: color-mix(in srgb, var(--a-surface) 55%, transparent); box-shadow: inset 0 0 0 1px var(--as-glass-edge); }

  .lx-floats { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; max-width: 460px; }
  .lx-float { position: relative; display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 14px 10px 10px; border-radius: 16px;
    background: color-mix(in srgb, var(--a-surface) 70%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
    box-shadow: inset 0 0 0 1px var(--as-glass-edge), 0 14px 30px -16px rgba(90,45,15,0.35);
    animation: lx-rise 480ms var(--lx-ease) both; }
  .lx-float:nth-child(even) { margin-top: 22px; margin-bottom: -22px; }   /* scattered, not tabular */
  .lx-f-text { min-width: 0; }
  .lx-f-text b { display: block; font-size: 13px; font-weight: 800; color: var(--a-ink); line-height: 1.2; }
  .lx-f-text small { display: block; font-size: 12px; font-weight: 600; color: var(--a-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lx-f-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    background: var(--cat); color: #fff; box-shadow: 0 6px 12px -6px var(--cat); }
  .lx-live { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,0.18); margin-left: auto; flex-shrink: 0; }

  /* ── sign-in card ── */
  .lx-card { padding: 40px 36px 28px; display: flex; flex-direction: column; justify-content: center;
    animation: lx-rise 520ms var(--lx-ease) 60ms both; }
  .lx-stagger > * { animation: lx-rise 420ms var(--lx-ease) both; }
  .lx-stagger > *:nth-child(1) { animation-delay: 140ms; }
  .lx-stagger > *:nth-child(2) { animation-delay: 170ms; }
  .lx-stagger > *:nth-child(3) { animation-delay: 200ms; }
  .lx-stagger > *:nth-child(4) { animation-delay: 230ms; }
  .lx-stagger > *:nth-child(5) { animation-delay: 260ms; }
  .lx-stagger > *:nth-child(n+6) { animation-delay: 290ms; }
  @keyframes lx-rise { from { opacity: 0; transform: translateY(8px); } }

  .lx-brand { display: flex; justify-content: center; margin-bottom: 14px; }
  .lx-logo { width: 60px; height: 60px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
    background: var(--a-accent-grad); color: var(--a-on-accent); font-size: 26px; font-weight: 900;
    box-shadow: 0 12px 26px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.3); }
  .lx-logo-img { height: 56px; max-width: 180px; object-fit: contain; }
  .lx-head { text-align: center; margin-bottom: 22px; }
  .lx-tag { margin: 0 0 4px; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-accent-ink); }
  .lx-title { margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; color: var(--a-ink); }
  .lx-sub { margin: 6px 0 0; font-size: 15px; font-weight: 600; color: var(--a-muted); line-height: 1.45; }
  .lx-sub strong { color: var(--a-ink); }

  .lx-error { display: flex; align-items: flex-start; gap: 10px; margin: 0 0 16px; padding: 11px 14px; border-radius: 14px;
    background: #fef2f2; color: #b91c1c; box-shadow: inset 0 0 0 1px #fecaca; font-size: 14px; font-weight: 700; line-height: 1.4;
    animation: lx-rise 200ms var(--lx-ease) both; }
  .lx-error svg { flex-shrink: 0; margin-top: 1px; }

  .lx-form { display: flex; flex-direction: column; gap: 16px; }
  .lx-field { display: flex; flex-direction: column; gap: 7px; }
  .lx-label-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
  .lx-label { font-size: 14px; font-weight: 800; color: var(--a-ink-2); }
  .lx-input { width: 100%; height: 50px; padding: 0 16px; border-radius: 14px; border: 1px solid var(--a-line-strong);
    background: color-mix(in srgb, var(--a-surface) 82%, transparent); color: var(--a-ink);
    font-family: inherit; font-size: 16px; font-weight: 600; outline: none;
    transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease; }
  .lx-input::placeholder { color: var(--a-muted); opacity: 0.75; font-weight: 500; }
  .lx-input:focus { border-color: var(--a-accent); background: var(--a-surface); box-shadow: 0 0 0 4px color-mix(in srgb, var(--a-accent) 16%, transparent); }
  .lx-input[aria-invalid="true"] { border-color: #f87171; }
  .lx-input:disabled { opacity: 0.7; }
  .lx-input.is-code { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 0.4em; font-variant-numeric: tabular-nums; }
  .lx-pw { position: relative; }
  .lx-pw .lx-input { padding-right: 52px; }
  .lx-eye { position: absolute; right: 5px; top: 5px; width: 40px; height: 40px; border-radius: 10px; border: none; background: none;
    color: var(--a-muted); cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: color 150ms ease, background-color 150ms ease, transform 160ms var(--lx-ease); }
  .lx-eye:active { transform: scale(0.94); }
  .lx-link { border: none; background: none; padding: 2px 0; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700;
    color: var(--a-accent-ink); text-decoration: none; border-radius: 4px; transition: color 150ms ease; }
  .lx-link.is-center { align-self: center; margin-top: -4px; color: var(--a-muted); }

  .lx-submit { position: relative; height: 52px; margin-top: 6px; border: none; border-radius: 16px; cursor: pointer;
    background: var(--a-accent-grad); color: var(--a-on-accent); font-family: inherit; font-size: 16px; font-weight: 800;
    box-shadow: 0 10px 24px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.25);
    transition: transform 160ms var(--lx-ease), filter 150ms ease, box-shadow 150ms ease, opacity 150ms ease; }
  .lx-submit:active:not(:disabled) { transform: scale(0.97); }
  .lx-submit:disabled { cursor: not-allowed; }
  .lx-submit[aria-busy="true"] { cursor: progress; }
  .lx-submit:disabled:not([aria-busy="true"]) { opacity: 0.55; }
  .lx-btn-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: opacity 150ms ease, transform 200ms var(--lx-ease); }
  .lx-btn-label.is-hidden { opacity: 0; transform: translateY(4px); pointer-events: none; }
  .lx-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid color-mix(in srgb, currentColor 35%, transparent);
    border-top-color: currentColor; animation: lx-spin 600ms linear infinite; }
  @keyframes lx-spin { to { transform: rotate(360deg); } }

  .lx-notes { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
  .lx-note { margin: 0; display: flex; align-items: flex-start; justify-content: center; gap: 7px; text-align: center;
    font-size: 12.5px; font-weight: 600; line-height: 1.45; color: var(--a-muted); }
  .lx-note svg { flex-shrink: 0; margin-top: 2px; }
  .lx-note.is-ok svg { color: #10b981; }
  .lx-note.is-warn { color: #92400e; }
  .lx-foot { margin: 18px 0 0; text-align: center; font-size: 12px; font-weight: 600; color: var(--a-muted); }

  .lx-portals { margin-top: 18px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .lx-portals-label { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--a-muted); }
  .lx-portals-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .lx-portal { border: none; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--a-ink-2);
    padding: 8px 14px; border-radius: 999px; background: color-mix(in srgb, var(--a-surface) 60%, transparent);
    box-shadow: inset 0 0 0 1px var(--as-glass-edge); transition: color 150ms ease, background-color 150ms ease, transform 160ms var(--lx-ease); }
  .lx-portal:active { transform: scale(0.97); }
  /* password requirement checklist (reset pages) */
  .lx-reqs { list-style: none; margin: -6px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 12px; }
  .lx-reqs li { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--a-muted); transition: color 150ms ease; }
  .lx-reqs li svg { flex-shrink: 0; padding: 2px; border-radius: 50%; color: transparent; box-shadow: inset 0 0 0 1.5px var(--a-line-strong);
    transition: color 150ms ease, background-color 150ms ease, box-shadow 150ms ease; }
  .lx-reqs li.is-ok { color: #047857; }
  .lx-reqs li.is-ok svg { color: #fff; background: #10b981; box-shadow: none; }
  .lx-hint { margin: -8px 0 0; font-size: 12.5px; font-weight: 700; color: #b91c1c; }
  .lx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (max-width: 380px) { .lx-reqs { grid-template-columns: 1fr; } }
  .lx-sent { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
  .lx-sent-icon { width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
    color: #fff; background: #10b981; box-shadow: 0 12px 24px -12px #10b981; }

  .lx-root button:focus-visible, .lx-root a:focus-visible { outline: 2px solid var(--a-accent); outline-offset: 2px; }

  @media (hover: hover) and (pointer: fine) {
    .lx-submit:hover:not(:disabled) { filter: brightness(1.06); box-shadow: 0 14px 28px -12px var(--a-accent), inset 0 1px 0 rgba(255,255,255,0.25); }
    .lx-eye:hover:not(:disabled) { color: var(--a-accent-ink); background: color-mix(in srgb, var(--a-accent) 10%, transparent); }
    .lx-link:hover { color: var(--a-accent); }
    .lx-portal:hover { color: var(--a-accent-ink); background: color-mix(in srgb, var(--a-accent) 10%, var(--a-surface)); }
    .lx-input:hover:not(:focus):not(:disabled) { border-color: color-mix(in srgb, var(--a-accent) 40%, var(--a-line-strong)); }
  }

  /* short laptop screens: tighter so the framed page fits */
  @media (min-width: 901px) and (max-height: 760px) {
    .lx-frame { padding: 20px 24px; }
    .lx-hero { min-height: 500px; padding: 40px 40px 36px; }
    .lx-card { padding: 30px 32px 22px; }
    .lx-head { margin-bottom: 16px; }
    .lx-brand { margin-bottom: 10px; }
    .lx-logo { width: 52px; height: 52px; border-radius: 16px; font-size: 22px; }
    .lx-form { gap: 12px; }
    .lx-input { height: 46px; }
    .lx-eye { top: 3px; }
    .lx-submit { height: 48px; }
    .lx-notes { margin-top: 14px; gap: 4px; }
    .lx-portals { margin-top: 12px; flex-direction: row; justify-content: center; }
    .lx-portal { padding: 6px 12px; }
    .lx-foot { margin-top: 10px; }
  }
  /* tablet / phone: card only */
  @media (max-width: 900px) {
    .lx-root { padding: 10px; }
    .lx-frame { min-height: calc(100dvh - 20px); border-radius: 26px; padding: 36px 14px; }
    .lx-wrap { grid-template-columns: 1fr; max-width: 440px; }
    .lx-hero { display: none; }
    .lx-card { padding: 36px 24px 24px; }
  }
  @media (max-width: 380px) {
    .lx-root { padding: 8px; }
    .lx-frame { min-height: calc(100dvh - 16px); border-radius: 22px; padding: 32px 10px; }
    .lx-card { padding: 32px 18px 22px; } .lx-title { font-size: 25px; }
  }
`;
