import { Activity, RefreshCw, UserCheck, Users } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function HealthTab({ health, healthLoading, loadHealth, centers }) {
  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 className={styles.sectionTitle}><Activity size={16} color="#34d399" /> Center Health</h2>
        <button onClick={loadHealth} className={styles.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
        Live counts from each center's database. Last Activity shows the most recent booking.
      </p>
      {healthLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading health data…</div>
      ) : health.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No active centers.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Center', 'Teachers', 'Students', 'Bookings (month)', 'Last Activity'].map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {health.map(h => {
                const daysSince = h.lastActivity
                  ? Math.floor((Date.now() - new Date(h.lastActivity)) / 86400000)
                  : null;
                const actColor = daysSince === null ? '#6b7280'
                  : daysSince <= 7  ? '#34d399'
                  : daysSince <= 30 ? '#f59e0b'
                  : '#f87171';
                return (
                  <tr key={h._id} className={styles.tr}>
                    <td className={styles.td}>
                      <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f9' }}>{centers.find(c => c._id === String(h._id))?.centerName || h.slug}</p>
                      <code className={styles.slug} style={{ fontSize: 11 }}>{h.slug}</code>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserCheck size={13} color="#818cf8" />
                        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{h.teachers}</span>
                        {h.maxTeachers && h.maxTeachers !== -1 && (
                          <span style={{ color: '#6b7280', fontSize: 11 }}>/ {h.maxTeachers}</span>
                        )}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={13} color="#34d399" />
                        <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{h.students}</span>
                        {h.maxStudents && h.maxStudents !== -1 && (
                          <span style={{ color: '#6b7280', fontSize: 11 }}>/ {h.maxStudents}</span>
                        )}
                      </div>
                    </td>
                    <td className={styles.td} style={{ fontWeight: 700, color: h.bookingsThisMonth > 0 ? '#34d399' : '#6b7280' }}>
                      {h.bookingsThisMonth}
                    </td>
                    <td className={styles.td} style={{ color: actColor, fontSize: 12, fontWeight: 600 }}>
                      {h.lastActivity
                        ? daysSince === 0 ? 'Today'
                        : daysSince === 1 ? 'Yesterday'
                        : `${daysSince}d ago`
                        : 'No bookings yet'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
