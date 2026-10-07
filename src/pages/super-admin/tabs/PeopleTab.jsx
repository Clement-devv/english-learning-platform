// src/pages/super-admin/tabs/PeopleTab.jsx
// Super admin → People: a center's active teachers / students, 25 a page,
// searched on the server (name, email, TCH-/STU- ID).
// Server: GET /api/v1/super-admin/centers/:id/people?type&page&q
import { useEffect, useRef, useState } from 'react';
import { Users, GraduationCap, Search } from 'lucide-react';
import Pagination from '../../../components/Pagination';
import styles from '../SuperAdmin.module.css';
import { visibleEmail } from "../../../utils/managedStudent.js";

const PAGE_SIZE = 25;
const codeChip = { color: 'var(--sa-text-2)', background: 'var(--sa-w06)', padding: '1px 6px', borderRadius: 6, fontSize: 11 };

export default function PeopleTab({ centers, peopleCenter, setPeopleCenter, apiBase, authHeaders }) {
  const [type, setType]       = useState('teachers');
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');
  const [page, setPage]       = useState(1);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const reqId = useRef(0);
  const headersRef = useRef(authHeaders);
  headersRef.current = authHeaders;

  useEffect(() => {
    if (!peopleCenter) { setData(null); return; }
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ type, page: String(page), limit: String(PAGE_SIZE) });
    if (query) params.set('q', query);
    fetch(`${apiBase}/super-admin/centers/${peopleCenter}/people?${params}`, { headers: headersRef.current })
      .then(r => r.json())
      .then(d => {
        if (id !== reqId.current) return;
        if (!d.success) throw new Error(d.message || 'Could not load people');
        setData(d.data); setError('');
        if (d.data.pagination.page !== page) setPage(d.data.pagination.page);
      })
      .catch(e => { if (id === reqId.current) setError(e.message || 'Could not load people'); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [apiBase, peopleCenter, type, page, query]);

  // Search as you type (short pause), not on every key
  useEffect(() => {
    const t = setTimeout(() => { if (search.trim() !== query) { setQuery(search.trim()); setPage(1); } }, 350);
    return () => clearTimeout(t);
  }, [search, query]);

  const pickCenter = (id) => { setPeopleCenter(id); setType('teachers'); setSearch(''); setQuery(''); setPage(1); setData(null); };
  const pickType = (t) => { setType(t); setSearch(''); setQuery(''); setPage(1); };

  const counts = data?.counts || { teachers: 0, students: 0 };
  const items = data?.type === type ? data.items : [];
  const pager = data?.pagination || { page: 1, totalPages: 1, total: 0, limit: PAGE_SIZE };

  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: 10 }}>
        <h2 className={styles.sectionTitle}><Users size={16} color="#34d399" /> People</h2>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Active teachers and students per center</span>
      </div>

      {/* Center selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={peopleCenter} onChange={e => pickCenter(e.target.value)} aria-label="Center"
          className={styles.input} style={{ width: 260, flex: '0 0 auto' }}>
          <option value="">— Select a center —</option>
          {centers.filter(c => c.status === 'active').map(c => (
            <option key={c._id} value={c._id}>{c.centerName}</option>
          ))}
        </select>
      </div>

      {!peopleCenter && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4b5563' }}>
          <Users size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Select a center to view its active members</p>
        </div>
      )}

      {peopleCenter && (
        <>
          {/* Sub-tab bar + search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'teachers', label: `Teachers (${counts.teachers})`, icon: GraduationCap },
                { key: 'students', label: `Students (${counts.students})`, icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => pickType(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: type === key ? '1px solid rgba(52,211,153,0.3)' : '1px solid var(--sa-w07)', background: type === key ? 'rgba(52,211,153,0.1)' : 'var(--sa-w03)', color: type === key ? '#34d399' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Search people"
                placeholder="Search name, email or ID…"
                className={styles.input} style={{ paddingLeft: 30, width: 240, fontSize: 12 }} />
            </div>
          </div>

          {error && <p role="alert" style={{ color: 'var(--sa-red-text)', fontSize: 13 }}>{error}</p>}

          {loading && !data ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280', fontSize: 13 }}>
              {query ? `No ${type} match "${query}".` : `No active ${type}.`}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
              <table className={styles.table}>
                {type === 'teachers' ? (
                  <>
                    <thead><tr>{['Name', 'Email', 'Continent', 'Specializations', 'Lessons', 'Joined'].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {items.map(t => (
                        <tr key={t._id} className={styles.tr}>
                          <td className={styles.td}>
                            <span style={{ fontWeight: 600, color: 'var(--sa-text)' }}>{t.name}</span>
                            {t.code && <div style={{ marginTop: 3 }}><code style={codeChip}>{t.code}</code></div>}
                          </td>
                          <td className={styles.td} style={{ color: 'var(--sa-muted)', fontSize: 12 }}>{t.email}</td>
                          <td className={styles.td}><span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{t.continent || '—'}</span></td>
                          <td className={styles.td} style={{ fontSize: 11, color: 'var(--sa-muted)', maxWidth: 180 }}>
                            {t.specializations.length > 0
                              ? t.specializations.slice(0, 3).join(', ') + (t.specializations.length > 3 ? ` +${t.specializations.length - 3}` : '')
                              : '—'}
                          </td>
                          <td className={styles.td} style={{ fontWeight: 700, color: t.lessonsCompleted > 0 ? '#f59e0b' : '#4b5563' }}>{t.lessonsCompleted}</td>
                          <td className={styles.td} style={{ fontSize: 11, color: '#6b7280' }}>{t.joinedAt ? new Date(t.joinedAt).toLocaleDateString('en-GB') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead><tr>{['Name', 'Email', 'Country', 'Classes Taken', 'Joined'].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {items.map(st => (
                        <tr key={st._id} className={styles.tr}>
                          <td className={styles.td}>
                            <span style={{ fontWeight: 600, color: 'var(--sa-text)' }}>{st.name}</span>
                            {st.code && <div style={{ marginTop: 3 }}><code style={codeChip}>{st.code}</code></div>}
                          </td>
                          <td className={styles.td} style={{ color: 'var(--sa-muted)', fontSize: 12 }}>{visibleEmail(st.email) || "No login (managed)"}</td>
                          <td className={styles.td}><span style={{ background: 'rgba(219,39,119,0.1)', color: '#f472b6', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{st.country || '—'}</span></td>
                          <td className={styles.td} style={{ fontWeight: 700, color: st.classes > 0 ? '#34d399' : '#4b5563' }}>{st.classes}</td>
                          <td className={styles.td} style={{ fontSize: 11, color: '#6b7280' }}>{st.joinedAt ? new Date(st.joinedAt).toLocaleDateString('en-GB') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={setPage} isDarkMode />
          </div>
        </>
      )}
    </div>
  );
}
