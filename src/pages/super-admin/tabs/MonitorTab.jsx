// src/pages/super-admin/tabs/MonitorTab.jsx
// App Health — is the platform working right now?
//   • Checks: emails, logins, bookings, classes, homework/quizzes, payments,
//     background jobs, databases, errors (green / amber / red)
//   • Open alerts (also sent to you by email + WhatsApp) with "Acknowledge"
//   • People having trouble (teachers / students, by center, with their ID)
//   • Event log (every email, booking, login problem, crash…) — filter + pages
//   • Alert settings: where alerts go + "Send test alert"
// Server: routes/monitorRoutes.js · checks run every minute (utils/monitorChecks.js)
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, RefreshCw, AlertTriangle, CheckCircle, XCircle, Mail, MessageCircle,
  Users, ListChecks, Send, Play, BellOff, ChevronDown, ChevronUp, Search, Settings,
} from 'lucide-react';
import Pagination from '../../../components/Pagination';
import styles from '../SuperAdmin.module.css';

const COLORS = { ok: '#34d399', warn: '#f59e0b', fail: '#ef4444', unknown: '#6b7280' };
const LABEL  = { ok: 'Working', warn: 'Needs a look', fail: 'Problem', unknown: 'Waiting for first check' };
const KINDS  = [
  ['', 'Everything'], ['email', 'Emails'], ['login', 'Logins'], ['booking', 'Bookings'], ['class', 'Classes'],
  ['learning', 'Homework & quizzes'], ['payment', 'Payments'], ['client', 'Page crashes'], ['request', 'Server errors'], ['job', 'Background jobs'],
];
const POLL_MS = 30_000;

const ago = (d) => {
  if (!d) return '—';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};
const when = (d) => d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

const pill = (status) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999,
  fontSize: 12, fontWeight: 700, color: COLORS[status] || COLORS.unknown,
  background: `${COLORS[status] || COLORS.unknown}1a`, border: `1px solid ${COLORS[status] || COLORS.unknown}40`,
});
const btn = (primary) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit',
  border: primary ? 'none' : '1px solid var(--sa-w12)',
  background: primary ? 'linear-gradient(135deg,#b45309,#f59e0b)' : 'transparent',
  color: primary ? '#0c0a00' : 'var(--sa-text)',
});
const Dot = ({ status }) => <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: COLORS[status] || COLORS.unknown, flexShrink: 0, boxShadow: `0 0 0 3px ${COLORS[status] || COLORS.unknown}26` }} />;

