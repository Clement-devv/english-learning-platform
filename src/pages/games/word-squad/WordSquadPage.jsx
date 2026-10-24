// src/pages/games/word-squad/WordSquadPage.jsx
// Word Squad — the English runner-shooter. This page is the lazy route chunk:
// menu, question strip, pause / mute and the end screen are React; the game
// itself (PixiJS) is loaded with import() only when a chapter starts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createDemoSession } from './data/demoSession.js';
import { listAssignments, createServerSession, apiMessage } from './data/serverSession.js';
import { computeStars } from './logic/stars.js';
import { chapterRating } from './logic/rating.js';
import { rewardLabel } from './logic/rewards.js';
import { CHAPTERS, BOSSES, CORRECT_SHOW_S } from './logic/config.js';
import { setMuted, isMuted, unlockAudio, closeAudio } from './audio/sfx.js';
import './wordSquad.css';

const PROGRESS_KEY = 'ws-progress-v1';
const CHAPTER_INFO = [
  { title: 'Bug Town', emoji: '🐞', color: '#9b5de5' },
  { title: 'Candy Jungle', emoji: '🦍', color: '#f472b6' },
  { title: 'Crystal City', emoji: '🦖', color: '#10b981' },
];

// Progress is only a convenience until Phase 2 saves it on the server
function readProgress() {
  try { return Math.max(0, Math.min(2, Number(localStorage.getItem(PROGRESS_KEY)) || 0)); } catch { return 0; }
}
function saveProgress(n) {
  try { localStorage.setItem(PROGRESS_KEY, String(n)); } catch { /* private mode — fine */ }
}
const RATING_KEY = 'ws-rating-v1';
function readRatings() {
  try { return JSON.parse(localStorage.getItem(RATING_KEY) || '{}') || {}; } catch { return {}; }
}
function saveRatings(r) {
  try { localStorage.setItem(RATING_KEY, JSON.stringify(r)); } catch { /* private mode — fine */ }
}

function RatingStars({ count, big = false }) {
  return (
    <span className={`ws-rating${big ? ' ws-rating--big' : ''}`} aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => <span key={i} className={i < count ? 'on' : ''} style={big ? { animationDelay: `${0.25 + i * 0.3}s` } : undefined}>★</span>)}
    </span>
  );
}

function SpellChip({ spell }) {
  if (!spell) return null;
  return (
    <div className={`ws-spell${spell.done === true ? ' ws-spell--done' : spell.done === false ? ' ws-spell--fail' : ''}`} role="status" aria-live="polite">
      <span className="ws-spell-label">Spell</span>
      {spell.word.split('').map((ch, i) => (
        <span key={i} className={`ws-spell-letter${i < spell.got ? ' got' : i === spell.got && spell.done == null ? ' next' : ''}${spell.missed.includes(i) ? ' miss' : ''}`}>
          {i < spell.got || spell.done != null ? ch : i === spell.got ? ch : '_'}
        </span>
      ))}
    </div>
  );
}

function ReviveCard({ revive, onPick }) {
  if (!revive) return null;
  const { q, picked, result } = revive;
  return (
    <div className="ws-overlay">
      <div className="ws-card ws-card--small ws-revive">
        <h2>Oh no! 💥</h2>
        <p className="ws-lead">Answer right to bring your squad back!</p>
        <div className="ws-revive-q"><Sentence prompt={q.prompt} word={picked} /></div>
        <div className="ws-revive-choices">
          {q.choices.map((c) => {
            const state = result && (c === result.correctAnswer ? ' right' : c === picked ? ' wrong' : '');
            return (
              <button key={c} type="button" className={`ws-btn ws-revive-btn${state || ''}`} disabled={!!picked} onClick={() => onPick(c)}>{c}</button>
            );
          })}
        </div>
        {result && <p className="ws-revive-msg">{result.correct ? '🎉 Yes! Back in the fight!' : `The right word is "${result.correctAnswer}".`}</p>}
      </div>
    </div>
  );
}

function Sentence({ prompt, word }) {
  const [a, b] = String(prompt).split('___');
  return (
    <span className="ws-sentence">
      {a}<span className={`ws-blank${word ? ' ws-blank--filled' : ''}`}>{word || '    '}</span>{b}
    </span>
  );
}

