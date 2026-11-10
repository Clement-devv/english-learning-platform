import { useCallback, useEffect, useState } from 'react';

export default function StandaloneTeacherActivity({ teacher, call, onClose, panel, button }) {
  const [page, setPage] = useState(1), [data, setData] = useState(null), [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await call(`/workspaces/${teacher._id}/activity?page=${page}`)); setError(''); }
    catch (e) { setError(e.message); }
  }, [call, teacher._id, page]);
  useEffect(() => { load(); }, [load]);
  return <section style={panel}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><h3>Teaching activity · {teacher.name}</h3><button style={button} onClick={onClose}>Close activity</button></div><p>Super Admin oversight. The teacher manages their own lessons, rates and family sharing.</p>{error && <p role="alert">{error}<button style={button} onClick={load}>Retry</button></p>}{!data ? <p role="status">Loading teaching activity…</p> : <>{data.classes.map(c => <article key={c._id} style={{ borderTop: '1px solid var(--sa-line)', padding: '16px 0' }}><strong>{c.classTitle || c.title}</strong><p>{data.centers.find(x => x._id === c.managedCenterId)?.name || 'Managed center'} · {c.status} · {new Date(c.scheduledTime).toLocaleString()} · {c.duration} min</p><p>{(c.enrollments ? c.enrollments.map(e => e.studentId) : [c.studentId]).map(id => data.students.find(s => s._id === id)).filter(Boolean).map(s => `${s.firstName} ${s.lastName || ''}`.trim()).join(', ')}</p><p style={{ whiteSpace: 'pre-wrap' }}>{c.classSummary?.text || 'No class summary yet.'}</p>{c.missedReason && <p>{c.missedReason}</p>}</article>)}{!data.classes.length && <p>No teaching activity yet.</p>}<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><button style={button} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page} of {data.pagination.totalPages}</span><button style={button} disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button></div></>}</section>;
}
