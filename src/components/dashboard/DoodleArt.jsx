// src/components/dashboard/DoodleArt.jsx
// The student Sunshine dashboard's own artwork: little sticker-style pictures a child
// might stick on their screen — rocket, pencil, smiley, star, heart, book, light bulb,
// paper plane, cloud, sparkles, ABC blocks, globe, backpack, a "Hi!" bubble and an owl. Flat filled shapes (no outlines / line
// strokes), instead of the gradient rings the admin / sub-admin / teacher shells use.
// Same three pieces as SunriseArt.jsx so the shells stay interchangeable:
//   <DoodleBackdrop />   behind the top of every page (first child of the scrolling <main>)
//   <DoodleSunset />     pinned to the bottom of the visible page (in the main column)
//   <DoodleBannerArt />  inside the welcome banner (position:relative + overflow:hidden)
// Each sticker pops in once (.as-sticker in index.css); reduced motion just shows it.
import React from 'react';

const C = {
  orange: '#f97316', amber: '#fbbf24', gold: '#f59e0b', sky: '#0ea5e9', skyLight: '#7dd3fc',
  skyDeep: '#0369a1', teal: '#14b8a6', coral: '#fb7185', green: '#22c55e', cream: '#fde3b0',
  paper: '#ffffff', cloud: '#e0f2fe', ink: '#44403c', brown: '#78350f',
};

