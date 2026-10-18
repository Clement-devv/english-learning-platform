// src/components/dashboard/FlipBoard.jsx
// Wraps a dashboard welcome banner. When the super admin has a board message (ad or
// information) for this person, the banner flips over, shows it for the time the super
// admin set, then flips back. Two ways in, chosen per message:
//   • on sign-in — flips by itself once per sign-in
//   • on tap     — tap the banner (or the little megaphone) to see it; each tap shows the next one
// The back face sits on the banner's own box, so the message is always the exact board size.
// Pauses while hovered or while the browser tab is hidden. Esc / × flips back early.
// Server: GET /board, POST /board/:id/seen|click  (server/routes/boardRoutes.js)
// Styles: .fb-* in src/index.css
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone, X, ExternalLink } from 'lucide-react';
import api from '../../api';
import { getStoredToken } from '../../utils/authStorage';

const AUTO_DELAY = 1100;    // let the dashboard settle before the sign-in flip
const FLIP_MS = 640;        // keep in sync with .fb-card transition in index.css

/** Messages already auto-shown in THIS sign-in (a new sign-in = a new token = shown again) */
const seenStore = (role) => {
  const key = `board-seen:${role}`;
  const token = String(getStoredToken(role) || '').slice(-16);
  let data = { token, ids: [] };
  try { const d = JSON.parse(localStorage.getItem(key) || 'null'); if (d?.token === token) data = d; } catch { /* storage blocked */ }
  return {
    has: (id) => data.ids.includes(id),
    add: (list) => {
      data = { token, ids: [...new Set([...data.ids, ...list])].slice(-50) };
      try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* storage blocked */ }
    },
  };
};

