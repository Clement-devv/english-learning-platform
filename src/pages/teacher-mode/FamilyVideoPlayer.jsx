import { studioText } from './studioLanguage';
import { useEffect, useMemo, useRef, useState } from 'react';

const formatDuration = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function RecordingSession({ parts, base, access, collapsed }) {
  const [index, setIndex] = useState(0), [playError, setPlayError] = useState(''), [open, setOpen] = useState(!collapsed);
  const ref = useRef(null), continuePlaying = useRef(false);
  const pendingSeek = useRef(null);
  const [position, setPosition] = useState({ id: null, seconds: 0 });
  const [measured, setMeasured] = useState({});
  const current = parts[index];
  const durations = parts.map(part => measured[part.id] || Number(part.duration) || 0);
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const offset = durations.slice(0, index).reduce((sum, duration) => sum + duration, 0);
  const elapsed = Math.min(total, offset + (position.id === current.id ? position.seconds : 0));
  const seek = seconds => {
    let next = 0, local = seconds;
    while (next < parts.length - 1 && local >= durations[next]) local -= durations[next++];
    setPosition({ id: parts[next].id, seconds: local });
    if (next === index) { ref.current.currentTime = local; return; }
    pendingSeek.current = local;
    continuePlaying.current = !ref.current.paused;
    setIndex(next);
  };
  const syncDuration = e => {
    const duration = e.currentTarget.duration;
    if (Number.isFinite(duration) && duration > 0) setMeasured(old => old[current.id] === duration ? old : { ...old, [current.id]: duration });
  };
  const src = current.local ? `${base}/recordings/${current.id}?a=${encodeURIComponent(access)}` : current.url;
  useEffect(() => {
    if (continuePlaying.current && ref.current) {
      continuePlaying.current = false;
      ref.current.play().catch(() => setPlayError('Press play to continue watching.'));
    }
  }, [index]);
  return <article className="tm-family-recording-session"><h3>{parts[0].title || 'Class recording'}</h3>{collapsed && <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? studioText('Close recording') : studioText('Watch recording')}</button>}{open && <>{parts.length > 1 && <p className="tm-muted">Part {index + 1} of {parts.length}{total > 0 ? ` · approximately ${formatDuration(total)} total` : ''}. The next part plays automatically.</p>}{current.source === 'external' || (!current.local && !current.source) ? <a href={current.url} target="_blank" rel="noreferrer">Open recording ↗</a> : src ? <video key={current.id} ref={ref} controls preload="metadata" onDurationChange={syncDuration} onLoadedMetadata={e => {
    syncDuration(e);
    if (pendingSeek.current !== null) {
      e.currentTarget.currentTime = pendingSeek.current;
      pendingSeek.current = null;
    }
  }} onTimeUpdate={e => setPosition({ id: current.id, seconds: e.currentTarget.currentTime })} src={src} onError={() => setPlayError('This recording could not be played. Please try again or ask your teacher.')} onEnded={() => { if (index + 1 < parts.length) { continuePlaying.current = true; setPlayError(''); setIndex(i => i + 1); } }} /> : <p>Recording unavailable.</p>}{src && parts.every((p, i) => durations[i] > 0 && (p.local || p.source === 'app')) && <label>
    {studioText('Recording progress')} · {formatDuration(elapsed)} / {formatDuration(total)}
    <input aria-label={studioText('Recording progress')} type="range" min="0" max={total} step="any" value={elapsed} onChange={e => seek(Number(e.target.value))} />
  </label>}{playError && <p role="status">{playError}</p>}{parts.length > 1 && <div className="tm-actions" aria-label="Recording parts"><button type="button" disabled={index === 0} onClick={() => { continuePlaying.current = false; setPlayError(''); setIndex(i => i - 1); }}>Previous part</button><button type="button" disabled={index === parts.length - 1} onClick={() => { continuePlaying.current = false; setPlayError(''); setIndex(i => i + 1); }}>Next part</button></div>}</>}</article>;
}

export default function FamilyVideoPlayer({ recordings, base, access, collapsed = false }) {
  const sessions = useMemo(() => {
    const groups = new Map();
    for (const recording of recordings) { const key = recording.sessionId || recording.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(recording); }
    return [...groups.entries()].map(([key, parts]) => ({ key, parts: parts.slice().sort((a, b) => (a.partNumber || 1) - (b.partNumber || 1)) }));
  }, [recordings]);
  return <div className="tm-family-video-sessions">{sessions.map(s => <RecordingSession key={s.key} parts={s.parts} base={base} access={access} collapsed={collapsed} />)}</div>;
}
