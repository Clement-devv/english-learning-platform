// src/pages/super-admin/tabs/BoardTab.jsx
// Super admin: ads and information shown on the back of the dashboard welcome banner
// (the "board"). The banner flips over, shows the message for the time set here, then
// flips back — on sign-in, on tap, or both. Target: centers → admins / teachers /
// students → (one center only) chosen people.
// Server: /super-admin/board (server/routes/boardRoutes.js) · Banner: components/dashboard/FlipBoard.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Megaphone, Plus, RefreshCw, Pencil, Trash2, Pause, Play, X, Upload, Image as ImageIcon,
  Type, Eye, MousePointerClick, LogIn, Hand, Search, Monitor, Smartphone, ExternalLink, Loader2,
} from 'lucide-react';
import styles from '../SuperAdmin.module.css';

const ROLE_LABEL = { admin: 'Admins', teacher: 'Teachers', student: 'Students' };
const EMPTY = {
  kind: 'info', layout: 'text', title: '', body: '', imageUrl: '', mobileImageUrl: '',
  ctaLabel: '', ctaUrl: '', durationSec: 8, showOnLogin: true, showOnClick: true,
  active: true, startsAt: '', endsAt: '',
  target: { allCenters: true, centerIds: [], roles: ['admin', 'teacher', 'student'], allTeachers: true, teacherIds: [], allStudents: true, studentIds: [] },
};
const toLocalInput = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');

/** Live / Scheduled / Ended / Paused */
const statusOf = (m) => {
  const now = Date.now();
  if (!m.active) return { label: 'Paused', color: '#64748b' };
  if (m.startsAt && new Date(m.startsAt) > now) return { label: 'Scheduled', color: '#2563eb' };
  if (m.endsAt && new Date(m.endsAt) <= now) return { label: 'Ended', color: '#94a3b8' };
  return { label: 'Live', color: '#16a34a' };
};

const audienceOf = (m) => {
  const t = m.target || {};
  const where = t.allCenters ? 'All centers' : (m.centerNames?.length === 1 ? m.centerNames[0] : `${t.centerIds?.length || 0} centers`);
  const who = (t.roles || []).map((r) => {
    if (r === 'teacher' && !t.allTeachers) return `${t.teacherIds.length} teacher${t.teacherIds.length === 1 ? '' : 's'}`;
    if (r === 'student' && !t.allStudents) return `${t.studentIds.length} student${t.studentIds.length === 1 ? '' : 's'}`;
    return ROLE_LABEL[r];
  }).join(', ');
  return `${where} · ${who}`;
};

// ── The back of the board, exactly as dashboards render it (uses the .fb-* CSS) ──
function BoardPreview({ m, phone = false }) {
  const img = phone && m.mobileImageUrl ? m.mobileImageUrl : m.imageUrl;
  const isImage = m.layout === 'image' && img;
  const hasText = m.title || m.body || m.ctaUrl;
  const label = m.kind === 'ad' ? 'Sponsored' : 'Announcement';
  return (
    <div className="fb" style={{ '--fb-radius': '16px', width: '100%', aspectRatio: phone ? '2 / 1' : '6.2 / 1', minHeight: phone ? 150 : 120 }}>
      <div className={`fb-back ${isImage ? 'fb-back--image' : m.kind === 'ad' ? 'fb-back--ad' : 'fb-back--info'}`} style={{ transform: 'none' }}>
        <div className={`fb-msg${hasText ? ' fb-msg--text' : ''}`} style={{ animation: 'none' }}>
          {isImage && <img className="fb-img" src={img} alt="" />}
          {m.layout === 'image' && !img && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#9ca3af', fontSize: 13, fontWeight: 600 }}>
              <ImageIcon size={18} /> Upload an image
            </div>
          )}
          <div className="fb-content">
            <div className="fb-text">
<span className="fb-label">{m.kind === 'ad' ? null : <Megaphone size={11} strokeWidth={2.6} />}{label}</span>
            {m.title && <h3 className="fb-title">{m.title}</h3>}
            {m.body && <p className="fb-body">{m.body}</p>}
</div>
            {m.ctaUrl && <span className="fb-cta">{m.ctaLabel || 'Learn more'} <ExternalLink size={13} strokeWidth={2.4} /></span>}
          </div>
          <span className="fb-progress" style={{ animation: 'none', transform: 'scaleX(0.62)' }} />
        </div>
        <span className="fb-close" aria-hidden="true"><X size={15} strokeWidth={2.6} /></span>
      </div>
    </div>
  );
}

