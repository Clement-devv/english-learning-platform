// src/pages/admin/tabs/BrandingTab.jsx
import { useState, useRef } from 'react';
import { Upload, Image, Check, Eye } from 'lucide-react';
import { useBranding } from '../../../context/BrandingContext';
import api from '../../../api';

// ── Theme presets ──────────────────────────────────────────────────────────────
const THEMES = {
  modern:    { name: 'Modern',    emoji: '◼',  primaryColor: '#111827', secondaryColor: '#374151', fontFamily: 'Inter',      borderRadius: '6px',  shadowStyle: 'soft',   spacing: 'compact'     },
  classic:   { name: 'Classic',   emoji: '🏛',  primaryColor: '#1d4ed8', secondaryColor: '#3b82f6', fontFamily: 'Lato',       borderRadius: '8px',  shadowStyle: 'medium', spacing: 'comfortable' },
  playful:   { name: 'Playful',   emoji: '🎨',  primaryColor: '#7c3aed', secondaryColor: '#f59e0b', fontFamily: 'Poppins',    borderRadius: '20px', shadowStyle: 'medium', spacing: 'spacious'    },
  glass:     { name: 'Glass',     emoji: '💎',  primaryColor: '#0ea5e9', secondaryColor: '#818cf8', fontFamily: 'Montserrat', borderRadius: '16px', shadowStyle: 'strong', spacing: 'comfortable' },
  corporate: { name: 'Corporate', emoji: '🏢',  primaryColor: '#374151', secondaryColor: '#6b7280', fontFamily: 'Roboto',     borderRadius: '4px',  shadowStyle: 'none',   spacing: 'compact'     },
  nature:    { name: 'Nature',    emoji: '🌿',  primaryColor: '#065f46', secondaryColor: '#10b981', fontFamily: 'Open Sans',  borderRadius: '12px', shadowStyle: 'soft',   spacing: 'spacious'    },
};

const FONT_OPTIONS    = ['Inter', 'Poppins', 'Roboto', 'Lato', 'Montserrat', 'Open Sans'];
const RADIUS_OPTIONS  = [{ label: 'Sharp', value: '4px' }, { label: 'Soft', value: '8px' }, { label: 'Rounded', value: '14px' }, { label: 'Pill', value: '20px' }];
const SHADOW_OPTIONS  = [{ label: 'None', value: 'none' }, { label: 'Soft', value: 'soft' }, { label: 'Medium', value: 'medium' }, { label: 'Strong', value: 'strong' }];
const SPACING_OPTIONS = [{ label: 'Compact', value: 'compact' }, { label: 'Comfortable', value: 'comfortable' }, { label: 'Spacious', value: 'spacious' }];

