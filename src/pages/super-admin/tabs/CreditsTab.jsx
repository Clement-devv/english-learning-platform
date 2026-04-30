import React from 'react';
import { Zap, Mic, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

function CreditTable({ centers, loading, totals, search, setSearch, expandedLog, setExpandedLog, setAllocModal, setAllocAmount, setAllocNote, setAllocMsg, accentColor, icon: Icon, label }) {
  return (
    <div className={styles.card} style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
        <h2 className={styles.sectionTitle}><Icon size={16} color={accentColor} /> {label}</h2>
      </div>

      {/* Summary totals */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Allocated',       value: totals.totalAllocated.toLocaleString(), color: accentColor },
            { label: 'Currently Available',   value: totals.totalBalance.toLocaleString(),   color: '#34d399'   },
            { label: 'Total Used by Students',value: totals.totalUsed.toLocaleString(),       color: '#fb923c'   },
          ].map(t => (
            <div key={t.label} style={{ background: `rgba(${accentColor === '#a78bfa' ? '167,139,250' : '249,115,22'},0.08)`, border: `1px solid rgba(${accentColor === '#a78bfa' ? '167,139,250' : '249,115,22'},0.2)`, borderRadius: 10, padding: '14px 16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.label}</p>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: t.color }}>{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search centers..."
          className={styles.input} style={{ paddingLeft: 32, width: '100%', boxSizing: 'border-box' }} />
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14 }}>🔍</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading credits...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>{['Center', 'Plan', 'Balance', 'Total Allocated', 'Used', 'Log', ''].map(h => (
                <th key={h} className={styles.th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {centers
                .filter(c => !search || c.centerName.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase()))
                .map(c => (
                  <React.Fragment key={c._id}>
                    <tr className={styles.tr}>
                      <td className={styles.td}>
                        <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{c.centerName}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{c.adminEmail}</p>
                      </td>
                      <td className={styles.td}>
                        <span style={{ background: `rgba(${accentColor === '#a78bfa' ? '167,139,250' : '249,115,22'},0.15)`, color: accentColor, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{c.plan}</span>
                      </td>
                      <td className={styles.td}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: c.balance === 0 ? '#ef4444' : c.balance <= 50 ? '#f59e0b' : '#34d399' }}>{c.balance.toLocaleString()}</span>
                      </td>
                      <td className={styles.td} style={{ color: '#9ca3af', fontSize: 13 }}>{c.totalAllocated.toLocaleString()}</td>
                      <td className={styles.td} style={{ color: '#fb923c', fontSize: 13 }}>{c.used.toLocaleString()}</td>
                      <td className={styles.td}>
                        {c.log.length > 0 ? (
                          <button onClick={() => setExpandedLog(expandedLog === c._id ? null : c._id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                            {expandedLog === c._id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {c.log.length} entr{c.log.length === 1 ? 'y' : 'ies'}
                          </button>
                        ) : <span style={{ color: '#4b5563', fontSize: 11 }}>No log</span>}
                      </td>
                      <td className={styles.td}>
                        <button onClick={() => { setAllocModal(c); setAllocAmount(''); setAllocNote(''); setAllocMsg(''); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: accentColor === '#a78bfa' ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'linear-gradient(135deg,#f97316,#fb923c)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                          <Icon size={12} /> Allocate
                        </button>
                      </td>
                    </tr>
                    {expandedLog === c._id && (
                      <tr>
                        <td colSpan={7} className={styles.td} style={{ background: 'rgba(167,139,250,0.04)', padding: '10px 16px' }}>
                          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: accentColor, textTransform: 'uppercase' }}>Allocation Log (last 10)</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {c.log.map((entry, i) => (
                              <div key={i} style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                                <span style={{ color: '#34d399', fontWeight: 700, minWidth: 60 }}>+{entry.amount}</span>
                                <span>{entry.note || '—'}</span>
                                <span style={{ color: '#6b7280' }}>by {entry.by || '—'}</span>
                                <span style={{ marginLeft: 'auto' }}>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : ''}</span>
                              </div>
                            ))}
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

export default function CreditsTab({
  // Chat credits
  creditCenters, creditLoading, creditTotals, loadCredits,
  creditSearch, setCreditSearch, expandedLog, setExpandedLog,
  setAllocModal, setAllocAmount, setAllocNote, setAllocMsg,
  // Pronunciation credits
  pronCenters, pronLoading, pronTotals, loadPronCredits,
  pronSearch, setPronSearch, pronExpandedLog, setPronExpandedLog,
  setPronAllocModal, setPronAllocAmount, setPronAllocNote, setPronAllocMsg,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Refresh both */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { loadCredits(); loadPronCredits(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <RefreshCw size={13} /> Refresh All
        </button>
      </div>

      <CreditTable
        centers={creditCenters} loading={creditLoading} totals={creditTotals}
        search={creditSearch} setSearch={setCreditSearch}
        expandedLog={expandedLog} setExpandedLog={setExpandedLog}
        setAllocModal={setAllocModal} setAllocAmount={setAllocAmount} setAllocNote={setAllocNote} setAllocMsg={setAllocMsg}
        accentColor="#a78bfa" icon={Zap} label="AI Chat Credits"
      />

      <CreditTable
        centers={pronCenters} loading={pronLoading} totals={pronTotals}
        search={pronSearch} setSearch={setPronSearch}
        expandedLog={pronExpandedLog} setExpandedLog={setPronExpandedLog}
        setAllocModal={setPronAllocModal} setAllocAmount={setPronAllocAmount} setAllocNote={setPronAllocNote} setAllocMsg={setPronAllocMsg}
        accentColor="#fb923c" icon={Mic} label="Pronunciation Credits"
      />
    </div>
  );
}