export default function MonitorTab({ apiBase, authHeaders, centers = [], onStatus }) {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [notice, setNotice]   = useState('');
  const [running, setRunning] = useState(false);
  const headersRef = useRef(authHeaders);
  headersRef.current = authHeaders;

  const call = useCallback(async (path, opts = {}) => {
    const res = await fetch(`${apiBase}/super-admin/monitor${path}`, {
      ...opts,
      headers: { ...headersRef.current, ...(opts.body && { 'Content-Type': 'application/json' }) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }, [apiBase]);

  const loadStatus = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const { data } = await call('/status');
      setStatus(data); setError('');
      onStatus?.(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [call, onStatus]);

  useEffect(() => {
    loadStatus();
    const id = setInterval(() => { if (document.visibilityState === 'visible') loadStatus(true); }, POLL_MS);
    return () => clearInterval(id);
  }, [loadStatus]);

  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(''), 5000); };

  const runNow = async () => {
    setRunning(true);
    try { const d = await call('/run', { method: 'POST' }); flash(d.message); await loadStatus(true); }
    catch (e) { flash(e.message); }
    finally { setRunning(false); }
  };

  const ack = async (id) => {
    try { const d = await call(`/alerts/${id}/ack`, { method: 'POST' }); flash(d.message); loadStatus(true); }
    catch (e) { flash(e.message); }
  };

  const overall = status?.overall || 'unknown';
  const checks = status?.checks || [];
  const open = status?.alerts?.open || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div className={styles.card} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: `${COLORS[overall]}1a` }}>
            <Activity size={22} color={COLORS[overall]} />
          </div>
          <div>
            <h2 className={styles.sectionTitle} style={{ fontSize: 18 }}>App Health</h2>
            <div style={{ fontSize: 12.5, color: 'var(--sa-muted)', marginTop: 3 }}>
              {status?.computedAt ? <>Checked {ago(status.computedAt)} · checks run every minute</> : 'The first check runs about 20 seconds after the server starts'}
            </div>
          </div>
          <span style={pill(overall)}><Dot status={overall} /> {LABEL[overall]}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={runNow} disabled={running} style={{ ...btn(true), opacity: running ? 0.6 : 1 }}>
            <Play size={14} /> {running ? 'Checking…' : 'Run checks now'}
          </button>
          <button type="button" onClick={() => loadStatus()} className={styles.refreshBtn} title="Refresh" aria-label="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      {notice && <div role="status" style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--sa-amber-text)', fontSize: 13, fontWeight: 600 }}>{notice}</div>}
      {error && <div role="alert" style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--sa-red-text)', fontSize: 13 }}>{error}</div>}

      {/* Open alerts */}
      {open.length > 0 && (
        <div className={styles.card} style={{ borderColor: 'rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.06)' }}>
          <h3 className={styles.sectionTitle} style={{ color: 'var(--sa-red-text)', marginBottom: 12 }}><AlertTriangle size={16} color="#ef4444" /> Open alerts ({open.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {open.map(a => (
              <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: 12, borderRadius: 12, background: 'var(--sa-w04)' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, color: 'var(--sa-text)' }}>{a.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--sa-text-2)', marginTop: 3 }}>{a.message}</div>
                  <div style={{ fontSize: 12, color: 'var(--sa-muted)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Since {when(a.openedAt)}</span>
                    <span><Mail size={11} style={{ verticalAlign: -1 }} /> {a.delivery?.email || 'not sent yet'}</span>
                    <span><MessageCircle size={11} style={{ verticalAlign: -1 }} /> {a.delivery?.whatsapp || 'not sent yet'}</span>
                    {a.acknowledgedAt && <span style={{ color: '#34d399' }}>Acknowledged {ago(a.acknowledgedAt)}</span>}
                  </div>
                </div>
                {!a.acknowledgedAt && (
                  <button type="button" onClick={() => ack(a._id)} style={btn(false)} title="Stop the 6-hourly reminders for this alert">
                    <BellOff size={14} /> Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checks */}
      {loading && !status ? (
        <div className={styles.card} style={{ textAlign: 'center', color: '#6b7280', padding: 40 }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 12 }}>
          {checks.length === 0 && <div className={styles.card} style={{ color: 'var(--sa-muted)' }}>No results yet — press "Run checks now".</div>}
          {checks.map(c => <CheckCard key={c.key} check={c} />)}
        </div>
      )}

      <TroublePanel call={call} />
      <EventLog call={call} centers={centers} />
      <AlertSettings call={call} initial={status?.settings} flash={flash} />

      {(status?.alerts?.recent || []).length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.sectionTitle} style={{ marginBottom: 10 }}><CheckCircle size={16} color="#34d399" /> Recently fixed</h3>
          {status.alerts.recent.map(a => (
            <div key={a._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '7px 0', borderTop: '1px solid var(--sa-w05)', color: 'var(--sa-text-2)', flexWrap: 'wrap' }}>
              <span><strong style={{ color: 'var(--sa-text)' }}>{a.title}</strong> — {a.message}</span>
              <span style={{ color: 'var(--sa-muted)' }}>{when(a.openedAt)} → {when(a.resolvedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckCard({ check }) {
  const [open, setOpen] = useState(false);
  const details = check.details || [];
  const shown = open ? details : details.slice(0, 2);
  return (
    <div className={styles.card} style={{ padding: 16, borderColor: check.status === 'ok' ? undefined : `${COLORS[check.status]}55` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: 'var(--sa-text)' }}><Dot status={check.status} /> {check.title}</div>
        <span style={pill(check.status)}>{LABEL[check.status]}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--sa-text-2)', marginTop: 8, lineHeight: 1.5 }}>{check.summary}</div>
      {shown.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: 'var(--sa-muted)', lineHeight: 1.55, wordBreak: 'break-word' }}>
          {shown.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
      {details.length > 2 && (
        <button type="button" onClick={() => setOpen(o => !o)} style={{ ...btn(false), border: 'none', padding: '6px 0', fontSize: 12, color: '#f59e0b' }}>
          {open ? <><ChevronUp size={13} /> Show less</> : <><ChevronDown size={13} /> {details.length - 2} more</>}
        </button>
      )}
    </div>
  );
}

function TroublePanel({ call }) {
  const [people, setPeople] = useState(null);
  const [error, setError]   = useState('');
  const [showAll, setShowAll] = useState(false);
  const load = useCallback(() => {
    call('/trouble').then(d => { setPeople(d.data.people); setError(''); }).catch(e => setError(e.message));
  }, [call]);
  useEffect(() => { load(); }, [load]);

  const list = people || [];
  const shown = showAll ? list : list.slice(0, 10);
  const roleColor = { teacher: '#f472b6', student: '#34d399', admin: '#f59e0b', subadmin: '#f59e0b', 'sub-admin': '#f59e0b' };

  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 10 }}>
        <h3 className={styles.sectionTitle}><Users size={16} color="#f472b6" /> People having trouble <span style={{ color: '#6b7280', fontWeight: 600, fontSize: 12 }}>· last 7 days</span></h3>
        <button type="button" onClick={load} className={styles.refreshBtn} title="Refresh" aria-label="Refresh people"><RefreshCw size={14} /></button>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--sa-muted)' }}>
        Repeated failed actions, lockouts, page crashes, emails that didn't reach them, unanswered class requests and missed classes.
      </p>
      {error ? <p style={{ color: 'var(--sa-red-text)', fontSize: 13 }}>{error}</p>
        : people === null ? <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>
        : list.length === 0 ? <p style={{ color: '#34d399', fontSize: 13, fontWeight: 600 }}>Nobody seems to be stuck. 🎉</p>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.th}>Person</th><th className={styles.th}>Center</th><th className={styles.th}>What's happening</th><th className={styles.th}>Last</th>
              </tr></thead>
              <tbody>
                {shown.map((p, i) => (
                  <tr key={`${p.key}-${p.center}-${i}`} className={styles.tr}>
                    <td className={styles.td}>
                      <div style={{ fontWeight: 700, color: 'var(--sa-text)' }}>{p.name || 'Unknown person'}</div>
                      <div style={{ fontSize: 11.5, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                        {p.role && <span style={{ color: roleColor[p.role] || 'var(--sa-muted)', fontWeight: 700, textTransform: 'capitalize' }}>{p.role}</span>}
                        {p.code && <code style={{ color: 'var(--sa-text-2)', background: 'var(--sa-w06)', padding: '1px 6px', borderRadius: 6 }}>{p.code}</code>}
                      </div>
                    </td>
                    <td className={styles.td} style={{ fontSize: 12.5, color: 'var(--sa-text-2)' }}>{p.centerName}</td>
                    <td className={styles.td} style={{ fontSize: 12.5 }}>
                      <span style={{ color: p.severity === 'high' ? 'var(--sa-red-text)' : 'var(--sa-amber-text)', fontWeight: 600 }}>{p.text}</span>
                      {p.lastMsg && <div style={{ color: 'var(--sa-muted)', marginTop: 2 }}>“{p.lastMsg}”</div>}
                    </td>
                    <td className={styles.td} style={{ fontSize: 12, color: 'var(--sa-muted)', whiteSpace: 'nowrap' }}>{p.lastAt ? ago(p.lastAt) : 'ongoing'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > 10 && (
              <button type="button" onClick={() => setShowAll(s => !s)} style={{ ...btn(false), marginTop: 10 }}>
                {showAll ? 'Show fewer' : `Show all ${list.length}`}
              </button>
            )}
          </div>
        )}
    </div>
  );
}

function EventLog({ call, centers }) {
  const [kind, setKind]     = useState('');
  const [failOnly, setFailOnly] = useState(true);
  const [center, setCenter] = useState('');
  const [q, setQ]           = useState('');
  const [query, setQuery]   = useState('');
  const [page, setPage]     = useState(1);
  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (kind) params.set('kind', kind);
    if (failOnly) params.set('ok', '0');
    if (center) params.set('center', center);
    if (query) params.set('q', query);
    call(`/events?${params}`).then(d => { setData(d.data); setError(''); }).catch(e => setError(e.message));
  }, [call, kind, failOnly, center, query, page]);

  const reset = (fn) => (v) => { fn(v); setPage(1); };
  const events = data?.events || [];
  const pager = data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 25 };

  return (
    <div className={styles.card}>
      <h3 className={styles.sectionTitle} style={{ marginBottom: 12 }}><ListChecks size={16} color="#f59e0b" /> Event log <span style={{ color: '#6b7280', fontWeight: 600, fontSize: 12 }}>· last 7 days</span></h3>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className={styles.label}>Type</span>
          <select value={kind} onChange={e => reset(setKind)(e.target.value)} className={styles.input} style={{ width: 180 }}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className={styles.label}>Center</span>
          <select value={center} onChange={e => reset(setCenter)(e.target.value)} className={styles.input} style={{ width: 200 }}>
            <option value="">All centers</option>
            {centers.filter(c => c.status === 'active').map(c => <option key={c._id} value={c.slug}>{c.centerName}</option>)}
          </select>
        </label>
        <form onSubmit={e => { e.preventDefault(); setQuery(q.trim()); setPage(1); }} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className={styles.label}>Search</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. reminder, quota, timeout" className={styles.input} style={{ width: 220 }} />
            <button type="submit" style={btn(false)} aria-label="Search"><Search size={14} /></button>
          </div>
        </form>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--sa-text-2)', cursor: 'pointer', paddingBottom: 10 }}>
          <input type="checkbox" checked={failOnly} onChange={e => reset(setFailOnly)(e.target.checked)} /> Problems only
        </label>
      </div>

      {error ? <p style={{ color: 'var(--sa-red-text)', fontSize: 13 }}>{error}</p>
        : !data ? <p style={{ color: '#6b7280', fontSize: 13 }}>Loading…</p>
        : events.length === 0 ? <p style={{ color: 'var(--sa-muted)', fontSize: 13 }}>{failOnly ? 'No problems recorded with these filters.' : 'Nothing recorded with these filters.'}</p>
        : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.th}>When</th><th className={styles.th}>Center</th><th className={styles.th}>What</th><th className={styles.th}>Result</th><th className={styles.th}>Who</th><th className={styles.th}>Details</th>
              </tr></thead>
              <tbody>
                {events.map(e => (
                  <tr key={e._id} className={styles.tr}>
                    <td className={styles.td} style={{ fontSize: 12, color: 'var(--sa-muted)', whiteSpace: 'nowrap' }} title={new Date(e.at).toLocaleString()}>{when(e.at)}</td>
                    <td className={styles.td} style={{ fontSize: 12.5, color: 'var(--sa-text-2)' }}>{e.center || 'Platform'}</td>
                    <td className={styles.td} style={{ fontSize: 12.5 }}>
                      <div style={{ color: 'var(--sa-text)', fontWeight: 600 }}>{e.action}</div>
                      <div style={{ color: '#6b7280', fontSize: 11.5, textTransform: 'capitalize' }}>{e.kind}</div>
                    </td>
                    <td className={styles.td}>
                      <span style={pill(e.ok ? 'ok' : (e.status && e.status < 500 && e.kind !== 'email' && e.kind !== 'client' ? 'warn' : 'fail'))}>
                        {e.ok ? <CheckCircle size={12} /> : <XCircle size={12} />} {e.ok ? 'OK' : 'Failed'}{e.status ? ` ${e.status}` : ''}
                      </span>
                    </td>
                    <td className={styles.td} style={{ fontSize: 12, color: 'var(--sa-text-2)' }}>
                      {e.actor?.label || (e.actor?.role ? <span style={{ textTransform: 'capitalize' }}>{e.actor.role}</span> : '—')}
                    </td>
                    <td className={styles.td} style={{ fontSize: 12, color: 'var(--sa-muted)', maxWidth: 360, wordBreak: 'break-word' }}>
                      {e.msg || (e.meta?.page ? `Page ${e.meta.page}` : '')}
                      {e.meta?.page && e.msg && <div style={{ color: '#6b7280' }}>Page {e.meta.page}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <div style={{ marginTop: 10 }}>
        <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={setPage} isDarkMode />
      </div>
    </div>
  );
}

function AlertSettings({ call, initial, flash }) {
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (initial && !form) setForm({ ...initial, alertEmailsText: (initial.alertEmails || []).join(', ') });
  }, [initial, form]);

  if (!form) return null;
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      const d = await call('/settings', { method: 'PUT', body: JSON.stringify({
        emailEnabled: form.emailEnabled, whatsappEnabled: form.whatsappEnabled,
        alertEmails: form.alertEmailsText, whatsappPhone: form.whatsappPhone,
      }) });
      setForm({ ...d.data, alertEmailsText: d.data.alertEmails.join(', ') });
      flash(d.message);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const test = async () => {
    setTesting(true); setError(''); setResult(null);
    try { const d = await call('/test-alert', { method: 'POST' }); setResult(d.data.delivery); }
    catch (e) { setError(e.message); }
    finally { setTesting(false); }
  };

  const provider = { twilio: 'Twilio', callmebot: 'CallMeBot' }[form.whatsappProvider];
  const resultColor = (r) => (/^sent/.test(r) ? '#34d399' : /^off/.test(r) ? 'var(--sa-muted)' : 'var(--sa-red-text)');
  const toggle = (checked, onChange, label) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, color: 'var(--sa-text)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16 }} /> {label}
    </label>
  );

  return (
    <div className={styles.card}>
      <h3 className={styles.sectionTitle} style={{ marginBottom: 4 }}><Settings size={16} color="#9ca3af" /> Where alerts go</h3>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--sa-muted)' }}>
        When a check turns red (two minutes in a row) you're told on both channels — WhatsApp is the backup in case email itself is broken.
        Reminders repeat every 6 hours until it's fixed or you acknowledge it, and you get a message when it's fixed.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toggle(form.emailEnabled, set('emailEnabled'), <><Mail size={14} /> Email alerts</>)}
          <input value={form.alertEmailsText} onChange={e => set('alertEmailsText')(e.target.value)} className={styles.input}
            placeholder="you@example.com, partner@example.com" aria-label="Alert email addresses" disabled={!form.emailEnabled} />
          <span style={{ fontSize: 11.5, color: '#6b7280' }}>Up to 5, comma separated. Empty = every super admin's email.</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toggle(form.whatsappEnabled, set('whatsappEnabled'), <><MessageCircle size={14} /> WhatsApp alerts</>)}
          <input value={form.whatsappPhone} onChange={e => set('whatsappPhone')(e.target.value)} className={styles.input}
            placeholder="+2348012345678" aria-label="WhatsApp number" disabled={!form.whatsappEnabled} inputMode="tel" />
          <span style={{ fontSize: 11.5, color: provider ? '#34d399' : '#f59e0b' }}>
            {provider ? `Sending through ${provider}` : 'No WhatsApp provider yet — add Twilio or CallMeBot keys to server/.env (see docs/monitoring.md)'}
          </span>
        </div>
      </div>
      {error && <p role="alert" style={{ color: 'var(--sa-red-text)', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 12, fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ color: resultColor(result.email) }}><Mail size={13} style={{ verticalAlign: -2 }} /> Email: {result.email}</span>
          <span style={{ color: resultColor(result.whatsapp) }}><MessageCircle size={13} style={{ verticalAlign: -2 }} /> WhatsApp: {result.whatsapp}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...btn(true), opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={test} disabled={testing} style={{ ...btn(false), opacity: testing ? 0.6 : 1 }}><Send size={14} /> {testing ? 'Sending…' : 'Send test alert'}</button>
      </div>
    </div>
  );
}