// ── ImageUploader ──────────────────────────────────────────────────────────────
function ImageUploader({ label, hint, currentUrl, type, onUploaded, isDarkMode, tall }) {
  const inputRef    = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState(currentUrl || null);
  const [error,     setError]     = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    const maxMb = type === 'loginBackground' ? 5 : 2;
    if (file.size > maxMb * 1024 * 1024) { setError(`File must be under ${maxMb} MB`); return; }
    if (!file.type.startsWith('image/')) { setError('Only image files allowed'); return; }
    setError('');
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append(type, file);
      const res = await api.post(`/api/center/branding/upload?type=${type}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data.url);
      onUploaded(res.data.url);
    } catch (e) {
      setError(e.response?.data?.message || 'Upload failed');
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const border = isDarkMode ? '#374151' : '#e5e7eb';
  const bg     = isDarkMode ? '#1f2937' : '#f9fafb';
  const text   = isDarkMode ? '#e5e7eb' : '#374151';
  const muted  = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>{label}</label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        style={{
          border: `2px dashed ${border}`, borderRadius: 12, background: bg,
          padding: tall ? '0' : '20px 16px',
          height: tall ? 120 : undefined,
          cursor: uploading ? 'wait' : 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, position: 'relative', overflow: 'hidden',
        }}
      >
        {preview ? (
          type === 'loginBackground' ? (
            <>
              <img src={preview} alt="bg preview" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setPreview(null)} />
              <div style={{ position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6 }}>
                Click or drag to replace
              </div>
            </>
          ) : (
            <>
              <img src={preview} alt="preview" style={{ maxHeight: type === 'favicon' ? 48 : 64, maxWidth: '100%', objectFit: 'contain', borderRadius: 6 }} onError={() => setPreview(null)} />
              <span style={{ fontSize: 12, color: muted }}>Click or drag to replace</span>
            </>
          )
        ) : (
          <>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: isDarkMode ? '#374151' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image size={18} color={muted} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text }}>{uploading ? 'Uploading…' : 'Click or drag image here'}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: muted }}>{hint}</p>
            </div>
          </>
        )}
        {uploading && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid #fff', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
      </div>
      {error && <p style={{ margin: '5px 0 0', fontSize: 12, color: '#ef4444' }}>{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}

// ── Live Preview ───────────────────────────────────────────────────────────────
function LivePreview({ form, isDarkMode }) {
  const shadows = {
    none:   'none',
    soft:   '0 1px 3px rgba(0,0,0,0.10)',
    medium: '0 4px 12px rgba(0,0,0,0.14)',
    strong: '0 8px 24px rgba(0,0,0,0.22)',
  };
  const shadow = shadows[form.shadowStyle] || shadows.soft;
  const radius = form.borderRadius;
  const primary = form.primaryColor;
  const secondary = form.secondaryColor;
  const bg = isDarkMode ? '#0f172a' : '#f1f5f9';
  const card = isDarkMode ? '#1e293b' : '#ffffff';
  const textCol = isDarkMode ? '#e2e8f0' : '#1e293b';
  const mutedCol = isDarkMode ? '#64748b' : '#94a3b8';

  return (
    <div style={{ background: bg, borderRadius: 14, padding: 20, fontFamily: `'${form.fontFamily}', sans-serif` }}>
      {/* Fake nav */}
      <div style={{ background: primary, borderRadius: radius, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, boxShadow: shadow }}>
        {form.logo ? (
          <img src={form.logo} alt="logo" style={{ height: 22, objectFit: 'contain' }} />
        ) : (
          <div style={{ width: 80, height: 10, background: 'rgba(255,255,255,0.5)', borderRadius: 4 }} />
        )}
        <div style={{ flex: 1 }} />
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
      </div>

      {/* Fake card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[primary, secondary].map((color, i) => (
          <div key={i} style={{ background: card, borderRadius: radius, padding: 14, boxShadow: shadow }}>
            <div style={{ width: 28, height: 28, borderRadius: radius, background: color, opacity: 0.15, marginBottom: 10 }} />
            <div style={{ width: '70%', height: 8, background: textCol, opacity: 0.25, borderRadius: 4, marginBottom: 6 }} />
            <div style={{ width: '50%', height: 6, background: mutedCol, opacity: 0.3, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Fake button row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, background: primary, borderRadius: radius, padding: '9px 0', textAlign: 'center', boxShadow: shadow }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: `'${form.fontFamily}', sans-serif` }}>Primary</span>
        </div>
        <div style={{ flex: 1, background: card, borderRadius: radius, padding: '9px 0', textAlign: 'center', border: `1.5px solid ${secondary}`, boxShadow: shadow }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: secondary, fontFamily: `'${form.fontFamily}', sans-serif` }}>Secondary</span>
        </div>
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, children, card, border }) {
  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'inherit' }}>{title}</p>
      {children}
    </div>
  );
}

// ── Pill chooser ───────────────────────────────────────────────────────────────
function PillGroup({ options, value, onChange, primary }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${active ? primary : '#d1d5db'}`,
              background: active ? primary : 'transparent',
              color: active ? '#fff' : 'inherit',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >{opt.label}</button>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BrandingTab({ isDarkMode }) {
  const { branding } = useBranding();

  const [form, setForm] = useState({
    primaryColor:    branding.primaryColor   || '#4F46E5',
    secondaryColor:  branding.secondaryColor || '#7C3AED',
    fontFamily:      branding.fontFamily     || 'Inter',
    logo:            branding.logo           || null,
    favicon:         branding.favicon        || null,
    loginBackground: branding.loginBackground || null,
    borderRadius:    branding.borderRadius   || '8px',
    shadowStyle:     branding.shadowStyle    || 'soft',
    spacing:         branding.spacing        || 'comfortable',
    theme:           branding.theme          || null,
    loginBgOverlay:  branding.loginBgOverlay !== undefined ? branding.loginBgOverlay : 0.45,
  });

  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val, theme: null }));

  const applyTheme = (themeKey) => {
    const t = THEMES[themeKey];
    if (!t) return;
    setForm(f => ({ ...f, ...t, theme: themeKey }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.patch('/api/center/branding', {
        primaryColor:   form.primaryColor,
        secondaryColor: form.secondaryColor,
        fontFamily:     form.fontFamily,
        borderRadius:   form.borderRadius,
        shadowStyle:    form.shadowStyle,
        spacing:        form.spacing,
        theme:          form.theme,
        loginBgOverlay: form.loginBgOverlay,
      });
      document.documentElement.style.setProperty('--brand-primary',   form.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', form.secondaryColor);
      setSuccess('✅ Branding saved! Changes are live across the platform.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save branding');
    } finally {
      setLoading(false);
    }
  };

  const card   = isDarkMode ? '#1f2937' : '#ffffff';
  const border = isDarkMode ? '#374151' : '#e5e7eb';
  const text   = isDarkMode ? '#e5e7eb' : '#111827';
  const muted  = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div style={{ fontFamily: 'inherit', color: text, maxWidth: 740 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Branding & Appearance</h2>
          <p style={{ margin: 0, fontSize: 13, color: muted }}>Customise how your platform looks to teachers and students.</p>
        </div>
        <button
          onClick={() => setShowPreview(p => !p)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${border}`, background: 'transparent', color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          <Eye size={14} /> {showPreview ? 'Hide' : 'Preview'}
        </button>
      </div>

      {/* Live preview panel */}
      {showPreview && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Preview</p>
          <LivePreview form={form} isDarkMode={isDarkMode} />
        </div>
      )}

      {/* ── Theme Presets ── */}
      <Section title="Theme Presets — pick one to set everything at once" card={card} border={border}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {Object.entries(THEMES).map(([key, t]) => {
            const active = form.theme === key;
            return (
              <button
                key={key}
                onClick={() => applyTheme(key)}
                style={{
                  position: 'relative',
                  background: isDarkMode ? '#111827' : '#f9fafb',
                  border: `2px solid ${active ? t.primaryColor : border}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  boxShadow: active ? `0 0 0 3px ${t.primaryColor}30` : 'none',
                }}
              >
                {active && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: t.primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={10} color="#fff" />
                  </div>
                )}
                {/* Mini colour swatch */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: t.primaryColor }} />
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: t.secondaryColor }} />
                  <div style={{ flex: 1, height: 20, borderRadius: t.borderRadius, background: t.primaryColor, opacity: 0.12 }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 2 }}>
                  {t.emoji} {t.name}
                </div>
                <div style={{ fontSize: 11, color: muted }}>{t.fontFamily} · {t.spacing}</div>
              </button>
            );
          })}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 11, color: muted }}>
          Choosing a theme sets colors, font, shape, shadow, and spacing. You can then fine-tune any individual setting below.
        </p>
      </Section>

      {/* ── Images ── */}
      <Section title="Images" card={card} border={border}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <ImageUploader
            label="Logo"
            hint="PNG or SVG · max 2 MB · 200×60 px"
            currentUrl={form.logo}
            type="logo"
            onUploaded={(url) => setForm(f => ({ ...f, logo: url }))}
            isDarkMode={isDarkMode}
          />
          <ImageUploader
            label="Favicon"
            hint="ICO / PNG · max 2 MB · 32×32 px"
            currentUrl={form.favicon}
            type="favicon"
            onUploaded={(url) => setForm(f => ({ ...f, favicon: url }))}
            isDarkMode={isDarkMode}
          />
          <ImageUploader
            label="Login Background"
            hint="JPG / PNG · max 5 MB · landscape"
            currentUrl={form.loginBackground}
            type="loginBackground"
            onUploaded={(url) => setForm(f => ({ ...f, loginBackground: url }))}
            isDarkMode={isDarkMode}
            tall
          />
        </div>
        {form.loginBackground && (
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: text, marginBottom: 6 }}>
              Login background overlay darkness — {Math.round(form.loginBgOverlay * 100)}%
            </label>
            <input
              type="range"
              min={0} max={0.8} step={0.05}
              value={form.loginBgOverlay}
              onChange={(e) => setForm(f => ({ ...f, loginBgOverlay: parseFloat(e.target.value) }))}
              style={{ width: '100%', accentColor: form.primaryColor }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: muted, marginTop: 2 }}>
              <span>Transparent</span><span>Dark</span>
            </div>
          </div>
        )}
        <p style={{ margin: '10px 0 0', fontSize: 11, color: muted }}>Images save instantly on upload. The login background appears behind the sign-in card on your login page.</p>
      </Section>

      {/* ── Colors ── */}
      <Section title="Colors" card={card} border={border}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[
            { key: 'primaryColor',   label: 'Primary Color',   hint: 'Buttons, nav bar, highlights' },
            { key: 'secondaryColor', label: 'Secondary Color', hint: 'Accents, badges, secondary buttons' },
          ].map(({ key, label, hint }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 4 }}>{label}</label>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: muted }}>{hint}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  style={{ width: 48, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }}
                />
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) set(key, e.target.value); }}
                  style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: `1px solid ${border}`, background: isDarkMode ? '#111827' : '#f9fafb', color: text, fontSize: 13, fontFamily: 'monospace' }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Colour preview chips */}
        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, background: form.primaryColor, borderRadius: 8, padding: '10px 0', textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Primary</span>
          </div>
          <div style={{ flex: 1, background: form.secondaryColor, borderRadius: 8, padding: '10px 0', textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Secondary</span>
          </div>
          <div style={{ flex: 1, background: form.primaryColor, opacity: 0.15, borderRadius: 8, padding: '10px 0', textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: form.primaryColor }}>Tint</span>
          </div>
        </div>
      </Section>

      {/* ── Typography ── */}
      <Section title="Typography" card={card} border={border}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>Font Family</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {FONT_OPTIONS.map(f => {
            const active = form.fontFamily === f;
            return (
              <button
                key={f}
                onClick={() => set('fontFamily', f)}
                style={{
                  padding: '7px 14px', borderRadius: 20,
                  border: `1.5px solid ${active ? form.primaryColor : border}`,
                  background: active ? form.primaryColor : 'transparent',
                  color: active ? '#fff' : text,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: `'${f}', sans-serif`,
                  transition: 'all 0.15s',
                }}
              >{f}</button>
            );
          })}
        </div>
        <div style={{ background: isDarkMode ? '#111827' : '#f8fafc', borderRadius: 10, padding: '14px 16px', border: `1px solid ${border}` }}>
          <p style={{ margin: 0, fontSize: 15, fontFamily: `'${form.fontFamily}', sans-serif`, color: text }}>
            The quick brown fox jumps over the lazy dog. 1234567890
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12, fontFamily: `'${form.fontFamily}', sans-serif`, color: muted }}>
            ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz
          </p>
        </div>
      </Section>

      {/* ── Shape & Style ── */}
      <Section title="Shape & Style" card={card} border={border}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>Corner Radius</label>
            <PillGroup options={RADIUS_OPTIONS} value={form.borderRadius} onChange={(v) => set('borderRadius', v)} primary={form.primaryColor} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>Shadow</label>
            <PillGroup options={SHADOW_OPTIONS} value={form.shadowStyle} onChange={(v) => set('shadowStyle', v)} primary={form.primaryColor} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>Spacing</label>
            <PillGroup options={SPACING_OPTIONS} value={form.spacing} onChange={(v) => set('spacing', v)} primary={form.primaryColor} />
          </div>
        </div>
        {/* Shape preview */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{
              flex: 1, height: 60, background: form.primaryColor, opacity: 0.1 + i * 0.1,
              borderRadius: form.borderRadius,
              boxShadow: { none: 'none', soft: '0 1px 3px rgba(0,0,0,0.10)', medium: '0 4px 12px rgba(0,0,0,0.14)', strong: '0 8px 24px rgba(0,0,0,0.22)' }[form.shadowStyle],
            }} />
          ))}
        </div>
      </Section>

      {/* Feedback */}
      {error   && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#ef4444', fontWeight: 600 }}>{error}</p>}
      {success && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#10b981', fontWeight: 600 }}>{success}</p>}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
          background: loading ? '#9ca3af' : form.primaryColor,
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Saving…' : 'Save Branding'}
      </button>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: muted, textAlign: 'center' }}>
        Images save instantly on upload. Save button applies all other changes platform-wide.
      </p>
    </div>
  );
}
