// src/pages/admin/tabs/CertificateTemplateSettingsTab.jsx
// Admin configures their own center's certificate template: colors, milestones, signature, footer.
import React, { useState, useEffect } from 'react';
import { Award, Plus, Trash2, Loader2, RefreshCw, Save } from 'lucide-react';
import api from '../../../api';

const F = "'Nunito','Inter',sans-serif";

const DEFAULT_MILESTONES = [
  { count: 10,  title: 'English Starter Certificate',     description: 'Awarded for completing 10 classes.' },
  { count: 25,  title: 'English Foundation Certificate',  description: 'Awarded for completing 25 classes.' },
  { count: 50,  title: 'English Proficiency Certificate', description: 'Awarded for completing 50 classes.' },
  { count: 100, title: 'English Excellence Certificate',  description: 'Awarded for completing 100 classes.' },
];

export default function CertificateTemplateSettingsTab({ isDarkMode }) {
  const col = {
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    body:    isDarkMode ? '#c8cce0' : '#5a4a3a',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
    input:   isDarkMode ? '#0f1117' : '#fff8f0',
    bg:      isDarkMode ? '#13111a' : '#fff8f0',
  };

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [isError,  setIsError]  = useState(false);

  const [form, setForm] = useState({
    organizationName: '',
    primaryColor:     '#f97316',
    secondaryColor:   '#1e293b',
    accentColor:      '#f43f5e',
    signatureName:    '',
    signatureTitle:   'Director of Studies',
    footerText:       '',
    completionMilestones: DEFAULT_MILESTONES,
  });

  const flash = (m, err = false) => {
    setMsg(m); setIsError(err);
    setTimeout(() => setMsg(''), 4000);
  };

  // Load current center config
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/center/config');
        const tpl = res.data?.center?.certificateTemplate || res.data?.certificateTemplate;
        if (tpl) {
          setForm({
            organizationName: tpl.organizationName || '',
            primaryColor:     tpl.primaryColor     || '#f97316',
            secondaryColor:   tpl.secondaryColor   || '#1e293b',
            accentColor:      tpl.accentColor      || '#f43f5e',
            signatureName:    tpl.signatureName    || '',
            signatureTitle:   tpl.signatureTitle   || 'Director of Studies',
            footerText:       tpl.footerText       || '',
            completionMilestones: tpl.completionMilestones?.length
              ? tpl.completionMilestones
              : DEFAULT_MILESTONES,
          });
        }
      } catch {
        flash('Failed to load certificate template', true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/center/certificate-template', { certificateTemplate: form });
      flash('Certificate template saved');
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to save', true);
    } finally {
      setSaving(false);
    }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const updateMilestone = (i, k, v) => {
    const ms = [...form.completionMilestones];
    ms[i] = { ...ms[i], [k]: k === 'count' ? (parseInt(v) || 0) : v };
    setField('completionMilestones', ms);
  };
  const addMilestone    = () => setField('completionMilestones', [...form.completionMilestones, { count: 0, title: '', description: '' }]);
  const removeMilestone = (i) => setField('completionMilestones', form.completionMilestones.filter((_, idx) => idx !== i));

  const inp = {
    width: '100%', background: col.input, border: `1.5px solid ${col.border}`,
    borderRadius: 12, padding: '9px 12px', fontSize: 14, color: col.body,
    fontFamily: F, outline: 'none',
  };

  const section = (title, children) => (
    <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
      <h3 style={{ margin: '0 0 18px', fontSize: 15, fontWeight: 900, color: col.heading }}>{title}</h3>
      {children}
    </div>
  );

  const field = (label, content) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
        {label}
      </label>
      {content}
    </div>
  );

  const colorField = (label, key) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="color" value={form[key]} onChange={e => setField(key, e.target.value)}
          style={{ width: 44, height: 38, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'none', padding: 2 }} />
        <input value={form[key]} onChange={e => setField(key, e.target.value)}
          style={{ ...inp, width: 140 }} placeholder="#f97316" />
        <div style={{ width: 38, height: 38, borderRadius: 10, background: form[key], border: `2px solid ${col.border}`, flexShrink: 0 }} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Loader2 size={32} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: F, maxWidth: 760 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg,#f97316,#f43f5e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Award size={24} color="#fff" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>Certificate Template</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>Customize certificates issued to your students</p>
        </div>
      </div>

      {msg && (
        <div style={{ background: isError ? '#fef2f2' : '#f0fdf4', border: `1.5px solid ${isError ? '#fecaca' : '#bbf7d0'}`, borderRadius: 12, padding: '10px 16px', marginBottom: 20, fontSize: 14, fontWeight: 700, color: isError ? '#dc2626' : '#16a34a' }}>
          {msg}
        </div>
      )}

      {/* Organization */}
      {section('Organization', <>
        {field('Organization Name (appears on certificate)',
          <input value={form.organizationName} onChange={e => setField('organizationName', e.target.value)}
            style={inp} placeholder="e.g. Sunshine English Academy" />
        )}
      </>)}

      {/* Colors */}
      {section('Certificate Colors', <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 0 }}>
          {colorField('Primary Color (border & header)', 'primaryColor')}
          {colorField('Secondary Color (text & footer)', 'secondaryColor')}
          {colorField('Accent Color (decorative)', 'accentColor')}
        </div>

        {/* Live preview swatch */}
        <div style={{ marginTop: 8, borderRadius: 16, overflow: 'hidden', border: `2px solid ${col.border}` }}>
          <div style={{ background: form.primaryColor, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>Certificate Preview</span>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: form.accentColor, border: '2px solid rgba(255,255,255,0.5)' }} />
          </div>
          <div style={{ background: '#fff', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: form.secondaryColor, fontWeight: 700 }}>This is to certify that</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: form.primaryColor, margin: '6px 0' }}>Student Name</div>
            <div style={{ fontSize: 12, color: form.secondaryColor }}>{form.organizationName || 'Your Center Name'}</div>
          </div>
        </div>
      </>)}

      {/* Signature */}
      {section('Signature', <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Signatory Name',
            <input value={form.signatureName} onChange={e => setField('signatureName', e.target.value)}
              style={inp} placeholder="e.g. Jane Smith" />
          )}
          {field('Signatory Title',
            <input value={form.signatureTitle} onChange={e => setField('signatureTitle', e.target.value)}
              style={inp} placeholder="e.g. Director of Studies" />
          )}
        </div>
        {field('Footer Text',
          <input value={form.footerText} onChange={e => setField('footerText', e.target.value)}
            style={inp} placeholder="e.g. Accredited by the British Council" />
        )}
      </>)}

      {/* Milestones */}
      <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: col.heading }}>Completion Milestones</h3>
          <button onClick={addMilestone}
            style={{ background: 'linear-gradient(135deg,#f97316,#f43f5e)', color: '#fff', border: 'none', borderRadius: 12, padding: '7px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={14} /> Add Milestone
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: col.muted }}>
          Certificates are automatically issued when students reach these class counts.
        </p>

        {form.completionMilestones.map((m, i) => (
          <div key={i} style={{ background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff8f0', border: `1.5px solid ${col.border}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 70, flexShrink: 0 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: col.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Classes</label>
                <input type="number" value={m.count} min={1}
                  onChange={e => updateMilestone(i, 'count', e.target.value)}
                  style={{ ...inp, textAlign: 'center', fontWeight: 900, fontSize: 16 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: col.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Certificate Title *</label>
                <input value={m.title} onChange={e => updateMilestone(i, 'title', e.target.value)}
                  style={inp} placeholder="e.g. English Starter Certificate" />
              </div>
              <button onClick={() => removeMilestone(i)}
                style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 10, padding: '6px 8px', cursor: 'pointer', marginTop: 20, flexShrink: 0 }}>
                <Trash2 size={14} color="#ef4444" />
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: col.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Description (optional)</label>
              <input value={m.description} onChange={e => updateMilestone(i, 'description', e.target.value)}
                style={inp} placeholder="e.g. Awarded for completing 10 classes." />
            </div>
          </div>
        ))}

        {form.completionMilestones.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: col.muted, fontSize: 13, fontWeight: 600 }}>
            No milestones set. Certificates will only be awarded manually.
          </div>
        )}
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button onClick={handleSave} disabled={saving}
          style={{ background: saving ? (isDarkMode ? '#2a2d40' : '#f5f0ec') : 'linear-gradient(135deg,#f97316,#f43f5e)', color: saving ? col.muted : '#fff', border: 'none', borderRadius: 14, padding: '10px 24px', fontSize: 14, fontWeight: 900, cursor: saving ? 'default' : 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 7 }}>
          {saving ? <><Loader2 size={15} style={{ animation: 'spin .7s linear infinite' }} /> Saving…</> : <><Save size={15} /> Save Template</>}
        </button>
      </div>
    </div>
  );
}
