// src/pages/super-admin/tabs/LandingPagesTab.jsx
// Super admin: build & manage the public landing page for each center.
import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, ChevronDown, ChevronUp, Save, Eye, EyeOff,
  Plus, Trash2, Loader2, Monitor, Smartphone, X,
} from 'lucide-react';
import ClassicTemplate from '../../landing-page/templates/ClassicTemplate';
import ModernTemplate  from '../../landing-page/templates/ModernTemplate';
import MinimalTemplate from '../../landing-page/templates/MinimalTemplate';
import { GoogleFont }  from '../../landing-page/utils.jsx';

const PREVIEW_TEMPLATES = { classic: ClassicTemplate, modern: ModernTemplate, minimal: MinimalTemplate };

const API  = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const FONT = "'Inter','system-ui',sans-serif";

const FONT_OPTIONS  = ['Inter', 'Nunito', 'Poppins', 'Roboto', 'Lato'];

const TEMPLATE_DEFS = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Full-viewport gradient hero, centered layout, card grid',
    thumb: ClassicThumb,
  },
  {
    id: 'modern',
    name: 'Modern',
    desc: 'Split dark/color hero, CTA band, multi-column footer',
    thumb: ModernThumb,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'White hero, generous whitespace, teacher list rows',
    thumb: MinimalThumb,
  },
];

const HERO_STYLES   = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'solid',    label: 'Solid color' },
  { value: 'image',    label: 'Background image' },
];
const NAV_STYLES = [
  { value: 'light',   label: 'Light (white)' },
  { value: 'dark',    label: 'Dark (black)' },
  { value: 'colored', label: 'Colored (primary)' },
];

const DEFAULT_LP = {
  published: false,
  template: 'classic',
  design: {
    primaryColor: '#4F46E5', secondaryColor: '#E0E7FF', accentColor: '#f59e0b',
    bgColor: '#ffffff', textColor: '#1e293b', mutedColor: '#64748b',
    fontFamily: 'Inter', heroStyle: 'gradient', heroImage: '', navStyle: 'light',
  },
  hero: {
    headline: '', subheadline: '',
    ctaText: 'Start Learning', ctaUrl: '/student/login',
    secondaryCtaText: '', secondaryCtaUrl: '',
  },
  about: { enabled: true, title: 'About Us', body: '', image: '' },
  teachers: [],
  links: { studentLogin: '', teacherLogin: '', facebook: '', instagram: '', youtube: '', whatsapp: '' },
  contact: { enabled: false, email: '', phone: '', address: '' },
  seo: { title: '', description: '' },
};