// Each sticker is drawn in a 64×64 box with filled shapes only.
const STICKERS = {
  rocket: (
    <>
      <path d="M26 46 C 26 54, 32 61, 32 61 C 32 61, 38 54, 38 46 Z" fill={C.amber} />
      <path d="M29 46 C 29 51, 32 56, 32 56 C 32 56, 35 51, 35 46 Z" fill={C.orange} />
      <path d="M23 33 L 13 47 L 24 46 Z" fill={C.coral} />
      <path d="M41 33 L 51 47 L 40 46 Z" fill={C.coral} />
      <path d="M32 3 C 45 13, 47 32, 41 47 L 23 47 C 17 32, 19 13, 32 3 Z" fill={C.sky} />
      <path d="M32 3 C 38 8, 42 14, 43 21 L 21 21 C 22 14, 26 8, 32 3 Z" fill={C.coral} />
      <circle cx="32" cy="29" r="6.5" fill={C.paper} />
      <circle cx="32" cy="29" r="3.8" fill={C.skyDeep} />
    </>
  ),
  pencil: (
    <g transform="translate(0 20)">
      <rect x="2" y="6" width="11" height="13" rx="4" fill={C.coral} />
      <rect x="12" y="6" width="6" height="13" fill="#a8a29e" />
      <rect x="18" y="6" width="32" height="13" fill={C.amber} />
      <rect x="18" y="10.5" width="32" height="4" fill={C.gold} />
      <path d="M50 6 L 62 12.5 L 50 19 Z" fill={C.cream} />
      <path d="M57.5 10 L 62 12.5 L 57.5 15 Z" fill={C.ink} />
    </g>
  ),
  smiley: (
    <>
      <circle cx="32" cy="32" r="24" fill={C.amber} />
      <ellipse cx="24" cy="27" rx="3" ry="4.2" fill={C.brown} />
      <ellipse cx="40" cy="27" rx="3" ry="4.2" fill={C.brown} />
      <path d="M19 36 Q 32 50, 45 36 Q 32 43, 19 36 Z" fill={C.brown} />
      <circle cx="17" cy="36" r="4" fill={C.coral} opacity="0.55" />
      <circle cx="47" cy="36" r="4" fill={C.coral} opacity="0.55" />
    </>
  ),
  star: (
    <>
      <path d="M32 5 L 39.5 22.5 L 58 24 L 44 36.5 L 48.5 55 L 32 45 L 15.5 55 L 20 36.5 L 6 24 L 24.5 22.5 Z" fill={C.amber} />
      <path d="M32 12 L 36 22 L 28 22 Z" fill="#fde68a" />
    </>
  ),
  heart: (
    <>
      <path d="M32 55 C 9 40, 3 25, 11 15 C 19 5, 29 9, 32 18 C 35 9, 45 5, 53 15 C 61 25, 55 40, 32 55 Z" fill={C.coral} />
      <ellipse cx="20" cy="21" rx="5" ry="3.2" fill="#fff" opacity="0.7" transform="rotate(-35 20 21)" />
    </>
  ),
  book: (
    <>
      <path d="M4 14 L 32 19 L 60 14 L 60 52 L 32 57 L 4 52 Z" fill={C.teal} />
      <path d="M8 16 L 31 21 L 31 52 L 8 48 Z" fill={C.paper} />
      <path d="M56 16 L 33 21 L 33 52 L 56 48 Z" fill={C.paper} />
      <rect x="12" y="26" width="14" height="2.6" rx="1.3" fill={C.cloud} />
      <rect x="12" y="32" width="12" height="2.6" rx="1.3" fill={C.cloud} />
      <rect x="38" y="26" width="14" height="2.6" rx="1.3" fill={C.cloud} />
      <rect x="38" y="32" width="10" height="2.6" rx="1.3" fill={C.cloud} />
    </>
  ),
  bulb: (
    <>
      <rect x="30" y="2" width="4" height="8" rx="2" fill={C.orange} />
      <rect x="6" y="20" width="8" height="4" rx="2" fill={C.orange} />
      <rect x="50" y="20" width="8" height="4" rx="2" fill={C.orange} />
      <rect x="11" y="6" width="4" height="8" rx="2" fill={C.orange} transform="rotate(-45 13 10)" />
      <rect x="49" y="6" width="4" height="8" rx="2" fill={C.orange} transform="rotate(45 51 10)" />
      <path d="M32 12 C 44 12, 50 21, 48 31 C 46 38, 40 41, 40 47 L 24 47 C 24 41, 18 38, 16 31 C 14 21, 20 12, 32 12 Z" fill={C.amber} />
      <rect x="24" y="47" width="16" height="5" rx="1.5" fill="#a8a29e" />
      <rect x="25" y="52" width="14" height="5" rx="2.5" fill="#78716c" />
      <ellipse cx="26" cy="24" rx="4" ry="6" fill="#fef3c7" opacity="0.85" />
    </>
  ),
  plane: (
    <>
      <path d="M4 30 L 60 8 L 44 54 L 32 38 Z" fill={C.skyLight} />
      <path d="M32 38 L 60 8 L 26 48 Z" fill={C.sky} />
      <path d="M32 38 L 26 48 L 28 36 Z" fill={C.skyDeep} />
    </>
  ),
  cloud: (
    <>
      <circle cx="22" cy="36" r="12" fill={C.cloud} />
      <circle cx="36" cy="28" r="15" fill={C.cloud} />
      <circle cx="48" cy="38" r="10" fill={C.cloud} />
      <rect x="14" y="36" width="40" height="12" rx="6" fill={C.cloud} />
    </>
  ),
  sparkle: (
    <path d="M32 4 C 34 22, 42 30, 60 32 C 42 34, 34 42, 32 60 C 30 42, 22 34, 4 32 C 22 30, 30 22, 32 4 Z" fill={C.amber} />
  ),
  sparklePink: (
    <path d="M32 4 C 34 22, 42 30, 60 32 C 42 34, 34 42, 32 60 C 30 42, 22 34, 4 32 C 22 30, 30 22, 32 4 Z" fill={C.coral} />
  ),
  blockA: (
    <>
      <rect x="6" y="6" width="52" height="52" rx="12" fill={C.coral} />
      <rect x="6" y="6" width="52" height="10" rx="6" fill="#fff" opacity="0.25" />
      <text x="32" y="45" textAnchor="middle" fontFamily="Nunito, Inter, sans-serif" fontWeight="900" fontSize="34" fill="#fff">A</text>
    </>
  ),
  blockB: (
    <>
      <rect x="6" y="6" width="52" height="52" rx="12" fill={C.sky} />
      <rect x="6" y="6" width="52" height="10" rx="6" fill="#fff" opacity="0.25" />
      <text x="32" y="45" textAnchor="middle" fontFamily="Nunito, Inter, sans-serif" fontWeight="900" fontSize="34" fill="#fff">B</text>
    </>
  ),
  blockC: (
    <>
      <rect x="6" y="6" width="52" height="52" rx="12" fill={C.green} />
      <rect x="6" y="6" width="52" height="10" rx="6" fill="#fff" opacity="0.25" />
      <text x="32" y="45" textAnchor="middle" fontFamily="Nunito, Inter, sans-serif" fontWeight="900" fontSize="34" fill="#fff">C</text>
    </>
  ),
  globe: (
    <>
      <rect x="30" y="48" width="4" height="6" fill={C.orange} />
      <rect x="22" y="53" width="20" height="5" rx="2.5" fill={C.orange} />
      <circle cx="32" cy="28" r="21" fill={C.sky} />
      <path d="M17 19 C 21 12, 30 12, 30 19 C 30 25, 22 23, 20 30 C 16 28, 14 23, 17 19 Z" fill={C.green} />
      <path d="M36 31 C 42 28, 49 32, 47 39 C 45 44, 38 44, 36 39 Z" fill={C.green} />
      <path d="M34 11 C 38 10, 43 13, 41 17 C 38 18, 34 16, 34 11 Z" fill={C.green} />
      <ellipse cx="24" cy="16" rx="5" ry="3" fill="#fff" opacity="0.45" transform="rotate(-30 24 16)" />
    </>
  ),
  backpack: (
    <>
      <path d="M24 12 C 24 4, 40 4, 40 12 L 36 12 C 36 8, 28 8, 28 12 Z" fill="#b45309" />
      <rect x="12" y="11" width="40" height="47" rx="13" fill={C.coral} />
      <path d="M12 24 C 12 15, 52 15, 52 24 L 52 28 L 12 28 Z" fill="#e11d48" />
      <rect x="19" y="35" width="26" height="17" rx="6" fill={C.amber} />
      <rect x="29" y="32" width="6" height="7" rx="2" fill="#fff" />
    </>
  ),
  speech: (
    <>
      <path d="M9 9 H55 Q60 9 60 14 V39 Q60 44 55 44 H27 L14 57 L17 44 H9 Q4 44 4 39 V14 Q4 9 9 9 Z" fill={C.teal} />
      <text x="32" y="34" textAnchor="middle" fontFamily="Nunito, Inter, sans-serif" fontWeight="900" fontSize="21" fill="#fff">Hi!</text>
    </>
  ),
  owl: (
    <>
      <path d="M16 15 L 18 2 L 27 10 Z" fill="#b45309" />
      <path d="M48 15 L 46 2 L 37 10 Z" fill="#b45309" />
      <path d="M14 27 C 14 13, 22 7, 32 7 C 42 7, 50 13, 50 27 L 50 46 C 50 54, 42 58, 32 58 C 22 58, 14 54, 14 46 Z" fill="#d97706" />
      <ellipse cx="14.5" cy="41" rx="4.5" ry="11" fill="#b45309" />
      <ellipse cx="49.5" cy="41" rx="4.5" ry="11" fill="#b45309" />
      <ellipse cx="32" cy="43" rx="12" ry="12" fill={C.cream} />
      <circle cx="24" cy="25" r="8.5" fill="#fff" />
      <circle cx="40" cy="25" r="8.5" fill="#fff" />
      <circle cx="25" cy="26" r="4.4" fill={C.ink} />
      <circle cx="39" cy="26" r="4.4" fill={C.ink} />
      <circle cx="26.5" cy="24.5" r="1.5" fill="#fff" />
      <circle cx="40.5" cy="24.5" r="1.5" fill="#fff" />
      <path d="M29 32 L 35 32 L 32 38 Z" fill={C.orange} />
      <ellipse cx="26" cy="58" rx="4" ry="2.2" fill={C.orange} />
      <ellipse cx="38" cy="58" rx="4" ry="2.2" fill={C.orange} />
    </>
  ),
  // Three stacked books (pink / sky / amber) with a bookmark — "classes remaining"
  bookStack: (
    <>
      <rect x="8" y="44" width="48" height="12" rx="3" fill={C.amber} />
      <rect x="11" y="47" width="40" height="2.4" rx="1.2" fill="#fde68a" />
      <rect x="52" y="44" width="4" height="12" fill={C.gold} />
      <rect x="12" y="31" width="42" height="12" rx="3" fill={C.sky} transform="rotate(-4 33 37)" />
      <rect x="15" y="34" width="34" height="2.4" rx="1.2" fill={C.skyLight} transform="rotate(-4 33 37)" />
      <rect x="10" y="18" width="44" height="12" rx="3" fill="#ec4899" transform="rotate(3 32 24)" />
      <rect x="13" y="21" width="36" height="2.4" rx="1.2" fill="#f9a8d4" transform="rotate(3 32 24)" />
      <path d="M40 15 L 46 15 L 46 29 L 43 26 L 40 29 Z" fill={C.coral} />
      <path d="M23 8 L 25 12.5 L 29.5 13 L 26 16 L 27 20.5 L 23 18 L 19 20.5 L 20 16 L 16.5 13 L 21 12.5 Z" fill="#fde68a" />
    </>
  ),
  // Layered flame (red-orange → orange → amber → yellow core) — "streak"
  flame: (
    <>
      <path d="M32 3 C 36 13, 50 20, 50 38 C 50 51, 42 60, 32 60 C 22 60, 14 51, 14 38 C 14 29, 19 23, 23 18 C 24 25, 27 28, 30 28 C 28 20, 29 10, 32 3 Z" fill="#ef4444" />
      <path d="M33 16 C 36 24, 45 29, 45 41 C 45 51, 39 57, 32 57 C 25 57, 19 51, 19 42 C 19 36, 22 32, 25 29 C 26 34, 28 36, 31 36 C 30 29, 31 22, 33 16 Z" fill={C.orange} />
      <path d="M32 31 C 35 37, 40 40, 40 47 C 40 53, 36 56, 32 56 C 28 56, 24 53, 24 47 C 24 43, 26 40, 28 38 C 29 41, 31 42, 32 42 C 31 38, 31 34, 32 31 Z" fill={C.amber} />
      <ellipse cx="32" cy="50" rx="4.5" ry="5.5" fill="#fef3c7" />
      <ellipse cx="22" cy="40" rx="2.6" ry="5" fill="#fff" opacity="0.35" transform="rotate(20 22 40)" />
    </>
  ),
};

