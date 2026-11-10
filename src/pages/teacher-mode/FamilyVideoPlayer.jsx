import { studioText } from './studioLanguage';
import { useEffect, useMemo, useRef, useState } from 'react';

const formatDuration = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function RecordingSession({ parts, base, access, collapsed }) {
  const [index, setIndex] = useState(0), [playError, setPlayError] = useState(''), [open, setOpen] = useState(!collapsed);
  const ref = useRef(null), continuePlaying = useRef(false);
  const current = parts[index], total = parts.reduce((sum, p) => sum + (p.duration || 0), 0);
  const src = current.local ? `${base}/recordings/${current.id}?a=${encodeURIComponent(access)}` : current.url;
  useEffect(() => {
    if (continuePlaying.current && ref.current) {
      continuePlaying.current = false;
      ref.current.play().catch(() => setPlayError('Press play to continue watching.'));
    }
  }, [index]);
  return <article className="tm-family-recording-session"><h3>{parts[0].title || 'Class recording'}</h3>{collapsed && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? studioText('Close recording') : studioText('Watch recording')}</button>}{open && <>{parts.length > 1 && <p className="tm-muted">Part {index + 1} of {parts.length}{total > 0 ? ` · approximately ${formatDuration(total)} total` : ''}. The next part plays automatically.</p>}{current.source === 'external' || (!current.local && !current.source) ? <a href={current.url} target="_blank" rel="noreferrer">Open recording ↗</a> : src ? <video key={current.id} ref={ref} controls preload="metadata" src={src} onError={() => setPlayError('This recording could not be played. Please try again or ask your teacher.')} onEnded={() => { if (index + 1 < parts.length) { continuePlaying.current = true; setPlayError(''); setIndex(i => i + 1); } }} /> : <p>Recording unavailable.</p>}{playError && <p role="status">{playError}</p>}{parts.length > 1 && <div className="tm-actions" aria-label="Recording parts"><button type="button" disabled={index === 0} onClick={() => { continuePlaying.current = false; setPlayError(''); setIndex(i => i - 1); }}>Previous part</button><button type="button" disabled={index === parts.length - 1} onClick={() => { continuePlaying.current = false; setPlayError(''); setIndex(i => i + 1); }}>Next part</button></div>}</>}</article>;
}

export default function FamilyVideoPlayer({ recordings, base, access, collapsed = false }) {
  const sessions = useMemo(() => {
    const groups = new Map();
    for (const recording of recordings) { const key = recording.sessionId || recording.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(recording); }
    return [...groups.entries()].map(([key, parts]) => ({ key, parts: parts.slice().sort((a, b) => (a.partNumber || 1) - (b.partNumber || 1)) }));
  }, [recordings]);
  return <div className="tm-family-video-sessions">{sessions.map(s => <RecordingSession key={s.key} parts={s.parts} base={base} access={access} collapsed={collapsed} />)}</div>;
}
