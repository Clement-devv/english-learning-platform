// src/pages/super-admin/tabs/CertificateTemplatesTab.jsx
// Super admin: configure certificate template per center (colors, milestones, signature).
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const F = "'Inter','system-ui',sans-serif";
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const DEFAULT_TEMPLATE = {
  organizationName: '',
  primaryColor:  '#f97316',
  secondaryColor:'#1e293b',
  accentColor:   '#f43f5e',
  signatureName: '',
  signatureTitle:'Director of Studies',
  footerText:    '',
  completionMilestones: [
    { count: 10,  title: 'English Starter Certificate',     description: 'Successfully completed 10 English lessons' },
    { count: 25,  title: 'English Foundation Certificate',  description: 'Successfully completed 25 English lessons' },
    { count: 50,  title: 'English Proficiency Certificate', description: 'Successfully completed 50 English lessons' },
    { count: 100, title: 'English Excellence Certificate',  description: 'Successfully completed 100 English lessons' },
  ],
};

function authHeaders() {
  const token = localStorage.getItem('superAdminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CertificateTemplatesTab({ centers }) {
  const [expanded,  setExpanded]  = useState({});
  const [templates, setTemplates] = useState({});  // centerId → template
  const [saving,    setSaving]    = useState({});
  const [msg,       setMsg]       = useState({});   // centerId → message
  const [search,    setSearch]    = useState('');

  // Pre-populate templates from center data
  useEffect(() => {
    const map = {};
    (centers || []).forEach(c => {
      map[c._id] = c.certificateTemplate
        ? { ...DEFAULT_TEMPLATE, ...c.certificateTemplate,
            completionMilestones: c.certificateTemplate.completionMilestones?.length
              ? c.certificateTemplate.completionMilestones
              : DEFAULT_TEMPLATE.completionMilestones }
        : { ...DEFAULT_TEMPLATE };
    });
    setTemplates(map);
  }, [centers]);

  const flash = (centerId, m, ok = true) => {
    setMsg(p => ({ ...p, [centerId]: { text: m, ok } }));
    setTimeout(() => setMsg(p => { const n = { ...p }; delete n[centerId]; return n; }), 4000);
  };

  const handleSave = async (center) => {
    const tpl = templates[center._id];
    if (!tpl) return;
    setSaving(p => ({ ...p, [center._id]: true }));
    try {
      const res = await fetch(`${API}/super-admin/centers/${center._id}/certificate-template`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({ certificateTemplate: tpl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');
      flash(center._id, '✅ Template saved');
    } catch (e) {
      flash(center._id, e.message, false);
    } finally {
      setSaving(p => ({ ...p, [center._id]: false }));
    }
  };

  const setField = (centerId, field, value) =>
    setTemplates(p => ({ ...p, [centerId]: { ...p[centerId], [field]: value } }));

  const setMilestone = (centerId, idx, field, value) =>
    setTemplates(p => {
      const ms = [...(p[centerId]?.completionMilestones || [])];
      ms[idx] = { ...ms[idx], [field]: field === 'count' ? +value : value };
      return { ...p, [centerId]: { ...p[centerId], completionMilestones: ms } };
    });

  const addMilestone = (centerId) =>
    setTemplates(p => ({
      ...p,
      [centerId]: {
        ...p[centerId],
        completionMilestones: [
          ...(p[centerId]?.completionMilestones || []),
          { count: 0, title: 'New Certificate', description: '' },
        ],
      },
    }));

  const removeMilestone = (centerId, idx) =>
    setTemplates(p => {
      const ms = [...(p[centerId]?.completionMilestones || [])];
      ms.splice(idx, 1);
      return { ...p, [centerId]: { ...p[centerId], completionMilestones: ms } };
    });

  const s = {
    card:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 10, overflow: 'hidden', fontFamily: F },
    label: { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 },
    inp:   { width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#1e293b', outline: 'none', fontFamily: F, boxSizing: 'border-box' },
    btn:   (bg, c='#fff') => ({ background: bg, color: c, border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 5 }),
  };

  const filtered = (centers || []).filter(c =>
    c.status === 'active' &&
    c.centerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ fontFamily: F }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Certificate Templates</h3>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
            Configure certificate design and milestone thresholds per center. Changes apply immediately.
          </p>
        </div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search centers..."
          style={{ ...s.inp, width: 200 }}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
          No active centers found
        </div>
      )}

      {filtered.map(center => {
        const tpl    = templates[center._id] || DEFAULT_TEMPLATE;
        const isOpen = expanded[center._id];
        const isSaving = saving[center._id];
        const centerMsg = msg[center._id];

        return (
          <div key={center._id} style={s.card}>
            {/* Header row */}
            <div
              style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: 12 }}
              onClick={() => setExpanded(p => ({ ...p, [center._id]: !p[center._id] }))}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: tpl.primaryColor || '#f97316', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{center.centerName}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {(tpl.completionMilestones || []).length} milestones · {tpl.organizationName || center.centerName}
                </div>
              </div>
              {centerMsg && (
                <span style={{ fontSize: 12, fontWeight: 700, color: centerMsg.ok ? '#16a34a' : '#dc2626' }}>
                  {centerMsg.text}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); handleSave(center); }}
                disabled={isSaving}
                style={s.btn('#0ea5e9')}
              >
                {isSaving ? <Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> : <Save size={13} />}
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              {isOpen ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
            </div>

            {/* Expanded editor */}
            {isOpen && (
              <div style={{ padding: '0 18px 18px', borderTop: '1px solid #f1f5f9' }}>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

                {/* Branding row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 16, marginBottom: 16 }}>
                  <div>
                    <label style={s.label}>Primary Color</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="color" value={tpl.primaryColor} onChange={e => setField(center._id, 'primaryColor', e.target.value)}
                        style={{ width: 36, height: 32, padding: 2, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }} />
                      <input value={tpl.primaryColor} onChange={e => setField(center._id, 'primaryColor', e.target.value)} style={{ ...s.inp, flex: 1 }} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Secondary Color</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="color" value={tpl.secondaryColor} onChange={e => setField(center._id, 'secondaryColor', e.target.value)}
                        style={{ width: 36, height: 32, padding: 2, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }} />
                      <input value={tpl.secondaryColor} onChange={e => setField(center._id, 'secondaryColor', e.target.value)} style={{ ...s.inp, flex: 1 }} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Accent Color</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="color" value={tpl.accentColor} onChange={e => setField(center._id, 'accentColor', e.target.value)}
                        style={{ width: 36, height: 32, padding: 2, border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }} />
                      <input value={tpl.accentColor} onChange={e => setField(center._id, 'accentColor', e.target.value)} style={{ ...s.inp, flex: 1 }} />
                    </div>
                  </div>
                  <div>
                    <label style={s.label}>Organization Name</label>
                    <input value={tpl.organizationName} onChange={e => setField(center._id, 'organizationName', e.target.value)}
                      placeholder={center.centerName} style={s.inp} />
                  </div>
                </div>

                {/* Signature row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={s.label}>Signature Name</label>
                    <input value={tpl.signatureName} onChange={e => setField(center._id, 'signatureName', e.target.value)}
                      placeholder="e.g. Ms. Linh Nguyen" style={s.inp} />
                  </div>
                  <div>
                    <label style={s.label}>Signature Title</label>
                    <input value={tpl.signatureTitle} onChange={e => setField(center._id, 'signatureTitle', e.target.value)}
                      placeholder="Director of Studies" style={s.inp} />
                  </div>
                  <div>
                    <label style={s.label}>Footer Text</label>
                    <input value={tpl.footerText} onChange={e => setField(center._id, 'footerText', e.target.value)}
                      placeholder="This certificate is issued digitally…" style={s.inp} />
                  </div>
                </div>

                {/* Milestones */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#374151' }}>Completion Milestones</span>
                  <button onClick={() => addMilestone(center._id)} style={s.btn('#10b981')}>
                    <Plus size={13} /> Add Milestone
                  </button>
                </div>
                {(tpl.completionMilestones || []).map((ms, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 2fr 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <div>
                      <label style={{ ...s.label, display: idx === 0 ? 'block' : 'none' }}>Classes</label>
                      <input type="number" min={1} value={ms.count}
                        onChange={e => setMilestone(center._id, idx, 'count', e.target.value)} style={s.inp} />
                    </div>
                    <div>
                      <label style={{ ...s.label, display: idx === 0 ? 'block' : 'none' }}>Certificate Title</label>
                      <input value={ms.title}
                        onChange={e => setMilestone(center._id, idx, 'title', e.target.value)} style={s.inp} />
                    </div>
                    <div>
                      <label style={{ ...s.label, display: idx === 0 ? 'block' : 'none' }}>Description</label>
                      <input value={ms.description || ''}
                        onChange={e => setMilestone(center._id, idx, 'description', e.target.value)} style={s.inp} />
                    </div>
                    <button onClick={() => removeMilestone(center._id, idx)}
                      style={{ background: '#fef2f2', border: 'none', borderRadius: 8, padding: '7px 8px', cursor: 'pointer', marginTop: idx === 0 ? 16 : 0 }}>
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