function QuestionStrip({ question, lane, flash, total }) {
  if (flash) {
    return (
      <div className={`ws-strip ws-strip--${flash.correct ? 'right' : 'wrong'}`} role="status" aria-live="polite">
        <div className="ws-strip-row">
          <span className="ws-flash-title">{flash.correct ? '🎉 Great!' : '😮 Oops!'}</span>
          <Sentence prompt={flash.prompt} word={flash.correct ? flash.chose : flash.answer} />
        </div>
        <div className="ws-strip-sub">
          {flash.correct ? <>You got <b>{flash.reward}</b></> : <>The right word is <b>{flash.answer}</b></>}
        </div>
      </div>
    );
  }
  // The question itself floats above its gate in the game; this copy is for screen readers only.
  if (!question) return null;
  const [a, b = ''] = String(question.prompt).split('___');
  return (
    <p className="ws-sr" role="status" aria-live="polite">
      {question.boss ? 'Boss gate' : `Gate ${question.index + 1} of ${total}`}: {a} blank {b}. Choices: {question.choices.join(', ')}. Lined up with: {question.choices[lane]}.
    </p>
  );
}

const ratingsObj = (arr) => Object.fromEntries((arr || []).map((n, i) => [i, n]));

/**
 * @param demo  true on the dev route: built-in questions, progress kept in the browser.
 *              Otherwise the student plays their assigned games and the server checks
 *              every answer and pays the stars.
 */
