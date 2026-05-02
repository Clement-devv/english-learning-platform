// AvatarPuppet.jsx — Pure CSS/SVG robot avatar, zero GPU
// Drop-in replacement for AvatarHead3D (same props: isSpeaking, isDarkMode)
import { useState, useEffect, useRef } from "react";

// ── Keyframe definitions injected once ──────────────────────────────────────
const CSS = `
  @keyframes ap-bob      { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-10px)} }
  @keyframes ap-pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.35)} }
  @keyframes ap-blink    { 0%,89%,100%{transform:scaleY(1)} 92%{transform:scaleY(0.06)} }
  @keyframes ap-shine    { 0%,80%,100%{opacity:.7} 90%{opacity:1;transform:scale(1.15)} }
  @keyframes ap-bar1     { 0%,100%{height:4px}  50%{height:14px} }
  @keyframes ap-bar2     { 0%,100%{height:8px}  50%{height:18px} }
  @keyframes ap-bar3     { 0%,100%{height:12px} 50%{height:6px}  }
  @keyframes ap-bar4     { 0%,100%{height:6px}  50%{height:16px} }
  @keyframes ap-bar5     { 0%,100%{height:4px}  50%{height:10px} }
  @keyframes ap-float    { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-8px) rotate(12deg)} }
  @keyframes ap-ripple   { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.2);opacity:0} }
  @keyframes ap-ear-glow { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 10px 3px var(--mood)} }
`;

// ── Floating emoji particles when speaking ───────────────────────────────────
const FLOATS = ["✨","🌟","💬","🎵","⭐","💡"];

