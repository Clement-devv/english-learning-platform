// src/pages/super-admin/tabs/AiCreditsCard.jsx
// AI credits for teacher tools (Word Squad questions made from book pages):
// each center's balance and use, and topping it up. Lives on the "AI credits" tab.
import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function AiCreditsCard({ apiBase, authHeaders }) {
  // the dashboard builds authHeaders fresh each render — depend on the token itself
  const auth = authHeaders?.Authorization;
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`${apiBase}/super-admin/ai-credits`, { headers: { Authorization: auth } })
      .then((r) => r.json())
      .then((d) => setData(d.success ? d : { centers: [], totals: null }))
      .catch(() => setData({ centers: [], totals: null }));
  }, [apiBase, auth]);
  useEffect(() => { load(); }, [load]);

  const allocate = async () => {
    const amt = Number(amount);
    if (!Number.isInteger(amt) || amt < 1 || amt > 100000) { setMsg('Enter a whole number from 1 to 100,000'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/super-admin/ai-credits/${modal._id}`, {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amt, note }),
      });
      const d = await res.json();
      if (!d.success) { setMsg(d.message || 'Could not allocate'); return; }
      setMsg(`✅ ${amt.toLocaleString()} credits added. New balance: ${d.balance.toLocaleString()}`);
      load();
    } catch { setMsg('Could not allocate — check the connection'); } finally { setBusy(false); }
  };

  const shown = (data?.centers || []).filter((c) => !search || c.centerName.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase()));

  return (
    <div className={styles.card} style={{ marginTop: 16 }}>
      <h2 className={styles.sectionTitle}><Sparkles size={16} color="#a78bfa" /> Teacher AI credits</h2>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--sa-muted)' }}>
        Used when teachers make Word Squad questions from book pages. 1 credit ≈ 4,000 AI tokens; a few pages usually cost 3–10 credits.
      </p>
      {data?.totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          {[['Total allocated', data.totals.totalAllocated, '#a78bfa'], ['Available', data.totals.totalBalance, '#34d399'], ['Used', data.totals.totalUsed, '#fb923c']].map(([label, v, color]) => (
            <div key={label} style={{ border: '1px solid rgba(167,139,250,0.25)', borderRadius: 10, padding: '12px 14px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--sa-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color }}>{v.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search centers..." className={styles.input} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />
      {!data ? <p style={{ color: '#6b7280' }}>Loading…</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead><tr>{['Center', 'Balance', 'Allocated', 'Used', ''].map((h) => <th key={h} className={styles.th}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c._id} className={styles.tr}>
                  <td className={styles.td}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--sa-text)', fontSize: 13 }}>{c.centerName}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{c.adminEmail}</p>
                  </td>
                  <td className={styles.td}><span style={{ fontWeight: 800, color: c.balance === 0 ? '#ef4444' : c.balance <= 20 ? '#f59e0b' : '#34d399' }}>{c.balance.toLocaleString()}</span></td>
                  <td className={styles.td} style={{ fontSize: 13 }}>{c.totalAllocated.toLocaleString()}</td>
                  <td className={styles.td} style={{ fontSize: 13, color: '#fb923c' }}>{c.used.toLocaleString()}</td>
                  <td className={styles.td}>
                    <button type="button" onClick={() => { setModal(c); setAmount(''); setNote(''); setMsg(''); }}
                      style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                      Allocate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <div role="dialog" aria-modal="true" aria-label={`Add AI credits to ${modal.centerName}`} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className={styles.card} style={{ width: 'min(420px, 100%)', margin: 0 }}>
            <h3 style={{ marginTop: 0 }}>Add AI credits — {modal.centerName}</h3>
            <p style={{ fontSize: 13, color: 'var(--sa-muted)' }}>Current balance: <strong>{modal.balance.toLocaleString()}</strong></p>
            <input type="number" min={1} max={100000} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Credits to add" className={styles.input} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }} />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={styles.input} style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8 }} />
            {msg && <p style={{ fontSize: 13 }}>{msg}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className={styles.input} style={{ cursor: 'pointer' }} onClick={() => setModal(null)}>Close</button>
              <button type="button" disabled={busy} onClick={allocate} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Add credits</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
