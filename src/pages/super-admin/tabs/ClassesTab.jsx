import { BookOpen, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function ClassesTab({
  centers,
  classesData, classesLoading,
  classesDateFrom, classesDateTo, classesFilterCenter,
  setClassesDateFrom, setClassesDateTo, setClassesFilterCenter,
  classesGrandTotal, classesExpanded, setClassesExpanded,
  loadClasses }) {
  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: 10 }}>
        <h2 className={styles.sectionTitle}><BookOpen size={16} color="#f59e0b" /> Completed Classes</h2>
        <button onClick={() => loadClasses(classesDateFrom, classesDateTo, classesFilterCenter)} className={styles.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 20, flexWrap: 'wrap', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
        <div>
          <label className={styles.label} style={{ display: 'block', marginBottom: 4 }}>From</label>
          <input type="date" value={classesDateFrom} onChange={e => setClassesDateFrom(e.target.value)}
            className={styles.input} style={{ width: 150 }} />
        </div>
        <div>
          <label className={styles.label} style={{ display: 'block', marginBottom: 4 }}>To</label>
          <input type="date" value={classesDateTo} onChange={e => setClassesDateTo(e.target.value)}
            className={styles.input} style={{ width: 150 }} />
        </div>
        <div>
          <label className={styles.label} style={{ display: 'block', marginBottom: 4 }}>Center</label>
          <select value={classesFilterCenter} onChange={e => setClassesFilterCenter(e.target.value)}
            className={styles.input} style={{ width: 220 }}>
            <option value="">All active centers</option>
            {centers.filter(c => c.status === 'active').map(c => (
              <option key={c._id} value={c._id}>{c.centerName}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setClassesExpanded(null); loadClasses(classesDateFrom, classesDateTo, classesFilterCenter); }}
          style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#b45309,#f59e0b)', color: '#0c0a00', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Search size={13} /> Apply Filter
        </button>
        {(classesDateFrom || classesDateTo || classesFilterCenter) && (
          <button
            onClick={() => { setClassesDateFrom(''); setClassesDateTo(''); setClassesFilterCenter(''); setClassesExpanded(null); loadClasses('', '', ''); }}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9ca3af', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >Clear</button>
        )}
      </div>

      {/* Grand total badge */}
      {!classesLoading && classesData.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 16px' }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Classes</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#f59e0b' }}>{classesGrandTotal.toLocaleString()}</p>
          </div>
          <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 10, padding: '10px 16px' }}>
            <p style={{ margin: '0 0 2px', fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Centers</p>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#34d399' }}>{classesData.length}</p>
          </div>
        </div>
      )}

      {classesLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading classes…</div>
      ) : classesData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <BookOpen size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: 14 }}>No completed classes found for the selected filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {classesData.map(center => (
            <div key={center.centerId} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              {/* Center header row — clickable to expand */}
              <button
                onClick={() => setClassesExpanded(classesExpanded === center.centerId ? null : center.centerId)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <BookOpen size={15} color="#f59e0b" />
                  <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{center.centerName}</span>
                  <code className={styles.slug}>{center.slug}</code>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 800 }}>
                    {center.total.toLocaleString()} classes
                  </span>
                  {classesExpanded === center.centerId ? <ChevronUp size={16} color="#6b7280" /> : <ChevronDown size={16} color="#6b7280" />}
                </div>
              </button>

              {/* Expanded class table */}
              {classesExpanded === center.centerId && (
                <div style={{ overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>{['Class Title', 'Topic', 'Teacher', 'Student', 'Date', 'Duration', 'Completed'].map(h => (
                        <th key={h} className={styles.th} style={{ fontSize: 10 }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {center.classes.map(cls => (
                        <tr key={cls._id} className={styles.tr}>
                          <td className={styles.td}><span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{cls.classTitle}</span></td>
                          <td className={styles.td} style={{ color: '#9ca3af', fontSize: 12, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.topic || '—'}</td>
                          <td className={styles.td} style={{ fontSize: 12 }}>
                            <span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{cls.teacherName}</span>
                          </td>
                          <td className={styles.td} style={{ fontSize: 12 }}>
                            <span style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{cls.studentName}</span>
                          </td>
                          <td className={styles.td} style={{ fontSize: 11, color: '#9ca3af' }}>
                            {cls.scheduledTime ? new Date(cls.scheduledTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className={styles.td} style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>{cls.duration} min</td>
                          <td className={styles.td} style={{ fontSize: 11, color: '#6b7280' }}>
                            {cls.completedAt ? new Date(cls.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {center.total > center.classes.length && (
                    <p style={{ margin: '8px 18px', fontSize: 11, color: '#6b7280' }}>Showing {center.classes.length} of {center.total} — use date filters to narrow results.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