export default function FlipBoard({ role, children, style, radius = 20, className = '' }) {
  const [messages, setMessages] = useState([]);
  const [queue, setQueue] = useState(null);       // messages in the current showing
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [paused, setPaused] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const rootRef = useRef(null);
  const timer = useRef({ id: null, startedAt: 0, left: 0 });
  const clickTurn = useRef(0);

  // ── load this person's messages ──
  useEffect(() => {
    let stale = false;
    api.get('/board')
      .then(({ data }) => { if (!stale) setMessages(Array.isArray(data?.data) ? data.data : []); })
      .catch(() => {});
    return () => { stale = true; };
  }, []);

  // board width → phone picture when the board is narrow
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flipBack = useCallback(() => {
    clearTimeout(timer.current.id);
    setFlipped(false);
    setPaused(false);
    // keep the content during the turn so the back doesn't go blank mid-flip
    setTimeout(() => setQueue((q) => (q && !rootRef.current?.dataset.flipped ? null : q)), FLIP_MS);
  }, []);

  const play = useCallback((list) => {
    if (!list.length) return;
    setQueue(list);
    setIdx(0);
    setFlipped(true);
  }, []);

  // ── sign-in flip: once per sign-in, after the page settles ──
  useEffect(() => {
    const seen = seenStore(role);
    const fresh = messages.filter((m) => m.showOnLogin && !seen.has(m._id));
    if (!fresh.length) return;
    const t = setTimeout(() => { seen.add(fresh.map((m) => m._id)); play(fresh); }, AUTO_DELAY);
    return () => clearTimeout(t);
  }, [messages, role, play]);

  // count a view each time a message comes up
  const current = queue?.[idx];
  useEffect(() => {
    if (flipped && current) api.post(`/board/${current._id}/seen`).catch(() => {});
  }, [flipped, current]);

  // ── timer: next message, or flip back; pausable ──
  useEffect(() => {
    if (!flipped || !current) return;
    timer.current.left = current.durationSec * 1000;
  }, [flipped, current]);

  useEffect(() => {
    if (!flipped || !current) return;
    const t = timer.current;
    if (paused) {
      clearTimeout(t.id);
      t.left = Math.max(0, t.left - (Date.now() - t.startedAt));
      return;
    }
    t.startedAt = Date.now();
    t.id = setTimeout(() => {
      if (queue && idx + 1 < queue.length) setIdx((i) => i + 1);
      else flipBack();
    }, t.left);
    return () => clearTimeout(t.id);
  }, [flipped, current, paused, queue, idx, flipBack]);

  // pause while the tab is hidden; Esc flips back
  useEffect(() => {
    if (!flipped) return;
    const onVis = () => setPaused(document.hidden);
    const onKey = (e) => { if (e.key === 'Escape') flipBack(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('keydown', onKey); };
  }, [flipped, flipBack]);

  const tappable = messages.filter((m) => m.showOnClick);
  const showNext = () => {
    if (flipped || !tappable.length) return;
    const m = tappable[clickTurn.current % tappable.length];
    clickTurn.current += 1;
    play([m]);
  };

  const onCta = (m) => {
    api.post(`/board/${m._id}/click`).catch(() => {});
  };

  const img = current && (narrow && current.mobileImageUrl ? current.mobileImageUrl : current.imageUrl);
  const isImage = current?.layout === 'image' && img;
  const label = current?.kind === 'ad' ? 'Sponsored' : 'Announcement';

  return (
    <div ref={rootRef} className={`fb ${className}`} style={{ ...style, '--fb-radius': `${radius}px` }} data-flipped={flipped || undefined}>
      <div className="fb-card">
        {/* Front: the normal banner */}
        <div
          className={`fb-front${tappable.length ? ' fb-front--tap' : ''}`}
          inert={flipped}
          aria-hidden={flipped || undefined}
          onClick={showNext}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); showNext(); } }}
          role={tappable.length ? 'button' : undefined}
          tabIndex={tappable.length ? 0 : undefined}
          aria-label={tappable.length ? `Show ${tappable.length === 1 ? 'the announcement' : `announcements (${tappable.length})`}` : undefined}
        >
          {children}
          {tappable.length > 0 && (
            <span className="fb-hint" aria-hidden="true">
              <Megaphone size={14} strokeWidth={2.4} />
              {tappable.length > 1 && <span className="fb-hint-count">{tappable.length}</span>}
            </span>
          )}
        </div>

        {/* Back: the message, same box as the banner */}
        <div
          className={`fb-back ${isImage ? 'fb-back--image' : current?.kind === 'ad' ? 'fb-back--ad' : 'fb-back--info'}`}
          inert={!flipped}
          aria-hidden={!flipped || undefined}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') setPaused(true); }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setPaused(false); }}
        >
          {current && (
            <div key={`${current._id}-${idx}`} className={`fb-msg${current.title || current.body || current.ctaUrl ? ' fb-msg--text' : ''}`}>
              {isImage && <img className="fb-img" src={img} alt={current.title || label} draggable="false" />}
              <div className="fb-content">
                <div className="fb-text">
<span className="fb-label">{current.kind === 'ad' ? null : <Megaphone size={11} strokeWidth={2.6} />}{label}</span>
                {current.title && <h3 className="fb-title">{current.title}</h3>}
                {current.body && <p className="fb-body">{current.body}</p>}
</div>
                {current.ctaUrl && (
                  <a className="fb-cta" href={current.ctaUrl} target="_blank" rel="noopener noreferrer" onClick={() => onCta(current)}>
                    {current.ctaLabel || 'Learn more'} <ExternalLink size={13} strokeWidth={2.4} />
                  </a>
                )}
              </div>
              <span className="fb-progress" style={{ animationDuration: `${current.durationSec}s`, animationPlayState: paused ? 'paused' : 'running' }} />
            </div>
          )}
          {queue?.length > 1 && <span className="fb-count">{idx + 1} / {queue.length}</span>}
          <button type="button" className="fb-close" onClick={flipBack} aria-label="Close">
            <X size={15} strokeWidth={2.6} />
          </button>
        </div>
      </div>
    </div>
  );
}
