// src/pages/homework-link/HeroScene.jsx
// Original, hand-drawn SVG characters for the kids' homework link page.
// (Not based on any real comic character.) Purely decorative: aria-hidden.
import { HERO } from "./heroTheme";

const INK = HERO.ink;

// Keyframes + reduced-motion guard. Class names are prefixed "hl-" to stay scoped.
export const HERO_CSS = `
@keyframes hl-fly-right { from { transform: translateX(-220px); } to { transform: translateX(calc(100vw + 220px)); } }
@keyframes hl-fly-left  { from { transform: translateX(calc(100vw + 220px)) scaleX(-1); } to { transform: translateX(-220px) scaleX(-1); } }
@keyframes hl-bob       { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-14px) rotate(2deg); } }
@keyframes hl-cape      { from { transform: scaleY(1) skewX(0deg); } to { transform: scaleY(0.82) skewX(-8deg); } }
@keyframes hl-speed     { 0%,100% { opacity: .2; transform: translateX(0); } 50% { opacity: .9; transform: translateX(-6px); } }
@keyframes hl-drift     { from { transform: translateX(-30vw); } to { transform: translateX(110vw); } }
@keyframes hl-spin      { to { transform: rotate(360deg); } }
@keyframes hl-twinkle   { 0%,100% { transform: scale(.4); opacity: .3; } 50% { transform: scale(1); opacity: 1; } }
@keyframes hl-bounce    { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-10px) rotate(6deg); } }
@keyframes hl-pop       { 0% { transform: scale(0) rotate(-20deg); } 70% { transform: scale(1.12) rotate(4deg); } 100% { transform: scale(1) rotate(-4deg); } }
@keyframes hl-confetti  { 0% { transform: translateY(-20px) rotate(0); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: .9; } }
@keyframes hl-rise      { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .hl-anim, .hl-anim * { animation: none !important; }
  .hl-hide-reduced { display: none !important; }
}
`;

// ── Flying hero ───────────────────────────────────────────────────────────────
const VARIANTS = {
  red:   { suit: HERO.blue,  suitDark: "#1F5FCC", cape: HERO.red,  mask: HERO.red,  hair: "#3B2A20", skin: "#FFD3B0", ponytail: false },
  green: { suit: HERO.green, suitDark: "#1FA873", cape: HERO.sunDeep, mask: HERO.blue, hair: "#1B1B2F", skin: "#F2C29B", ponytail: true },
};

