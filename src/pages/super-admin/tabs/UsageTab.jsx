import React from 'react';
import { BarChart2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function UsageTab({
  usage, loading, usageMonth, loadData,
  expandedCenter, sessionDetail, loadingDetail, toggleSessionDetail,
  fmtMins }) {
  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 className={styles.sectionTitle}><BarChart2 size={16} color="#f59e0b" /> Agora Usage — {usageMonth || 'All Time'}</h2>
        <button onClick={loadData} className={styles.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
        Accurate server-tracked Agora minutes per center. Only the teacher's session is counted (no double-counting). Click a row to see individual sessions.
      </p>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
      ) : usage.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          No Agora usage recorded yet. Minutes will appear here after centers complete calls.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Center', 'This Month', 'Last Month', 'All Time', 'Completed', 'Live', ''].map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usage.map(u => (
                <React.Fragment key={u.centerId}>
                  <tr
                    className={styles.tr} style={{ cursor: 'pointer' }}
                    onClick={() => toggleSessionDetail(u.centerId)}
                  >
                    <td className={styles.td}>
                      <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{u.centerName}</p>
                      <code className={styles.slug} style={{ fontSize: '11px' }}>{u.centerId}</code>
                    </td>
                    <td className={styles.td}>
                      <span style={{ color: '#34d399', fontWeight: '700', fontSize: '15px' }}>{fmtMins(u.thisMonthMinutes)}</span>
                    </td>
                    <td className={styles.td}>
                      <span style={{ color: '#9ca3af', fontWeight: '600' }}>{fmtMins(u.lastMonthMinutes)}</span>
                    </td>
                    <td className={styles.td}>
                      <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{fmtMins(u.totalMinutes)}</span>
                    </td>
                    <td className={styles.td}>
                      <span style={{ color: '#6b7280', fontSize: '13px' }}>{u.sessions} sessions</span>
                    </td>
                    <td className={styles.td}>
                      {u.activeSessions > 0
                        ? <span style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>
                            {u.activeSessions} live
                          </span>
                        : <span style={{ color: '#374151', fontSize: '12px' }}>—</span>
                      }
                    </td>
                    <td className={styles.td}>
                      {loadingDetail[u.centerId]
                        ? <span style={{ color: '#6b7280', fontSize: '12px' }}>Loading…</span>
                        : expandedCenter === u.centerId
                          ? <ChevronUp size={15} color="#f59e0b" />
                          : <ChevronDown size={15} color="#6b7280" />
                      }
                    </td>
                  </tr>

                  {expandedCenter === u.centerId && sessionDetail[u.centerId] && (
                    <tr style={{ background: 'rgba(245,158,11,0.03)' }}>
                      <td colSpan={7} style={{ padding: '0 14px 14px' }}>
                        <div style={{
                          borderTop: '1px solid rgba(245,158,11,0.15)',
                          marginTop: '4px',
                          paddingTop: '12px',
                        }}>
                          <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#f59e0b', fontWeight: '700' }}>
                            Sessions in {usageMonth || 'current month'} — Completed: {fmtMins(sessionDetail[u.centerId].totalMinutes)}
                          </p>
                          {sessionDetail[u.centerId].sessions.length === 0 ? (
                            <p style={{ color: '#6b7280', fontSize: '12px' }}>No sessions this month.</p>
                          ) : (
                            <table className={styles.table} style={{ fontSize: '12px' }}>
                              <thead>
                                <tr>
                                  {['Started', 'Ended', 'Duration', 'Booking ID', 'Status'].map(h => (
                                    <th key={h} className={styles.th} style={{ fontSize: '10px' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sessionDetail[u.centerId].sessions.map(sess => {
                                  const statusColor = sess.status === 'completed' ? '#34d399'
                                    : sess.status === 'active'    ? '#f59e0b'
                                    : '#6b7280';
                                  return (
                                    <tr key={sess._id} className={styles.tr}>
                                      <td className={styles.td} style={{ color: '#9ca3af' }}>
                                        {new Date(sess.startedAt).toLocaleDateString()} {new Date(sess.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                      <td className={styles.td} style={{ color: '#9ca3af' }}>
                                        {sess.endedAt
                                          ? `${new Date(sess.endedAt).toLocaleDateString()} ${new Date(sess.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                          : <span style={{ color: '#f59e0b' }}>In progress</span>
                                        }
                                      </td>
                                      <td className={styles.td} style={{ color: '#34d399', fontWeight: '600' }}>
                                        {sess.status === 'completed' ? fmtMins(sess.durationMinutes) : '—'}
                                      </td>
                                      <td className={styles.td}>
                                        <code className={styles.slug} style={{ fontSize: '10px' }}>{sess.bookingId || '—'}</code>
                                      </td>
                                      <td className={styles.td}>
                                        <span style={{
                                          background: `${statusColor}22`,
                                          color: statusColor,
                                          padding: '2px 7px',
                                          borderRadius: '8px',
                                          fontSize: '10px',
                                          fontWeight: '700',
                                          textTransform: 'capitalize',
                                        }}>
                                          {sess.status}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