// Inline sticker for use inside cards / tiles (not absolutely positioned, no pop-in).
export function StickerIcon({ name, size = 40, style }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" width={size} height={size}
      style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 3px 4px rgba(90, 45, 15, 0.18))', ...style }}>
      {STICKERS[name]}
    </svg>
  );
}

// One sticker. `size` in px; `rotate` tilts it; `delay` staggers the pop-in.
export function Sticker({ name, size, style, rotate = 0, delay = 0, opacity = 1 }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" width={size} height={size} className="as-sticker"
      style={{ position: 'absolute', pointerEvents: 'none', overflow: 'visible', opacity, animationDelay: `${delay}s`, ...style }}>
      <g transform={`rotate(${rotate} 32 32)`}>{STICKERS[name]}</g>
    </svg>
  );
}

const fade = (dir) => ({
  WebkitMaskImage: `linear-gradient(to ${dir}, #000 45%, transparent 100%)`,
  maskImage: `linear-gradient(to ${dir}, #000 45%, transparent 100%)`,
});

// ── Backdrop: soft warm glow + stickers around the top of the page ────────────
export function DoodleBackdrop() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 560, pointerEvents: 'none', overflow: 'hidden', ...fade('bottom') }}>
      <div style={{ position: 'absolute', inset: 0, background: [
        'radial-gradient(10% 22% at 52% 0%, rgba(255,214,102,0.45) 0%, transparent 100%)',
        'radial-gradient(34% 62% at 52% -8%, rgba(249,115,22,0.30) 0%, rgba(251,146,60,0.12) 45%, transparent 75%)',
        'radial-gradient(40% 72% at 100% -5%, color-mix(in srgb, var(--a-accent) 26%, transparent) 0%, transparent 75%)',
        'radial-gradient(26% 52% at 0% 0%, rgba(14,165,233,0.10) 0%, transparent 75%)',
      ].join(', ') }} />
      <Sticker name="plane"       size={55} style={{ right: 36, top: 14 }}  rotate={-8}  delay={0.10} opacity={0.85} />
      <Sticker name="cloud"       size={70} style={{ right: 120, top: 4 }}  delay={0.25} opacity={0.9} />
      <Sticker name="star"        size={36} style={{ right: 230, top: 30 }} rotate={14}  delay={0.40} opacity={0.9} />
      <Sticker name="sparkle"     size={22} style={{ right: 300, top: 12 }} delay={0.55} />
      <Sticker name="bulb"        size={48} style={{ left: '30%', top: 6 }} rotate={-10} delay={0.35} opacity={0.75} />
      <Sticker name="sparklePink" size={19} style={{ left: '24%', top: 44 }} delay={0.70} />
      <Sticker name="book"        size={48} style={{ left: 18, top: 12 }}   rotate={8}   delay={0.20} opacity={0.75} />
      <Sticker name="globe"       size={50} style={{ left: '46%', top: 12 }} rotate={-6}  delay={0.45} opacity={0.8} />
      <Sticker name="backpack"    size={44} style={{ right: 360, top: 16 }} rotate={10}  delay={0.60} opacity={0.8} />
    </div>
  );
}

