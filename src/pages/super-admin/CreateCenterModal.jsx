// src/pages/super-admin/CreateCenterModal.jsx
// Super admin → "Create Center": fill in the basics, the center's admin gets an
// invite email and finishes the setup themselves (name, location, time zone,
// password) at /center-invite/:token. The center goes live when they do.
// Server: routes/centerInviteRoutes.js
import { useEffect, useRef, useState } from 'react';
import { X, Building2, Mail, CheckCircle, Copy, Check, Loader2, AlertTriangle, Send } from 'lucide-react';

const PLANS = [
  { key: 'free', label: 'Free' }, { key: 'basic', label: 'Basic' },
  { key: 'pro', label: 'Pro' }, { key: 'enterprise', label: 'Enterprise' },
];
const toSlug = (v) => v.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');

export default function CreateCenterModal({ s, apiBase, authHeaders, onClose, onCreated }) {
  const [form, setForm] = useState({ centerName: '', slug: '', adminEmail: '', plan: 'basic', maxTeachers: '', maxStudents: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugCheck, setSlugCheck] = useState({ state: 'idle', reason: '' }); // idle | checking | ok | bad
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { emailed, inviteUrl, adminEmail, expiresAt, message }
  const [copied, setCopied] = useState(false);
  const headersRef = useRef(authHeaders);
  headersRef.current = authHeaders;

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Live "is this web address free?" check
  useEffect(() => {
    if (!form.slug) { setSlugCheck({ state: 'idle', reason: '' }); return undefined; }
    setSlugCheck({ state: 'checking', reason: '' });
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`${apiBase}/super-admin/center-invites/slug-available?slug=${encodeURIComponent(form.slug)}`, { headers: headersRef.current });
        const d = await r.json();
        if (!d.success) throw new Error(d.message);
        setSlugCheck(d.data.available ? { state: 'ok', reason: '' } : { state: 'bad', reason: d.data.reason });
      } catch {
        setSlugCheck({ state: 'idle', reason: '' });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.slug, apiBase]);

  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose, sending]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (slugCheck.state === 'bad') { setError(slugCheck.reason); return; }
    setSending(true);
    try {
      const r = await fetch(`${apiBase}/super-admin/center-invites`, {
        method: 'POST',
        headers: { ...headersRef.current, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message || 'Could not create the center');
      setResult({ ...d.data, message: d.message });
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Could not create the center');
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(result.inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };

  const slugHint = {
    checking: <span style={{ color: 'var(--sa-muted)' }}>Checking…</span>,
    ok: <span style={{ color: '#10b981' }}>✓ Available</span>,
    bad: <span style={{ color: '#ef4444' }}>{slugCheck.reason}</span>,
    idle: null,
  }[slugCheck.state];

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && !sending && onClose()}>
      <div style={{ ...s.modal, maxWidth: 560 }} role="dialog" aria-label="Create new center">
        <div style={s.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={18} color="#0ea5e9" />
            <span style={s.modalTitle}>{result ? 'Invite sent' : 'Create New Center'}</span>
          </div>
          <button type="button" onClick={onClose} style={s.closeBtn} aria-label="Close" disabled={sending}><X size={18} /></button>
        </div>

        {!result ? (
          <form onSubmit={submit} style={s.modalForm}>
            <p style={s.stepDesc}>
              Fill in the basics. We'll email the center's admin a secure link to finish the setup: their name, the center's location and time zone, and their password. The center goes live when they're done.
            </p>

            <div style={s.field}>
              <label style={s.label} htmlFor="cc-name">Center name *</label>
              <input id="cc-name" style={s.input} required autoFocus maxLength={100} placeholder="e.g. Sunrise English Academy"
                value={form.centerName}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, centerName: v, slug: slugTouched ? f.slug : toSlug(v) })); }}
                disabled={sending} />
            </div>

            <div style={s.field}>
              <label style={s.label} htmlFor="cc-slug">Web address *</label>
              <div style={{ ...s.input, display: 'flex', alignItems: 'center', gap: 0, padding: 0, overflow: 'hidden' }}>
                <input id="cc-slug" required maxLength={40} placeholder="sunrise-english"
                  style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: 'inherit', font: 'inherit', padding: '10px 4px 10px 14px', outline: 'none' }}
                  value={form.slug}
                  onChange={e => { setSlugTouched(true); setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })); }}
                  disabled={sending} />
                <span style={{ padding: '10px 14px 10px 0', color: 'var(--sa-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>.clemify.com</span>
              </div>
              <span style={{ fontSize: 12, minHeight: 16 }}>{slugHint || <span style={{ color: 'var(--sa-muted)' }}>Lowercase letters, numbers and hyphens. Can't be changed later.</span>}</span>
            </div>

            <div style={s.field}>
              <label style={s.label} htmlFor="cc-email">Admin email *</label>
              <input id="cc-email" type="email" style={s.input} required maxLength={254} placeholder="owner@school.com"
                value={form.adminEmail} onChange={set('adminEmail')} disabled={sending} />
              <span style={{ fontSize: 12, color: 'var(--sa-muted)' }}>The invite goes here. This email becomes the admin's login.</span>
            </div>

            <div style={s.field}>
              <span style={s.label}>Plan *</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }} role="radiogroup" aria-label="Plan">
                {PLANS.map(p => {
                  const on = form.plan === p.key;
                  return (
                    <button key={p.key} type="button" role="radio" aria-checked={on} onClick={() => setForm(f => ({ ...f, plan: p.key }))} disabled={sending}
                      style={{ padding: '9px 6px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                        border: `1.5px solid ${on ? '#0ea5e9' : 'var(--sa-w10)'}`, background: on ? 'rgba(14,165,233,0.12)' : 'transparent', color: on ? '#0ea5e9' : 'var(--sa-text)' }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={s.twoCol}>
              <div style={s.field}>
                <label style={s.label} htmlFor="cc-mt">Max teachers</label>
                <input id="cc-mt" type="number" min={-1} style={s.input} placeholder="Plan default" value={form.maxTeachers} onChange={set('maxTeachers')} disabled={sending} />
              </div>
              <div style={s.field}>
                <label style={s.label} htmlFor="cc-ms">Max students</label>
                <input id="cc-ms" type="number" min={-1} style={s.input} placeholder="Plan default" value={form.maxStudents} onChange={set('maxStudents')} disabled={sending} />
              </div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--sa-muted)', marginTop: -8 }}>Leave empty for the default limits; use -1 for unlimited. You can change these later.</span>

            {error && (
              <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--sa-red-text)', fontSize: 13 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={s.cancelBtn} disabled={sending}>Cancel</button>
              <button type="submit" style={{ ...s.submitBtn, display: 'inline-flex', alignItems: 'center', gap: 8, opacity: sending || slugCheck.state === 'bad' ? 0.6 : 1 }} disabled={sending || slugCheck.state === 'bad' || slugCheck.state === 'checking'}>
                {sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />} {sending ? 'Sending invite…' : 'Create & send invite'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
            {result.emailed ? <CheckCircle size={44} color="#10b981" /> : <AlertTriangle size={44} color="#f59e0b" />}
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--sa-text)' }}>
                {result.emailed ? <>Invite sent to {result.adminEmail}</> : 'Center created — the email did not go out'}
              </p>
              <p style={{ margin: '8px auto 0', fontSize: 13.5, color: 'var(--sa-muted)', maxWidth: 400, lineHeight: 1.6 }}>
                {result.emailed
                  ? 'The center shows as Pending until the admin opens the link and finishes the setup. You can resend the invite from the center\'s Manage panel.'
                  : 'Copy the link below and send it to the admin yourself (WhatsApp, chat…).'}
              </p>
            </div>
            <div style={{ width: '100%', textAlign: 'left' }}>
              <span style={{ ...s.label, display: 'block', marginBottom: 6 }}><Mail size={12} style={{ verticalAlign: -1 }} /> Invite link · works once, expires {new Date(result.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={result.inviteUrl} style={{ ...s.input, fontSize: 12.5, fontFamily: 'monospace' }} onFocus={e => e.target.select()} aria-label="Invite link" />
                <button type="button" onClick={copy} style={{ ...s.cancelBtn, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <button type="button" onClick={onClose} style={{ ...s.submitBtn, marginTop: 4 }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
