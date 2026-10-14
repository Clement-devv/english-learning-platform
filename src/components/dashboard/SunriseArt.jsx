// src/components/dashboard/SunriseArt.jsx
// Decorative "sunrise" artwork shared by the admin and sub-admin Sunshine shells:
// a soft glow + gradient rings + twinkling sparkles behind the top of every page,
// and a mirrored "sunset" pinned to the bottom of the visible page.
// Colours come from the admin tokens (src/index.css .as-root), so the art follows the
// center's accent and dark mode. Animations (.as-sparkle) live in index.css and stop
// for reduced-motion users.
//
// Usage inside a .as-root shell:
//   <div style={{ position: 'relative', … }}>      ← the main column
//     <SunsetGlow />
//     <main style={{ position: 'relative', overflowY: 'auto', … }}>
//       <SunriseBackdrop />
//       <div style={{ position: 'relative' }}>…page…</div>
//     </main>
//   </div>
import React from 'react';

// ── Sunrise backdrop ─────────────────────────────────────────────────────────
// Page-wide version of the overview banner: orange glow with a golden core, the
// accent/pink corner, orange→pink rings and twinkling sparkles. Softer than the
// banner so tables and forms stay easy to read; fades out down the page.
// Sits first inside <main>; content follows in a positioned wrapper (no z-index,
// so modals keep their existing stacking).
const BACKDROP_SPARKLES = [
  { left: '24%', top: 54, size: 7, color: '#f97316', delay: '0s' },
  { left: '47%', top: 22, size: 5, color: '#fbbf24', delay: '0.9s' },
  { left: '66%', top: 96, size: 6, color: 'var(--a-accent)', delay: '1.7s' },
  { left: '83%', top: 190, size: 5, color: '#fb923c', delay: '2.5s' },
];

export function SunriseBackdrop() {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 560, pointerEvents: 'none', overflow: 'hidden',
      WebkitMaskImage: 'linear-gradient(to bottom, #000 40%, transparent 100%)',
      maskImage: 'linear-gradient(to bottom, #000 40%, transparent 100%)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: [
        'radial-gradient(10% 22% at 52% 0%, rgba(255,214,102,0.5) 0%, transparent 100%)',
        'radial-gradient(34% 62% at 52% -8%, rgba(249,115,22,0.36) 0%, rgba(251,146,60,0.15) 45%, transparent 75%)',
        'radial-gradient(40% 72% at 100% -5%, color-mix(in srgb, var(--a-accent) 32%, transparent) 0%, color-mix(in srgb, var(--a-pink) 13%, transparent) 45%, transparent 75%)',
        'radial-gradient(26% 52% at 0% 0%, color-mix(in srgb, var(--a-pink) 18%, transparent) 0%, transparent 75%)',
      ].join(', ') }} />
      <svg width="440" height="440" viewBox="0 0 440 440" style={{ position: 'absolute', right: -150, top: -180, filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.3))' }}>
        <defs>
          <linearGradient id="as-bg-ring" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="var(--a-accent)" />
          </linearGradient>
        </defs>
        {[75, 125, 175].map((r, i) => (
          <circle key={r} cx="220" cy="220" r={r} fill="none" stroke="url(#as-bg-ring)" strokeOpacity={0.5 - i * 0.12} strokeWidth={i === 0 ? 2.5 : 1.75} />
        ))}
      </svg>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', left: '32%', top: -128, filter: 'drop-shadow(0 0 5px rgba(249,115,22,0.35))' }}>
        {[45, 80].map((r, i) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#f97316" strokeOpacity={0.38 - i * 0.12} strokeWidth="1.75" />
        ))}
      </svg>
      {BACKDROP_SPARKLES.map((d, i) => (
        <span key={i} className="as-sparkle" style={{ position: 'absolute', left: d.left, top: d.top, width: d.size, height: d.size, borderRadius: '50%', background: d.color, boxShadow: `0 0 10px 2px ${d.color}`, animationDelay: d.delay }} />
      ))}
    </div>
  );
}

// ── Sunset footer glow ───────────────────────────────────────────────────────
// Mirror of the sunrise, pinned to the bottom of the visible page (it does not
// scroll), so long and short pages both end in colour instead of plain blush.
// Pink rises from the lower-left, orange/amber glows lower-right.
const SUNSET_SPARKLES = [
  { left: '14%', bottom: 96, size: 6, color: 'var(--a-accent)', delay: '0.4s' },
  { left: '41%', bottom: 40, size: 5, color: '#fbbf24', delay: '1.5s' },
  { left: '72%', bottom: 120, size: 7, color: '#f97316', delay: '2.3s' },
  { left: '90%', bottom: 58, size: 5, color: '#fb923c', delay: '0.9s' },
];