// ── Sunset: stickers pinned to the bottom of the visible page ────────────────
export function DoodleSunset() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300, pointerEvents: 'none', overflow: 'hidden', ...fade('top') }}>
      <div style={{ position: 'absolute', inset: 0, background: [
        'radial-gradient(38% 80% at 0% 105%, color-mix(in srgb, var(--a-accent) 24%, transparent) 0%, transparent 75%)',
        'radial-gradient(34% 70% at 74% 112%, rgba(249,115,22,0.26) 0%, rgba(251,146,60,0.10) 45%, transparent 75%)',
        'radial-gradient(10% 24% at 74% 100%, rgba(255,214,102,0.38) 0%, transparent 100%)',
      ].join(', ') }} />
      <Sticker name="blockA"      size={50} style={{ left: 30, bottom: 22 }}    rotate={-10} delay={0.20} />
      <Sticker name="blockB"      size={43} style={{ left: 74, bottom: 40 }}    rotate={8}   delay={0.32} />
      <Sticker name="blockC"      size={38} style={{ left: 112, bottom: 18 }}   rotate={-4}  delay={0.44} />
      <Sticker name="heart"       size={38} style={{ left: '40%', bottom: 26 }} rotate={-12} delay={0.55} opacity={0.9} />
      <Sticker name="pencil"      size={73} style={{ right: '22%', bottom: 18 }} rotate={-18} delay={0.30} />
      <Sticker name="smiley"      size={53} style={{ right: 40, bottom: 28 }}   rotate={6}   delay={0.45} />
      <Sticker name="sparkle"     size={20} style={{ right: 100, bottom: 96 }}  delay={0.70} />
      <Sticker name="globe"       size={46} style={{ left: '58%', bottom: 16 }} rotate={8}   delay={0.60} opacity={0.9} />
    </div>
  );
}

