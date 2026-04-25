// src/pages/student/tabs/CertificatesTab.jsx
// Student view: list earned certificates, download PDF, preview details.
import React, { useState, useEffect } from 'react';
import { Award, Download, RefreshCw, Loader2, Shield } from 'lucide-react';
import api from '../../../api';

const F = "'Nunito','Inter',sans-serif";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

function CertCard({ cert, isDarkMode, onDownload, downloading }) {
  const col = {
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    body:    isDarkMode ? '#c8cce0' : '#5a4a3a',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
  };

  return (
    <div style={{
      background: col.card,
      border: `2px solid ${col.border}`,
      borderRadius: 20, padding: 20,
      fontFamily: F, position: 'relative', overflow: 'hidden',
    }}>
      {/* Accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg,#f97316,#f43f5e)' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, paddingTop: 6 }}>
        {/* Icon */}
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg,#f97316,#f43f5e)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Award size={26} color="#fff" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: col.heading, marginBottom: 4 }}>{cert.title}</div>
          {cert.description && (
            <div style={{ fontSize: 13, color: col.body, marginBottom: 6 }}>{cert.description}</div>
          )}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: col.muted, fontWeight: 600 }}>
            <span>📅 {fmtDate(cert.issuedAt)}</span>
            {cert.classesCompleted > 0 && <span>📚 {cert.classesCompleted} classes completed</span>}
            <span>🔖 {cert.certificateNumber}</span>
          </div>
        </div>

        <button
          onClick={() => onDownload(cert)}
          disabled={downloading === cert._id}
          style={{
            background: 'linear-gradient(135deg,#f97316,#f43f5e)',
            color: '#fff', border: 'none', borderRadius: 12,
            padding: '8px 16px', fontSize: 13, fontWeight: 800,
            cursor: downloading === cert._id ? 'default' : 'pointer',
            fontFamily: F, display: 'flex', alignItems: 'center', gap: 5,
            opacity: downloading === cert._id ? 0.7 : 1, flexShrink: 0,
          }}
        >
          {downloading === cert._id
            ? <><Loader2 size={13} style={{ animation: 'spin .7s linear infinite' }} /> Generating…</>
            : <><Download size={13} /> Download PDF</>}
        </button>
      </div>
    </div>
  );
}

export default function CertificatesTab({ isDarkMode }) {
  const col = {
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
  };

  const [certs,       setCerts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [msg,         setMsg]         = useState('');

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/certificates');
      setCerts(res.data.certificates || []);
    } catch {
      flash('Failed to load certificates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDownload = async (cert) => {
    setDownloading(cert._id);
    try {
      const res = await api.get(`/certificates/${cert._id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${cert.certificateNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      flash('Failed to download PDF. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div style={{ fontFamily: F }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>My Certificates</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>
            {certs.length} certificate{certs.length !== 1 ? 's' : ''} earned
          </p>
        </div>
        <button onClick={load} style={{ background: 'none', border: `1.5px solid ${col.border}`, borderRadius: 10, padding: '7px 10px', cursor: 'pointer' }}>
          <RefreshCw size={15} color={col.muted} />
        </button>
      </div>

      {msg && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : certs.length === 0 ? (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 60, textAlign: 'center' }}>
          <Award size={48} color={col.muted} style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 16, fontWeight: 800, color: col.heading, margin: '0 0 6px' }}>No certificates yet</p>
          <p style={{ fontSize: 13, color: col.muted, margin: 0 }}>
            Complete classes to earn certificates. Milestones are reached at 10, 25, 50, and 100 classes.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {certs.map(cert => (
            <CertCard
              key={cert._id}
              cert={cert}
              isDarkMode={isDarkMode}
              onDownload={handleDownload}
              downloading={downloading}
            />
          ))}
        </div>
      )}

      {/* Upcoming milestones hint */}
      {certs.length > 0 && (
        <div style={{ marginTop: 24, background: isDarkMode ? 'rgba(249,115,22,0.06)' : '#fff7ed', border: `1.5px solid ${isDarkMode ? 'rgba(249,115,22,0.18)' : '#fed7aa'}`, borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Shield size={18} color={col.accent} />
          <p style={{ margin: 0, fontSize: 13, color: col.muted, fontWeight: 600 }}>
            All certificates are digitally signed and verifiable. Share your certificate number with employers or parents to verify authenticity.
          </p>
        </div>
      )}
    </div>
  );
}