function authHeaders() {
  const token = localStorage.getItem('superAdminToken');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export default function LandingPagesTab({ centers, darkMode, focusCenterId }) {
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState({});  // centerId → true/false
  const [lps,      setLps]      = useState({});  // centerId → landingPage object
  const [saving,   setSaving]   = useState({});  // centerId → bool
  const [toggling, setToggling] = useState({});  // centerId → bool
  const [msg,      setMsg]      = useState({});  // centerId → { text, ok }
  const [section,  setSection]  = useState({});  // centerId → section key
  const [preview,  setPreview]  = useState(null); // { center, lp } or null
  const cardRefs = useRef({});  // centerId → DOM ref

  // Auto-expand and scroll when focusCenterId changes
  useEffect(() => {
    if (!focusCenterId || !centers?.length) return;
    const center = centers.find(c => c._id === focusCenterId);
    if (!center) return;
    // Clear search so center is visible
    setSearch('');
    // Expand the center (load its data)
    toggleExpand(center);
    // Scroll after a short delay to allow render
    setTimeout(() => {
      const el = cardRefs.current[focusCenterId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCenterId]);

  const isDark = !!darkMode;
  const bg     = isDark ? '#0f172a' : '#f8fafc';
  const card   = isDark ? '#1e293b' : '#ffffff';
  const bdr    = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const txt    = isDark ? '#f1f5f9' : '#0f172a';
  const muted  = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc';
  const inputBdr = isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1';

  const filtered = (centers || []).filter(c =>
    !search || c.centerName.toLowerCase().includes(search.toLowerCase()) || c.slug.includes(search.toLowerCase())
  );

  const flash = (cid, text, ok = true) => {
    setMsg(p => ({ ...p, [cid]: { text, ok } }));
    setTimeout(() => setMsg(p => { const n = { ...p }; delete n[cid]; return n; }), 4000);
  };

  const toggleExpand = async (center) => {
    const cid = center._id;
    if (expanded[cid]) { setExpanded(p => ({ ...p, [cid]: false })); return; }
    setExpanded(p => ({ ...p, [cid]: true }));
    if (!lps[cid]) {
      try {
        const r = await fetch(`${API}/super-admin/centers/${cid}/landing-page`, { headers: authHeaders() });
        const d = await r.json();
        const lp = d.landingPage && Object.keys(d.landingPage).length
          ? mergeDeep({ ...DEFAULT_LP }, d.landingPage)
          : { ...DEFAULT_LP, design: { ...DEFAULT_LP.design, primaryColor: center.branding?.primaryColor || '#4F46E5' } };
        setLps(p => ({ ...p, [cid]: lp }));
        setSection(p => ({ ...p, [cid]: 'design' }));
      } catch {
        flash(cid, 'Failed to load landing page data', false);
      }
    }
  };

  const setField = (cid, path, value) => {
    setLps(p => {
      const lp = deepClone(p[cid] || DEFAULT_LP);
      setNestedValue(lp, path, value);
      return { ...p, [cid]: lp };
    });
  };

  const handleSave = async (center) => {
    const cid = center._id;
    const lp  = lps[cid];
    if (!lp) return;
    setSaving(p => ({ ...p, [cid]: true }));
    try {
      const r = await fetch(`${API}/super-admin/centers/${cid}/landing-page`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ landingPage: lp }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message);
      setLps(p => ({ ...p, [cid]: mergeDeep({ ...DEFAULT_LP }, d.landingPage) }));
      flash(cid, '✅ Landing page saved');
    } catch (e) {
      flash(cid, e.message || 'Save failed', false);
    } finally {
      setSaving(p => ({ ...p, [cid]: false }));
    }
  };

  const handleTogglePublish = async (center) => {
    const cid   = center._id;
    const lp    = lps[cid];
    if (!lp) return;
    const next  = !lp.published;
    setToggling(p => ({ ...p, [cid]: true }));
    try {
      const r = await fetch(`${API}/super-admin/centers/${cid}/landing-page/publish`, {
        method: 'PATCH', headers: authHeaders(),
        body: JSON.stringify({ published: next }),
      });
      const d = await r.json();
      if (!d.success) throw new Error(d.message);
      setLps(p => ({ ...p, [cid]: { ...(p[cid] || DEFAULT_LP), published: next } }));
      flash(cid, next ? '🌐 Landing page is now live!' : '⬇️ Landing page unpublished');
    } catch (e) {
      flash(cid, e.message || 'Toggle failed', false);
    } finally {
      setToggling(p => ({ ...p, [cid]: false }));
    }
  };

  const handlePreview = (center) => {
    const lp = lps[center._id];
    if (!lp) return;
    // Build a safe center object matching the shape publicRoutes.js returns
    const previewCenter = {
      centerName:  center.centerName,
      slug:        center.slug,
      logo:        center.branding?.logo || null,
      favicon:     center.branding?.favicon || null,
      description: center.description || '',
      country:     center.country || '',
      phone:       center.phone || '',
      website:     center.website || '',
    };
    setPreview({ center: previewCenter, lp });
  };

  const addTeacher = (cid) => {
    setLps(p => {
      const lp = deepClone(p[cid] || DEFAULT_LP);
      lp.teachers = [...(lp.teachers || []), { name: '', photo: '', title: '', bio: '', order: (lp.teachers?.length || 0) }];
      return { ...p, [cid]: lp };
    });
  };

  const removeTeacher = (cid, idx) => {
    setLps(p => {
      const lp = deepClone(p[cid] || DEFAULT_LP);
      lp.teachers = lp.teachers.filter((_, i) => i !== idx);
      return { ...p, [cid]: lp };
    });
  };

  const setTeacherField = (cid, idx, field, value) => {
    setLps(p => {
      const lp = deepClone(p[cid] || DEFAULT_LP);
      lp.teachers[idx] = { ...(lp.teachers[idx] || {}), [field]: value };
      return { ...p, [cid]: lp };
    });
  };

  const s = styles(isDark, card, bdr, txt, muted, inputBg, inputBdr);

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search centers..."
          style={s.searchInput}
        />
      </div>

      {filtered.length === 0 && (
        <p style={{ color: muted, fontSize: 14, textAlign: 'center', padding: '40px 0' }}>No centers found.</p>
      )}

      {filtered.map(center => {
        const cid = center._id;
        const lp  = lps[cid];
        const isOpen    = !!expanded[cid];
        const isSaving  = !!saving[cid];
        const isToggling = !!toggling[cid];
        const flash_msg = msg[cid];
        const published = lp?.published || false;
        const sec = section[cid] || 'design';

        return (
          <div key={cid} ref={el => { cardRefs.current[cid] = el; }} style={s.centerCard}>
            {/* Header row */}
            <div style={s.centerHeader} onClick={() => toggleExpand(center)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...s.statusDot, background: published ? '#10b981' : muted }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: txt }}>{center.centerName}</span>
                <span style={{ fontSize: 12, color: muted }}>/{center.slug}</span>
                {published && (
                  <span style={s.liveBadge}>LIVE</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {flash_msg && (
                  <span style={{ fontSize: 12, color: flash_msg.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {flash_msg.text}
                  </span>
                )}
                {isOpen ? <ChevronUp size={16} color={muted} /> : <ChevronDown size={16} color={muted} />}
              </div>
            </div>

            {/* Editor body */}
            {isOpen && lp && (
              <div style={{ padding: '20px 24px', borderTop: `1px solid ${bdr}` }}>

                {/* Action bar */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                  <button onClick={() => handleSave(center)} disabled={isSaving} style={s.saveBtn}>
                    {isSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => handleTogglePublish(center)} disabled={isToggling} style={published ? s.unpublishBtn : s.publishBtn}>
                    {isToggling ? <Loader2 size={14} /> : (published ? <EyeOff size={14} /> : <Globe size={14} />)}
                    {published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => handlePreview(center)} style={s.previewBtn}>
                    <Eye size={14} /> Preview
                  </button>
                </div>

                {/* ── Template picker ── */}
                <TemplatePicker
                  selected={lp.template || 'classic'}
                  onChange={v => setField(cid, 'template', v)}
                  s={s} isDark={isDark} txt={txt} muted={muted} bdr={bdr}
                />

                {/* Section tabs */}
                <div style={s.sectionTabs}>
                  {['design','hero','about','teachers','links','contact','seo'].map(k => (
                    <button key={k} onClick={() => setSection(p => ({ ...p, [cid]: k }))} style={{ ...s.sectionTab, ...(sec === k ? s.sectionTabActive : {}) }}>
                      {k.charAt(0).toUpperCase() + k.slice(1)}
                    </button>
                  ))}
                </div>

                {/* ── DESIGN ── */}
                {sec === 'design' && (
                  <div style={s.grid2}>
                    <ColorField label="Primary Color" value={lp.design?.primaryColor} onChange={v => setField(cid,'design.primaryColor',v)} s={s} />
                    <ColorField label="Secondary Color" value={lp.design?.secondaryColor} onChange={v => setField(cid,'design.secondaryColor',v)} s={s} />
                    <ColorField label="Accent / CTA Color" value={lp.design?.accentColor} onChange={v => setField(cid,'design.accentColor',v)} s={s} />
                    <ColorField label="Background Color" value={lp.design?.bgColor} onChange={v => setField(cid,'design.bgColor',v)} s={s} />
                    <ColorField label="Text Color" value={lp.design?.textColor} onChange={v => setField(cid,'design.textColor',v)} s={s} />
                    <ColorField label="Muted Text Color" value={lp.design?.mutedColor} onChange={v => setField(cid,'design.mutedColor',v)} s={s} />
                    <SelectField label="Font Family" value={lp.design?.fontFamily} options={FONT_OPTIONS.map(f => ({ value: f, label: f }))} onChange={v => setField(cid,'design.fontFamily',v)} s={s} />
                    <SelectField label="Hero Style" value={lp.design?.heroStyle} options={HERO_STYLES} onChange={v => setField(cid,'design.heroStyle',v)} s={s} />
                    <SelectField label="Nav Style" value={lp.design?.navStyle} options={NAV_STYLES} onChange={v => setField(cid,'design.navStyle',v)} s={s} />
                    {lp.design?.heroStyle === 'image' && (
                      <TextField label="Hero Background Image URL" value={lp.design?.heroImage} onChange={v => setField(cid,'design.heroImage',v)} s={s} />
                    )}
                  </div>
                )}

                {/* ── HERO ── */}
                {sec === 'hero' && (
                  <div style={s.stack}>
                    <TextField label="Headline" value={lp.hero?.headline} onChange={v => setField(cid,'hero.headline',v)} placeholder="Master English with Expert Teachers" s={s} />
                    <TextareaField label="Sub-headline" value={lp.hero?.subheadline} onChange={v => setField(cid,'hero.subheadline',v)} placeholder="Join hundreds of students improving their English skills" rows={3} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Primary CTA Text" value={lp.hero?.ctaText} onChange={v => setField(cid,'hero.ctaText',v)} s={s} />
                      <TextField label="Primary CTA URL" value={lp.hero?.ctaUrl} onChange={v => setField(cid,'hero.ctaUrl',v)} placeholder="/student/login" s={s} />
                      <TextField label="Secondary CTA Text (optional)" value={lp.hero?.secondaryCtaText} onChange={v => setField(cid,'hero.secondaryCtaText',v)} s={s} />
                      <TextField label="Secondary CTA URL" value={lp.hero?.secondaryCtaUrl} onChange={v => setField(cid,'hero.secondaryCtaUrl',v)} s={s} />
                    </div>
                  </div>
                )}

                {/* ── ABOUT ── */}
                {sec === 'about' && (
                  <div style={s.stack}>
                    <ToggleField label="Show About Section" value={lp.about?.enabled} onChange={v => setField(cid,'about.enabled',v)} s={s} />
                    <TextField label="Section Title" value={lp.about?.title} onChange={v => setField(cid,'about.title',v)} s={s} />
                    <TextareaField label="Body Text" value={lp.about?.body} onChange={v => setField(cid,'about.body',v)} rows={6} placeholder="Tell prospective students about your center, teaching method, and what makes you unique." s={s} />
                    <TextField label="Image URL (optional)" value={lp.about?.image} onChange={v => setField(cid,'about.image',v)} placeholder="https://..." s={s} />
                  </div>
                )}

                {/* ── TEACHERS ── */}
                {sec === 'teachers' && (
                  <div style={s.stack}>
                    {(lp.teachers || []).map((t, idx) => (
                      <div key={idx} style={s.teacherCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: txt }}>Teacher {idx + 1}</span>
                          <button onClick={() => removeTeacher(cid, idx)} style={s.removeBtn}>
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                        <div style={s.grid2}>
                          <TextField label="Name" value={t.name} onChange={v => setTeacherField(cid,idx,'name',v)} s={s} />
                          <TextField label="Title / Role" value={t.title} onChange={v => setTeacherField(cid,idx,'title',v)} placeholder="e.g. IELTS Specialist" s={s} />
                          <TextField label="Photo URL" value={t.photo} onChange={v => setTeacherField(cid,idx,'photo',v)} placeholder="https://..." s={s} />
                        </div>
                        <TextareaField label="Short Bio" value={t.bio} onChange={v => setTeacherField(cid,idx,'bio',v)} rows={2} s={s} />
                      </div>
                    ))}
                    <button onClick={() => addTeacher(cid)} style={s.addTeacherBtn}>
                      <Plus size={14} /> Add Teacher
                    </button>
                  </div>
                )}

                {/* ── LINKS ── */}
                {sec === 'links' && (
                  <div style={s.grid2}>
                    <TextField label="Student Login URL" value={lp.links?.studentLogin} onChange={v => setField(cid,'links.studentLogin',v)} placeholder="/student/login" s={s} />
                    <TextField label="Teacher Login URL" value={lp.links?.teacherLogin} onChange={v => setField(cid,'links.teacherLogin',v)} placeholder="/teacher/login" s={s} />
                    <TextField label="Facebook URL" value={lp.links?.facebook} onChange={v => setField(cid,'links.facebook',v)} placeholder="https://facebook.com/..." s={s} />
                    <TextField label="Instagram URL" value={lp.links?.instagram} onChange={v => setField(cid,'links.instagram',v)} placeholder="https://instagram.com/..." s={s} />
                    <TextField label="YouTube URL" value={lp.links?.youtube} onChange={v => setField(cid,'links.youtube',v)} placeholder="https://youtube.com/..." s={s} />
                    <TextField label="WhatsApp Link" value={lp.links?.whatsapp} onChange={v => setField(cid,'links.whatsapp',v)} placeholder="https://wa.me/..." s={s} />
                  </div>
                )}

                {/* ── CONTACT ── */}
                {sec === 'contact' && (
                  <div style={s.stack}>
                    <ToggleField label="Show Contact Section" value={lp.contact?.enabled} onChange={v => setField(cid,'contact.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Email" value={lp.contact?.email} onChange={v => setField(cid,'contact.email',v)} placeholder="hello@school.com" s={s} />
                      <TextField label="Phone" value={lp.contact?.phone} onChange={v => setField(cid,'contact.phone',v)} placeholder="+1 555 0000" s={s} />
                    </div>
                    <TextField label="Address" value={lp.contact?.address} onChange={v => setField(cid,'contact.address',v)} s={s} />
                  </div>
                )}

                {/* ── SEO ── */}
                {sec === 'seo' && (
                  <div style={s.stack}>
                    <TextField label="Page Title (browser tab)" value={lp.seo?.title} onChange={v => setField(cid,'seo.title',v)} placeholder={`${center.centerName} — English Learning`} s={s} />
                    <TextareaField label="Meta Description" value={lp.seo?.description} onChange={v => setField(cid,'seo.description',v)} rows={3} placeholder="A short description shown in Google search results (160 chars max)" s={s} />
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 0.7s linear infinite}`}</style>

      {/* ── Live preview overlay ── */}
      {preview && (
        <PreviewOverlay
          center={preview.center}
          lp={preview.lp}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

/* ─── Live preview overlay ───────────────────────────────────────────────── */
function PreviewOverlay({ center, lp, onClose }) {
  const [device, setDevice] = useState('desktop'); // 'desktop' | 'mobile'
  const Template = PREVIEW_TEMPLATES[lp.template] || ClassicTemplate;

  // Prevent body scroll while preview is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const isMobile = device === 'mobile';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', flexDirection: 'column',
      background: '#0f172a',
      fontFamily: FONT,
    }}>
      {/* ── Preview toolbar ── */}
      <div style={{
        height: 52, flexShrink: 0,
        background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
      }}>
        <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.8)', cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:FONT }}>
          <X size={14} /> Close Preview
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize:13, color:'rgba(255,255,255,0.5)' }}>Previewing </span>
          <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{center.centerName}</span>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.35)', marginLeft:8 }}>({lp.template} template)</span>
          {!lp.published && <span style={{ marginLeft:10, fontSize:11, fontWeight:700, color:'#f59e0b', background:'rgba(245,158,11,0.12)', padding:'2px 8px', borderRadius:6, border:'1px solid rgba(245,158,11,0.3)' }}>DRAFT</span>}
        </div>

        {/* Device toggle */}
        <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,0.06)', borderRadius:8, padding:3 }}>
          <button onClick={() => setDevice('desktop')} title="Desktop" style={{ display:'flex', alignItems:'center', padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', background: !isMobile ? 'rgba(255,255,255,0.12)' : 'transparent', color: !isMobile ? '#fff' : 'rgba(255,255,255,0.45)', fontFamily:FONT }}>
            <Monitor size={15} />
          </button>
          <button onClick={() => setDevice('mobile')} title="Mobile" style={{ display:'flex', alignItems:'center', padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', background: isMobile ? 'rgba(255,255,255,0.12)' : 'transparent', color: isMobile ? '#fff' : 'rgba(255,255,255,0.45)', fontFamily:FONT }}>
            <Smartphone size={15} />
          </button>
        </div>
      </div>

      {/* ── Template canvas ── */}
      <div style={{
        flex: 1, overflow: 'auto',
        background: isMobile ? '#334155' : '#e2e8f0',
        display: 'flex', justifyContent: 'center',
        alignItems: isMobile ? 'flex-start' : 'stretch',
        padding: isMobile ? '32px 16px' : '0',
      }}>
        <div style={{
          width: isMobile ? 390 : '100%',
          maxWidth: '100%',
          background: '#fff',
          boxShadow: isMobile ? '0 24px 80px rgba(0,0,0,0.5)' : 'none',
          borderRadius: isMobile ? 16 : 0,
          overflow: 'hidden',
          // Isolate fixed positioning so template nav sticks within canvas
          isolation: 'isolate',
        }}>
          <GoogleFont fontName={lp.design?.fontFamily} />
          <Template center={center} lp={lp} />
        </div>
      </div>
    </div>
  );
}

/* ─── Template picker ────────────────────────────────────────────────────── */
function TemplatePicker({ selected, onChange, s, isDark, txt, muted, bdr }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
        Template
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {TEMPLATE_DEFS.map(({ id, name, desc, thumb: Thumb }) => {
          const active = selected === id;
          return (
            <button key={id} onClick={() => onChange(id)} style={{
              border: `2px solid ${active ? '#818cf8' : bdr}`,
              borderRadius: 12, padding: 0, cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
              background: active ? 'rgba(99,102,241,0.06)' : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
              transition: 'all 0.15s',
              boxShadow: active ? '0 0 0 3px rgba(99,102,241,0.18)' : 'none',
            }}>
              {/* CSS wireframe thumbnail */}
              <div style={{ borderBottom: `1px solid ${bdr}`, padding: 12, background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                <Thumb active={active} />
              </div>
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: active ? '#818cf8' : txt, margin: '0 0 3px' }}>{name}</p>
                <p style={{ fontSize: 11, color: muted, margin: 0, lineHeight: 1.4 }}>{desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Template thumbnail SVGs ────────────────────────────────────────────── */
function ClassicThumb({ active }) {
  const c = active ? '#818cf8' : '#94a3b8';
  const c2 = active ? '#c4b5fd' : '#cbd5e1';
  return (
    <svg width="100%" viewBox="0 0 140 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Nav bar */}
      <rect x="0" y="0" width="140" height="12" rx="2" fill={c2} />
      {/* Hero — full width gradient */}
      <rect x="0" y="14" width="140" height="30" rx="2" fill={c} opacity="0.7" />
      <rect x="40" y="20" width="60" height="5" rx="2" fill="white" opacity="0.6" />
      <rect x="50" y="28" width="40" height="3" rx="1.5" fill="white" opacity="0.4" />
      {/* About section */}
      <rect x="8" y="50" width="55" height="3" rx="1.5" fill={c2} />
      <rect x="8" y="56" width="50" height="2" rx="1" fill={c2} opacity="0.5" />
      <rect x="8" y="61" width="45" height="2" rx="1" fill={c2} opacity="0.4" />
      <rect x="75" y="50" width="57" height="18" rx="3" fill={c2} opacity="0.4" />
      {/* Teacher cards */}
      {[0,1,2,3].map(i => <rect key={i} x={8+i*32} y="76" width="28" height="12" rx="3" fill={c2} opacity="0.5" />)}
    </svg>
  );
}

function ModernThumb({ active }) {
  const c = active ? '#818cf8' : '#94a3b8';
  const c2 = active ? '#c4b5fd' : '#cbd5e1';
  return (
    <svg width="100%" viewBox="0 0 140 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Nav */}
      <rect x="0" y="0" width="140" height="10" rx="2" fill={c2} />
      {/* Split hero — dark left, colored right */}
      <rect x="0" y="12" width="78" height="36" rx="0" fill="#1e293b" opacity="0.85" />
      <rect x="78" y="12" width="62" height="36" rx="0" fill={c} opacity="0.75" />
      {/* Left text lines */}
      <rect x="6" y="18" width="36" height="4" rx="2" fill="white" opacity="0.5" />
      <rect x="6" y="25" width="28" height="3" rx="1.5" fill="white" opacity="0.35" />
      <rect x="6" y="32" width="20" height="5" rx="2.5" fill="#f59e0b" opacity="0.85" />
      {/* Right floating card */}
      <rect x="88" y="17" width="40" height="24" rx="4" fill="white" opacity="0.15" />
      <rect x="93" y="22" width="28" height="3" rx="1.5" fill="white" opacity="0.5" />
      <rect x="93" y="28" width="22" height="3" rx="1.5" fill="white" opacity="0.35" />
      {/* About */}
      <rect x="8" y="52" width="55" height="16" rx="2" fill={c2} opacity="0.4" />
      <rect x="72" y="52" width="60" height="16" rx="2" fill={c2} opacity="0.3" />
      {/* CTA band */}
      <rect x="0" y="72" width="140" height="12" rx="0" fill={c} opacity="0.5" />
      <rect x="50" y="75" width="40" height="5" rx="2.5" fill="white" opacity="0.6" />
    </svg>
  );
}

function MinimalThumb({ active }) {
  const c = active ? '#818cf8' : '#94a3b8';
  const c2 = active ? '#c4b5fd' : '#cbd5e1';
  return (
    <svg width="100%" viewBox="0 0 140 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top accent bar */}
      <rect x="0" y="0" width="140" height="2" rx="1" fill={c} />
      {/* Nav — very minimal */}
      <rect x="0" y="2" width="140" height="10" rx="0" fill="white" />
      <rect x="6" y="5" width="25" height="3" rx="1.5" fill={c2} />
      <rect x="118" y="4" width="16" height="5" rx="2.5" fill={c} opacity="0.7" />
      {/* Hero — white, centered text */}
      <rect x="0" y="12" width="140" height="34" fill="white" />
      <rect x="40" y="18" width="60" height="6" rx="3" fill={c} opacity="0.15" />
      {/* Accent underline on last word */}
      <rect x="70" y="24" width="30" height="2" rx="1" fill={c} opacity="0.7" />
      <rect x="35" y="28" width="70" height="2.5" rx="1.25" fill={c2} opacity="0.4" />
      <rect x="50" y="33" width="40" height="5" rx="2.5" fill={c} opacity="0.6" />
      {/* About — centered text block */}
      <rect x="20" y="50" width="100" height="2.5" rx="1.25" fill={c2} opacity="0.4" />
      <rect x="25" y="55" width="90" height="2" rx="1" fill={c2} opacity="0.3" />
      <rect x="30" y="60" width="80" height="2" rx="1" fill={c2} opacity="0.25" />
      {/* Teacher rows */}
      {[0,1,2].map(i => (
        <g key={i}>
          <circle cx="14" cy={73+i*6} r="3" fill={c2} opacity="0.5" />
          <rect x="22" y={71+i*6} width="50" height="2.5" rx="1.25" fill={c2} opacity="0.4" />
          <rect x="22" y={75+i*6} width="35" height="1.5" rx="0.75" fill={c2} opacity="0.25" />
          <rect x="0" y={77.5+i*6} width="140" height="0.5" fill={c2} opacity="0.2" />
        </g>
      ))}
    </svg>
  );
}

/* ─── Reusable field components ─────────────────────────────────────────── */
function TextField({ label, value, onChange, placeholder = '', s }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s.input} />
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 4, placeholder = '', s }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{ ...s.input, resize: 'vertical' }} />
    </div>
  );
}

function ColorField({ label, value, onChange, s }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)}
          style={{ width: 42, height: 36, padding: 2, borderRadius: 8, border: `1px solid ${s._bdr}`, cursor: 'pointer', background: 'none' }} />
        <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder="#000000" style={{ ...s.input, flex: 1 }} />
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange, s }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} style={s.input}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ToggleField({ label, value, onChange, s }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? '#10b981' : '#cbd5e1',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 22 : 3,
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }} />
      </button>
      <span style={{ fontSize: 13, fontWeight: 600, color: s._txt }}>{label}</span>
    </div>
  );
}

/* ─── Stylesheet factory ─────────────────────────────────────────────────── */
function styles(isDark, card, bdr, txt, muted, inputBg, inputBdr) {
  const s = {
    _bdr: inputBdr, _txt: txt,
    searchInput: {
      width: '100%', padding: '10px 14px', borderRadius: 10,
      background: inputBg, border: `1px solid ${inputBdr}`,
      color: txt, fontSize: 14, fontFamily: FONT, outline: 'none', boxSizing: 'border-box',
    },
    centerCard: {
      background: card, border: `1px solid ${bdr}`, borderRadius: 14,
      marginBottom: 12, overflow: 'hidden',
    },
    centerHeader: {
      padding: '14px 20px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      transition: 'background 0.15s',
    },
    statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
    liveBadge: {
      fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
      color: '#10b981', background: 'rgba(16,185,129,0.1)',
      padding: '2px 7px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.25)',
    },
    sectionTabs: {
      display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20,
      borderBottom: `1px solid ${bdr}`, paddingBottom: 12,
    },
    sectionTab: {
      padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontSize: 12, fontWeight: 600, background: 'transparent', color: muted, fontFamily: FONT,
      transition: 'all 0.15s',
    },
    sectionTabActive: {
      background: 'rgba(99,102,241,0.12)', color: '#818cf8',
    },
    grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 },
    stack: { display: 'flex', flexDirection: 'column', gap: 16 },
    field: { display: 'flex', flexDirection: 'column', gap: 6 },
    label: { fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.08em' },
    input: {
      padding: '9px 12px', borderRadius: 9, border: `1px solid ${inputBdr}`,
      background: inputBg, color: txt, fontSize: 13.5, fontFamily: FONT,
      outline: 'none', width: '100%', boxSizing: 'border-box',
    },
    teacherCard: {
      background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
      border: `1px solid ${bdr}`, borderRadius: 12, padding: 16,
    },
    saveBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
      fontSize: 13, fontWeight: 700, fontFamily: FONT,
      background: 'linear-gradient(135deg,#4f63d2,#7c3aed)', color: '#fff',
      boxShadow: '0 4px 14px rgba(79,99,210,0.35)',
    },
    publishBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer',
      fontSize: 13, fontWeight: 700, fontFamily: FONT,
      background: 'rgba(16,185,129,0.1)', color: '#34d399',
    },
    unpublishBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
      fontSize: 13, fontWeight: 700, fontFamily: FONT,
      background: 'rgba(239,68,68,0.08)', color: '#f87171',
    },
    previewBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 18px', borderRadius: 9, border: `1px solid ${bdr}`, cursor: 'pointer',
      fontSize: 13, fontWeight: 700, fontFamily: FONT,
      background: 'transparent', color: muted,
    },
    addTeacherBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '9px 18px', borderRadius: 9, border: `1px dashed ${inputBdr}`, cursor: 'pointer',
      fontSize: 13, fontWeight: 600, fontFamily: FONT,
      background: 'transparent', color: muted, alignSelf: 'flex-start',
    },
    removeBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer',
      fontSize: 11, fontWeight: 600, fontFamily: FONT,
      background: 'rgba(239,68,68,0.07)', color: '#f87171',
    },
  };
  return s;
}

/* ─── Utility helpers ────────────────────────────────────────────────────── */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeDeep(target, source) {
  const out = deepClone(target);
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      out[key] = mergeDeep(out[key] || {}, source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}
