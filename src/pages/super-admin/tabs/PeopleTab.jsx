import { Users, GraduationCap, Search } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function PeopleTab({
  centers, peopleCenter, setPeopleCenter, peopleData, peopleLoading,
  peopleSubTab, setPeopleSubTab, peopleSearch, setPeopleSearch, loadCenterPeople }) {
  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: 10 }}>
        <h2 className={styles.sectionTitle}><Users size={16} color="#34d399" /> People</h2>
        <span style={{ fontSize: 12, color: '#6b7280' }}>Active teachers and students per center</span>
      </div>

      {/* Center selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          value={peopleCenter}
          onChange={e => {
            setPeopleCenter(e.target.value);
            setPeopleSearch('');
            setPeopleSubTab('teachers');
            loadCenterPeople(e.target.value);
          }}
          className={styles.input} style={{ width: 260, flex: '0 0 auto' }}
        >
          <option value="">— Select a center —</option>
          {centers.filter(c => c.status === 'active').map(c => (
            <option key={c._id} value={c._id}>{c.centerName}</option>
          ))}
        </select>
        {peopleData && (
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {peopleData.teachers.length} Teachers
            </span>
            <span style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
              {peopleData.students.length} Students
            </span>
          </div>
        )}
      </div>

      {!peopleCenter && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4b5563' }}>
          <Users size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 14 }}>Select a center to view its active members</p>
        </div>
      )}

      {peopleCenter && peopleLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading…</div>
      )}

      {peopleCenter && !peopleLoading && peopleData && (
        <>
          {/* Sub-tab bar + search */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'teachers', label: `Teachers (${peopleData.teachers.length})`, icon: GraduationCap },
                { key: 'students', label: `Students (${peopleData.students.length})`, icon: Users },
              ].map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => { setPeopleSubTab(key); setPeopleSearch(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: peopleSubTab === key ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255,255,255,0.07)', background: peopleSubTab === key ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.03)', color: peopleSubTab === key ? '#34d399' : '#6b7280', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                value={peopleSearch}
                onChange={e => setPeopleSearch(e.target.value)}
                placeholder="Search name or email…"
                className={styles.input} style={{ paddingLeft: 30, width: 220, fontSize: 12 }}
              />
            </div>
          </div>

          {/* Teachers table */}
          {peopleSubTab === 'teachers' && (() => {
            const rows = peopleData.teachers.filter(t =>
              !peopleSearch || t.name.toLowerCase().includes(peopleSearch.toLowerCase()) || t.email.toLowerCase().includes(peopleSearch.toLowerCase())
            );
            return rows.length === 0
              ? <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280', fontSize: 13 }}>{peopleSearch ? 'No teachers match your search.' : 'No active teachers.'}</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>{['Name', 'Email', 'Continent', 'Specializations', 'Lessons', 'Joined'].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map(t => (
                        <tr key={t._id} className={styles.tr}>
                          <td className={styles.td}><span style={{ fontWeight: 600, color: '#f1f5f9' }}>{t.name}</span></td>
                          <td className={styles.td} style={{ color: '#9ca3af', fontSize: 12 }}>{t.email}</td>
                          <td className={styles.td}><span style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{t.continent || '—'}</span></td>
                          <td className={styles.td} style={{ fontSize: 11, color: '#9ca3af', maxWidth: 180 }}>
                            {t.specializations.length > 0
                              ? t.specializations.slice(0, 3).join(', ') + (t.specializations.length > 3 ? ` +${t.specializations.length - 3}` : '')
                              : '—'}
                          </td>
                          <td className={styles.td} style={{ fontWeight: 700, color: t.lessonsCompleted > 0 ? '#f59e0b' : '#4b5563' }}>{t.lessonsCompleted}</td>
                          <td className={styles.td} style={{ fontSize: 11, color: '#6b7280' }}>{t.joinedAt ? new Date(t.joinedAt).toLocaleDateString('en-GB') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
          })()}

          {/* Students table */}
          {peopleSubTab === 'students' && (() => {
            const rows = peopleData.students.filter(st =>
              !peopleSearch || st.name.toLowerCase().includes(peopleSearch.toLowerCase()) || st.email.toLowerCase().includes(peopleSearch.toLowerCase())
            );
            return rows.length === 0
              ? <div style={{ textAlign: 'center', padding: '30px', color: '#6b7280', fontSize: 13 }}>{peopleSearch ? 'No students match your search.' : 'No active students.'}</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>{['Name', 'Email', 'Country', 'Classes Taken', 'Joined'].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map(st => (
                        <tr key={st._id} className={styles.tr}>
                          <td className={styles.td}><span style={{ fontWeight: 600, color: '#f1f5f9' }}>{st.name}</span></td>
                          <td className={styles.td} style={{ color: '#9ca3af', fontSize: 12 }}>{st.email}</td>
                          <td className={styles.td}><span style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{st.country || '—'}</span></td>
                          <td className={styles.td} style={{ fontWeight: 700, color: st.classes > 0 ? '#34d399' : '#4b5563' }}>{st.classes}</td>
                          <td className={styles.td} style={{ fontSize: 11, color: '#6b7280' }}>{st.joinedAt ? new Date(st.joinedAt).toLocaleDateString('en-GB') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
          })()}
        </>
      )}
    </div>
  );
}