export function SunsetGlow() {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 340, pointerEvents: 'none', overflow: 'hidden',
      WebkitMaskImage: 'linear-gradient(to top, #000 35%, transparent 100%)',
      maskImage: 'linear-gradient(to top, #000 35%, transparent 100%)',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: [
        'radial-gradient(38% 80% at 0% 105%, color-mix(in srgb, var(--a-accent) 34%, transparent) 0%, color-mix(in srgb, var(--a-pink) 14%, transparent) 45%, transparent 75%)',
        'radial-gradient(34% 70% at 74% 112%, rgba(249,115,22,0.34) 0%, rgba(251,146,60,0.14) 45%, transparent 75%)',
        'radial-gradient(10% 24% at 74% 100%, rgba(255,214,102,0.45) 0%, transparent 100%)',
        'radial-gradient(28% 60% at 100% 100%, color-mix(in srgb, var(--a-pink) 20%, transparent) 0%, transparent 75%)',
      ].join(', ') }} />
      <svg width="420" height="420" viewBox="0 0 420 420" style={{ position: 'absolute', left: -150, bottom: -180, filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.3))' }}>
        {[75, 125, 175].map((r, i) => (
          <circle key={r} cx="210" cy="210" r={r} fill="none" stroke="url(#as-bg-ring)" strokeOpacity={0.5 - i * 0.12} strokeWidth={i === 0 ? 2.5 : 1.75} />
        ))}
      </svg>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute', right: '18%', bottom: -120, filter: 'drop-shadow(0 0 5px rgba(249,115,22,0.35))' }}>
        {[45, 80].map((r, i) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#f97316" strokeOpacity={0.38 - i * 0.12} strokeWidth="1.75" />
        ))}
      </svg>
      {SUNSET_SPARKLES.map((d, i) => (
        <span key={i} className="as-sparkle" style={{ position: 'absolute', left: d.left, bottom: d.bottom, width: d.size, height: d.size, borderRadius: '50%', background: d.color, boxShadow: `0 0 10px 2px ${d.color}`, animationDelay: d.delay }} />
      ))}
    </div>
  );
}

// ── Banner art ───────────────────────────────────────────────────────────────
// The bright overview-banner decoration (same as the admin welcome banner):
// golden-orange sunrise between greeting and stats, accent glow on the right,
// one light sweep on mount, orange→accent rings and twinkling sparkles.
// Drop it as the first child of a position:relative + overflow:hidden banner.
const BANNER_SPARKLES = [
  { left: '38%', top: 18, size: 9, color: '#f97316', delay: '0s' },
  { left: '56%', top: 46, size: 6, color: 'var(--a-accent)', delay: '1.1s' },
  { left: '48%', bottom: 22, size: 7, color: '#fbbf24', delay: '2.2s' },
  { left: '63%', top: 14, size: 5, color: '#fb923c', delay: '0.6s' },
];

export function BannerArt({ ringId = 'as-banner-ring' }) {
  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: [
        'radial-gradient(14% 70% at 50% -5%, rgba(255,214,102,0.85) 0%, rgba(253,186,116,0.4) 55%, transparent 100%)',
        'radial-gradient(36% 160% at 50% -20%, rgba(249,115,22,0.88) 0%, rgba(251,146,60,0.48) 40%, rgba(253,186,116,0.15) 62%, transparent 76%)',
        'radial-gradient(44% 160% at 100% 0%, color-mix(in srgb, var(--a-accent) 52%, transparent) 0%, color-mix(in srgb, var(--a-pink) 26%, transparent) 45%, transparent 76%)',
        'radial-gradient(32% 130% at 68% 130%, rgba(251,191,36,0.45) 0%, transparent 70%)',
        'radial-gradient(28% 120% at 0% 120%, color-mix(in srgb, var(--a-pink) 30%, transparent) 0%, transparent 70%)',
      ].join(', ') }} />
      <div aria-hidden="true" className="as-hero-shine" />
      <svg aria-hidden="true" width="320" height="320" viewBox="0 0 320 320" style={{ position: 'absolute', right: -90, top: -120, pointerEvents: 'none', filter: 'drop-shadow(0 0 6px rgba(249,115,22,0.45))' }}>
        <defs>
          <linearGradient id={ringId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="var(--a-accent)" />
          </linearGradient>
        </defs>
        {[50, 90, 130].map((r, i) => (
          <circle key={r} cx="160" cy="160" r={r} fill="none" stroke={`url(#${ringId})`} strokeOpacity={0.8 - i * 0.16} strokeWidth={i === 0 ? 3 : 2} />
        ))}
      </svg>
      <svg aria-hidden="true" width="140" height="140" viewBox="0 0 140 140" style={{ position: 'absolute', left: '44%', bottom: -70, pointerEvents: 'none', filter: 'drop-shadow(0 0 5px rgba(249,115,22,0.5))' }}>
        {[30, 55].map((r, i) => (
          <circle key={r} cx="70" cy="70" r={r} fill="none" stroke="#f97316" strokeOpacity={0.65 - i * 0.18} strokeWidth="2" />
        ))}
      </svg>
      {BANNER_SPARKLES.map((d, i) => (
        <span key={i} aria-hidden="true" className="as-sparkle" style={{ position: 'absolute', left: d.left, top: d.top, bottom: d.bottom, width: d.size, height: d.size, borderRadius: '50%', background: d.color, boxShadow: `0 0 10px 2px ${d.color}`, animationDelay: d.delay }} />
      ))}
    </>
  );
}