// ── Pick teachers / students of one center (uses the existing people search) ──
function PeoplePicker({ apiBase, headers, centerId, type, selected, onChange }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let stale = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`${apiBase}/super-admin/centers/${centerId}/people?type=${type}&limit=40&q=${encodeURIComponent(q)}`, { headers })
        .then((r) => r.json())
        .then((d) => {
          if (stale) return;
          const items = d?.data?.items || [];
          setRows(items);
          setNames((n) => ({ ...n, ...Object.fromEntries(items.map((p) => [p._id, p.name])) }));
        })
        .catch(() => {})
        .finally(() => { if (!stale) setLoading(false); });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [apiBase, centerId, type, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div style={{ border: '1px solid var(--sa-line)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--sa-line)', background: 'var(--sa-w02)' }}>
        <Search size={14} color="var(--sa-muted)" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${type}…`}
          style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', color: 'var(--sa-text)', fontSize: 13, fontFamily: 'inherit' }} />
        {loading && <Loader2 size={14} className="sa-spin" color="var(--sa-muted)" />}
      </div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', borderBottom: '1px solid var(--sa-line)' }}>
          {selected.map((id) => (
            <button key={id} type="button" onClick={() => toggle(id)} className="sa-chip sa-chip--on">
              {names[id] || 'Selected'} <X size={11} />
            </button>
          ))}
        </div>
      )}
      <div style={{ maxHeight: 180, overflowY: 'auto' }}>
        {rows.length === 0 && !loading && <p style={{ margin: 0, padding: 14, fontSize: 13, color: 'var(--sa-muted)', textAlign: 'center' }}>No {type} found</p>}
        {rows.map((p) => (
          <label key={p._id} className="sa-pick-row">
            <input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggle(p._id)} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--sa-text)' }}>{p.name}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--sa-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.code ? `${p.code} · ` : ''}{p.email}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Editor ──
function Editor({ initial, centers, apiBase, headers, onClose, onSaved }) {
  const [m, setM] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [centerQ, setCenterQ] = useState('');
  const fileRef = useRef(null);
  const uploadField = useRef('imageUrl');
  const set = (patch) => setM((x) => ({ ...x, ...patch }));
  const setT = (patch) => setM((x) => ({ ...x, target: { ...x.target, ...patch } }));
  const t = m.target;
  const singleCenter = !t.allCenters && t.centerIds.length === 1 ? t.centerIds[0] : null;
  const activeCenters = useMemo(() => centers.filter((c) => c.status === 'active'), [centers]);
  const shownCenters = activeCenters.filter((c) => c.centerName?.toLowerCase().includes(centerQ.toLowerCase()));

  const upload = async (file) => {
    if (!file) return;
    setUploading(uploadField.current); setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch(`${apiBase}/super-admin/board/upload`, { method: 'POST', headers, body: fd });
      const d = await res.json();
      if (!d.success) throw new Error(d.message || 'Upload failed');
      set({ [uploadField.current]: d.data.url });
    } catch (e) { setError(e.message); } finally { setUploading(''); }
  };
  const pick = (field) => { uploadField.current = field; fileRef.current?.click(); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const body = { ...m, startsAt: m.startsAt ? new Date(m.startsAt).toISOString() : null, endsAt: m.endsAt ? new Date(m.endsAt).toISOString() : null };
      const res = await fetch(`${apiBase}/super-admin/board${m._id ? `/${m._id}` : ''}`, {
        method: m._id ? 'PUT' : 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.message || 'Could not save');
      onSaved(d.message);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const toggleRole = (r) => setT({ roles: t.roles.includes(r) ? t.roles.filter((x) => x !== r) : [...t.roles, r] });
  const toggleCenter = (id) => setT({ centerIds: t.centerIds.includes(id) ? t.centerIds.filter((x) => x !== id) : [...t.centerIds, id] });

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className={`${styles.modal} sa-board-modal`} role="dialog" aria-label={m._id ? 'Edit board message' : 'New board message'}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Megaphone size={16} color="#f59e0b" />
            <span className={styles.modalTitle}>{m._id ? 'Edit board message' : 'New board message'}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="sa-board-grid">
          {/* ── Left: form ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <Section title="Message">
              <div className="sa-row2">
                <Segmented value={m.kind} onChange={(kind) => set({ kind })} options={[{ value: 'info', label: 'Information', icon: Megaphone }, { value: 'ad', label: 'Ad', icon: ExternalLink }]} />
                <Segmented value={m.layout} onChange={(layout) => set({ layout })} options={[{ value: 'text', label: 'Text card', icon: Type }, { value: 'image', label: 'Image', icon: ImageIcon }]} />
              </div>
              {m.layout === 'image' && (
                <div className="sa-row2">
                  <ImageSlot label="Board image" hint="1600 × 260 px · wide" url={m.imageUrl} busy={uploading === 'imageUrl'} onPick={() => pick('imageUrl')} onClear={() => set({ imageUrl: '', mobileImageUrl: '' })} />
                  <ImageSlot label="Phone image (optional)" hint="800 × 400 px · used on phones" url={m.mobileImageUrl} busy={uploading === 'mobileImageUrl'} disabled={!m.imageUrl} onPick={() => pick('mobileImageUrl')} onClear={() => set({ mobileImageUrl: '' })} />
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              <Field label="Title" count={`${m.title.length}/80`}>
                <input className={styles.input} maxLength={80} value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder={m.kind === 'ad' ? 'Summer IELTS course — 20% off' : 'Center closed on Friday'} />
              </Field>
              <Field label={m.layout === 'image' ? 'Text on the image (optional)' : 'Message'} count={`${m.body.length}/240`}>
                <textarea className={styles.input} maxLength={240} rows={2} value={m.body} onChange={(e) => set({ body: e.target.value })} style={{ resize: 'vertical' }} />
              </Field>
              <div className="sa-row2">
                <Field label="Button text (optional)">
                  <input className={styles.input} maxLength={30} value={m.ctaLabel} onChange={(e) => set({ ctaLabel: e.target.value })} placeholder="Learn more" />
                </Field>
                <Field label="Button link">
                  <input className={styles.input} type="url" value={m.ctaUrl} onChange={(e) => set({ ctaUrl: e.target.value })} placeholder="https://…" />
                </Field>
              </div>
            </Section>

            <Section title="Timing">
              <Field label="Show for">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {[5, 8, 15, 30].map((s) => (
                    <button key={s} type="button" className={`sa-chip${m.durationSec === s ? ' sa-chip--on' : ''}`} onClick={() => set({ durationSec: s })}>{s}s</button>
                  ))}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input className={styles.input} type="number" min={3} max={120} value={m.durationSec} onChange={(e) => set({ durationSec: Math.max(0, Number(e.target.value) || 0) })} style={{ width: 80 }} />
                    <span style={{ fontSize: 13, color: 'var(--sa-muted)' }}>seconds</span>
                  </span>
                </div>
              </Field>
              <Field label="Flips over">
                <div className="sa-row2">
                  <Check checked={m.showOnLogin} onChange={(v) => set({ showOnLogin: v })} icon={LogIn} title="When they sign in" sub="Once per sign-in, by itself" />
                  <Check checked={m.showOnClick} onChange={(v) => set({ showOnClick: v })} icon={Hand} title="When they tap the board" sub="A small megaphone shows on the banner" />
                </div>
              </Field>
              <div className="sa-row2">
                <Field label="Start (optional)"><input className={styles.input} type="datetime-local" value={m.startsAt} onChange={(e) => set({ startsAt: e.target.value })} /></Field>
                <Field label="End (optional)"><input className={styles.input} type="datetime-local" value={m.endsAt} onChange={(e) => set({ endsAt: e.target.value })} /></Field>
              </div>
            </Section>

            <Section title="Audience">
              <Segmented value={t.allCenters ? 'all' : 'some'} onChange={(v) => setT({ allCenters: v === 'all' })}
                options={[{ value: 'all', label: 'All centers' }, { value: 'some', label: 'Choose centers' }]} />
              {!t.allCenters && (
                <div style={{ border: '1px solid var(--sa-line)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--sa-line)', background: 'var(--sa-w02)' }}>
                    <Search size={14} color="var(--sa-muted)" />
                    <input value={centerQ} onChange={(e) => setCenterQ(e.target.value)} placeholder="Search centers…"
                      style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', color: 'var(--sa-text)', fontSize: 13, fontFamily: 'inherit' }} />
                    <span style={{ fontSize: 12, color: 'var(--sa-muted)', fontWeight: 600 }}>{t.centerIds.length} chosen</span>
                  </div>
                  <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                    {shownCenters.map((c) => (
                      <label key={c._id} className="sa-pick-row">
                        <input type="checkbox" checked={t.centerIds.includes(c._id)} onChange={() => toggleCenter(c._id)} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sa-text)' }}>{c.centerName}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Field label="Who sees it">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['admin', 'teacher', 'student'].map((r) => (
                    <button key={r} type="button" className={`sa-chip${t.roles.includes(r) ? ' sa-chip--on' : ''}`} aria-pressed={t.roles.includes(r)} onClick={() => toggleRole(r)}>{ROLE_LABEL[r]}</button>
                  ))}
                </div>
              </Field>
              {singleCenter ? (
                ['teacher', 'student'].filter((r) => t.roles.includes(r)).map((r) => {
                  const allKey = r === 'teacher' ? 'allTeachers' : 'allStudents';
                  const idsKey = r === 'teacher' ? 'teacherIds' : 'studentIds';
                  return (
                    <Field key={r} label={ROLE_LABEL[r]}>
                      <Segmented value={t[allKey] ? 'all' : 'some'} onChange={(v) => setT({ [allKey]: v === 'all' })}
                        options={[{ value: 'all', label: `All ${ROLE_LABEL[r].toLowerCase()}` }, { value: 'some', label: `Choose ${ROLE_LABEL[r].toLowerCase()}` }]} />
                      {!t[allKey] && (
                        <div style={{ marginTop: 8 }}>
                          <PeoplePicker apiBase={apiBase} headers={headers} centerId={singleCenter} type={`${r}s`} selected={t[idsKey]} onChange={(list) => setT({ [idsKey]: list })} />
                        </div>
                      )}
                    </Field>
                  );
                })
              ) : (t.roles.includes('teacher') || t.roles.includes('student')) && (
                <p className="sa-hint">To pick individual teachers or students, choose exactly one center.</p>
              )}
            </Section>
          </div>

          {/* ── Right: live preview ── */}
          <aside className="sa-board-preview">
            <p className="sa-preview-title"><Eye size={13} /> Preview — exactly what they'll see</p>
            <p className="sa-preview-sub"><Monitor size={12} /> Desktop</p>
            <BoardPreview m={m} />
            <p className="sa-preview-sub"><Smartphone size={12} /> Phone</p>
            <div style={{ maxWidth: 340 }}><BoardPreview m={m} phone /></div>
            <p className="sa-hint" style={{ marginTop: 12 }}>
              The board turns over for <strong>{m.durationSec || '–'} seconds</strong>, then turns back. People can close it early or hover to pause it.
            </p>
          </aside>
        </div>

        <div className="sa-board-foot">
          {error ? <p role="alert" className="sa-error">{error}</p> : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className={styles.cancelBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button className={styles.submitBtn} onClick={save} disabled={saving || !!uploading}>
              {saving ? <Loader2 size={15} className="sa-spin" /> : null}{m._id ? 'Save changes' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Section = ({ title, children }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <h3 className="sa-section-h">{title}</h3>
    {children}
  </section>
);
const Field = ({ label, count, children }) => (
  <div className={styles.field}>
    <span style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span className={styles.label}>{label}</span>
      {count && <span style={{ fontSize: 11, color: 'var(--sa-muted)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
    </span>
    {children}
  </div>
);
const Segmented = ({ value, onChange, options }) => (
  <div className="sa-seg" role="radiogroup">
    {options.map(({ value: v, label, icon: Icon }) => (
      <button key={v} type="button" role="radio" aria-checked={value === v} className={`sa-seg-btn${value === v ? ' sa-seg-btn--on' : ''}`} onClick={() => onChange(v)}>
        {Icon && <Icon size={14} />}{label}
      </button>
    ))}
  </div>
);
const Check = ({ checked, onChange, icon: Icon, title, sub }) => (
  <label className={`sa-check${checked ? ' sa-check--on' : ''}`}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <Icon size={16} />
    <span><span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--sa-text)' }}>{title}</span>
      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--sa-muted)' }}>{sub}</span></span>
  </label>
);
const ImageSlot = ({ label, hint, url, busy, disabled, onPick, onClear }) => (
  <div className={styles.field}>
    <span className={styles.label}>{label}</span>
    <div className="sa-slot" data-disabled={disabled || undefined}>
      {url ? <img src={url} alt="" /> : <span className="sa-slot-empty">{busy ? <Loader2 size={18} className="sa-spin" /> : <Upload size={18} />}<span>{hint}</span></span>}
      <span className="sa-slot-actions">
        <button type="button" className="sa-chip" onClick={onPick} disabled={disabled || busy}>{url ? 'Replace' : 'Upload'}</button>
        {url && <button type="button" className="sa-chip" onClick={onClear}>Remove</button>}
      </span>
    </div>
  </div>
);

// ── Tab ──
export default function BoardTab({ apiBase, authHeaders, centers = [] }) {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const headers = authHeaders;

  const load = () => fetch(`${apiBase}/super-admin/board`, { headers }).then((r) => r.json())
    .then((d) => setItems(d.success ? d.data : [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 3000); return () => clearTimeout(t); }, [msg]);

  const openEdit = (m) => setEditing(m ? {
    ...EMPTY, ...m,
    startsAt: toLocalInput(m.startsAt), endsAt: toLocalInput(m.endsAt),
    target: { ...EMPTY.target, ...m.target, centerIds: (m.target?.centerIds || []).map(String) },
  } : { ...EMPTY, target: { ...EMPTY.target } });

  const toggle = async (m) => {
    setBusy(m._id);
    const d = await fetch(`${apiBase}/super-admin/board/${m._id}/active`, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !m.active }) }).then((r) => r.json()).catch(() => ({}));
    setBusy('');
    if (d.success) { setMsg(d.message); load(); }
  };
  const remove = async (m) => {
    if (!window.confirm(`Delete "${m.title || 'this message'}"? It disappears from every dashboard.`)) return;
    setBusy(m._id);
    const d = await fetch(`${apiBase}/super-admin/board/${m._id}`, { method: 'DELETE', headers }).then((r) => r.json()).catch(() => ({}));
    setBusy('');
    if (d.success) { setMsg(d.message); load(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className={styles.card} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h2 className={styles.sectionTitle}><Megaphone size={16} color="#f59e0b" /> Dashboard board</h2>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--sa-muted)', maxWidth: 620, lineHeight: 1.5 }}>
            Put an ad or an announcement on the welcome banner of admin, teacher and student dashboards. The banner flips over, shows it for the time you choose, then flips back.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className={styles.refreshBtn} title="Refresh" aria-label="Refresh"><RefreshCw size={14} /></button>
          <button onClick={() => openEdit(null)} className={styles.submitBtn}><Plus size={15} /> New message</button>
        </div>
      </div>

      {msg && <p role="status" className="sa-toast">{msg}</p>}

      {items === null ? (
        <div className={styles.card} style={{ textAlign: 'center', color: 'var(--sa-muted)', padding: 40 }}>Loading…</div>
      ) : items.length === 0 ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: '48px 20px' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,158,11,0.12)' }}>
            <Megaphone size={22} color="#f59e0b" />
          </div>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--sa-text)' }}>No board messages yet</p>
          <p style={{ margin: '4px 0 16px', fontSize: 13, color: 'var(--sa-muted)' }}>Create one to show it on dashboards.</p>
          <button onClick={() => openEdit(null)} className={styles.submitBtn}><Plus size={15} /> New message</button>
        </div>
      ) : (
        <div className="sa-board-list">
          {items.map((m) => {
            const st = statusOf(m);
            return (
              <article key={m._id} className={`${styles.card} sa-board-item`} data-paused={!m.active || undefined}>
                <div className="sa-board-thumb"><BoardPreview m={m} /></div>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="sa-status" style={{ '--c': st.color }}><span className="sa-dot" />{st.label}</span>
                    <span className="sa-kind">{m.kind === 'ad' ? 'Ad' : 'Information'}</span>
                    <strong style={{ fontSize: 14, color: 'var(--sa-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title || (m.layout === 'image' ? 'Image board' : 'Untitled')}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 12.5, color: 'var(--sa-muted)' }}>{audienceOf(m)}</p>
                  <div className="sa-meta">
                    <span>{m.durationSec}s</span>
                    {m.showOnLogin && <span><LogIn size={12} /> On sign-in</span>}
                    {m.showOnClick && <span><Hand size={12} /> On tap</span>}
                    {(m.startsAt || m.endsAt) && <span>{m.startsAt ? new Date(m.startsAt).toLocaleDateString() : 'Now'} → {m.endsAt ? new Date(m.endsAt).toLocaleDateString() : 'no end'}</span>}
                    <span><Eye size={12} /> {m.views} views</span>
                    {m.ctaUrl && <span><MousePointerClick size={12} /> {m.clicks} clicks</span>}
                  </div>
                </div>
                <div className="sa-board-actions">
                  <button className="sa-icon-btn" onClick={() => toggle(m)} disabled={busy === m._id} aria-label={m.active ? 'Pause' : 'Resume'} title={m.active ? 'Pause' : 'Resume'}>
                    {m.active ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button className="sa-icon-btn" onClick={() => openEdit(m)} aria-label="Edit" title="Edit"><Pencil size={15} /></button>
                  <button className="sa-icon-btn sa-icon-btn--danger" onClick={() => remove(m)} disabled={busy === m._id} aria-label="Delete" title="Delete"><Trash2 size={15} /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <Editor initial={editing} centers={centers} apiBase={apiBase} headers={headers}
          onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); setMsg(text); load(); }} />
      )}
    </div>
  );
}