export default function WordSquadPage({ exitTo = '/student/dashboard', demo = false }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [games, setGames] = useState(null);        // the student's assigned games (server mode)
  const [assignment, setAssignment] = useState(null);
  const [practice, setPractice] = useState(false); // play the demo questions without stars
  const [totalStars, setTotalStars] = useState(0);
  const offline = demo || practice;
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const flashTimer = useRef(null);
  const [screen, setScreen] = useState('menu'); // menu | loading | playing | ended
  const [chapter, setChapter] = useState(0);
  const [unlocked, setUnlocked] = useState(() => (demo ? readProgress() : 0));
  const [question, setQuestion] = useState(null);
  const [lane, setLane] = useState(0);
  const [flash, setFlash] = useState(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const [summary, setSummary] = useState(null);
  const [ratings, setRatings] = useState(() => (demo ? readRatings() : {}));
  const [spell, setSpell] = useState(null);
  const [powers, setPowers] = useState({});
  const [revive, setRevive] = useState(null);
  const sessionRef = useRef(null);
  const spellTimer = useRef(null);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(() => window.matchMedia?.('(pointer: coarse) and (orientation: portrait)').matches);
  const questionRef = useRef(null);
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  // Warm the game code while the menu shows
  useEffect(() => { import('./engine.js').catch(() => {}); }, []);

  // The student's assigned games (and where they got to), from the server
  const pick = useCallback((a) => {
    setAssignment(a);
    setPractice(false);
    if (a) {
      setUnlocked(Math.min(a.progress.unlocked, a.chapters - 1));
      setRatings(ratingsObj(a.progress.ratings));
    }
  }, []);
  const loadGames = useCallback(async (keepId) => {
    try {
      const d = await listAssignments();
      setGames(d.assignments);
      setTotalStars(d.stars);
      const want = keepId || params.get('assignment');
      const found = d.assignments.find((a) => String(a.id) === String(want)) || (d.assignments.length === 1 ? d.assignments[0] : null);
      if (found) pick(found);
    } catch (err) {
      setGames([]);
      setError(apiMessage(err, 'Could not load your games. Check your connection and try again.'));
    }
  }, [params, pick]);
  useEffect(() => { if (!demo) loadGames(); }, [demo, loadGames]);

  const stopGame = useCallback(() => {
    clearTimeout(flashTimer.current);
    clearTimeout(spellTimer.current);
    gameRef.current?.destroy();
    gameRef.current = null;
  }, []);
  useEffect(() => () => { stopGame(); closeAudio(); }, [stopGame]);

  // Pause when the tab is hidden or the window loses focus
  useEffect(() => {
    const pause = () => { if (gameRef.current && !gameRef.current.paused) { gameRef.current.setPaused(true); setPaused(true); } };
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', pause);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', pause); };
  }, []);

  const start = useCallback(async (ch) => {
    stopGame();
    unlockAudio();
    setChapter(ch);
    setScreen('loading');
    setQuestion(null);
    setFlash(null);
    setPaused(false);
    setSummary(null);
    setSpell(null);
    setPowers({});
    setRevive(null);
    setError('');
    try {
      const { startGame } = await import('./engine.js');
      let session;
      try {
        session = offline ? createDemoSession(ch) : await createServerSession(assignment.id, ch);
      } catch (err) {
        setError(apiMessage(err, 'Could not start the game. Check your connection and try again.'));
        setScreen('menu');
        return;
      }
      sessionRef.current = session;
      // wait a frame so the host has its size
      await new Promise((r) => requestAnimationFrame(r));
      const game = await startGame({
        host: hostRef.current,
        chapter: ch,
        session,
        on: {
          question: (q) => { questionRef.current = q; setQuestion(q); setLane(0); },
          lane: setLane,
          spell: (ev) => {
            clearTimeout(spellTimer.current);
            if (ev.type === 'spellStart') setSpell({ word: ev.word, got: 0, missed: [], done: null });
            else if (ev.type === 'letter') setSpell((sp) => sp && { ...sp, got: ev.ok ? sp.got + 1 : sp.got, missed: ev.ok ? sp.missed : [...sp.missed, sp.got] });
            else {
              setSpell((sp) => sp && { ...sp, done: ev.ok });
              spellTimer.current = setTimeout(() => setSpell(null), 2200);
            }
          },
          power: (kind, secs) => {
            setPowers((p) => ({ ...p, [kind]: Date.now() + secs * 1000 }));
            setTimeout(() => setPowers((p) => { const n = { ...p }; if (n[kind] <= Date.now() + 50) delete n[kind]; return n; }), secs * 1000);
          },
          down: (q) => setRevive({ q, picked: null, result: null }),
          result: (ev) => {
            const q = questionRef.current;
            const res = gameRef.current?.world.results.at(-1);
            setFlash({ correct: ev.correct, prompt: res?.prompt ?? q?.prompt ?? '', chose: res?.chose, answer: res?.answer ?? ev.correctAnswer, reward: ev.correct ? rewardLabel(ev.reward, null) : '' });
            clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => setFlash(null), (ev.correct ? 1.2 : CORRECT_SHOW_S) * 1000);
          },
          end: async (s) => {
            setRevive(null);
            if (session.server) {
              // The server checked every answer: its right/total, stars and rating are the real ones
              try {
                const d = await session.finish(s);
                setSummary({ ...s, right: d.right, total: d.total, review: d.review, stars: d.stars, rating: d.rating, countsForStars: d.countsForStars, totalStars: d.totalStars });
                setTotalStars(d.totalStars);
                setUnlocked(d.progress.unlocked);
                setRatings(ratingsObj(d.progress.ratings));
                setGames((list) => list && list.map((a) => (a.id === assignment.id ? { ...a, progress: { ...a.progress, ...d.progress }, playsToday: a.playsToday + (d.countsForStars ? 1 : 0) } : a)));
              } catch (err) {
                setSummary({ ...s, stars: { base: 0, bonus: 0, boss: 0, total: 0 }, rating: chapterRating(s), saveError: apiMessage(err, 'Your stars could not be saved. Check your connection.') });
              }
              setScreen('ended');
              return;
            }
            const stars = computeStars(s);
            const rating = chapterRating(s);
            setSummary({ ...s, stars, rating });
            if (practice) { setScreen('ended'); return; } // practice: no progress kept
            setRatings((r) => {
              if ((r[ch] || 0) >= rating.count) return r;
              const next = { ...r, [ch]: rating.count };
              saveRatings(next);
              return next;
            });
            if (s.won && ch + 1 > unlockedRef.current && ch < 2) { saveProgress(ch + 1); setUnlocked(ch + 1); }
            setScreen('ended');
          },
        },
      });
      gameRef.current = game;
      setScreen('playing');
    } catch (err) {
      console.error('Word Squad failed to start', err);
      setError('The game could not start on this device. Please try again or use another browser.');
      setScreen('menu');
    }
  }, [stopGame, offline, assignment, practice]);

  const answerRevive = async (choice) => {
    const session = sessionRef.current;
    if (!revive || revive.picked || !session) return;
    setRevive((r) => ({ ...r, picked: choice }));
    let result;
    try { result = await session.answer(revive.q.gateId, choice); } catch { result = { correct: false, correctAnswer: null }; }
    setRevive((r) => r && { ...r, result });
    setTimeout(() => {
      setRevive(null);
      gameRef.current?.revive(!!result?.correct);
    }, result?.correct ? 1100 : 1900);
  };

  const togglePause = () => {
    const g = gameRef.current;
    if (!g) return;
    g.setPaused(!g.paused);
    setPaused(g.paused);
  };
  const toggleMute = () => { unlockAudio(); setMuted(!muted); setMutedState(!muted); };
  const quitToMenu = () => { stopGame(); setScreen('menu'); setPaused(false); };
  const exit = () => { stopGame(); navigate(exitTo); };

  const total = CHAPTERS[chapter]?.gates ?? 0;
  const lastChapter = assignment && !practice ? assignment.chapters - 1 : 2;
  const backToList = !demo && (practice || (assignment && games?.length > 1));

  return (
    <div className="ws-root">
      <div ref={hostRef} className="ws-stage" aria-label="Word Squad game" />

      {screen === 'playing' && (
        <>
          <QuestionStrip question={question} lane={lane} flash={flash} total={total} />
          <SpellChip spell={spell} />
          <div className="ws-powers">
            {powers.shield && <span className="ws-power ws-power--shield">🛡️ Shield</span>}
            {powers.frenzy && <span className="ws-power ws-power--frenzy">⚡ Frenzy</span>}
          </div>
          <div className="ws-buttons">
            <button type="button" className="ws-icon-btn" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '🔇' : '🔊'}</button>
            <button type="button" className="ws-icon-btn" onClick={togglePause} aria-label="Pause">⏸</button>
          </div>
        </>
      )}

      {screen === 'playing' && <ReviveCard revive={revive} onPick={answerRevive} />}

      {screen === 'loading' && <div className="ws-overlay"><div className="ws-loading"><div className="ws-spinner" />Getting the squad ready…</div></div>}

      {paused && screen === 'playing' && (
        <div className="ws-overlay">
          <div className="ws-card ws-card--small">
            <h2>Paused</h2>
            <button type="button" className="ws-btn ws-btn--primary" onClick={togglePause}>▶ Keep playing</button>
            <button type="button" className="ws-btn" onClick={() => start(chapter)}>↻ Restart chapter</button>
            <button type="button" className="ws-btn ws-btn--ghost" onClick={quitToMenu}>Chapters</button>
          </div>
        </div>
      )}

      {screen === 'menu' && (
        <div className="ws-overlay ws-overlay--menu">
          <div className="ws-card">
            <div className="ws-title">
              <span className="ws-title-word">WORD</span><span className="ws-title-word ws-title-word--b">SQUAD</span>
            </div>
            <p className="ws-lead">Steer your squad through the <b>right word</b>. Right words give weapons and friends. Wrong words bring more bugs!</p>
            {!demo && games === null && <p className="ws-lead">Loading your games…</p>}
            {!demo && games && !assignment && !practice && (
              <div className="ws-chapters">
                {games.length === 0 && <p className="ws-lead">No Word Squad games from your teacher yet.</p>}
                {games.map((g) => (
                  <button key={g.id} type="button" className="ws-chapter" style={{ '--c': '#7c3aed' }} onClick={() => pick(g)}>
                    <span className="ws-chapter-emoji" aria-hidden="true">📘</span>
                    <span className="ws-chapter-text">
                      <span className="ws-chapter-no">{g.level} · {g.chapters} chapter{g.chapters > 1 ? 's' : ''}</span>
                      <span className="ws-chapter-title">{g.title}</span>
                      <span className="ws-chapter-boss">{g.dueAt ? `Due ${new Date(g.dueAt).toLocaleDateString()}` : 'No due date'} · ⭐ {g.progress.bestStars.reduce((a, b) => a + b, 0)}</span>
                    </span>
                  </button>
                ))}
                <button type="button" className="ws-btn ws-btn--ghost" onClick={() => { setPractice(true); setUnlocked(2); setRatings({}); }}>Practice with sample words (no stars)</button>
              </div>
            )}
            {(demo || assignment || practice) && (
            <>
            {!demo && (
              <div className="ws-game-head">
                <span>{practice ? 'Practice — sample words, no stars' : assignment.title}</span>
                {!practice && <span>⭐ {totalStars} · star plays today {Math.min(assignment.playsToday, assignment.maxPlaysPerDay)}/{assignment.maxPlaysPerDay}</span>}
              </div>
            )}
            <div className="ws-chapters">
              {CHAPTER_INFO.slice(0, assignment && !practice ? assignment.chapters : 3).map((c, i) => {
                const locked = i > unlocked;
                return (
                  <button key={c.title} type="button" className="ws-chapter" style={{ '--c': c.color }} disabled={locked} onClick={() => start(i)}>
                    <span className="ws-chapter-emoji" aria-hidden="true">{locked ? '🔒' : c.emoji}</span>
                    <span className="ws-chapter-text">
                      <span className="ws-chapter-no">Chapter {i + 1}</span>
                      <span className="ws-chapter-title">{c.title}</span>
                      <span className="ws-chapter-boss">Boss: {BOSSES[i].name}</span>
                      {!locked && <RatingStars count={ratings[i] || 0} />}
                    </span>
                  </button>
                );
              })}
            </div>
            </>
            )}
            <div className="ws-howto">
              <span>👆 Drag left and right</span><span>⌨️ or use ← → / A D</span><span>🔫 Your squad fires by itself</span>
            </div>
            {error && <p className="ws-error" role="alert">{error}</p>}
            <div className="ws-menu-row">
              {backToList
                ? <button type="button" className="ws-btn ws-btn--ghost" onClick={() => { setAssignment(null); setPractice(false); }}>← My games</button>
                : <button type="button" className="ws-btn ws-btn--ghost" onClick={exit}>← Back</button>}
              <button type="button" className="ws-btn ws-btn--ghost" onClick={toggleMute}>{muted ? '🔇 Sound off' : '🔊 Sound on'}</button>
            </div>
          </div>
          {tip && (
            <div className="ws-tip" role="note">
              <span>📱 Tip: turn your phone sideways for a wider view.</span>
              <button type="button" onClick={() => setTip(false)} aria-label="Close tip">✕</button>
            </div>
          )}
        </div>
      )}

      {screen === 'ended' && summary && (
        <div className="ws-overlay">
          <div className="ws-card ws-end">
            <h2 className={summary.won ? 'ws-win' : 'ws-lose'}>{summary.won ? 'Chapter clear!' : 'Nice try!'}</h2>
            <RatingStars count={summary.rating.count} big />
            <div className="ws-rating-labels">
              <span className={summary.rating.cleared ? 'on' : ''}>Cleared</span>
              <span className={summary.rating.smart ? 'on' : ''}>80% words right</span>
              <span className={summary.rating.hero ? 'on' : ''}>No boss hits or ×30 combo</span>
            </div>
            <div className="ws-stars" aria-label={`${summary.stars.total} stars`}>
              <span className="ws-star-big">⭐</span><span className="ws-star-num">{summary.stars.total}</span>
            </div>
            {summary.saveError && <p className="ws-error" role="alert">{summary.saveError}</p>}
            {summary.countsForStars === false && <p className="ws-lead">No stars this time — you've used today's star plays for this game. Come back tomorrow!</p>}
            {summary.totalStars != null && <p className="ws-lead">You have <b>⭐ {summary.totalStars}</b> stars in total.</p>}
            <div className="ws-star-break">
              {summary.stars.base} for words · +{summary.stars.bonus} bonus{summary.stars.boss ? ` · +${summary.stars.boss} boss` : ''}
            </div>
            <div className="ws-stats">
              <div><b>{summary.right}/{summary.total}</b><span>right words</span></div>
              <div><b>{summary.squadSize}</b><span>squad size</span></div>
              <div><b>{summary.bugsPopped}</b><span>bugs popped</span></div>
              <div><b>×{summary.bestCombo}</b><span>best combo</span></div>
              <div><b>{summary.coins}</b><span>coins</span></div>
              <div><b>{summary.spells}</b><span>words spelled</span></div>
            </div>
            {summary.review.length > 0 && (
              <div className="ws-review">
                <h3>Words to review</h3>
                <ul>
                  {summary.review.map((r, i) => (
                    <li key={i}>
                      <Sentence prompt={r.prompt} word={r.answer} />
                      <span className="ws-review-chose">You chose: <s>{r.chose}</s></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="ws-end-buttons">
              <button type="button" className="ws-btn" onClick={() => start(chapter)}>↻ Play again</button>
              {summary.won && chapter < lastChapter && <button type="button" className="ws-btn ws-btn--primary" onClick={() => start(chapter + 1)}>Next chapter ▶</button>}
              <button type="button" className="ws-btn ws-btn--ghost" onClick={quitToMenu}>Chapters</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
