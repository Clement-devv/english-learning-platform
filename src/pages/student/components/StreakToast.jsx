// src/pages/student/components/StreakToast.jsx
// Animated popup shown when a student earns or extends their daily streak.
// Usage:
//   const [streakToast, setStreakToast] = useState(null);
//   // after activity: setStreakToast({ newStreak: 5, usedFreeze: false });
//   <StreakToast data={streakToast} onDone={() => setStreakToast(null)} />

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/i18n.js";

// For text in file-level lists: read when rendered, so it follows the chosen language
const ta = (key, opts) => i18n.t(`student:${key}`, opts);


const MILESTONE_MSG = {
  3:   { emoji: "🌱", get label() { return ta("streakToast.milestoneMsgT3DayStreak"); } },
  7:   { emoji: "🔥", get label() { return ta("streakToast.milestoneMsgOneFullWeek"); } },
  14:  { emoji: "⚡", get label() { return ta("streakToast.milestoneMsgTwoWeeksStrong"); } },
  30:  { emoji: "🌟", get label() { return ta("streakToast.milestoneMsgT30DayLegend"); } },
  50:  { emoji: "💎", get label() { return ta("streakToast.milestoneMsgT50DaysIncredible"); } },
  100: { emoji: "🏆", get label() { return ta("streakToast.milestoneMsgT100DaysYouRe"); } },
};

/** Returns the highest milestone hit at `streak`, or null */
function getMilestone(streak) {
  const keys = Object.keys(MILESTONE_MSG).map(Number).sort((a, b) => b - a);
  return keys.find((k) => streak === k) ?? null;
}

export default function StreakToast({ data, onDone }) {
  const { t: tr } = useTranslation("student");
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!data) return;
    setVisible(true);
    setExiting(false);

    const hideTimer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => { setVisible(false); onDone?.(); }, 400);
    }, 3200);

    return () => clearTimeout(hideTimer);
  }, [data]);

  if (!visible || !data) return null;

  const { newStreak, usedFreeze } = data;
  const milestone = getMilestone(newStreak);
  const isBig = !!milestone;

  const fireCount = Math.min(newStreak, 5);

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        pointerEvents: "none",
        animation: exiting
          ? "streakToastOut 0.4s ease forwards"
          : "streakToastIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
      }}
    >
      <style>{`
        @keyframes streakToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.85); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
        }
        @keyframes streakToastOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
          to   { opacity: 0; transform: translateX(-50%) translateY(-16px) scale(0.9);  }
        }
        @keyframes firePulse {
          0%, 100% { transform: scale(1);    }
          50%       { transform: scale(1.25); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
      `}</style>

      <div style={{
        background: isBig
          ? "linear-gradient(135deg, #f59e0b, #ef4444, #f97316)"
          : "linear-gradient(135deg, #1e2235ee, #111827ee)",
        backdropFilter: "blur(12px)",
        border: isBig ? "2px solid rgba(255,255,255,0.3)" : "1.5px solid rgba(245,158,11,0.4)",
        borderRadius: 20,
        padding: isBig ? "18px 28px" : "12px 22px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: isBig
          ? "0 8px 32px rgba(245,158,11,0.5)"
          : "0 4px 20px rgba(0,0,0,0.4)",
        minWidth: 240,
      }}>
        {/* Fire emojis */}
        <div style={{ display: "flex", gap: 2 }}>
          {Array.from({ length: fireCount }).map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: isBig ? 28 : 22,
                animation: `firePulse 0.6s ease-in-out ${i * 0.08}s infinite`,
                display: "inline-block",
              }}
            >
              🔥
            </span>
          ))}
        </div>

        {/* Text */}
        <div>
          {isBig ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)", marginBottom: 2 }}>
                {milestone.emoji} {milestone.label}
              </div>
              <div style={{
                fontSize: 22, fontWeight: 900, color: "#fff",
                background: "linear-gradient(90deg,#fff,#ffe,#fff)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "shimmer 1.5s linear infinite",
              }}>
                {tr("streakToast.dayStreak", { newStreak })}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 1 }}>
                {usedFreeze ? tr("streakToast.streakSavedByFreeze") : tr("streakToast.keepItUp")}
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#f59e0b" }}>{tr("streakToast.dayStreak2", { newStreak })}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
