import SummaryPreview from './SummaryPreview';
import { useCallback, useEffect, useState } from 'react';
import { studioText } from './studioLanguage';
import { BookOpen, MessageSquareText } from 'lucide-react';

export default function FamilyClassUpdates({ work, request, run, busy }) {
  const [items, setItems] = useState(null), [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const load = useCallback(async (next) => {
    setLoading(true); setError('');
    try {
      const response = await request('get', `/work?page=${next}`);
      const data = response.data.data;
      setItems(current => next === 1 ? data.items : [...(current || []), ...data.items.filter(item => !current?.some(old => old._id === item._id))]);
      setPage(next); setHasMore(data.hasMore);
    } catch { setError('Class reviews could not be loaded. Please try again.'); }
    finally { setLoading(false); }
  }, [request]);
  const latestUpdate = work?.[0]?._id;
  useEffect(() => { setItems(null); setPage(0); load(1); }, [load, latestUpdate]);
  const attendance = (w, attended) => run(async () => {
    await request('post', `/work/${w._id}/attendance`, { attended });
    setItems(current => current.map(item => item._id === w._id ? { ...item, attended } : item));
  });
  return <section id="family-reviews" className="tm-family-section"><div className="tm-family-section-heading"><div><span className="tm-eyebrow">{studioText('A WINDOW INTO THEIR PROGRESS')}</span><h2>{studioText('Class reviews')}</h2><p>Read your teacher’s notes about what your child learned and how they’re progressing.</p></div><BookOpen size={22} /></div>
    {error && <p role="alert">{error} <button type="button" onClick={() => load(page + 1)}>Retry</button></p>}
    {items === null ? <p role="status">{studioText('Loading class reviews…')}</p> : !items.length ? <div className="tm-family-empty"><MessageSquareText size={21} /><p>Your teacher hasn’t shared a class review yet. It will appear here when they publish one.</p></div> : <div className="tm-family-updates">{items.map(w => <article className="tm-card tm-family-update" key={w._id}><div className="tm-row"><span className="tm-tag">{w.class?.status === 'completed' ? 'Completed lesson' : 'Class update'}</span>{w.class && <span className="tm-family-date">{new Date(w.class.scheduledTime).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}</div><h3>{w.title}</h3>{w.class?.duration && <p className="tm-family-duration">{w.class.duration} minute lesson</p>}<div className="tm-family-review-copy"><span className="tm-eyebrow">{studioText('YOUR TEACHER’S NOTES')}</span><SummaryPreview text={w.summary || 'Your teacher has shared this class with you.'} /></div>{w.class?.status === 'completed' && <details className="tm-family-feedback"><summary>Attendance</summary><p>Did your child attend this lesson?</p><div className="tm-actions"><button disabled={busy} onClick={() => attendance(w, 'yes')}>{w.attended === 'yes' ? studioText('Confirmed attended') : studioText('Yes, attended')}</button><button disabled={busy} onClick={() => attendance(w, 'no')}>{w.attended === 'no' ? studioText('Issue reported') : studioText('There is a problem')}</button></div></details>}</article>)}</div>}
    {hasMore && <button type="button" disabled={loading} onClick={() => load(page + 1)}>{studioText(loading ? 'Loading…' : 'Show older class reviews')}</button>}
  </section>;
}
