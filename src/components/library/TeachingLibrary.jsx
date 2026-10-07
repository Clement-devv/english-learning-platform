// src/components/library/TeachingLibrary.jsx
// A center's teaching library (PDFs). Used by:
//   • admin  (canManage)  — storage bar, upload, edit, delete
//   • teacher             — search, filter, view, download
// Server: routes/libraryRoutes.js (GET/POST/PATCH/DELETE /library, GET /library/:id/download)
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Library, Search, Upload, FileText, Download, Eye, Pencil, Trash2, X, Loader2, AlertTriangle, CheckCircle2, HardDrive, Tag, Send, Clock,
} from 'lucide-react';
import api from '../../api';
import Pagination from '../Pagination';
import { useOnDataChanged } from '../../hooks/useLiveData';

const BRAND = 'var(--brand-primary, #be185d)';
const API_ORIGIN = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MAX_MB = 25;

const fmtBytes = (b = 0) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const titleFromFile = (name = '') => name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export default function TeachingLibrary({ isDarkMode = false, canManage = false }) {
  const c = isDarkMode
    ? { card: '#1a1d2e', border: '#2a2d40', heading: '#f0f4ff', body: '#c8cce0', muted: '#8b91b8', input: '#0f1117', soft: '#141620', chip: 'rgba(255,255,255,0.06)' }
    : { card: '#ffffff', border: '#e2e8f0', heading: '#1e293b', body: '#475569', muted: '#64748b', input: '#f8faff', soft: '#f8fafc', chip: '#f1f5f9' };

  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [sort, setSort] = useState('new');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { text, kind }
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [assigning, setAssigning] = useState(null); // admin: "Send to teacher" dialog
  const [sentList, setSentList] = useState(null);   // admin: who a book was sent to
  const [showUpload, setShowUpload] = useState(false);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const { data: d } = await api.get('/library', { params: { q: query || undefined, category: category || undefined, level: level || undefined, sort, page, limit: 24 } });
      if (id !== reqId.current) return;
      setData(d.data); setError('');
      if (d.data.pagination.page !== page) setPage(d.data.pagination.page);
    } catch (e) {
      if (id === reqId.current) setError(e?.response?.data?.message || 'Could not load the library');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [query, category, level, sort, page]);
  useEffect(() => { load(); }, [load]);
  // Live: a book the admin sends pops up here without a reload (server key "library")
  useOnDataChanged(['library'], () => load());

  const acknowledge = async (pin) => {
    setBusyId(pin.assignmentId + 'ack');
    try {
      await api.post(`/library/assignments/${pin.assignmentId}/acknowledge`);
      setData(prev => ({ ...prev, pinned: (prev.pinned || []).filter(p => p.assignmentId !== pin.assignmentId) }));
      flash(`Got it — "${pin.file.title}" is no longer pinned`);
    } catch (e) {
      flash(e?.response?.data?.message || 'Could not acknowledge', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // Search as you type (short pause)
  useEffect(() => {
    const t = setTimeout(() => { if (q.trim() !== query) { setQuery(q.trim()); setPage(1); } }, 350);
    return () => clearTimeout(t);
  }, [q, query]);

  const flash = (text, kind = 'ok') => { setNotice({ text, kind }); setTimeout(() => setNotice(null), 5000); };

  const open = async (file, mode) => {
    setBusyId(file._id + mode);
    try {
      const { data: d } = await api.get(`/library/${file._id}/download`, { params: { mode } });
      const url = d.data.url.startsWith('/') ? `${API_ORIGIN}${d.data.url}` : d.data.url;
      if (mode === 'view') {
        window.open(url, '_blank', 'noopener');
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = d.data.fileName; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        if (data) setData(prev => ({ ...prev, files: prev.files.map(f => (f._id === file._id ? { ...f, downloads: (f.downloads || 0) + 1 } : f)) }));
      }
    } catch (e) {
      flash(e?.response?.data?.message || 'Could not open the file', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (file) => {
    if (!window.confirm(`Delete "${file.title}" from the library? Teachers will no longer see it.`)) return;
    setBusyId(file._id + 'del');
    try {
      const { data: d } = await api.delete(`/library/${file._id}`);
      flash(d.message || 'Deleted');
      load();
    } catch (e) {
      flash(e?.response?.data?.message || 'Could not delete', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const files = data?.files || [];
  const pager = data?.pagination || { page: 1, totalPages: 1, total: 0, limit: 24 };
  const usage = data?.usage;
  const filtersOn = query || category || level;

  const inp = { padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${c.border}`, background: c.input, color: c.heading, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', colorScheme: isDarkMode ? 'dark' : 'light' };
  const btn = (primary) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', border: primary ? 'none' : `1px solid ${c.border}`, background: primary ? BRAND : 'transparent', color: primary ? '#fff' : c.heading });
  const chip = (on) => ({ padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? 'transparent' : c.border}`, background: on ? BRAND : 'transparent', color: on ? '#fff' : c.body });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: c.heading, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Library size={20} color={BRAND} /> Teaching library
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: c.body }}>
            {canManage ? 'Upload PDFs your teachers use — they can search, view and download them from their account.' : 'Teaching materials shared by your school. Search, view or download.'}
          </p>
        </div>
        {canManage && <button type="button" onClick={() => setShowUpload(true)} style={btn(true)}><Upload size={15} /> Upload PDF</button>}
      </div>

      {canManage && usage && <UsageBar usage={usage} pricePerGb={data.pricePerGb} c={c} />}

      {/* Teacher: books the admin sent — pinned and pulsing until acknowledged */}
      {!canManage && data?.pinned?.length > 0 && (
        <section aria-label="Books sent to you" style={{ borderRadius: 18, padding: 16, background: isDarkMode ? 'rgba(219,39,119,0.10)' : '#fdf2f8', border: '1.5px solid rgba(219,39,119,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="tl-dot" aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: '#db2777' }} />
            <strong style={{ color: c.heading, fontSize: 15 }}>
              {data.pinned.length === 1 ? 'Your admin sent you a book to use' : `Your admin sent you ${data.pinned.length} books to use`}
            </strong>
            <span style={{ fontSize: 12.5, color: c.body }}>They stay here until you press Acknowledge.</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
            {data.pinned.map(p => (
              <article key={p.assignmentId} className="tl-pinned" style={{ background: c.card, border: '1.5px solid #db2777', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div aria-hidden style={{ width: 40, height: 50, borderRadius: 8, background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>PDF</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, color: c.heading, fontSize: 14.5, lineHeight: 1.35, wordBreak: 'break-word' }}>{p.file.title}</div>
                    <div style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>From {p.assignedBy} · {fmtDate(p.assignedAt)} · {fmtBytes(p.file.size)}</div>
                  </div>
                </div>
                <p style={{ margin: 0, padding: '10px 12px', borderRadius: 10, background: c.soft, borderLeft: '3px solid #db2777', fontSize: 13.5, color: c.heading, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{p.note}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => open(p.file, 'view')} disabled={busyId === p.file._id + 'view'} style={btn(false)}><Eye size={14} /> View</button>
                  <button type="button" onClick={() => open(p.file, 'download')} disabled={busyId === p.file._id + 'download'} style={btn(false)}><Download size={14} /> Download</button>
                  <button type="button" onClick={() => acknowledge(p)} disabled={busyId === p.assignmentId + 'ack'} style={{ ...btn(true), marginLeft: 'auto' }}>
                    {busyId === p.assignmentId + 'ack' ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />} Acknowledge
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {notice && (
        <div role={notice.kind === 'error' ? 'alert' : 'status'} style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', background: notice.kind === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: notice.kind === 'error' ? '#dc2626' : '#059669' }}>
          {notice.kind === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />} {notice.text}
        </div>
      )}

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={15} color={c.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title, topic, tag…" aria-label="Search the library" style={{ ...inp, width: '100%', paddingLeft: 34 }} />
        </div>
        {(data?.levels?.length > 0) && (
          <select value={level} onChange={e => { setLevel(e.target.value); setPage(1); }} aria-label="Level" style={{ ...inp, width: 150 }}>
            <option value="">All levels</option>
            {data.levels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} aria-label="Sort" style={{ ...inp, width: 160 }}>
          <option value="new">Newest first</option>
          <option value="title">Title A–Z</option>
          <option value="popular">Most downloaded</option>
        </select>
      </div>
      {data?.categories?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setCategory(''); setPage(1); }} style={chip(!category)}>All</button>
          {data.categories.map(cat => <button key={cat} type="button" onClick={() => { setCategory(cat); setPage(1); }} style={chip(category === cat)}>{cat}</button>)}
        </div>
      )}

      {/* Files */}
      {error ? (
        <p style={{ color: '#dc2626', textAlign: 'center', padding: 20 }}>{error}</p>
      ) : loading && !data ? (
        <p style={{ color: c.muted, textAlign: 'center', padding: 40 }}>Loading…</p>
      ) : files.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: c.card, border: `1px dashed ${c.border}`, borderRadius: 16, color: c.muted }}>
          <FileText size={34} style={{ opacity: 0.4 }} />
          <p style={{ margin: '10px 0 0', fontWeight: 600 }}>
            {filtersOn ? 'No files match your search.' : canManage ? 'Your library is empty. Upload your first PDF.' : 'No teaching materials have been shared yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 14, opacity: loading ? 0.6 : 1 }}>
          {files.map(f => (
            <article key={f._id} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div aria-hidden style={{ width: 44, height: 54, borderRadius: 8, background: 'rgba(220,38,38,0.1)', color: '#dc2626', display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 900, flexShrink: 0, letterSpacing: '.04em' }}>PDF</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, color: c.heading, fontSize: 14.5, lineHeight: 1.35, wordBreak: 'break-word' }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: c.muted, marginTop: 3 }}>{fmtBytes(f.size)} · {fmtDate(f.createdAt)} · {f.downloads || 0} download{f.downloads === 1 ? '' : 's'}</div>
                </div>
              </div>
              {f.description && <p style={{ margin: 0, fontSize: 13, color: c.body, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{f.description}</p>}
              {(f.category || f.level || f.tags?.length > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {f.category && <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: c.chip, color: c.body }}>{f.category}</span>}
                  {f.level && <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'rgba(190,24,93,0.12)', color: isDarkMode ? `color-mix(in srgb, ${BRAND} 45%, white)` : BRAND }}>{f.level}</span>}
                  {(f.tags || []).slice(0, 4).map(t => <span key={t} style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 999, color: c.muted, border: `1px solid ${c.border}`, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Tag size={10} />{t}</span>)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => open(f, 'view')} disabled={busyId === f._id + 'view'} style={btn(false)}>
                  {busyId === f._id + 'view' ? <Loader2 size={14} className="spin" /> : <Eye size={14} />} View
                </button>
                <button type="button" onClick={() => open(f, 'download')} disabled={busyId === f._id + 'download'} style={btn(true)}>
                  {busyId === f._id + 'download' ? <Loader2 size={14} className="spin" /> : <Download size={14} />} Download
                </button>
              </div>
              {canManage && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${c.border}`, flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => setAssigning(f)} style={{ ...btn(false), color: BRAND, borderColor: 'rgba(190,24,93,0.35)' }} title="Ask a teacher to use this book">
                    <Send size={14} /> Send to teacher
                  </button>
                  {f.sentTo && (
                    <button type="button" onClick={() => setSentList(f)} title="Who it was sent to"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: 4, color: f.sentTo.pending ? '#b45309' : '#059669', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {f.sentTo.pending ? <Clock size={13} /> : <CheckCircle2 size={13} />}
                      {f.sentTo.pending ? `${f.sentTo.pending} waiting` : `${f.sentTo.total} acknowledged`}
                    </button>
                  )}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button type="button" onClick={() => setEditing(f)} aria-label={`Edit ${f.title}`} title="Edit details" style={{ ...btn(false), padding: 8 }}><Pencil size={14} /></button>
                    <button type="button" onClick={() => remove(f)} disabled={busyId === f._id + 'del'} aria-label={`Delete ${f.title}`} title="Delete" style={{ ...btn(false), padding: 8, color: '#dc2626' }}><Trash2 size={14} /></button>
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={setPage} isDarkMode={isDarkMode} />

      {data?.copyrightEmail && (
        <p style={{ margin: 0, fontSize: 12, color: c.muted, textAlign: 'center' }}>
          Copyright concern about a file? Contact <a href={`mailto:${data.copyrightEmail}`} style={{ color: BRAND }}>{data.copyrightEmail}</a>.
        </p>
      )}

      {showUpload && (
        <UploadDialog c={c} inp={inp} btn={btn} isDarkMode={isDarkMode} categories={data?.categories || []} levels={data?.levels || []}
          onClose={() => setShowUpload(false)} onDone={(msg) => { setShowUpload(false); flash(msg); load(); }} />
      )}
      {editing && (
        <EditDialog c={c} inp={inp} btn={btn} file={editing} categories={data?.categories || []} levels={data?.levels || []}
          onClose={() => setEditing(null)} onDone={(msg) => { setEditing(null); flash(msg); load(); }} />
      )}
      {assigning && (
        <AssignDialog c={c} inp={inp} btn={btn} file={assigning}
          onClose={() => setAssigning(null)} onDone={(msg) => { setAssigning(null); flash(msg); load(); }} />
      )}
      {sentList && <SentListDialog c={c} btn={btn} file={sentList} onClose={() => setSentList(null)} onChanged={load} />}
      <style>{`@keyframes tlSpin{to{transform:rotate(360deg)}} .spin{animation:tlSpin .8s linear infinite}
@keyframes tlPulse{0%,100%{box-shadow:0 0 0 0 rgba(219,39,119,.55),0 10px 28px -12px rgba(190,24,93,.45)}50%{box-shadow:0 0 0 7px rgba(219,39,119,0),0 10px 28px -12px rgba(190,24,93,.45)}}
@keyframes tlBlink{0%,100%{opacity:1}50%{opacity:.35}}
.tl-pinned{animation:tlPulse 1.8s ease-in-out infinite}
.tl-dot{animation:tlBlink 1.2s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.tl-pinned,.tl-dot{animation:none}}`}</style>
    </div>
  );
}

function UsageBar({ usage, pricePerGb, c }) {
  const over = usage.usedBytes > usage.allowanceBytes;
  const pct = Math.min(100, Math.round((usage.usedBytes / Math.max(usage.allowanceBytes, 1)) * 100));
  const color = over ? '#f59e0b' : pct >= 80 ? '#f59e0b' : BRAND;
  return (
    <div style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: c.heading }}><HardDrive size={15} color={color} /> Storage</span>
        <span style={{ color: c.body }}><strong style={{ color: c.heading }}>{fmtBytes(usage.usedBytes)}</strong> of {fmtBytes(usage.allowanceBytes)} · {usage.fileCount} file{usage.fileCount === 1 ? '' : 's'}</span>
      </div>
      <div style={{ height: 8, borderRadius: 8, background: c.chip, marginTop: 10, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 8, transition: 'width .3s' }} />
      </div>
      {over ? (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#b45309' }}>
          You're {fmtBytes(usage.usedBytes - usage.allowanceBytes)} over your allowance. Uploads still work up to {fmtBytes(usage.hardCapBytes)}; extra space is billed at {usage.currency} {pricePerGb} per GB per month
          {usage.estimatedCharge > 0 ? ` (about ${usage.currency} ${usage.estimatedCharge} this month)` : ''}.
        </p>
      ) : pct >= 80 ? (
        <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#b45309' }}>Almost full. Delete files you no longer need, or keep uploading — extra space is billed at {usage.currency} {pricePerGb} per GB per month.</p>
      ) : null}
    </div>
  );
}

function Dialog({ title, c, onClose, children }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={title} style={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: c.heading }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: c.muted, cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailsFields({ form, setForm, c, inp, categories, levels }) {
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const label = { fontSize: 12, fontWeight: 700, color: c.muted, display: 'block', marginBottom: 5 };
  return (
    <>
      <label><span style={label}>Title *</span><input value={form.title} onChange={set('title')} maxLength={160} required style={{ ...inp, width: '100%' }} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label><span style={label}>Category</span>
          <input value={form.category} onChange={set('category')} list="tl-categories" maxLength={60} placeholder="Grammar" style={{ ...inp, width: '100%' }} />
          <datalist id="tl-categories">{categories.map(x => <option key={x} value={x} />)}</datalist>
        </label>
        <label><span style={label}>Level</span>
          <input value={form.level} onChange={set('level')} list="tl-levels" maxLength={40} placeholder="A2, Kids, IELTS…" style={{ ...inp, width: '100%' }} />
          <datalist id="tl-levels">{levels.map(x => <option key={x} value={x} />)}</datalist>
        </label>
      </div>
      <label><span style={label}>Tags <span style={{ fontWeight: 500 }}>(comma separated)</span></span><input value={form.tags} onChange={set('tags')} placeholder="present simple, worksheet" style={{ ...inp, width: '100%' }} /></label>
      <label><span style={label}>Description</span><textarea value={form.description} onChange={set('description')} rows={3} maxLength={1000} style={{ ...inp, width: '100%', resize: 'vertical' }} /></label>
    </>
  );
}

function UploadDialog({ c, inp, btn, categories, levels, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', category: '', level: '', tags: '', description: '' });
  const [rights, setRights] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const pick = (f) => {
    setError('');
    if (!f) return;
    if (f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { setError('Only PDF files can be added'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`This PDF is ${fmtBytes(f.size)} — the limit is ${MAX_MB} MB`); return; }
    setFile(f);
    setForm(p => ({ ...p, title: p.title || titleFromFile(f.name) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Choose a PDF first'); return; }
    if (!form.title.trim()) { setError('Give the file a title'); return; }
    if (!rights) { setError('Please confirm you have the right to share this file'); return; }
    const body = new FormData();
    body.append('file', file);
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append('rightsConfirmed', 'true');
    setProgress(0); setError('');
    try {
      const { data } = await api.post('/library', body, { onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)) });
      onDone(data.message || 'Uploaded');
    } catch (err) {
      setError(err?.response?.data?.message || 'Upload failed');
      setProgress(null);
    }
  };

  const uploading = progress !== null;
  return (
    <Dialog title="Upload a PDF" c={c} onClose={uploading ? () => {} : onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          style={{ border: `2px dashed ${drag ? BRAND : c.border}`, borderRadius: 14, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', background: drag ? 'rgba(190,24,93,0.05)' : c.soft }}>
          {file ? (
            <div style={{ color: c.heading, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <FileText size={18} color="#dc2626" /> {file.name} <span style={{ color: c.muted, fontWeight: 500 }}>· {fmtBytes(file.size)}</span>
            </div>
          ) : (
            <>
              <Upload size={24} color={BRAND} />
              <div style={{ color: c.heading, fontWeight: 700, marginTop: 6 }}>Drop a PDF here or click to choose</div>
              <div style={{ color: c.muted, fontSize: 12.5, marginTop: 2 }}>PDF only · up to {MAX_MB} MB</div>
            </>
          )}
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={e => pick(e.target.files?.[0])} />
        </div>

        <DetailsFields form={form} setForm={setForm} c={c} inp={inp} categories={categories} levels={levels} />

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: c.soft, border: `1px solid ${c.border}`, cursor: 'pointer', fontSize: 13, color: c.body, lineHeight: 1.5 }}>
          <input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} style={{ width: 17, height: 17, marginTop: 1, flexShrink: 0 }} />
          <span><strong style={{ color: c.heading }}>I have the right to share this file.</strong> It's our own material, or we're licensed to share it with our teachers. Copyrighted books we don't have rights to must not be uploaded.</span>
        </label>

        {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        {uploading && (
          <div>
            <div style={{ height: 6, borderRadius: 6, background: c.soft, overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: BRAND, transition: 'width .2s' }} /></div>
            <div style={{ fontSize: 12, color: c.muted, marginTop: 4 }}>{progress < 100 ? `Uploading… ${progress}%` : 'Saving…'}</div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={uploading} style={btn(false)}>Cancel</button>
          <button type="submit" disabled={uploading} style={{ ...btn(true), opacity: uploading ? 0.7 : 1 }}>{uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} Upload</button>
        </div>
      </form>
    </Dialog>
  );
}

function EditDialog({ c, inp, btn, file, categories, levels, onClose, onDone }) {
  const [form, setForm] = useState({ title: file.title || '', category: file.category || '', level: file.level || '', tags: (file.tags || []).join(', '), description: file.description || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const { data } = await api.patch(`/library/${file._id}`, form);
      onDone(data.message || 'Saved');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog title="Edit file details" c={c} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <DetailsFields form={form} setForm={setForm} c={c} inp={inp} categories={categories} levels={levels} />
        {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn(false)}>Cancel</button>
          <button type="submit" disabled={saving} style={btn(true)}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Dialog>
  );
}

function AssignDialog({ c, inp, btn, file, onClose, onDone }) {
  const [q, setQ] = useState('');
  const [teachers, setTeachers] = useState(null);
  const [picked, setPicked] = useState({}); // id → name
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get('/library/teachers', { params: { q: q.trim() || undefined } })
        .then(({ data }) => setTeachers(data.data))
        .catch(() => setTeachers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = (t) => setPicked(p => { const n = { ...p }; if (n[t._id]) delete n[t._id]; else n[t._id] = t.name; return n; });
  const ids = Object.keys(picked);

  const submit = async (e) => {
    e.preventDefault();
    if (!ids.length) { setError('Choose at least one teacher'); return; }
    if (!note.trim()) { setError('Add a short description — e.g. which student and what to use it for'); return; }
    setSending(true); setError('');
    try {
      const { data } = await api.post(`/library/${file._id}/assign`, { teacherIds: ids, note: note.trim() });
      onDone(data.message || 'Sent');
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send');
    } finally {
      setSending(false);
    }
  };

  const label = { fontSize: 12, fontWeight: 700, color: c.muted, display: 'block', marginBottom: 5 };
  return (
    <Dialog title="Send to teacher" c={c} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 12, background: c.soft, border: `1px solid ${c.border}` }}>
          <FileText size={18} color="#dc2626" />
          <span style={{ fontWeight: 700, color: c.heading, fontSize: 14 }}>{file.title}</span>
        </div>

        <div>
          <span style={label}>Teacher(s) *</span>
          {ids.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {ids.map(id => (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px 4px 10px', borderRadius: 999, background: 'rgba(190,24,93,0.1)', color: BRAND, fontSize: 12.5, fontWeight: 700 }}>
                  {picked[id]}
                  <button type="button" onClick={() => setPicked(p => { const n = { ...p }; delete n[id]; return n; })} aria-label={`Remove ${picked[id]}`} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'grid' }}><X size={13} /></button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <Search size={14} color={c.muted} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search teachers by name or ID" aria-label="Search teachers" style={{ ...inp, width: '100%', paddingLeft: 32 }} />
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 6, border: `1px solid ${c.border}`, borderRadius: 12 }}>
            {teachers === null ? <p style={{ margin: 0, padding: 12, color: c.muted, fontSize: 13 }}>Loading…</p>
              : teachers.length === 0 ? <p style={{ margin: 0, padding: 12, color: c.muted, fontSize: 13 }}>No teachers found.</p>
              : teachers.map(t => (
                <label key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer', borderBottom: `1px solid ${c.border}`, background: picked[t._id] ? 'rgba(190,24,93,0.06)' : 'transparent' }}>
                  <input type="checkbox" checked={!!picked[t._id]} onChange={() => toggle(t)} style={{ width: 16, height: 16 }} />
                  <span style={{ color: c.heading, fontWeight: 600, fontSize: 13.5 }}>{t.name}</span>
                  {t.code && <code style={{ fontSize: 11, color: c.muted, marginLeft: 'auto' }}>{t.code}</code>}
                </label>
              ))}
          </div>
        </div>

        <label>
          <span style={label}>What should they use it for? *</span>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={4} maxLength={1000} placeholder="e.g. Use units 2–3 with Minh (IELTS 6.5 goal) for his Task 2 essays this week."
            style={{ ...inp, width: '100%', resize: 'vertical' }} />
          <span style={{ fontSize: 12, color: c.muted }}>The book is pinned and highlighted at the top of their library until they acknowledge it.</span>
        </label>

        {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={btn(false)}>Cancel</button>
          <button type="submit" disabled={sending} style={{ ...btn(true), opacity: sending ? 0.7 : 1 }}>
            {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Send{ids.length > 1 ? ` to ${ids.length} teachers` : ''}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function SentListDialog({ c, btn, file, onClose, onChanged }) {
  const [list, setList] = useState(null);
  const load = useCallback(() => {
    api.get(`/library/${file._id}/assignments`).then(({ data }) => setList(data.data)).catch(() => setList([]));
  }, [file._id]);
  useEffect(() => { load(); }, [load]);
  const cancel = async (a) => {
    if (!window.confirm(`Stop pinning this book for ${a.teacher.name}?`)) return;
    await api.delete(`/library/assignments/${a._id}`).catch(() => {});
    load(); onChanged();
  };
  return (
    <Dialog title={`Sent: ${file.title}`} c={c} onClose={onClose}>
      {list === null ? <p style={{ color: c.muted }}>Loading…</p> : list.length === 0 ? <p style={{ color: c.muted }}>Not sent to anyone yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(a => (
            <div key={a._id} style={{ padding: 12, borderRadius: 12, border: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: c.heading }}>{a.teacher.name}</strong>
                {a.teacher.code && <code style={{ fontSize: 11, color: c.muted }}>{a.teacher.code}</code>}
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: a.acknowledgedAt ? '#059669' : '#b45309', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {a.acknowledgedAt ? <><CheckCircle2 size={13} /> Acknowledged {fmtDate(a.acknowledgedAt)}</> : <><Clock size={13} /> Waiting</>}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: c.body, whiteSpace: 'pre-wrap' }}>{a.note}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: c.muted }}>
                <span>Sent {fmtDate(a.createdAt)}{a.assignedBy ? ` by ${a.assignedBy}` : ''}</span>
                {!a.acknowledgedAt && <button type="button" onClick={() => cancel(a)} style={{ ...btn(false), padding: '4px 10px', fontSize: 12, color: '#dc2626' }}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  );
}
