// src/pages/super-admin/CommandPalette.jsx
// Ctrl/⌘ K anywhere in the super admin: type a center's name, slug or admin email and
// press Enter to open its Manage panel; also jumps to any page and runs common actions.
// Keyboard: ↑ ↓ to move, Enter to open, Esc to close.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Building2 } from 'lucide-react';

const STATUS = { active: '#16a34a', pending: '#d97706', suspended: '#dc2626', rejected: '#64748b' };
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export default function CommandPalette({ open, onClose, centers, pages, actions, onPage, onCenter }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setQ(''); setSel(0); requestAnimationFrame(() => inputRef.current?.focus()); } }, [open]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const match = (...v) => !t || v.some((x) => String(x || '').toLowerCase().includes(t));
    const cs = centers
      .filter((c) => match(c.centerName, c.slug, c.adminEmail, c.customDomain))
      .slice(0, t ? 8 : 5)
      .map((c) => ({ kind: 'center', id: `c-${c._id}`, c }));
    const ps = pages.filter((p) => match(p.label, p.group)).slice(0, t ? 6 : 4).map((p) => ({ kind: 'page', id: `p-${p.key}`, p }));
    const as = actions.filter((a) => match(a.label)).map((a) => ({ kind: 'action', id: `a-${a.key}`, a }));
    return [
      cs.length && { title: t ? 'Centers' : 'Recent centers', items: cs },
      as.length && { title: 'Actions', items: as },
      ps.length && { title: 'Go to', items: ps },
    ].filter(Boolean);
  }, [q, centers, pages, actions]);
  const flat = results.flatMap((g) => g.items);

  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  if (!open) return null;

  const run = (item) => {
    if (!item) return;
    onClose();
    if (item.kind === 'center') onCenter(item.c);
    else if (item.kind === 'page') onPage(item.p.key);
    else item.a.run();
  };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let i = -1;
  return (
    <div className="sa2-cmd-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sa2-cmd" role="dialog" aria-modal="true" aria-label="Search">
        <div className="sa2-cmd-input">
          <Search size={18} color="var(--sa-muted)" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search centers, pages and actions…" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="sa2-cmd-list"
            aria-activedescendant={flat[sel]?.id} autoComplete="off" spellCheck={false} />
          <kbd className="sa2-kbd">Esc</kbd>
        </div>
        <div className="sa2-cmd-list" id="sa2-cmd-list" role="listbox" ref={listRef}>
          {flat.length === 0 && <div className="sa2-cmd-empty">No results for “{q}”</div>}
          {results.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <div className="sa2-cmd-group">{g.title}</div>
              {g.items.map((item) => {
                i += 1;
                const idx = i;
                const props = { id: item.id, role: 'option', 'aria-selected': sel === idx, className: 'sa2-cmd-item',
                  onMouseMove: () => sel !== idx && setSel(idx), onClick: () => run(item) };
                if (item.kind === 'center') {
                  const c = item.c;
                  return (
                    <button type="button" key={item.id} {...props}>
                      <span className="sa2-cmd-mark">{initials(c.centerName)}</span>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.centerName}</span>
                        <small>{c.slug}{c.adminEmail ? ` · ${c.adminEmail}` : ''}</small>
                      </span>
                      <span className="sa2-cmd-meta">
                        <span className="sa2-pill" style={{ '--c': STATUS[c.status] || '#64748b' }}>{c.status}</span>
                      </span>
                    </button>
                  );
                }
                const { icon: Icon = Building2, label, hint } = item.kind === 'page' ? item.p : item.a;
                return (
                  <button type="button" key={item.id} {...props}>
                    <Icon size={16} />
                    <span>{label}</span>
                    {hint && <span className="sa2-cmd-meta"><small>{hint}</small></span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sa2-cmd-foot">
          <span><ArrowUp size={12} /><ArrowDown size={12} /> move</span>
          <span><CornerDownLeft size={12} /> open</span>
          <span>Centers open their Manage panel</span>
        </div>
      </div>
    </div>
  );
}
