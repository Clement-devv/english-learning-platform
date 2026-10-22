// src/pages/super-admin/tabs/LibraryStorageTab.jsx
// Super admin → Library Storage: every center's teaching-library usage and what
// it owes for extra space (billed manually), plan allowances + price per GB,
// per-center allowance / extra space packs / paid months, and copyright takedowns.
// Server: routes/libraryAdminRoutes.js · utils/libraryQuota.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { HardDrive, RefreshCw, Search, Settings, X, Plus, Trash2, CheckCircle, Circle, FileText, AlertTriangle } from 'lucide-react';
import Pagination from '../../../components/Pagination';
import styles from '../SuperAdmin.module.css';

const fmtBytes = (b = 0) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const fmtMb = (mb) => (mb >= 1024 ? `${+(mb / 1024).toFixed(1)} GB` : `${mb} MB`);
const money = (n, cur) => `${cur} ${Number(n || 0).toFixed(2)}`;
const monthName = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
const btn = (primary, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  border: primary ? 'none' : '1px solid var(--sa-w12)', background: primary ? 'linear-gradient(135deg,#9d174d,#db2777)' : 'transparent', color: primary ? '#fff' : (color || 'var(--sa-text)'),
});

export default function LibraryStorageTab({ apiBase, authHeaders }) {
  const headersRef = useRef(authHeaders);
  headersRef.current = authHeaders;
  const call = useCallback(async (path, opts = {}) => {
    const r = await fetch(`${apiBase}/super-admin/library${path}`, { ...opts, headers: { ...headersRef.current, ...(opts.body && { 'Content-Type': 'application/json' }) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.success === false) throw new Error(d.message || `Request failed (${r.status})`);
    return d;
  }, [apiBase]);

  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [manage, setManage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (query) params.set('q', query);
      const d = await call(`/usage?${params}`);
      setData(d.data); setError('');
      setManage(m => (m ? d.data.centers.find(c => c._id === m._id) || m : m));
    } catch (e) { setError(e.message); }
  }, [call, page, query]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => { if (q.trim() !== query) { setQuery(q.trim()); setPage(1); } }, 350);
    return () => clearTimeout(t);
  }, [q, query]);

  const s = data?.settings;
  const centers = data?.centers || [];
  const monthTotal = centers.reduce((a, c) => a + (c.usage.estimatedCharge || 0), 0);
  const unpaid = centers.reduce((a, c) => a + (c.history || []).filter(h => !h.paid && h.amount > 0).reduce((x, h) => x + h.amount, 0), 0);
  const pager = data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 25 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={styles.card} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <h2 className={styles.sectionTitle}><HardDrive size={16} color="#db2777" /> Library storage</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--sa-muted)' }}>
            Each center's teaching-library space. Over the allowance is allowed up to 2× and billed per extra GB per month (on the month's peak).
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setShowSettings(true)} style={btn(false)}><Settings size={14} /> Prices & allowances</button>
          <button type="button" onClick={load} className={styles.refreshBtn} aria-label="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {[
            ['Stored (all centers)', fmtBytes(data.totals.bytes)],
            ['Files', data.totals.files.toLocaleString()],
            ['Extra space this month', money(monthTotal, s.currency), monthTotal > 0 ? '#db2777' : undefined],
            ['Unpaid past months', money(unpaid, s.currency), unpaid > 0 ? '#f59e0b' : undefined],
            ['Price per extra GB', `${money(s.pricePerGb, s.currency)} / month`],
          ].map(([label, value, color]) => (
            <div key={label} className={styles.card} style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--sa-muted)', fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--sa-text)', marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '0 1 300px' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--sa-muted)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search centers" aria-label="Search centers" className={styles.input} style={{ paddingLeft: 32, fontSize: 13 }} />
          </div>
          <span style={{ fontSize: 12.5, color: 'var(--sa-muted)' }}>Biggest users first</span>
        </div>
        {error && <p role="alert" style={{ margin: '0 18px 14px', color: 'var(--sa-red-text)', fontSize: 13 }}>{error}</p>}
        {!data ? <p style={{ padding: 30, textAlign: 'center', color: 'var(--sa-muted)' }}>Loading…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead><tr>{['Center', 'Plan', 'Used / allowance', 'Files', 'This month', ''].map(h => <th key={h} className={styles.th}>{h}</th>)}</tr></thead>
              <tbody>
                {centers.map(c => {
                  const u = c.usage;
                  const pct = Math.min(100, Math.round((u.usedBytes / Math.max(u.allowanceBytes, 1)) * 100));
                  const over = u.usedBytes > u.allowanceBytes;
                  return (
                    <tr key={c._id} className={styles.tr}>
                      <td className={styles.td}><div style={{ fontWeight: 700, color: 'var(--sa-text)' }}>{c.centerName}</div><code style={{ fontSize: 11.5, color: 'var(--sa-muted)' }}>{c.slug}</code></td>
                      <td className={styles.td}><span className={styles.planBadge}>{c.plan}</span></td>
                      <td className={styles.td} style={{ minWidth: 220 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--sa-text-2)' }}>
                          <strong style={{ color: over ? '#f59e0b' : 'var(--sa-text)' }}>{fmtBytes(u.usedBytes)}</strong> of {fmtBytes(u.allowanceBytes)}
                          {u.extraMb > 0 && <span style={{ color: 'var(--sa-muted)' }}> (incl. +{fmtMb(u.extraMb)} extra)</span>}
                        </div>
                        <div style={{ height: 5, borderRadius: 5, background: 'var(--sa-w06)', marginTop: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: over ? '#f59e0b' : '#db2777' }} />
                        </div>
                      </td>
                      <td className={styles.td} style={{ color: 'var(--sa-text-2)' }}>{u.fileCount}</td>
                      <td className={styles.td}>
                        {u.overageGb > 0
                          ? <div><strong style={{ color: '#db2777' }}>{money(u.estimatedCharge, u.currency)}</strong><div style={{ fontSize: 11.5, color: 'var(--sa-muted)' }}>{u.overageGb} GB over (peak {fmtBytes(u.monthPeakBytes)})</div></div>
                          : <span style={{ color: 'var(--sa-muted)', fontSize: 12.5 }}>Within allowance</span>}
                      </td>
                      <td className={styles.td} style={{ textAlign: 'right' }}><button type="button" onClick={() => setManage(c)} style={btn(false)}>Manage</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {centers.length === 0 && <p style={{ padding: 24, textAlign: 'center', color: 'var(--sa-muted)' }}>No centers match.</p>}
          </div>
        )}
        <div style={{ padding: '10px 18px 14px' }}>
          <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={setPage} isDarkMode />
        </div>
      </div>

      {showSettings && s && <SettingsDialog settings={s} call={call} onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); load(); }} />}
      {manage && <ManageDialog center={manage} currency={s?.currency || 'USD'} call={call} onClose={() => setManage(null)} onChanged={load} />}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={title} style={{ background: 'var(--sa-modal)', border: '1px solid var(--sa-line)', borderRadius: 18, width: '100%', maxWidth: wide ? 760 : 520, maxHeight: '92vh', overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--sa-text)' }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...btn(false), padding: 7 }}><X size={15} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Label = ({ children }) => <span className={styles.label} style={{ display: 'block', marginBottom: 6 }}>{children}</span>;

function SettingsDialog({ settings, call, onClose, onSaved }) {
  const [form, setForm] = useState({ ...settings, planMb: { ...settings.planMb } });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try { await call('/settings', { method: 'PUT', body: JSON.stringify(form) }); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Prices & allowances" onClose={onClose}>
      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label><Label>Price per extra GB / month</Label><input type="number" min={0} step="0.01" className={styles.input} value={form.pricePerGb} onChange={e => setForm(f => ({ ...f, pricePerGb: e.target.value }))} /></label>
          <label><Label>Currency</Label><input className={styles.input} maxLength={3} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="VND, USD…" /></label>
        </div>
        <div>
          <Label>Library allowance per plan (MB)</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            {['free', 'basic', 'pro', 'enterprise'].map(p => (
              <label key={p} style={{ fontSize: 12, color: 'var(--sa-muted)', textTransform: 'capitalize' }}>{p}
                <input type="number" min={0} className={styles.input} style={{ marginTop: 4 }} value={form.planMb[p]} onChange={e => setForm(f => ({ ...f, planMb: { ...f.planMb, [p]: e.target.value } }))} />
                <span style={{ fontSize: 11 }}>{fmtMb(Number(form.planMb[p]) || 0)}</span>
              </label>
            ))}
          </div>
        </div>
        <label><Label>Copyright contact email</Label>
          <input type="email" className={styles.input} value={form.copyrightEmail} onChange={e => setForm(f => ({ ...f, copyrightEmail: e.target.value }))} placeholder="copyright@clemify.com" />
          <span style={{ fontSize: 12, color: 'var(--sa-muted)' }}>Shown at the bottom of every center's library for takedown requests.</span>
        </label>
        {error && <p role="alert" style={{ margin: 0, color: 'var(--sa-red-text)', fontSize: 13 }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn(false)}>Cancel</button>
          <button type="submit" disabled={saving} style={btn(true)}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ManageDialog({ center, currency, call, onClose, onChanged }) {
  const u = center.usage;
  const [quota, setQuota] = useState(u.quotaOverrideMb ?? '');
  const [extra, setExtra] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [files, setFiles] = useState(null);
  const [fileQ, setFileQ] = useState('');
  const [takedown, setTakedown] = useState(null);
  const [reason, setReason] = useState('');

  const run = async (fn, okText) => {
    setMsg(null);
    try { const d = await fn(); setMsg({ ok: true, text: d?.message || okText }); onChanged(); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  const loadFiles = useCallback(async () => {
    const d = await call(`/centers/${center._id}/files?limit=50${fileQ ? `&q=${encodeURIComponent(fileQ)}` : ''}`);
    setFiles(d.data.files);
  }, [call, center._id, fileQ]);
  useEffect(() => { loadFiles().catch(() => setFiles([])); }, [loadFiles]);

  return (
    <Modal title={`${center.centerName} — library`} onClose={onClose} wide>
      <div style={{ fontSize: 13.5, color: 'var(--sa-text-2)' }}>
        Using <strong style={{ color: 'var(--sa-text)' }}>{fmtBytes(u.usedBytes)}</strong> of <strong style={{ color: 'var(--sa-text)' }}>{fmtBytes(u.allowanceBytes)}</strong>
        {' '}({fmtMb(u.baseMb)} {u.quotaOverrideMb != null ? 'custom' : `${center.plan} plan`} + {fmtMb(u.extraMb)} extra) · hard limit {fmtBytes(u.hardCapBytes)}
      </div>
      {msg && <div role="status" style={{ padding: '9px 12px', borderRadius: 10, fontSize: 13, background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: msg.ok ? '#10b981' : 'var(--sa-red-text)' }}>{msg.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <form onSubmit={e => { e.preventDefault(); run(() => call(`/centers/${center._id}`, { method: 'PATCH', body: JSON.stringify({ quotaMb: quota === '' ? null : Number(quota) }) }), 'Saved'); }}
          style={{ padding: 14, borderRadius: 12, border: '1px solid var(--sa-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Base allowance (MB)</Label>
          <input type="number" min={0} className={styles.input} value={quota} onChange={e => setQuota(e.target.value)} placeholder={`Plan default: ${u.planMb} MB`} />
          <span style={{ fontSize: 12, color: 'var(--sa-muted)' }}>Leave empty to use the plan's allowance.</span>
          <button type="submit" style={{ ...btn(false), alignSelf: 'flex-start' }}>Save allowance</button>
        </form>
        <form onSubmit={e => { e.preventDefault(); if (!Number(extra)) return; run(() => call(`/centers/${center._id}`, { method: 'PATCH', body: JSON.stringify({ addExtraMb: Number(extra), note }) }), 'Added').then(() => { setExtra(''); setNote(''); }); }}
          style={{ padding: 14, borderRadius: 12, border: '1px solid var(--sa-line)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>Add extra space (MB)</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[1024, 5120, 10240].map(mb => <button key={mb} type="button" onClick={() => setExtra(String(mb))} style={{ ...btn(false), padding: '5px 10px', fontSize: 12 }}>+{fmtMb(mb)}</button>)}
          </div>
          <input type="number" className={styles.input} value={extra} onChange={e => setExtra(e.target.value)} placeholder="e.g. 5120 (negative removes)" />
          <input className={styles.input} value={note} onChange={e => setNote(e.target.value)} placeholder="Note (e.g. Paid invoice #104)" maxLength={200} />
          <button type="submit" style={{ ...btn(true), alignSelf: 'flex-start' }}><Plus size={14} /> Add space</button>
        </form>
      </div>

      {(center.log || []).length > 0 && (
        <div>
          <Label>Space added</Label>
          {center.log.map((l, i) => (
            <div key={i} style={{ fontSize: 12.5, color: 'var(--sa-text-2)', padding: '5px 0', borderTop: '1px solid var(--sa-w06)' }}>
              <strong style={{ color: l.mb < 0 ? 'var(--sa-red-text)' : '#10b981' }}>{l.mb > 0 ? '+' : ''}{fmtMb(l.mb)}</strong> · {new Date(l.at).toLocaleDateString()} {l.note ? `· ${l.note}` : ''} <span style={{ color: 'var(--sa-muted)' }}>· {l.by}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <Label>Monthly bills (extra space)</Label>
        <div style={{ fontSize: 12.5, color: 'var(--sa-text-2)', padding: '6px 0' }}>
          This month so far: {u.overageGb > 0 ? <strong style={{ color: '#db2777' }}>{money(u.estimatedCharge, currency)}</strong> : 'nothing'} {u.overageGb > 0 && `(${u.overageGb} GB over)`}
        </div>
        {(center.history || []).length === 0 ? <p style={{ margin: 0, fontSize: 12.5, color: 'var(--sa-muted)' }}>No past months yet.</p> : center.history.map(h => (
          <div key={h.month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 13, padding: '7px 0', borderTop: '1px solid var(--sa-w06)', color: 'var(--sa-text-2)' }}>
            <span>{monthName(h.month)} · peak {fmtBytes(h.peakBytes)} of {fmtBytes(h.allowanceBytes)}</span>
            {h.amount > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ color: 'var(--sa-text)' }}>{money(h.amount, h.currency || currency)}</strong>
                <button type="button" onClick={() => run(() => call(`/centers/${center._id}/history/${h.month}`, { method: 'PATCH', body: JSON.stringify({ paid: !h.paid }) }))}
                  style={{ ...btn(false, h.paid ? '#10b981' : '#f59e0b'), padding: '4px 10px', fontSize: 12 }}>
                  {h.paid ? <CheckCircle size={13} /> : <Circle size={13} />} {h.paid ? 'Paid' : 'Mark paid'}
                </button>
              </span>
            ) : <span style={{ color: 'var(--sa-muted)' }}>Nothing owed</span>}
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Label>Files (copyright takedowns)</Label>
          <input value={fileQ} onChange={e => setFileQ(e.target.value)} placeholder="Search files" className={styles.input} style={{ maxWidth: 220, fontSize: 12.5, padding: '6px 10px' }} aria-label="Search files" />
        </div>
        {!files ? <p style={{ fontSize: 12.5, color: 'var(--sa-muted)' }}>Loading…</p> : files.length === 0 ? <p style={{ fontSize: 12.5, color: 'var(--sa-muted)' }}>No files.</p> : files.map(f => (
          <div key={f._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--sa-w06)', fontSize: 13 }}>
            <FileText size={16} color="#dc2626" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--sa-text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--sa-muted)' }}>{f.fileName} · {fmtBytes(f.size)} · by {f.uploadedBy?.name || 'admin'} on {new Date(f.createdAt).toLocaleDateString()} · rights confirmed {f.rightsConfirmed ? '✓' : '✗'}</div>
            </div>
            <button type="button" onClick={() => { setTakedown(f); setReason(''); }} style={{ ...btn(false, 'var(--sa-red-text)'), padding: '5px 10px', fontSize: 12 }}><Trash2 size={13} /> Take down</button>
          </div>
        ))}
      </div>

      {takedown && (
        <div style={{ padding: 14, borderRadius: 12, border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--sa-red-text)', fontWeight: 700, fontSize: 13.5 }}><AlertTriangle size={15} /> Remove "{takedown.title}"?</div>
          <span style={{ fontSize: 12.5, color: 'var(--sa-text-2)' }}>The file is deleted, its record is kept, and the center admin is emailed the reason.</span>
          <textarea className={styles.input} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason — e.g. copyright notice from Oxford University Press, 6 Oct" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setTakedown(null)} style={btn(false)}>Cancel</button>
            <button type="button" disabled={!reason.trim()} onClick={() => run(() => call(`/centers/${center._id}/files/${takedown._id}/takedown`, { method: 'POST', body: JSON.stringify({ reason }) })).then(() => { setTakedown(null); loadFiles(); })}
              style={{ ...btn(true), background: '#dc2626', opacity: reason.trim() ? 1 : 0.5 }}><Trash2 size={14} /> Remove file</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
