// src/pages/student/tabs/WordSquadTab.jsx
// The student's Word Squad games from their teachers: star total, each game's
// chapters and best 3-star ratings, and a Play button that opens the game.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAssignments } from '../../games/word-squad/data/serverSession.js';

const CHAPTER_NAMES = ['Bug Town', 'Candy Jungle', 'Crystal City'];

export default function WordSquadTab({ isDarkMode }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listAssignments().then(setData).catch((err) => setError(err?.response?.data?.message || 'Could not load your games.'));
  }, []);

  const c = {
    card: isDarkMode ? 'var(--as-raised, #1a1d2e)' : 'var(--as-surface, #ffffff)',
    line: isDarkMode ? 'var(--as-line, #2a2d40)' : 'var(--as-line, #e8edf5)',
    ink: isDarkMode ? 'var(--as-ink, #e8eaf6)' : 'var(--as-ink, #1a1d2e)',
    muted: isDarkMode ? 'var(--as-muted, #8b91b8)' : 'var(--as-ink-2, #6b7280)',
  };
  const card = { background: c.card, border: `1px solid ${c.line}`, borderRadius: 18, padding: 18 };
  const play = (id) => navigate(`/student/games/word-squad?assignment=${id}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, color: c.ink, maxWidth: 820 }}>
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, #7c3aed, #ff5d8f)', color: '#fff', border: 0 }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">🎮</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 22 }}>Word Squad</div>
          <div style={{ opacity: 0.9, fontWeight: 600 }}>Steer through the right words, beat the bosses, earn stars!</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900 }}>⭐ {data?.stars ?? '–'}</div>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.9 }}>your stars</div>
        </div>
      </div>

      {error && <div style={{ ...card, color: '#dc2626', fontWeight: 700 }} role="alert">{error}</div>}
      {!data && !error && <div style={{ ...card, color: c.muted }}>Loading your games…</div>}
      {data && data.assignments.length === 0 && (
        <div style={card}>
          <p style={{ margin: 0, fontWeight: 700 }}>🔒 Word Squad isn't open for you yet. When your teacher gives you a game, it will be here.</p>
        </div>
      )}
      {data?.assignments.map((a) => (
        <div key={a.id} style={{ ...card, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: '1 1 260px' }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{a.title}</div>
            <div style={{ color: c.muted, fontSize: 13, fontWeight: 600, marginTop: 2 }}>
              {a.level} · {a.dueAt ? `due ${new Date(a.dueAt).toLocaleDateString()}` : 'no due date'} · star plays today {Math.min(a.playsToday, a.maxPlaysPerDay)}/{a.maxPlaysPerDay}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {CHAPTER_NAMES.slice(0, a.chapters).map((name, i) => (
                <span key={name} style={{ fontSize: 13, fontWeight: 700, color: i > a.progress.unlocked ? c.muted : c.ink }}>
                  {i > a.progress.unlocked ? '🔒' : ''} {name}{' '}
                  <span aria-label={`${a.progress.ratings[i] || 0} of 3 stars`} style={{ color: '#f59e0b', letterSpacing: 1 }}>
                    {'★'.repeat(a.progress.ratings[i] || 0)}<span style={{ color: c.line }}>{'★'.repeat(3 - (a.progress.ratings[i] || 0))}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => play(a.id)} style={{ font: 'inherit', fontWeight: 900, fontSize: 16, padding: '12px 22px', borderRadius: 14, border: 0, background: '#ffd166', color: '#2a1f45', cursor: 'pointer', boxShadow: '0 4px 0 rgba(42,31,69,0.35)' }}>
            ▶ Play
          </button>
        </div>
      ))}
    </div>
  );
}
