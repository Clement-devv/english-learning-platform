import { useEffect, useState } from 'react';
import api from '../../api';
import { studioMoney } from './studioFormatting';

export default function TeacherEarningsHistory({ centerId, refreshKey }) {
  const [page, setPage] = useState(1), [history, setHistory] = useState(null), [error, setError] = useState('');
  useEffect(() => { setPage(1); setHistory(null); setError(''); }, [centerId]);
  useEffect(() => {
    if (!centerId) return;
    let current = true;
    api.get('/earnings/history', { params: { centerId, page } }).then(r => { if (current) { setHistory(r.data.data); setError(''); } }).catch(() => { if (current) setError('Could not load earnings history.'); });
    return () => { current = false; };
  }, [centerId, page, refreshKey]);
  if (!centerId) return <p className="tm-muted">Choose a center in Workspace view to see its class and payment history.</p>;
  return <section className="tm-card tm-earnings-history"><h3>Class and payment history</h3>{error && <p role="alert">{error}</p>}{!history ? <p role="status">Loading history…</p> : <>{!history.entries.length && <p className="tm-muted">Completed classes and payments will appear here.</p>}{history.entries.map(e => <article key={`${e.type}-${e.id}`} className="tm-earnings-history-row"><div><strong>{e.title}</strong><p className="tm-muted">{new Date(e.date).toLocaleDateString()} · {e.type === 'payment' ? 'Payment received' : `${e.type === 'group' ? 'Group class' : 'Class'} · ${e.duration} min`}</p></div><strong>{e.type === 'payment' ? 'Received ' : 'Earned '}{studioMoney(e.amountMinor, e.currency)}</strong></article>)}<div className="tm-actions"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {history.totalPages}</span><button disabled={page >= history.totalPages} onClick={() => setPage(p => p + 1)}>Next</button></div></>}</section>;
}