export function FlyingHero({ variant = "red", size = 150 }) {
  const v = VARIANTS[variant];
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 140 84" aria-hidden="true" style={{ overflow: "visible" }}>
      {/* speed lines */}
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round" className="hl-anim" style={{ animation: "hl-speed .5s ease-in-out infinite" }}>
        <line x1="-18" y1="30" x2="2" y2="30" />
        <line x1="-26" y1="40" x2="0" y2="40" />
        <line x1="-16" y1="50" x2="4" y2="50" />
      </g>
      {/* legs + boots */}
      <rect x="22" y="33" width="36" height="13" rx="6.5" fill={v.suitDark} stroke={INK} strokeWidth="2.5" />
      <rect x="12" y="31" width="16" height="17" rx="7" fill={HERO.red} stroke={INK} strokeWidth="2.5" />
      {/* cape */}
      <g className="hl-anim" style={{ transformOrigin: "64px 32px", animation: "hl-cape .45s ease-in-out infinite alternate" }}>
        <path d="M66 28 C50 18, 26 16, 4 26 C14 31, 10 38, 2 45 C20 45, 40 47, 64 42 Z" fill={v.cape} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      {/* torso */}
      <rect x="52" y="26" width="42" height="21" rx="10.5" fill={v.suit} stroke={INK} strokeWidth="2.5" />
      <rect x="54" y="39" width="38" height="5" rx="2.5" fill={HERO.sun} stroke={INK} strokeWidth="1.5" />
      {/* chest star */}
      <path d="M72 29.5 l1.9 3.9 4.3.6 -3.1 3 .7 4.3 -3.8-2 -3.8 2 .7-4.3 -3.1-3 4.3-.6z" fill={HERO.sun} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
      {/* arm + fist */}
      <rect x="88" y="23" width="28" height="10" rx="5" fill={v.suit} stroke={INK} strokeWidth="2.5" />
      <circle cx="118" cy="28" r="6.5" fill={v.skin} stroke={INK} strokeWidth="2.5" />
      {/* head */}
      {v.ponytail && <path d="M86 12 C76 8, 70 14, 72 22 C78 18, 82 18, 88 20 Z" fill={v.hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />}
      <circle cx="99" cy="17" r="13.5" fill={v.skin} stroke={INK} strokeWidth="2.5" />
      <path d="M86 15 C86 3, 106 -1, 112 9 C104 7, 96 9, 90 18 Z" fill={v.hair} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      {/* mask + ribbon */}
      <path d="M91 14 L81 9 L83 17 Z" fill={v.mask} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="90" y="11" width="22" height="9" rx="4.5" fill={v.mask} stroke={INK} strokeWidth="2" />
      <ellipse cx="98" cy="15.5" rx="2.6" ry="2.4" fill="#fff" />
      <ellipse cx="106" cy="15.5" rx="2.6" ry="2.4" fill="#fff" />
      <circle cx="98.9" cy="15.7" r="1.3" fill={INK} />
      <circle cx="106.9" cy="15.7" r="1.3" fill={INK} />
      {/* smile + cheek */}
      <path d="M100 23 Q104.5 27 109 22" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="96" cy="22.5" r="2.2" fill="#FF8FA3" opacity=".6" />
    </svg>
  );
}

// ── Star sidekick ─────────────────────────────────────────────────────────────
export function StarBuddy({ size = 64, mood = "happy", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={style}>
      <path d="M32 3 l8.2 17 18.6 2.6 -13.5 13 3.3 18.5 -16.6-8.9 -16.6 8.9 3.3-18.5 -13.5-13 18.6-2.6z"
        fill={HERO.sun} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="26" cy="30" r="2.6" fill={INK} />
      <circle cx="38" cy="30" r="2.6" fill={INK} />
      {mood === "happy"
        ? <path d="M26 37 Q32 43 38 37" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        : <path d="M26 41 Q32 36 38 41" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />}
      <circle cx="22" cy="35" r="2.4" fill="#FF8FA3" opacity=".7" />
      <circle cx="42" cy="35" r="2.4" fill="#FF8FA3" opacity=".7" />
    </svg>
  );
}

// ── Scenery ───────────────────────────────────────────────────────────────────
function Cloud({ width = 140, opacity = 0.95 }) {
  return (
    <svg width={width} height={width * 0.5} viewBox="0 0 120 60" aria-hidden="true" style={{ opacity }}>
      <g fill={HERO.cloud}>
        <circle cx="30" cy="38" r="18" /><circle cx="55" cy="28" r="24" />
        <circle cx="82" cy="36" r="19" /><rect x="22" y="36" width="72" height="20" rx="10" />
      </g>
    </svg>
  );
}

function Sparkle({ size = 18, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 0 C11 7, 13 9, 20 10 C13 11, 11 13, 10 20 C9 13, 7 11, 0 10 C7 9, 9 7, 10 0 Z" fill={color} />
    </svg>
  );
}

function Sun() {
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
      <g className="hl-anim" style={{ transformOrigin: "65px 65px", animation: "hl-spin 40s linear infinite" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x="61" y="4" width="8" height="20" rx="4" fill={HERO.sun} transform={`rotate(${i * 30} 65 65)`} />
        ))}
      </g>
      <circle cx="65" cy="65" r="34" fill={HERO.sun} stroke={HERO.sunDeep} strokeWidth="4" />
    </svg>
  );
}

