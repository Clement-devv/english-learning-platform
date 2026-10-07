// src/pages/super-admin/tabs/LandingEditorFields.jsx
// Editor pieces for center websites (used by LandingPagesTab):
//   ImageField — thumbnail + "Upload" (to our server) or paste a link + remove
//   ListEditor — add / remove / reorder repeated items (programs, FAQ, gallery…)
import { useRef, useState } from 'react';
import { Upload, Trash2, ArrowUp, ArrowDown, Plus, Image as ImageIcon, Loader2 } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

export function ImageField({ label, value, onChange, centerId, s, hint, wide = false }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Image is too large (max 5 MB)'); return; }
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const token = localStorage.getItem('superAdminToken');
      const r = await fetch(`${API}/super-admin/centers/${centerId}/landing-page/upload`, {
        method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) throw new Error(d.message || 'Upload failed');
      onChange(d.data.url);
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div style={{ ...s.field, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={s.label}>{label}</label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 92, height: 66, borderRadius: 10, border: `1px solid ${s._bdr}`, overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'rgba(148,163,184,0.12)' }}>
          {value
            ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <ImageIcon size={20} color="#94a3b8" />}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={s.smallBtn}>
              {busy ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} {busy ? 'Uploading…' : value ? 'Replace' : 'Upload image'}
            </button>
            {value && (
              <button type="button" onClick={() => onChange('')} style={{ ...s.smallBtn, color: '#f87171' }}>
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
          <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="…or paste an image link (https://…)" style={{ ...s.input, fontSize: 12.5, padding: '7px 10px' }} />
          {(error || hint) && <span style={{ fontSize: 11.5, color: error ? '#f87171' : s._muted }}>{error || hint}</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => upload(e.target.files?.[0])} />
      </div>
    </div>
  );
}

/**
 * @param items     array
 * @param onChange  (newArray) => void
 * @param newItem   () => item
 * @param render    (item, update(patch|value), index) => JSX
 */
export function ListEditor({ items = [], onChange, newItem, render, itemLabel = 'Item', addLabel = 'Add', max = 12, s, summary }) {
  const list = Array.isArray(items) ? items : [];
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const update = (i) => (patch) => {
    const next = [...list];
    next[i] = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? { ...(list[i] || {}), ...patch } : patch;
    onChange(next);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((item, i) => (
        <div key={i} style={s.teacherCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: s._txt, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {itemLabel} {i + 1}{summary?.(item) ? <span style={{ fontWeight: 500, color: s._muted }}> · {summary(item)}</span> : null}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ ...s.iconBtn, opacity: i === 0 ? 0.35 : 1 }} aria-label="Move up"><ArrowUp size={13} /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === list.length - 1} style={{ ...s.iconBtn, opacity: i === list.length - 1 ? 0.35 : 1 }} aria-label="Move down"><ArrowDown size={13} /></button>
              <button type="button" onClick={() => onChange(list.filter((_, k) => k !== i))} style={s.removeBtn}><Trash2 size={13} /> Remove</button>
            </div>
          </div>
          {render(item, update(i), i)}
        </div>
      ))}
      {list.length < max
        ? <button type="button" onClick={() => onChange([...list, newItem()])} style={s.addTeacherBtn}><Plus size={14} /> {addLabel}</button>
        : <span style={{ fontSize: 12, color: s._muted }}>Maximum of {max} reached.</span>}
    </div>
  );
}