function FloatParticle({ emoji, delay, left }) {
  return (
    <div style={{
      position: "absolute", top: "20%", left: `${left}%`,
      fontSize: 14, userSelect: "none", pointerEvents: "none",
      animation: `ap-float ${1.8 + delay}s ease-in-out ${delay}s infinite`,
      opacity: 0.85,
    }}>{emoji}</div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AvatarPuppet({ isSpeaking = false, isDarkMode = false }) {
  const [blinking, setBlinking] = useState(false);
  const timerRef  = useRef(null);

  // Randomised blink every 2–5 s
  useEffect(() => {
    const schedule = () => {
      timerRef.current = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => { setBlinking(false); schedule(); }, 130);
      }, 2000 + Math.random() * 3000);
    };
    schedule();
    return () => clearTimeout(timerRef.current);
  }, []);

  // Colour palette: indigo while listening, emerald while speaking
  const mood    = isSpeaking ? "#10b981" : "#6366f1";
  const moodDim = isSpeaking ? "#065f46" : "#3730a3";

  const head = {
    bg:     isDarkMode ? "#1e293b" : "#f1f5f9",
    panel:  isDarkMode ? "#0f172a" : "#e2e8f0",
    border: isDarkMode ? "#334155" : "#cbd5e1",
    text:   isDarkMode ? "#94a3b8" : "#64748b",
  };

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      "--mood": mood,
    }}>
      <style>{CSS}</style>

      {/* Floating particles while speaking */}
      {isSpeaking && FLOATS.map((e, i) => (
        <FloatParticle key={i} emoji={e} delay={i * 0.3} left={10 + i * 14} />
      ))}

      {/* Speaking ripple rings */}
      {isSpeaking && [0, 0.4, 0.8].map(d => (
        <div key={d} style={{
          position: "absolute",
          width: 160, height: 160,
          borderRadius: "50%",
          border: `2px solid ${mood}`,
          animation: `ap-ripple 1.6s ease-out ${d}s infinite`,
          pointerEvents: "none",
        }} />
      ))}

      {/* ── Robot ── */}
      <div style={{ animation: "ap-bob 3.2s ease-in-out infinite", display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Antenna */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1 }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%",
            background: mood,
            boxShadow: `0 0 12px 4px ${mood}80`,
            animation: "ap-pulse 1.1s ease-in-out infinite",
            transition: "background .4s, box-shadow .4s",
          }} />
          <div style={{ width: 4, height: 18, background: head.border, borderRadius: 2 }} />
        </div>

        {/* Head */}
        <div style={{
          width: 148, height: 126, borderRadius: 32,
          background: head.bg,
          border: `3px solid ${mood}`,
          boxShadow: `0 6px 32px ${mood}30`,
          transition: "border-color .4s, box-shadow .4s",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 14, position: "relative",
        }}>

          {/* Side ears */}
          {[-1, 1].map(side => (
            <div key={side} style={{
              position: "absolute",
              [side === -1 ? "left" : "right"]: -13,
              top: "50%", transform: "translateY(-50%)",
              width: 13, height: 36,
              background: head.panel,
              border: `3px solid ${head.border}`,
              borderRadius: side === -1 ? "6px 0 0 6px" : "0 6px 6px 0",
              animation: "ap-ear-glow 2s ease-in-out infinite",
            }} />
          ))}

          {/* Eyes */}
          <div style={{ display: "flex", gap: 22 }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: "50%",
                background: mood,
                boxShadow: `0 0 8px ${mood}80`,
                transition: "background .4s",
                overflow: "hidden", position: "relative",
                animation: "ap-blink 4s ease-in-out infinite",
                animationDelay: `${i * 0.08}s`,
                transform: blinking ? "scaleY(0.06)" : "scaleY(1)",
                transitionProperty: "transform, background",
              }}>
                {/* Pupil */}
                <div style={{
                  position: "absolute", top: 5, left: 5,
                  width: 12, height: 12, borderRadius: "50%",
                  background: isDarkMode ? "#0f172a" : "#1e293b",
                  transform: isSpeaking ? "translate(2px,2px)" : "translate(0,0)",
                  transition: "transform .3s",
                }} />
                {/* Shine */}
                <div style={{
                  position: "absolute", top: 4, left: 14,
                  width: 6, height: 6, borderRadius: "50%",
                  background: "rgba(255,255,255,0.85)",
                  animation: "ap-shine 3.5s ease-in-out infinite",
                }} />
              </div>
            ))}
          </div>

          {/* Mouth */}
          <div style={{
            width: 60, height: isSpeaking ? 22 : 6,
            borderRadius: isSpeaking ? 10 : 3,
            background: mood,
            transition: "height .15s ease, background .4s, border-radius .15s",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            {isSpeaking && (
              <>
                {[
                  { a: "ap-bar1", d: "0s" },
                  { a: "ap-bar2", d: ".07s" },
                  { a: "ap-bar3", d: ".14s" },
                  { a: "ap-bar4", d: ".05s" },
                  { a: "ap-bar5", d: ".11s" },
                ].map((b, i) => (
                  <div key={i} style={{
                    width: 4, borderRadius: 2,
                    background: "rgba(255,255,255,0.88)",
                    animation: `${b.a} .35s ease-in-out ${b.d} infinite`,
                  }} />
                ))}
              </>
            )}
          </div>

          {/* Status dot (bottom-right) */}
          <div style={{
            position: "absolute", bottom: 10, right: 12,
            width: 9, height: 9, borderRadius: "50%",
            background: mood,
            boxShadow: `0 0 6px ${mood}`,
            transition: "background .4s, box-shadow .4s",
            animation: "ap-pulse 1.4s ease-in-out infinite",
          }} />
        </div>

        {/* Neck */}
        <div style={{ width: 24, height: 10, background: head.border }} />

        {/* Body / chest panel */}
        <div style={{
          width: 90, height: 38, borderRadius: "0 0 20px 20px",
          background: head.bg,
          border: `3px solid ${mood}`,
          borderTop: "none",
          transition: "border-color .4s",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {[false, true, false].map((active, i) => (
            <div key={i} style={{
              width: 9, height: 9, borderRadius: "50%",
              background: active ? mood : head.border,
              transition: "background .4s",
              animation: active ? "ap-pulse 1.6s ease-in-out infinite" : "none",
            }} />
          ))}
        </div>

        {/* Status label */}
        <div style={{
          marginTop: 10, fontSize: 11, fontWeight: 800,
          letterSpacing: "0.08em",
          color: mood,
          transition: "color .4s",
        }}>
          {isSpeaking ? "● SPEAKING" : "◎ LISTENING"}
        </div>
      </div>
    </div>
  );
}
