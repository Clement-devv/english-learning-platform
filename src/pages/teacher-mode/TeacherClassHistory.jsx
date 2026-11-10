import { studioText } from './studioLanguage';
import { useCallback, useEffect, useState } from 'react';
import api from '../../api';
import { StudioEmpty, StudioIntro } from './StudioUI';
import { BookOpen } from 'lucide-react';

export default function TeacherClassHistory({ teacherInfo, centerId, onNavigate }) {
  const [view, setView] = useState('all'), [q, setQ] = useState(''), [page, setPage] = useState(1);
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [data, setData] = useState({ classes: [], pagination: { totalPages: 1 } });
  const [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const id = teacherInfo._id || teacherInfo.id;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get(`/bookings/teacher/${id}/history`, { params: { view, q, page, from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined } });
      setData(response.data);
    } catch { setError('Unable to load class history. Please retry.'); }
    finally { setLoading(false); }
  }, [id, view, q, page, from, to, centerId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const timer = setTimeout(load, 250); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { setPage(1); }, [view, q, from, to, centerId]);
  return <><StudioIntro eyebrow="YOUR TEACHING RECORD" title="Every lesson, accounted for.">Review completed and missed classes. You decide when a lesson is taught and when its summary is shared with families.</StudioIntro>
    <details className="tm-card tm-history-filters"><summary>Search and filter classes</summary><label>Search classes or students<input type="search" value={q} onChange={e => setQ(e.target.value)} /></label><label>From<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label><button onClick={() => window.print()}>Print record</button></details>
    <div className="tm-list-toolbar"><h3>Class history</h3><div className="tm-segmented" role="group" aria-label="Filter class outcomes">{[['all', 'All'], ['completed', 'Completed'], ['not_completed', 'Not completed']].map(([value, label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => { setPage(1); setView(value); }}>{label}</button>)}</div></div>
    {error && <p role="alert" className="tm-notice tm-error">{error}<button onClick={load}>Retry</button></p>}
    {loading ? <p role="status">Loading class history…</p> : <div className="tm-lesson-records">{data.classes?.length ? data.classes.map(c => <article className="tm-card tm-history-record" key={c.id}><div className="tm-row"><span className="tm-tag">{c.isGroupClass ? 'Group lesson' : 'Individual lesson'}</span><span className={(c.officiallyCompleted && !c.adminRejected) ? 'tm-history-done' : 'tm-history-incomplete'}>{(c.officiallyCompleted && !c.adminRejected) ? 'Completed' : 'Not completed'}</span></div><h3>{c.title}</h3><p className="tm-muted">{new Date(c.scheduledTime).toLocaleString()} · {c.duration} min</p>{(!c.officiallyCompleted || c.adminRejected) && <p className="tm-history-note"><strong>What happened:</strong> {c.missedReason || c.adminRejectedReason || (c.isMissed ? 'No reason was recorded for this missed class.' : 'This class has not been marked complete. Open the lesson to record its outcome.')}</p>}<details className="tm-history-details"><summary>Class details</summary><p><strong>Students:</strong> {c.students?.filter(Boolean).join(', ') || 'No student details available'}</p>{c.topic && <p><strong>Topic:</strong> {c.topic}</p>}<button onClick={() => onNavigate((c.officiallyCompleted && !c.adminRejected) ? 'class-summaries' : 'classes')}>{(c.officiallyCompleted && !c.adminRejected) ? 'Write or review summary' : 'Manage lesson'}</button></details></article>) : <StudioEmpty icon={BookOpen} title="Your teaching story starts here.">Completed and missed lessons will appear here.</StudioEmpty>}</div>}
    <div className="tm-actions" aria-label="Class history pagination"><button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>{studioText("Previous")}</button><span>Page {page} of {data.pagination?.totalPages || 1}</span><button disabled={page >= (data.pagination?.totalPages || 1) || loading} onClick={() => setPage(p => p + 1)}>{studioText("Next")}</button></div>
  </>;
}
