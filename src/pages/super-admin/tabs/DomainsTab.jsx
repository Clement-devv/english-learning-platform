import { Globe, RefreshCw, CheckCircle, Clock, Trash2 } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function DomainsTab({
  domains, loading, loadData,
  handleVerifyDomain, handleRemoveDomain, domainAction }) {
  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 className={styles.sectionTitle}><Globe size={16} color="#f59e0b" /> Custom Domains</h2>
        <button onClick={loadData} className={styles.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
      ) : domains.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          No custom domains submitted yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Center', 'Domain', 'Plan', 'DNS Status', 'Requested', 'Actions'].map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {domains.map(d => (
                <tr key={d._id} className={styles.tr}>
                  <td className={styles.td}>
                    <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{d.centerName}</p>
                    <code className={styles.slug} style={{ fontSize: '11px' }}>{d.slug}</code>
                  </td>
                  <td className={styles.td}>
                    <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>{d.customDomain}</span>
                  </td>
                  <td className={styles.td}><span className={styles.planBadge}>{d.plan || 'basic'}</span></td>
                  <td className={styles.td}>
                    {d.domainVerified ? (
                      <span className={styles.statusBadge} style={{ color: '#10b981', borderColor: '#10b98140', background: '#10b98112' }}>
                        <CheckCircle size={12} /> Verified
                      </span>
                    ) : (
                      <span className={styles.statusBadge} style={{ color: '#f59e0b', borderColor: '#f59e0b40', background: '#f59e0b12' }}>
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </td>
                  <td className={styles.td} style={{ fontSize: '12px', color: '#6b7280' }}>
                    {d.domainRequestedAt ? new Date(d.domainRequestedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className={styles.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {!d.domainVerified && (
                        <button
                          onClick={() => handleVerifyDomain(d._id)}
                          disabled={!!domainAction[d._id]}
                          className={styles.approveBtn}
                        >
                          {domainAction[d._id] === 'verifying' ? '…' : 'Verify DNS'}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveDomain(d._id, d.customDomain)}
                        disabled={!!domainAction[d._id]}
                        className={styles.rejectBtn}
                      >
                        {domainAction[d._id] === 'removing' ? '…' : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
