// src/pages/student/components/StreakWidget.jsx
// Shows both the daily activity streak and weekly class streak.
// Fetches live from /api/students/streak on mount.

import { useState, useEffect } from "react";
import api from "../../../api";

// ── helpers ───────────────────────────────────────────────────────────────────

function toMidnightUTC(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Last 7 calendar days ending today (Mon → Sun or today-6 → today) */
function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(toMidnightUTC(d).toISOString().slice(0, 10));
  }
  return days; // ["2026-03-25", ..., "2026-03-31"]
}

const DAY_LABEL = ["S", "M", "T", "W", "T", "F", "S"];

function streakLabel(n) {
  if (n >= 365) return "Legend";
  if (n >= 100) return "On Fire";
  if (n >= 30)  return "Monthly Pro";
  if (n >= 14)  return "Two Weeks!";
  if (n >= 7)   return "Full Week";
  if (n >= 3)   return "Getting Warm";
  if (n === 1)  return "Just Started";
  return "Start today!";
}

function streakEmoji(n) {
  if (n >= 100) return "🏆";
  if (n >= 30)  return "🌟";
  if (n >= 14)  return "⚡";
  if (n >= 7)   return "🔥";
  if (n >= 3)   return "🌱";
  return "💤";
}

// ── sub-components ────────────────────────────────────────────────────────────

function DayDot({ active, isToday, label, isDarkMode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active
          ? "linear-gradient(135deg,#f59e0b,#ef4444)"
          : isDarkMode ? "#1e2235" : "#f1f5f9",
        boxShadow: isToday ? "0 0 0 2px #f59e0b" : "none",
        transition: "all 0.2s",
      }}>
        {active
          ? <span style={{ fontSize: 14 }}>🔥</span>
          : <span style={{ width: 8, height: 8, borderRadius: "50%", background: isDarkMode ? "#374151" : "#d1d5db", display: "block" }} />
        }
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color: isDarkMode ? "#6b7280" : "#9ca3af" }}>{label}</span>
    </div>
  );
}

// ── main widget ───────────────────────────────────────────────────────────────

export default function StreakWidget({ isDarkMode, onLoad }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/students/streak")
      .then(res => {
        setData(res.data);
        if (res.data?.currentStreak) onLoad?.(res.data.currentStreak);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const c = {
    card:    isDarkMode ? "#1a1f2e" : "#ffffff",
    border:  isDarkMode ? "#1e2235" : "#e8ecf8",
    text:    isDarkMode ? "#e2e8f0" : "#1a1d2e",
    muted:   isDarkMode ? "#64748b" : "#6b7280",
    subCard: isDarkMode ? "#0f1117" : "#f8f9ff",
  };

  if (loading) {
    return (
      <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: "20px 24px" }}>
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: c.muted, fontSize: 13 }}>
          Loading streaks…
        </div>
      </div>
    );
  }

  const current       = data?.currentStreak       ?? 0;
  const longest       = data?.longestStreak        ?? 0;
  const weekStreak    = data?.weeklyClassStreak    ?? 0;
  const weekLongest   = data?.longestWeeklyClassStreak ?? 0;
  const freezes       = data?.streakFreezes        ?? 0;
  const activitySet   = new Set(
    (data?.activityDates ?? []).map(d => new Date(d).toISOString().slice(0, 10))
  );

  const days    = last7Days();
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      <style>{`
        @keyframes streakPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(245,158,11,0.3); }
          50%       { box-shadow: 0 4px 28px rgba(245,158,11,0.65), 0 0 0 4px rgba(245,158,11,0.15); }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.muted }}>
          Streaks
        </span>
        {freezes > 0 && (
          <span title={`${freezes} streak freeze${freezes !== 1 ? "s" : ""} available`} style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 700, color: "#60a5fa",
            background: isDarkMode ? "rgba(96,165,250,0.1)" : "#eff6ff",
            border: "1px solid rgba(96,165,250,0.3)",
            padding: "2px 8px", borderRadius: 20,
          }}>
            🛡️ {freezes} freeze{freezes !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Daily streak big display ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, flexShrink: 0,
          background: current > 0
            ? "linear-gradient(135deg,#f59e0b,#ef4444)"
            : isDarkMode ? "#1e2235" : "#f1f5f9",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: current > 0 ? "0 4px 16px rgba(245,158,11,0.3)" : "none",
          animation: current > 0 ? "streakPulse 2.4s ease-in-out infinite" : "none",
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{streakEmoji(current)}</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: current > 0 ? "#fff" : c.muted, lineHeight: 1, marginTop: 2 }}>
            {current}
          </span>
        </div>

        <div>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: c.text, lineHeight: 1 }}>
            {current} day{current !== 1 ? "s" : ""}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "#f59e0b", fontWeight: 600 }}>
            {streakLabel(current)}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: c.muted }}>
            Longest: {longest} day{longest !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── 7-day activity dots ── */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {days.map((dayStr) => {
          const jsDay = new Date(dayStr + "T12:00:00Z").getUTCDay(); // 0=Sun
          return (
            <DayDot
              key={dayStr}
              active={activitySet.has(dayStr)}
              isToday={dayStr === todayStr}
              label={DAY_LABEL[jsDay]}
              isDarkMode={isDarkMode}
            />
          );
        })}
      </div>

      {/* ── Weekly class streak ── */}
      <div style={{ background: c.subCard, border: `1px solid ${c.border}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📅</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: c.text }}>
              Weekly Class Streak
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: c.muted }}>
              Attend ≥1 class every week to keep it going
            </p>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: weekStreak > 0 ? "#10b981" : c.muted, lineHeight: 1 }}>
            {weekStreak}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: c.muted }}>
            best: {weekLongest}
          </p>
        </div>
      </div>

      {/* ── What counts note ── */}
      <p style={{ margin: 0, fontSize: 11, color: c.muted, lineHeight: 1.5 }}>
        🔥 Daily streak — any activity (class, quiz, homework, flashcards) counts.
        &nbsp;📅 Weekly streak — needs at least one completed class per week.
      </p>

    </div>
  );
}
