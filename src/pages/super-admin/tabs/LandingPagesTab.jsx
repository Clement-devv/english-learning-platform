// src/pages/super-admin/tabs/LandingPagesTab.jsx
// Super admin: build & manage the public landing page for each center.
import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, ChevronDown, ChevronUp, Save, Eye, EyeOff,
  Plus, Trash2, Loader2, Monitor, Smartphone, X, Wand2,
} from 'lucide-react';
import ClassicTemplate from '../../landing-page/templates/ClassicTemplate';
import ModernTemplate  from '../../landing-page/templates/ModernTemplate';
import MinimalTemplate from '../../landing-page/templates/MinimalTemplate';
import { ImageField, ListEditor } from './LandingEditorFields';
import { classicSample, CLASSIC_FEATURE_ICONS } from '../../landing-page/classicContent';
import { GoogleFont }  from '../../landing-page/utils.jsx';

const PREVIEW_TEMPLATES = { classic: ClassicTemplate, modern: ModernTemplate, minimal: MinimalTemplate };

const API  = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const FONT = "'Inter','system-ui',sans-serif";

const FONT_OPTIONS  = ['Inter', 'Nunito', 'Poppins', 'Roboto', 'Lato'];

const TEMPLATE_DEFS = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Full school website: photo hero, programs, reviews, gallery, FAQ',
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

const SECTION_TABS = [
  ['design', 'Design'], ['hero', 'Header & hero'], ['stats', 'Numbers'], ['about', 'About'],
  ['programs', 'Programs'], ['features', 'Why us'], ['teachers', 'Teachers'], ['testimonials', 'Testimonials'],
  ['gallery', 'Gallery'], ['cta', 'Enrol banner'], ['faq', 'FAQ'], ['contact', 'Contact & footer'],
  ['links', 'Links'], ['seo', 'SEO'],
];
// Sections only the Classic template shows
const CLASSIC_ONLY = ['stats', 'programs', 'features', 'testimonials', 'gallery', 'cta', 'faq'];

