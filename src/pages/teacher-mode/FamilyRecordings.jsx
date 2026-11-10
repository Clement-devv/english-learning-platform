import { studioText } from './studioLanguage';
import { useCallback, useEffect, useState } from 'react';
import { Video } from 'lucide-react';
import FamilyVideoPlayer from './FamilyVideoPlayer';

export default function FamilyRecordings({ request, base, access }) {
  const [items, setItems] = useState(null), [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const load = useCallback(async next => {
    setLoading(true); setError('');
    try {
      const r = await request('get', `/recordings?page=${next}`);
      const data = r.data.data;
      setItems(current => next === 1 ? data.items : [...(current || []), ...data.items.filter(item => !current?.some(old => old.id === item.id))]);
      setPage(next); setHasMore(data.hasMore);
    } catch { setError('Recordings could not be loaded.'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { setItems(null); setPage(0); load(1); }, [load]);
  return <section id="family-recordings" className="tm-family-section"><div className="tm-family-section-heading"><div><span className="tm-eyebrow">{studioText('WATCH & REVISIT')}</span><h2>{studioText('Class recordings')}</h2><p>Revisit the moments your teacher has shared with your family.</p></div><Video size={22} /></div>{error && <p role="alert">{error} <button type="button" onClick={() => load(page + 1)}>Retry</button></p>}{items === null ? <p role="status">{studioText('Loading recordings…')}</p> : items.length ? <FamilyVideoPlayer recordings={items} base={base} access={access} collapsed /> : <div className="tm-family-empty"><Video size={21} /><p>{studioText('No recordings have been shared yet. When your teacher shares one, it will appear here.')}</p></div>}{hasMore && <button type="button" disabled={loading} onClick={() => load(page + 1)}>{studioText(loading ? 'Loading…' : 'Show older recordings')}</button>}</section>;
}
