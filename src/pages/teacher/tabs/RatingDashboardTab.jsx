// src/pages/teacher/tabs/RatingDashboardTab.jsx
// Teacher's own rating dashboard: weekly trend, best-rated classes, low-rated feedback.

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../../../api';

function Stars({ rating, size = 14 }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: size, letterSpacing: 1 }}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

const fmt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

const SECTIONS = [
  { key: 'trend',    icon: '📈', label: 'Weekly Trend'  },
  { key: 'best',     icon: '⭐', label: 'Best Classes'  },
  { key: 'feedback', icon: '💬', label: 'Low Ratings'   },
];

export default function RatingDashboardTab({ teacherInfo, isDarkMode }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('trend');

  const card   = isDarkMode ? '#1a1d2e' : '#ffffff';
  const border = isDarkMode ? '#2a2d40' : '#ffe8cc';
  const text   = isDarkMode ? '#f0f4ff' : '#3d2e20';
  const muted  = isDarkMode ? '#6b7090' : '#a89480';
  const accent = '#f97316';
  const F      = "'Nunito','Inter',sans-serif";
  const tooltipStyle = { backgroundColor: card, border: `1px solid ${border}`, color: text, borderRadius: 12, fontFamily: F };

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/reviews/my-trends');
      setData(res.data.data);
    } catch (e) {
      console.error('Rating trends load error:', e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bestWeekRating = data?.weeklyTrend?.length
    ? Math.max(...data.weeklyTrend.map(w => w.avgRating))
    : null;
  const latestWeekRating = data?.weeklyTrend?.length
    ? data.weeklyTrend[data.weeklyTrend.length - 1].avgRating
    : null;

  return (
    <div style={{ fontFamily: F }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: text }}>📊 My Rating Dashboard</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: muted }}>Track your teaching performance over time.</p>
        </div>
        <button onClick={load} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted, padding: 4 }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Summary pills */}
      {!loading && data && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { icon: '⭐', label: 'Total Reviews', value: data.totalReviews },
            { icon: '📈', label: 'Latest Week',   value: latestWeekRating != null ? `${latestWeekRating} ★` : '—' },
            { icon: '🏆', label: 'Best Week',     value: bestWeekRating   != null ? `${bestWeekRating} ★`   : '—' },
          ].map(({ icon, label, value }) => (
            <div key={label} style={{
              background: card, border: `2px solid ${border}`, borderRadius: 18,
              padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: text }}>{value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => {
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => setSection(s.key)} style={{
              padding: '7px 16px', borderRadius: 999, fontSize: 12, fontWeight: 800,
              border: `2px solid ${active ? accent : border}`,
              background: active ? 'linear-gradient(135deg,#f97316,#fbbf24)' : 'transparent',
              color: active ? '#fff' : text,
              cursor: 'pointer', fontFamily: F,
              transition: 'all 0.15s',
            }}>
              {s.icon} {s.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p style={{ color: muted, fontSize: 13 }}>Loading…</p>
      ) : !data ? (
        <p style={{ color: muted, fontSize: 13 }}>Unable to load data.</p>
      ) : (
        <>
          {/* ── WEEKLY TREND ── */}
          {section === 'trend' && (
            <div style={{ background: card, border: `2px solid ${border}`, borderRadius: 24, padding: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontWeight: 900, color: text, fontSize: 17 }}>Weekly Average Rating</h3>
              {data.weeklyTrend.length < 2 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: muted }}>
                  <p style={{ fontSize: 36, margin: '0 0 10px' }}>📈</p>
                  <p style={{ margin: 0, fontWeight: 700, color: text }}>Not enough data yet</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13 }}>Your weekly trend appears once you have reviews across multiple weeks.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={data.weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={border} />
                    <XAxis dataKey="week" stroke={muted} style={{ fontFamily: F, fontSize: 11 }} />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke={muted} style={{ fontFamily: F, fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={v => [`${v} ★`, 'Avg Rating']} />
                    <Line
                      type="monotone"
                      dataKey="avgRating"
                      stroke={accent}
                      strokeWidth={3}
                      dot={{ fill: accent, r: 5 }}
                      activeDot={{ r: 7 }}
                      name="Avg Rating"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* ── BEST CLASSES ── */}
          {section === 'best' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.bestClasses.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', background: card, border: `2px solid ${border}`, borderRadius: 24 }}>
                  <p style={{ fontSize: 36, margin: '0 0 10px' }}>⭐</p>
                  <p style={{ margin: 0, fontWeight: 700, color: text }}>No reviewed classes yet</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: muted }}>Your top-rated classes will appear here once students leave reviews.</p>
                </div>
              ) : (
                data.bestClasses.map((cls, i) => (
                  <div key={i} style={{
                    background: card, border: `2px solid ${border}`,
                    borderRadius: 20, padding: '16px 20px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: text }}>{cls.classTitle || 'Class'}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: muted }}>
                          {fmt(cls.scheduledTime)} · {cls.studentName}
                        </p>
                        {cls.comment && (
                          <p style={{ margin: '8px 0 0', fontSize: 13, color: text, fontStyle: 'italic', lineHeight: 1.5 }}>
                            "{cls.comment}"
                          </p>
                        )}
                      </div>
                      <Stars rating={cls.rating} size={16} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── LOW-RATED FEEDBACK ── */}
          {section === 'feedback' && (
            <div>
              {data.lowRated.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', background: card, border: `2px solid ${border}`, borderRadius: 24 }}>
                  <p style={{ fontSize: 44, margin: '0 0 10px' }}>🎉</p>
                  <p style={{ margin: 0, fontWeight: 700, color: text, fontSize: 16 }}>No low-rated feedback!</p>
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: muted }}>Keep up the excellent teaching.</p>
                </div>
              ) : (
                <>
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: muted, fontWeight: 600 }}>
                    Reviews rated 1–2 stars with comments — areas worth reviewing:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.lowRated.map((r, i) => (
                      <div key={i} style={{
                        background: isDarkMode ? 'rgba(239,68,68,0.08)' : '#fff5f5',
                        border: `2px solid ${isDarkMode ? 'rgba(239,68,68,0.2)' : '#fecaca'}`,
                        borderRadius: 18, padding: '14px 18px',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: text }}>{r.classTitle}</span>
                          <Stars rating={r.rating} size={13} />
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: text, fontStyle: 'italic', lineHeight: 1.5 }}>"{r.comment}"</p>
                        <p style={{ margin: '6px 0 0', fontSize: 11, color: muted }}>{fmt(r.date)}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