const DEFAULT_LP = {
  published: false,
  template: 'classic',
  design: {
    primaryColor: '#BE185D', secondaryColor: '#FCE7F3', accentColor: '#f59e0b',
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
  links: { studentLogin: '', teacherLogin: '', parentLogin: '', facebook: '', instagram: '', youtube: '', whatsapp: '' },
  contact: { enabled: false, email: '', phone: '', address: '', hours: '' },
  seo: { title: '', description: '' },
  topBar: { enabled: false, text: '' },
  stats: { enabled: true, items: [] },
  features: { enabled: true, title: '', subtitle: '', items: [] },
  programs: { enabled: true, title: '', subtitle: '', items: [] },
  testimonials: { enabled: true, title: '', subtitle: '', items: [] },
  gallery: { enabled: true, title: '', subtitle: '', items: [] },
  faq: { enabled: true, title: '', subtitle: '', items: [] },
  cta: { enabled: false, title: '', text: '', buttonText: '', buttonUrl: '', image: '' },
  footer: { about: '' },
};

/** Fill only what's empty with the sample — never overwrite what the admin typed. */
function fillEmpty(target, sample) {
  const out = deepClone(target);
  for (const [k, v] of Object.entries(sample)) {
    const cur = out[k];
    if (Array.isArray(v)) { if (!Array.isArray(cur) || cur.length === 0) out[k] = deepClone(v); }
    else if (v && typeof v === 'object') out[k] = fillEmpty(cur && typeof cur === 'object' ? cur : {}, v);
    // empty text gets the sample; an "off" section switch is turned on so the sample shows
    else if (cur === undefined || cur === null || cur === '' || (typeof v === 'boolean' && cur === false)) out[k] = v;
  }
  return out;
}

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
          : { ...DEFAULT_LP, design: { ...DEFAULT_LP.design, primaryColor: center.branding?.primaryColor || '#BE185D' } };
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

  const fillSample = (center) => {
    const cid = center._id;
    if (!window.confirm('Fill the empty parts of this website with sample text and photos?\n\nNothing you have already typed will be changed. Replace the sample photos with your own before publishing.')) return;
    setLps(p => ({ ...p, [cid]: { ...fillEmpty(p[cid] || DEFAULT_LP, classicSample(center.centerName)), template: 'classic' } }));
    flash(cid, 'Sample content added — press Save to keep it');
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
                  <button onClick={() => fillSample(center)} style={s.previewBtn} title="Fill empty sections with example text and photos">
                    <Wand2 size={14} /> Fill with sample content
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
                  {SECTION_TABS.map(([k, label]) => (
                    <button key={k} onClick={() => setSection(p => ({ ...p, [cid]: k }))} style={{ ...s.sectionTab, ...(sec === k ? s.sectionTabActive : {}) }}>
                      {label}
                    </button>
                  ))}
                </div>
                {lp.template !== 'classic' && CLASSIC_ONLY.includes(sec) && (
                  <p style={s.note}>This section shows on the <strong>Classic</strong> template. Pick Classic above to use it.</p>
                )}

                {/* ── DESIGN ── */}
                {sec === 'design' && (
                  <div style={s.grid2}>
                    <ColorField label="Primary Color" value={lp.design?.primaryColor} onChange={v => setField(cid,'design.primaryColor',v)} s={s} />
                    <ColorField label="Secondary Color" value={lp.design?.secondaryColor} onChange={v => setField(cid,'design.secondaryColor',v)} s={s} />
                    <ColorField label="Accent / CTA Color" value={lp.design?.accentColor} onChange={v => setField(cid,'design.accentColor',v)} s={s} />
                    <ColorField label="Background Color" value={lp.design?.bgColor} onChange={v => setField(cid,'design.bgColor',v)} s={s} />
                    <ColorField label="Text Color" value={lp.design?.textColor} onChange={v => setField(cid,'design.textColor',v)} s={s} />
                    <ColorField label="Muted Text Color" value={lp.design?.mutedColor} onChange={v => setField(cid,'design.mutedColor',v)} s={s} />
                    <SelectField label="Body Font" value={lp.design?.fontFamily} options={FONT_OPTIONS.map(f => ({ value: f, label: f }))} onChange={v => setField(cid,'design.fontFamily',v)} s={s} />
                    <SelectField label="Hero Style" value={lp.design?.heroStyle} options={HERO_STYLES} onChange={v => setField(cid,'design.heroStyle',v)} s={s} />
                    <SelectField label="Nav Style" value={lp.design?.navStyle} options={NAV_STYLES} onChange={v => setField(cid,'design.navStyle',v)} s={s} />
                    {lp.design?.heroStyle === 'image' && lp.template !== 'classic' && (
                      <ImageField label="Hero Background Image" value={lp.design?.heroImage} onChange={v => setField(cid,'design.heroImage',v)} centerId={cid} s={s} />
                    )}
                  </div>
                )}

                {/* ── HEADER & HERO ── */}
                {sec === 'hero' && (
                  <div style={s.stack}>
                    <div style={s.subCard}>
                      <ToggleField label="Show announcement bar above the header" value={lp.topBar?.enabled} onChange={v => setField(cid,'topBar.enabled',v)} s={s} />
                      {lp.topBar?.enabled && <TextField label="Announcement" value={lp.topBar?.text} onChange={v => setField(cid,'topBar.text',v)} placeholder="Admissions are open — book a free placement test today." s={s} />}
                      <span style={s.hint}>The bar also shows your phone, email and social links from the Contact and Links tabs.</span>
                    </div>
                    <TextField label="Small label above the headline" value={lp.hero?.badge} onChange={v => setField(cid,'hero.badge',v)} placeholder="English for kids, teens & adults" s={s} />
                    <TextField label="Headline" value={lp.hero?.headline} onChange={v => setField(cid,'hero.headline',v)} placeholder="Speak English with confidence" s={s} />
                    <TextareaField label="Sub-headline" value={lp.hero?.subheadline} onChange={v => setField(cid,'hero.subheadline',v)} placeholder="Join hundreds of students improving their English skills" rows={3} s={s} />
                    <ImageField label="Hero photo (large, landscape)" value={lp.hero?.image} onChange={v => setField(cid,'hero.image',v)} centerId={cid} s={s} hint="Best: 1900 × 1000 px or larger. Text sits on the left, so keep faces to the right." />
                    <div style={s.grid2}>
                      <TextField label="Main button text" value={lp.hero?.ctaText} onChange={v => setField(cid,'hero.ctaText',v)} s={s} />
                      <TextField label="Main button link" value={lp.hero?.ctaUrl} onChange={v => setField(cid,'hero.ctaUrl',v)} placeholder="/student/login" s={s} />
                      <TextField label="Second button text (optional)" value={lp.hero?.secondaryCtaText} onChange={v => setField(cid,'hero.secondaryCtaText',v)} s={s} />
                      <TextField label="Second button link" value={lp.hero?.secondaryCtaUrl} onChange={v => setField(cid,'hero.secondaryCtaUrl',v)} placeholder="#programs" s={s} />
                    </div>
                    <span style={s.hint}>The first three “Why choose us” items appear as highlight cards at the bottom of the hero.</span>
                  </div>
                )}

                {/* ── STATS ── */}
                {sec === 'stats' && (
                  <div style={s.stack}>
                    <ToggleField label="Show numbers row" value={lp.stats?.enabled} onChange={v => setField(cid,'stats.enabled',v)} s={s} />
                    <ListEditor s={s} items={lp.stats?.items} onChange={v => setField(cid,'stats.items',v)} max={6}
                      itemLabel="Number" addLabel="Add number" newItem={() => ({ value: '', label: '' })} summary={x => x.value}
                      render={(x, up) => (
                        <div style={s.grid2}>
                          <TextField label="Number" value={x.value} onChange={v => up({ value: v })} placeholder="1,200+" s={s} />
                          <TextField label="Label" value={x.label} onChange={v => up({ label: v })} placeholder="Students taught" s={s} />
                        </div>
                      )} />
                  </div>
                )}

                {/* ── ABOUT ── */}
                {sec === 'about' && (
                  <div style={s.stack}>
                    <ToggleField label="Show About Section" value={lp.about?.enabled} onChange={v => setField(cid,'about.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Small label" value={lp.about?.subtitle} onChange={v => setField(cid,'about.subtitle',v)} placeholder="About us" s={s} />
                      <TextField label="Section Title" value={lp.about?.title} onChange={v => setField(cid,'about.title',v)} s={s} />
                    </div>
                    <TextareaField label="Body Text" value={lp.about?.body} onChange={v => setField(cid,'about.body',v)} rows={6} placeholder="Tell prospective students about your center, teaching method, and what makes you unique." s={s} />
                    <div style={s.grid2}>
                      <ImageField label="Main photo (portrait)" value={lp.about?.image} onChange={v => setField(cid,'about.image',v)} centerId={cid} s={s} />
                      <ImageField label="Second photo (small, overlaps)" value={lp.about?.image2} onChange={v => setField(cid,'about.image2',v)} centerId={cid} s={s} />
                      <TextField label="Badge number" value={lp.about?.badgeValue} onChange={v => setField(cid,'about.badgeValue',v)} placeholder="12+" s={s} />
                      <TextField label="Badge text" value={lp.about?.badgeLabel} onChange={v => setField(cid,'about.badgeLabel',v)} placeholder="Years of experience" s={s} />
                    </div>
                    <p style={{ ...s.label, margin: '6px 0 0' }}>Checklist</p>
                    <ListEditor s={s} items={lp.about?.points} onChange={v => setField(cid,'about.points',v)} max={8}
                      itemLabel="Point" addLabel="Add point" newItem={() => ''}
                      render={(x, up) => <input value={x || ''} onChange={e => up(e.target.value)} placeholder="Certified, experienced teachers" style={s.input} />} />
                  </div>
                )}

                {/* ── PROGRAMS ── */}
                {sec === 'programs' && (
                  <div style={s.stack}>
                    <ToggleField label="Show Programs" value={lp.programs?.enabled} onChange={v => setField(cid,'programs.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Section title" value={lp.programs?.title} onChange={v => setField(cid,'programs.title',v)} placeholder="Courses for every goal" s={s} />
                      <TextField label="Section text" value={lp.programs?.subtitle} onChange={v => setField(cid,'programs.subtitle',v)} s={s} />
                    </div>
                    <ListEditor s={s} items={lp.programs?.items} onChange={v => setField(cid,'programs.items',v)} max={12}
                      itemLabel="Program" addLabel="Add program" summary={x => x.title}
                      newItem={() => ({ title: '', level: '', text: '', duration: '', price: '', image: '', ctaText: 'Learn more', ctaUrl: '#contact' })}
                      render={(x, up) => (
                        <div style={s.grid2}>
                          <TextField label="Title" value={x.title} onChange={v => up({ title: v })} placeholder="Kids English" s={s} />
                          <TextField label="Tag (age / level)" value={x.level} onChange={v => up({ level: v })} placeholder="Ages 5–12" s={s} />
                          <div style={{ gridColumn: '1 / -1' }}><TextareaField label="Description" value={x.text} onChange={v => up({ text: v })} rows={2} s={s} /></div>
                          <TextField label="Duration / schedule" value={x.duration} onChange={v => up({ duration: v })} placeholder="2 × 45 min / week" s={s} />
                          <TextField label="Price" value={x.price} onChange={v => up({ price: v })} placeholder="From $60 / month" s={s} />
                          <TextField label="Button text" value={x.ctaText} onChange={v => up({ ctaText: v })} s={s} />
                          <TextField label="Button link" value={x.ctaUrl} onChange={v => up({ ctaUrl: v })} placeholder="#contact" s={s} />
                          <ImageField label="Photo" value={x.image} onChange={v => up({ image: v })} centerId={cid} s={s} wide />
                        </div>
                      )} />
                  </div>
                )}

                {/* ── WHY US ── */}
                {sec === 'features' && (
                  <div style={s.stack}>
                    <ToggleField label="Show “Why choose us”" value={lp.features?.enabled} onChange={v => setField(cid,'features.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Section title" value={lp.features?.title} onChange={v => setField(cid,'features.title',v)} s={s} />
                      <TextField label="Section text" value={lp.features?.subtitle} onChange={v => setField(cid,'features.subtitle',v)} s={s} />
                    </div>
                    <ListEditor s={s} items={lp.features?.items} onChange={v => setField(cid,'features.items',v)} max={12}
                      itemLabel="Reason" addLabel="Add reason" summary={x => x.title}
                      newItem={() => ({ icon: 'star', title: '', text: '' })}
                      render={(x, up) => (
                        <div style={s.grid2}>
                          <TextField label="Title" value={x.title} onChange={v => up({ title: v })} placeholder="Small classes" s={s} />
                          <SelectField label="Icon" value={x.icon || 'star'} options={CLASSIC_FEATURE_ICONS.map(i => ({ value: i, label: i[0].toUpperCase() + i.slice(1) }))} onChange={v => up({ icon: v })} s={s} />
                          <div style={{ gridColumn: '1 / -1' }}><TextareaField label="Text" value={x.text} onChange={v => up({ text: v })} rows={2} s={s} /></div>
                        </div>
                      )} />
                  </div>
                )}

                {/* ── TEACHERS ── */}
                {sec === 'teachers' && (
                  <ListEditor s={s} items={lp.teachers} onChange={v => setField(cid,'teachers',v)} max={24}
                    itemLabel="Teacher" addLabel="Add teacher" summary={x => x.name}
                    newItem={() => ({ name: '', title: '', bio: '', photo: '' })}
                    render={(t, up) => (
                      <div style={s.grid2}>
                        <TextField label="Name" value={t.name} onChange={v => up({ name: v })} s={s} />
                        <TextField label="Title / Role" value={t.title} onChange={v => up({ title: v })} placeholder="e.g. IELTS Specialist" s={s} />
                        <div style={{ gridColumn: '1 / -1' }}><TextareaField label="Short Bio" value={t.bio} onChange={v => up({ bio: v })} rows={2} s={s} /></div>
                        <ImageField label="Photo (portrait)" value={t.photo} onChange={v => up({ photo: v })} centerId={cid} s={s} wide />
                      </div>
                    )} />
                )}

                {/* ── TESTIMONIALS ── */}
                {sec === 'testimonials' && (
                  <div style={s.stack}>
                    <ToggleField label="Show Testimonials" value={lp.testimonials?.enabled} onChange={v => setField(cid,'testimonials.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Section title" value={lp.testimonials?.title} onChange={v => setField(cid,'testimonials.title',v)} s={s} />
                      <TextField label="Section text" value={lp.testimonials?.subtitle} onChange={v => setField(cid,'testimonials.subtitle',v)} s={s} />
                    </div>
                    <ListEditor s={s} items={lp.testimonials?.items} onChange={v => setField(cid,'testimonials.items',v)} max={12}
                      itemLabel="Review" addLabel="Add review" summary={x => x.name}
                      newItem={() => ({ name: '', role: '', quote: '', rating: 5, photo: '' })}
                      render={(x, up) => (
                        <div style={s.grid2}>
                          <TextField label="Name" value={x.name} onChange={v => up({ name: v })} s={s} />
                          <TextField label="Who they are" value={x.role} onChange={v => up({ role: v })} placeholder="Parent of a 9-year-old" s={s} />
                          <div style={{ gridColumn: '1 / -1' }}><TextareaField label="What they said" value={x.quote} onChange={v => up({ quote: v })} rows={3} s={s} /></div>
                          <SelectField label="Stars" value={String(x.rating || 5)} options={[5, 4, 3].map(n => ({ value: String(n), label: '★'.repeat(n) }))} onChange={v => up({ rating: Number(v) })} s={s} />
                          <ImageField label="Photo (optional)" value={x.photo} onChange={v => up({ photo: v })} centerId={cid} s={s} />
                        </div>
                      )} />
                  </div>
                )}

                {/* ── GALLERY ── */}
                {sec === 'gallery' && (
                  <div style={s.stack}>
                    <ToggleField label="Show Gallery" value={lp.gallery?.enabled} onChange={v => setField(cid,'gallery.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Section title" value={lp.gallery?.title} onChange={v => setField(cid,'gallery.title',v)} placeholder="Life at our school" s={s} />
                      <TextField label="Section text" value={lp.gallery?.subtitle} onChange={v => setField(cid,'gallery.subtitle',v)} s={s} />
                    </div>
                    <span style={s.hint}>The first photo is shown large. Visitors can click any photo to view it full size.</span>
                    <ListEditor s={s} items={lp.gallery?.items} onChange={v => setField(cid,'gallery.items',v)} max={24}
                      itemLabel="Photo" addLabel="Add photo" summary={x => x.caption}
                      newItem={() => ({ image: '', caption: '' })}
                      render={(x, up) => (
                        <div style={s.grid2}>
                          <ImageField label="Photo" value={x.image} onChange={v => up({ image: v })} centerId={cid} s={s} />
                          <TextField label="Caption (optional)" value={x.caption} onChange={v => up({ caption: v })} s={s} />
                        </div>
                      )} />
                  </div>
                )}

                {/* ── ENROLMENT BANNER ── */}
                {sec === 'cta' && (
                  <div style={s.stack}>
                    <ToggleField label="Show enrolment banner" value={lp.cta?.enabled} onChange={v => setField(cid,'cta.enabled',v)} s={s} />
                    <TextField label="Title" value={lp.cta?.title} onChange={v => setField(cid,'cta.title',v)} placeholder="Start your English journey this month" s={s} />
                    <TextareaField label="Text" value={lp.cta?.text} onChange={v => setField(cid,'cta.text',v)} rows={2} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Button text" value={lp.cta?.buttonText} onChange={v => setField(cid,'cta.buttonText',v)} placeholder="Book a free trial" s={s} />
                      <TextField label="Button link" value={lp.cta?.buttonUrl} onChange={v => setField(cid,'cta.buttonUrl',v)} placeholder="/student/login" s={s} />
                    </div>
                    <ImageField label="Background photo (optional)" value={lp.cta?.image} onChange={v => setField(cid,'cta.image',v)} centerId={cid} s={s} />
                  </div>
                )}

                {/* ── FAQ ── */}
                {sec === 'faq' && (
                  <div style={s.stack}>
                    <ToggleField label="Show FAQ" value={lp.faq?.enabled} onChange={v => setField(cid,'faq.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Section title" value={lp.faq?.title} onChange={v => setField(cid,'faq.title',v)} s={s} />
                      <TextField label="Section text" value={lp.faq?.subtitle} onChange={v => setField(cid,'faq.subtitle',v)} s={s} />
                    </div>
                    <ListEditor s={s} items={lp.faq?.items} onChange={v => setField(cid,'faq.items',v)} max={20}
                      itemLabel="Question" addLabel="Add question" summary={x => x.q}
                      newItem={() => ({ q: '', a: '' })}
                      render={(x, up) => (
                        <div style={s.stack}>
                          <TextField label="Question" value={x.q} onChange={v => up({ q: v })} s={s} />
                          <TextareaField label="Answer" value={x.a} onChange={v => up({ a: v })} rows={3} s={s} />
                        </div>
                      )} />
                  </div>
                )}

                {/* ── LINKS ── */}
                {sec === 'links' && (
                  <div style={s.grid2}>
                    <TextField label="Student Login URL" value={lp.links?.studentLogin} onChange={v => setField(cid,'links.studentLogin',v)} placeholder="/student/login" s={s} />
                    <TextField label="Teacher Login URL" value={lp.links?.teacherLogin} onChange={v => setField(cid,'links.teacherLogin',v)} placeholder="/teacher/login" s={s} />
                    <TextField label="Parent Login URL" value={lp.links?.parentLogin} onChange={v => setField(cid,'links.parentLogin',v)} placeholder="/parent/login" s={s} />
                    <TextField label="Facebook URL" value={lp.links?.facebook} onChange={v => setField(cid,'links.facebook',v)} placeholder="https://facebook.com/..." s={s} />
                    <TextField label="Instagram URL" value={lp.links?.instagram} onChange={v => setField(cid,'links.instagram',v)} placeholder="https://instagram.com/..." s={s} />
                    <TextField label="YouTube URL" value={lp.links?.youtube} onChange={v => setField(cid,'links.youtube',v)} placeholder="https://youtube.com/..." s={s} />
                    <TextField label="WhatsApp Link" value={lp.links?.whatsapp} onChange={v => setField(cid,'links.whatsapp',v)} placeholder="https://wa.me/..." s={s} />
                  </div>
                )}

                {/* ── CONTACT & FOOTER ── */}
                {sec === 'contact' && (
                  <div style={s.stack}>
                    <ToggleField label="Show Contact Section" value={lp.contact?.enabled} onChange={v => setField(cid,'contact.enabled',v)} s={s} />
                    <div style={s.grid2}>
                      <TextField label="Email" value={lp.contact?.email} onChange={v => setField(cid,'contact.email',v)} placeholder="hello@school.com" s={s} />
                      <TextField label="Phone" value={lp.contact?.phone} onChange={v => setField(cid,'contact.phone',v)} placeholder="+1 555 0000" s={s} />
                    </div>
                    <TextField label="Address" value={lp.contact?.address} onChange={v => setField(cid,'contact.address',v)} s={s} />
                    <TextField label="Opening hours" value={lp.contact?.hours} onChange={v => setField(cid,'contact.hours',v)} placeholder="Mon–Fri 8:00–20:00 · Sat 9:00–14:00" s={s} />
                    <span style={s.hint}>The address gets an “Open in Google Maps” button.</span>
                    <TextareaField label="Footer text (about your school)" value={lp.footer?.about} onChange={v => setField(cid,'footer.about',v)} rows={2} s={s} />
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
          // clip (not hidden) so the template's sticky header can still stick
          overflow: 'clip',
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
              border: `2px solid ${active ? '#f472b6' : bdr}`,
              borderRadius: 12, padding: 0, cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
              background: active ? 'rgba(219,39,119,0.06)' : (isDark ? 'rgba(255,255,255,0.03)' : '#fff'),
              transition: 'all 0.15s',
              boxShadow: active ? '0 0 0 3px rgba(219,39,119,0.18)' : 'none',
            }}>
              {/* CSS wireframe thumbnail */}
              <div style={{ borderBottom: `1px solid ${bdr}`, padding: 12, background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' }}>
                <Thumb active={active} />
              </div>
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: active ? '#f472b6' : txt, margin: '0 0 3px' }}>{name}</p>
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
  const c = active ? '#f472b6' : '#94a3b8';
  const c2 = active ? '#f9a8d4' : '#cbd5e1';
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
  const c = active ? '#f472b6' : '#94a3b8';
  const c2 = active ? '#f9a8d4' : '#cbd5e1';
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
  const c = active ? '#f472b6' : '#94a3b8';
  const c2 = active ? '#f9a8d4' : '#cbd5e1';
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
    _bdr: inputBdr, _txt: txt, _muted: muted,
    note: { fontSize: 12.5, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 9, padding: '8px 12px', margin: '0 0 16px' },
    hint: { fontSize: 12, color: muted, lineHeight: 1.5 },
    subCard: { display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, border: `1px solid ${bdr}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#f8fafc' },
    smallBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, border: `1px solid ${inputBdr}`, background: 'transparent', color: txt, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
    iconBtn: { display: 'inline-grid', placeItems: 'center', width: 28, height: 26, borderRadius: 7, border: `1px solid ${inputBdr}`, background: 'transparent', color: muted, cursor: 'pointer' },
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
      background: 'rgba(219,39,119,0.12)', color: '#f472b6',
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
      background: 'linear-gradient(135deg,#be185d,#db2777)', color: '#fff',
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