/** Full-page animated sky behind the content. */
export function HeroSky() {
  const layer = { position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 };
  const abs = (s) => ({ position: "absolute", ...s });
  return (
    <div aria-hidden="true" className="hl-anim" style={{ ...layer, background: `linear-gradient(180deg, ${HERO.skyTop} 0%, ${HERO.skyBottom} 70%, #E9F8FF 100%)` }}>
      <div style={abs({ top: -30, right: -30 })}><Sun /></div>

      {/* drifting clouds */}
      <div style={abs({ top: "12%", left: 0, animation: "hl-drift 70s linear infinite", animationDelay: "-20s" })}><Cloud width={160} /></div>
      <div style={abs({ top: "38%", left: 0, animation: "hl-drift 95s linear infinite", animationDelay: "-60s" })}><Cloud width={120} opacity={0.8} /></div>
      <div style={abs({ top: "68%", left: 0, animation: "hl-drift 80s linear infinite", animationDelay: "-5s" })}><Cloud width={190} opacity={0.9} /></div>

      {/* twinkles */}
      {[["8%", "18%", 0], ["22%", "82%", 0.8], ["55%", "6%", 1.6], ["80%", "88%", 0.4], ["46%", "92%", 1.2]].map(([top, left, d], i) => (
        <div key={i} style={abs({ top, left, animation: `hl-twinkle 2.4s ease-in-out ${d}s infinite` })}><Sparkle /></div>
      ))}

      {/* flying heroes */}
      <div className="hl-hide-reduced" style={abs({ top: "18%", left: 0, animation: "hl-fly-right 16s linear infinite", animationDelay: "-3s" })}>
        <div style={{ animation: "hl-bob 1.6s ease-in-out infinite" }}><FlyingHero variant="red" size={150} /></div>
      </div>
      <div className="hl-hide-reduced" style={abs({ top: "74%", left: 0, animation: "hl-fly-left 22s linear infinite", animationDelay: "-12s" })}>
        <div style={{ animation: "hl-bob 1.9s ease-in-out infinite" }}><FlyingHero variant="green" size={120} /></div>
      </div>
    </div>
  );
}

// ── Celebration (after submitting) ────────────────────────────────────────────
const CONFETTI_COLORS = [HERO.red, HERO.sun, HERO.blue, HERO.green, "#fff"];

export function Celebration() {
  return (
    <div aria-hidden="true" className="hl-anim hl-hide-reduced" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" }}>
      {Array.from({ length: 42 }).map((_, i) => (
        <span key={i} style={{
          position: "absolute", top: -20, left: `${(i * 97) % 100}%`,
          width: 8 + (i % 3) * 3, height: 12 + (i % 4) * 3, borderRadius: i % 2 ? 2 : 6,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], border: `1.5px solid ${INK}`,
          animation: `hl-confetti ${2.4 + (i % 5) * 0.35}s cubic-bezier(.2,.6,.4,1) ${(i % 7) * 0.12}s forwards`,
        }} />
      ))}
    </div>
  );
}

/** Comic-book "POW" burst with two short lines of text inside. */
export function PowBurst({ lines = ["MISSION", "DONE!"], size = 190 }) {
  const pts = Array.from({ length: 24 }).map((_, i) => {
    const r = i % 2 ? 62 : 92, a = (Math.PI * 2 * i) / 24;
    return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`;
  }).join(" ");
  const textStyle = { paintOrder: "stroke", fontFamily: "Mali, 'Comic Sans MS', sans-serif", fontWeight: 700 };
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className="hl-anim" style={{ animation: "hl-pop .6s cubic-bezier(.2,1.4,.4,1) both" }} role="img" aria-label={lines.join(" ")}>
      <polygon points={pts} fill={HERO.sun} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <polygon points={pts} fill={HERO.red} transform="translate(100 100) scale(.7) translate(-100 -100)" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {lines.map((line, i) => (
        <text key={i} x="100" y={lines.length === 1 ? 108 : 94 + i * 26} textAnchor="middle" fontSize={line.length > 7 ? 19 : 23}
          fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" style={textStyle}>
          {line}
        </text>
      ))}
    </svg>
  );
}
