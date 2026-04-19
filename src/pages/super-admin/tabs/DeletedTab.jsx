import { Trash2, RefreshCw, RotateCcw } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function DeletedTab({ deleted, loadData, restoring, handleRestore, daysRemaining }) {
  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 className={styles.sectionTitle}><Trash2 size={16} color="#ef4444" /> Scheduled for Deletion</h2>
        <button onClick={loadData} className={styles.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
        Centers below will be permanently deleted after their countdown expires. Restore them before the deadline to reactivate.
      </p>

      {deleted.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          No centers are currently scheduled for deletion.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Center', 'Slug', 'Deleted On', 'Permanent Deletion', 'Days Left', ''].map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deleted.map(c => {
                const days = daysRemaining(c.scheduledDeletionAt);
                const urgent = days <= 2;
                return (
                  <tr key={c._id} className={styles.tr}>
                    <td className={styles.td}>
                      <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{c.centerName}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{c.adminEmail}</p>
                    </td>
                    <td className={styles.td}><code className={styles.slug}>{c.slug}</code></td>
                    <td className={styles.td} style={{ fontSize: '12px', color: '#6b7280' }}>
                      {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className={styles.td} style={{ fontSize: '12px', color: urgent ? '#f87171' : '#9ca3af', fontWeight: urgent ? '700' : '400' }}>
                      {c.scheduledDeletionAt ? new Date(c.scheduledDeletionAt).toLocaleDateString() : '—'}
                    </td>
                    <td className={styles.td}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '13px', fontWeight: '700',
                        color: days === 0 ? '#ef4444' : urgent ? '#f59e0b' : '#34d399',
                      }}>
                        {days === 0 ? '⚠️ Expired' : `${days} day${days === 1 ? '' : 's'}`}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <button
                        onClick={() => handleRestore(c)}
                        disabled={restoring === c._id}
                        className={styles.approveBtn}
                      >
                        <RotateCcw size={12} />
                        {restoring === c._id ? 'Restoring…' : 'Restore'}
                      </button>
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
