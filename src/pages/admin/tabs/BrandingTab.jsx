import { useState, useRef } from 'react';
import { Upload, X, Image } from 'lucide-react';
import { useBranding } from '../../../context/BrandingContext';
import api from '../../../api';

const FONT_OPTIONS = ['Inter', 'Poppins', 'Roboto', 'Lato', 'Montserrat', 'Open Sans'];

function ImageUploader({ label, hint, currentUrl, type, onUploaded, isDarkMode }) {
  const inputRef   = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview,   setPreview]   = useState(currentUrl || null);
  const [error,     setError]     = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('File must be under 2 MB'); return; }
    if (!file.type.startsWith('image/')) { setError('Only image files allowed'); return; }

    setError('');
    setUploading(true);
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

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

  const border  = isDarkMode ? '#374151' : '#e5e7eb';
  const bg      = isDarkMode ? '#1f2937' : '#f9fafb';
  const text    = isDarkMode ? '#e5e7eb' : '#374151';
  const muted   = isDarkMode ? '#9ca3af' : '#6b7280';

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>
        {label}
      </label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        style={{
          border: `2px dashed ${border}`,
          borderRadius: 12,
          background: bg,
          padding: '20px 16px',
          cursor: uploading ? 'wait' : 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          transition: 'border-color 0.15s',
          position: 'relative',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="preview"
              style={{
                maxHeight: type === 'favicon' ? 48 : 80,
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: 6,
              }}
              onError={() => setPreview(null)}
            />
            <span style={{ fontSize: 12, color: muted }}>Click or drag to replace</span>
          </>
        ) : (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: isDarkMode ? '#374151' : '#e5e7eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Image size={20} color={muted} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: text }}>
                {uploading ? 'Uploading…' : 'Click or drag image here'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: muted }}>{hint}</p>
            </div>
          </>
        )}

        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 10,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '3px solid #fff', borderTopColor: 'transparent',
              animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        )}
      </div>

      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#ef4444' }}>{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}

export default function BrandingTab({ isDarkMode }) {
  const { branding } = useBranding();

  const [form, setForm] = useState({
    primaryColor:   branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    fontFamily:     branding.fontFamily,
    logo:           branding.logo   || null,
    favicon:        branding.favicon || null,
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await api.patch('/api/center/branding', {
        primaryColor:   form.primaryColor,
        secondaryColor: form.secondaryColor,
        fontFamily:     form.fontFamily,
      });
      document.documentElement.style.setProperty('--brand-primary',   form.primaryColor);
      document.documentElement.style.setProperty('--brand-secondary', form.secondaryColor);
      setSuccess('Branding saved! Changes are live.');
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
    <div style={{ fontFamily: 'inherit', color: text, maxWidth: 680 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800 }}>Branding & Appearance</h2>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: muted }}>
        Customise how your platform looks to teachers and students.
      </p>

      {/* ── Images ── */}
      <div style={{
        background: card, border: `1px solid ${border}`,
        borderRadius: 14, padding: 20, marginBottom: 16,
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: text }}>Images</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ImageUploader
            label="Logo"
            hint="PNG or SVG · max 2 MB · recommended 200×60 px"
            currentUrl={form.logo}
            type="logo"
            onUploaded={(url) => setForm(f => ({ ...f, logo: url }))}
            isDarkMode={isDarkMode}
          />
          <ImageUploader
            label="Favicon"
            hint="ICO, PNG or SVG · max 2 MB · 32×32 px ideal"
            currentUrl={form.favicon}
            type="favicon"
            onUploaded={(url) => setForm(f => ({ ...f, favicon: url }))}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>

      {/* ── Colors ── */}
      <div style={{
        background: card, border: `1px solid ${border}`,
        borderRadius: 14, padding: 20, marginBottom: 16,
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: text }}>Colors</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { key: 'primaryColor',   label: 'Primary Color'   },
            { key: 'secondaryColor', label: 'Secondary Color' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: text, marginBottom: 8 }}>
                {label}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  type="color"
                  value={form[key]}
                  onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={{ width: 48, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 2 }}
                />
                <span style={{ fontSize: 13, fontFamily: 'monospace', color: muted }}>{form[key]}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={{ background: form.primaryColor, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'default' }}>
            Primary
          </button>
          <button style={{ background: form.secondaryColor, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'default' }}>
            Secondary
          </button>
        </div>
      </div>

      {/* ── Font ── */}
      <div style={{
        background: card, border: `1px solid ${border}`,
        borderRadius: 14, padding: 20, marginBottom: 24,
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: text }}>Font</p>
        <select
          value={form.fontFamily}
          onChange={(e) => setForm(f => ({ ...f, fontFamily: e.target.value }))}
          style={{
            padding: '9px 12px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${border}`,
            background: isDarkMode ? '#111827' : '#f9fafb',
            color: text, fontFamily: 'inherit', outline: 'none',
          }}
        >
          {FONT_OPTIONS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
        <p style={{ margin: '10px 0 0', fontSize: 14, fontFamily: form.fontFamily, color: muted }}>
          The quick brown fox jumps over the lazy dog
        </p>
      </div>

      {/* Feedback */}
      {error   && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#ef4444' }}>{error}</p>}
      {success && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#10b981' }}>{success}</p>}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
          background: loading ? '#9ca3af' : form.primaryColor,
          color: '#fff', fontSize: 14, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {loading ? 'Saving…' : 'Save Branding'}
      </button>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: muted, textAlign: 'center' }}>
        Images are saved instantly on upload. Save button applies color and font changes.
      </p>
    </div>
  );
}
