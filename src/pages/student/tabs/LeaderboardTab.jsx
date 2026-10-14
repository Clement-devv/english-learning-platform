// src/pages/student/tabs/LeaderboardTab.jsx
// Center-wide leaderboard: top 10 by streak, completed classes, quiz average.

import { useState, useEffect } from 'react';
import api from '../../../api';
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n/i18n.js";

// For text in file-level lists: read when rendered, so it follows the chosen language
const ta = (key, opts) => i18n.t(`student:${key}`, opts);


const CATEGORIES = [
  { key: 'streak',  icon: '🔥', get label() { return ta("leaderboardTab.categoriesStreakKings"); },    unit: 'day streak'   },
  { key: 'classes', icon: '📚', get label() { return ta("leaderboardTab.categoriesClassChampions"); }, unit: 'classes done'  },
  { key: 'quiz',    icon: '🧠', get label() { return ta("leaderboardTab.categoriesQuizStars"); },      unit: '% avg score'  },
];

const MEDALS = ['🥇', '🥈', '🥉'];

function getValue(entry, catKey) {
  if (catKey === 'streak')  return entry.currentStreak;
  if (catKey === 'classes') return entry.completedClasses;
  if (catKey === 'quiz')    return entry.avgScore != null ? `${entry.avgScore}%` : '—';
  return '—';
}

export default function LeaderboardTab({ isDarkMode }) {
  const { t: tr } = useTranslation("student");
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [category, setCategory] = useState('streak');

  const bg     = isDarkMode ? 'var(--as-bg, #0f1117)' : 'var(--as-raised, #fff8f0)';
  const card   = isDarkMode ? 'var(--as-raised, #1a1d2e)' : 'var(--as-surface, #ffffff)';
  const border = isDarkMode ? 'var(--as-line, #2a2d40)' : 'var(--as-line, #ffe8cc)';
  const text   = isDarkMode ? 'var(--as-ink, #f0f4ff)' : 'var(--as-ink, #3d2e20)';
  const muted  = isDarkMode ? 'var(--as-ink-2, #6b7090)' : 'var(--as-muted, #a89480)';
  const accent = isDarkMode ? '#fbbf24' : 'var(--as-accent-ink, #f97316)';
  const F      = "'Nunito','Inter',sans-serif";

  useEffect(() => {
    api.get('/analytics/leaderboard')
      .then(res => setData(res.data.data))
      .catch(err => console.error('Leaderboard load error:', err.message))
      .finally(() => setLoading(false));
  }, []);

  const cat  = CATEGORIES.find(c => c.key === category);
  const list = data?.[category] ?? [];

  return (
    <div style={{ fontFamily: F }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 900, color: text }}>{tr("leaderboardTab.centerLeaderboard")}</h2>
        <p style={{ margin: 0, fontSize: 13, color: muted }}>{tr("leaderboardTab.topPerformersThisSeasonWho")}</p>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {CATEGORIES.map(c => {
          const active = category === c.key;
          return (
            <button key={c.key} onClick={() => setCategory(c.key)} style={{
              padding: '8px 18px', borderRadius: 999, fontSize: 13, fontWeight: 800,
              border: `2px solid ${active ? accent : border}`,
              background: active ? 'linear-gradient(135deg,var(--as-accent, #f97316),#fbbf24)' : 'transparent',
              color: active ? '#fff' : text,
              cursor: 'pointer', fontFamily: F,
              boxShadow: active ? '0 4px 14px rgba(249,115,22,0.3)' : 'none',
              transition: 'all 0.15s',
            }}>
              {c.icon} {c.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>{tr("leaderboardTab.loadingLeaderboard")}</p>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', background: card, border: `2px solid ${border}`, borderRadius: 24 }}>
          <p style={{ fontSize: 44, margin: '0 0 12px' }}>🏆</p>
          <p style={{ margin: 0, fontWeight: 700, color: text, fontSize: 16 }}>{tr("leaderboardTab.noDataYet")}</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: muted }}>{tr("leaderboardTab.beTheFirstToGet")}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((entry, i) => {
            const top3 = i < 3;
            return (
              <div key={entry._id ?? i} style={{
                background: top3
                  ? (isDarkMode
                      ? 'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(251,191,36,0.10))'
                      : 'linear-gradient(135deg,var(--as-accent-soft, #fff7ed),#fef3c7)')
                  : card,
                border: `2px solid ${top3 ? `color-mix(in srgb, ${accent} 50%, transparent)` : border}`,
                borderRadius: 20,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}>

                {/* Rank badge */}
                <div style={{
                  width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: top3 ? 24 : 14, fontWeight: 900,
                  background: top3
                    ? 'linear-gradient(135deg,var(--as-accent, #f97316),#fbbf24)'
                    : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'var(--as-raised, #f3f4f6)'),
                  color: top3 ? '#fff' : muted,
                  boxShadow: top3 ? '0 4px 12px rgba(249,115,22,0.3)' : 'none',
                }}>
                  {top3 ? MEDALS[i] : `#${i + 1}`}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg,var(--as-accent, #f97316),#fbbf24)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 900, fontSize: 16,
                }}>
                  {entry.firstName?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    margin: 0, fontWeight: 800, fontSize: 15, color: text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.firstName} {entry.lastName?.[0] ? `${entry.lastName[0]}.` : ''}
                  </p>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: top3 ? accent : text }}>
                    {getValue(entry, category)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {cat.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