// ── Banner: bright sunrise glow + bigger stickers (welcome card) ─────────────
export function DoodleBannerArt() {
  return (
    <>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: [
        'radial-gradient(14% 70% at 50% -5%, rgba(255,214,102,0.85) 0%, rgba(253,186,116,0.4) 55%, transparent 100%)',
        'radial-gradient(36% 160% at 50% -20%, rgba(249,115,22,0.82) 0%, rgba(251,146,60,0.44) 40%, rgba(253,186,116,0.14) 62%, transparent 76%)',
        'radial-gradient(44% 160% at 100% 0%, color-mix(in srgb, var(--a-accent) 46%, transparent) 0%, transparent 76%)',
        'radial-gradient(32% 130% at 68% 130%, rgba(251,191,36,0.42) 0%, transparent 70%)',
        'radial-gradient(28% 120% at 0% 120%, rgba(14,165,233,0.16) 0%, transparent 70%)',
      ].join(', ') }} />
      <div aria-hidden="true" className="as-hero-shine" />
      <Sticker name="rocket"      size={86} style={{ left: '47%', top: 10 }}    rotate={18}  delay={0.15} />
      <Sticker name="star"        size={46} style={{ left: '41%', top: 14 }}    rotate={-12} delay={0.30} />
      <Sticker name="sparkle"     size={24} style={{ left: '56%', bottom: 18 }} delay={0.45} />
      <Sticker name="owl"         size={66} style={{ right: 196, top: 8 }}      rotate={-6}  delay={0.40} />
      <Sticker name="speech"      size={44} style={{ right: 262, top: 4 }}      rotate={-8}  delay={0.62} />
      <Sticker name="pencil"      size={81} style={{ right: 170, bottom: -4 }}  rotate={-16} delay={0.55} />
      <Sticker name="heart"       size={35} style={{ left: '38%', bottom: 14 }} rotate={14}  delay={0.65} />
      <Sticker name="sparklePink" size={19} style={{ right: 260, bottom: 22 }}  delay={0.80} />
    </>
  );
}
