// src/pages/super-admin/tabs/TeamTab.jsx
// Super admins who run the platform together. Everyone sees and manages the same centers
// and settings — each person just has their own login, sign-in codes and name in the logs.
// Invite → they get an email link to set a password. Switch off / remove anyone but yourself.
// Server: server/routes/superAdminTeamRoutes.js
import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, RefreshCw, Mail, Power, Trash2, ShieldCheck } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

const fmt = (d) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS = {
  active:  { label: 'Active',          color: '#059669', bg: 'rgba(16,185,129,0.12)' },
  invited: { label: 'Invite sent',     color: '#d97706', bg: 'rgba(245,158,11,0.14)' },
  off:     { label: 'Switched off',    color: '#6b7280', bg: 'rgba(107,114,128,0.14)' },
};
const btn = (tone) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  ...(tone === 'primary' ? { background: '#d97706', color: '#fff', border: 'none' }
    : tone === 'danger' ? { background: 'none', color: '#dc2626', border: '1px solid rgba(220,38,38,0.35)' }
    : { background: 'none', color: 'inherit', border: '1px solid rgba(127,127,127,0.35)' }),
});

export default function TeamTab({ apiBase, authHeaders }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);

  const flash = (msg, type = 'ok') => { setNotice({ msg, type }); setTimeout(() => setNotice(null), 4000); };
  const call = async (key, path, opts = {}) => {
    setBusy(key);
    try {
      const res = await fetch(`${apiBase}/super-admin/team${path}`, {
        ...opts, headers: { ...authHeaders, 'Content-Type': 'application/json', ...(opts.headers || {}) },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.message || 'Something went wrong');
      if (Array.isArray(body.data)) setTeam(body.data);
      if (body.message) flash(body.message);
      return body;
    } catch (err) {
      flash(err.message, 'err');
      return null;
    } finally { setBusy(''); }
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/super-admin/team`, { headers: authHeaders });
      const body = await res.json();
      if (res.ok) setTeam(body.data || []);
    } finally { setLoading(false); }
  }, [apiBase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    const done = await call('invite', '/invite', { method: 'POST', body: JSON.stringify(form) });
    if (done) setForm({ firstName: '', lastName: '', email: '' });
  };
  const setActive = (a, active) => {
    if (!active && !window.confirm(`Switch off ${a.firstName} ${a.lastName}? They'll be signed out everywhere right away and can't sign in until switched back on.`)) return;
    call(`toggle-${a.id}`, `/${a.id}`, { method: 'PATCH', body: JSON.stringify({ active }) });
  };
  const remove = (a) => {
    const what = a.status === 'invited' ? `Cancel the invite for ${a.email}?` : `Remove ${a.firstName} ${a.lastName} (${a.email}) as a super admin? This can't be undone — you'd have to invite them again.`;
    if (window.confirm(what)) call(`remove-${a.id}`, `/${a.id}`, { method: 'DELETE' });
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 className={styles.sectionTitle}><Users size={16} color="#d97706" /> Super admin team</h2>
          <button onClick={load} className={styles.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
          Everyone here sees and manages <strong>the same centers and settings</strong>. Each person has their own
          password and gets their own sign-in codes by email, and the audit log shows who did what.
        </p>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.65, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={13} /> The rest of the team is emailed whenever someone is invited, joins, is switched off or removed.
        </p>
      </div>

      <form onSubmit={invite} className={styles.card}>
        <h2 className={styles.sectionTitle} style={{ marginBottom: 12 }}><UserPlus size={16} color="#d97706" /> Invite a super admin</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>First name
            <input className={styles.input} value={form.firstName} onChange={set('firstName')} maxLength={60} required style={{ marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Last name
            <input className={styles.input} value={form.lastName} onChange={set('lastName')} maxLength={60} required style={{ marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>Email
            <input className={styles.input} type="email" value={form.email} onChange={set('email')} maxLength={200} required style={{ marginTop: 4 }} />
          </label>
          <button type="submit" disabled={busy === 'invite'} style={{ ...btn('primary'), padding: '10px 16px', justifyContent: 'center' }}>
            <Mail size={14} /> {busy === 'invite' ? 'Sending…' : 'Send invite'}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, opacity: 0.65 }}>
          They get a link (valid 7 days) to set their own password. Until then the account can't sign in.
        </p>
      </form>

      <div className={styles.card}>
        {loading ? <p style={{ margin: 0, opacity: 0.7 }}>Loading…</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>{['Name', 'Email', 'Status', 'Last sign-in', 'Devices', ''].map((h) => <th key={h} className={styles.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {team.map((a) => {
                  const st = STATUS[a.status] || STATUS.active;
                  return (
                    <tr key={a.id} className={styles.tr}>
                      <td className={styles.td}>
                        <strong>{a.firstName} {a.lastName}</strong>{a.isYou && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>(you)</span>}
                        {a.invitedBy && <div style={{ fontSize: 11, opacity: 0.6 }}>invited by {a.invitedBy}</div>}
                      </td>
                      <td className={styles.td}>{a.email}</td>
                      <td className={styles.td}>
                        <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: st.color, background: st.bg }}>{st.label}</span>
                        {a.status === 'invited' && a.inviteExpiresAt && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>link valid until {fmt(a.inviteExpiresAt)}</div>}
                      </td>
                      <td className={styles.td}>{fmt(a.lastLogin)}</td>
                      <td className={styles.td}>{a.status === 'active' ? a.activeSessions : '—'}</td>
                      <td className={styles.td}>
                        {!a.isYou && (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {a.status === 'invited' && (
                              <button style={btn()} disabled={!!busy} onClick={() => call(`resend-${a.id}`, `/${a.id}/resend`, { method: 'POST' })}>
                                <Mail size={13} /> {busy === `resend-${a.id}` ? 'Sending…' : 'Resend'}
                              </button>
                            )}
                            {a.status !== 'invited' && (
                              <button style={btn()} disabled={!!busy} onClick={() => setActive(a, a.status === 'off')}>
                                <Power size={13} /> {a.status === 'off' ? 'Switch on' : 'Switch off'}
                              </button>
                            )}
                            <button style={btn('danger')} disabled={!!busy} onClick={() => remove(a)}>
                              <Trash2 size={13} /> {a.status === 'invited' ? 'Cancel invite' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {notice && (
        <div role="status" style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, color: '#fff',
          background: notice.type === 'err' ? '#dc2626' : '#059669', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>{notice.msg}</div>
      )}
    </div>
  );
}
