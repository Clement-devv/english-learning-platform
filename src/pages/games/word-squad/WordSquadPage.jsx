// src/pages/games/word-squad/WordSquadPage.jsx
// Word Squad — the English runner-shooter. This page is the lazy route chunk:
// menu, question strip, pause / mute and the end screen are React; the game
// itself (PixiJS) is loaded with import() only when a chapter starts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createDemoSession } from './data/demoSession.js';
import { computeStars } from './logic/stars.js';
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

function Sentence({ prompt, word }) {
  const [a, b] = String(prompt).split('___');
  return (
    <span className="ws-sentence">
      {a}<span className={`ws-blank${word ? ' ws-blank--filled' : ''}`}>{word || '    '}</span>{b}
    </span>
  );
}

const IDLE_TEXT = { run: 'Next word coming…', boss: 'Beat the boss!', finish: 'Run to the finish!', won: 'You did it!', lost: 'Oh no!' };

function QuestionStrip({ question, lane, flash, total, phase }) {
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
  if (!question) return <div className="ws-strip ws-strip--idle"><span>{IDLE_TEXT[phase] || 'Get ready…'}</span></div>;
  return (
    <div className="ws-strip" role="status" aria-live="polite">
      <div className="ws-strip-row">
        <span className="ws-gate-no">{question.boss ? 'BOSS' : `${question.index + 1}/${total}`}</span>
        <Sentence prompt={question.prompt} word={question.choices[lane]} />
        <span className="ws-reward">{question.reward}</span>
      </div>
      <div className="ws-choices">
        {question.choices.map((c, i) => (
          <span key={c + i} className={`ws-choice${i === lane ? ' ws-choice--on' : ''}`}>{c}</span>
        ))}
      </div>
    </div>
  );
}

export default function WordSquadPage({ exitTo = '/student/dashboard' }) {
  const navigate = useNavigate();
  const hostRef = useRef(null);
  const gameRef = useRef(null);
  const flashTimer = useRef(null);
  const [screen, setScreen] = useState('menu'); // menu | loading | playing | ended
  const [chapter, setChapter] = useState(0);
  const [unlocked, setUnlocked] = useState(readProgress);
  const [question, setQuestion] = useState(null);
  const [lane, setLane] = useState(0);
  const [flash, setFlash] = useState(null);
  const [phase, setPhase] = useState('run');
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [tip, setTip] = useState(() => window.matchMedia?.('(pointer: coarse) and (orientation: portrait)').matches);
  const questionRef = useRef(null);
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;

  // Warm the game code while the menu shows
  useEffect(() => { import('./engine.js').catch(() => {}); }, []);

  const stopGame = useCallback(() => {
    clearTimeout(flashTimer.current);
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
    setPhase('run');
    setPaused(false);
    setSummary(null);
    setError('');
    try {
      const { startGame } = await import('./engine.js');
      const session = createDemoSession(ch);
      // wait a frame so the host has its size
      await new Promise((r) => requestAnimationFrame(r));
      const game = await startGame({
        host: hostRef.current,
        chapter: ch,
        session,
        on: {
          question: (q) => { questionRef.current = q; setQuestion(q); setLane(0); },
          lane: setLane,
          phase: setPhase,
          result: (ev) => {
            const q = questionRef.current;
            const res = gameRef.current?.world.results.at(-1);
            setFlash({ correct: ev.correct, prompt: res?.prompt ?? q?.prompt ?? '', chose: res?.chose, answer: res?.answer ?? ev.correctAnswer, reward: ev.correct ? rewardLabel(ev.reward, null) : '' });
            clearTimeout(flashTimer.current);
            flashTimer.current = setTimeout(() => setFlash(null), (ev.correct ? 1.2 : CORRECT_SHOW_S) * 1000);
          },
          end: (s) => {
            const stars = computeStars(s);
            setSummary({ ...s, stars });
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
  }, [stopGame]);

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

  return (
    <div className="ws-root">
      <div ref={hostRef} className="ws-stage" aria-label="Word Squad game" />

      {screen === 'playing' && (
        <>
          <QuestionStrip question={question} lane={lane} flash={flash} total={total} phase={phase} />
          <div className="ws-buttons">
            <button type="button" className="ws-icon-btn" onClick={toggleMute} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>{muted ? '🔇' : '🔊'}</button>
            <button type="button" className="ws-icon-btn" onClick={togglePause} aria-label="Pause">⏸</button>
          </div>
        </>
      )}

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
            <div className="ws-chapters">
              {CHAPTER_INFO.map((c, i) => {
                const locked = i > unlocked;
                return (
                  <button key={c.title} type="button" className="ws-chapter" style={{ '--c': c.color }} disabled={locked} onClick={() => start(i)}>
                    <span className="ws-chapter-emoji" aria-hidden="true">{locked ? '🔒' : c.emoji}</span>
                    <span className="ws-chapter-text">
                      <span className="ws-chapter-no">Chapter {i + 1}</span>
                      <span className="ws-chapter-title">{c.title}</span>
                      <span className="ws-chapter-boss">Boss: {BOSSES[i].name}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="ws-howto">
              <span>👆 Drag left and right</span><span>⌨️ or use ← → / A D</span><span>🔫 Your squad fires by itself</span>
            </div>
            {error && <p className="ws-error" role="alert">{error}</p>}
            <div className="ws-menu-row">
              <button type="button" className="ws-btn ws-btn--ghost" onClick={exit}>← Back</button>
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
            <div className="ws-stars" aria-label={`${summary.stars.total} stars`}>
              <span className="ws-star-big">⭐</span><span className="ws-star-num">{summary.stars.total}</span>
            </div>
            <div className="ws-star-break">
              {summary.stars.base} for words · +{summary.stars.bonus} bonus{summary.stars.boss ? ` · +${summary.stars.boss} boss` : ''}
            </div>
            <div className="ws-stats">
              <div><b>{summary.right}/{summary.total}</b><span>right words</span></div>
              <div><b>{summary.squadSize}</b><span>squad size</span></div>
              <div><b>{summary.bugsPopped}</b><span>bugs popped</span></div>
              <div><b>×{summary.bestCombo}</b><span>best combo</span></div>
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
              {summary.won && chapter < 2 && <button type="button" className="ws-btn ws-btn--primary" onClick={() => start(chapter + 1)}>Next chapter ▶</button>}
              <button type="button" className="ws-btn ws-btn--ghost" onClick={quitToMenu}>Chapters</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
