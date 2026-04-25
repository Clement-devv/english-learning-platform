// src/pages/admin/tabs/CertificatesTab.jsx
// Admin view: browse all certificates, manually award, download PDF, revoke.
import React, { useState, useEffect, useCallback } from 'react';
import { Award, Download, Plus, Trash2, RefreshCw, Loader2, Search } from 'lucide-react';
import api from '../../../api';

const F = "'Nunito','Inter',sans-serif";

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CertificatesTab({ isDarkMode }) {
  const col = {
    card:    isDarkMode ? '#1a1d2e' : '#ffffff',
    border:  isDarkMode ? '#2a2d40' : '#ffe8cc',
    heading: isDarkMode ? '#f0f4ff' : '#3d2e20',
    body:    isDarkMode ? '#c8cce0' : '#5a4a3a',
    muted:   isDarkMode ? '#6b7090' : '#a89480',
    accent:  isDarkMode ? '#fbbf24' : '#f97316',
    input:   isDarkMode ? '#0f1117' : '#fff8f0',
  };

  const [certs,       setCerts]       = useState([]);
  const [students,    setStudents]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [msg,         setMsg]         = useState('');
  const [search,      setSearch]      = useState('');

  // Award modal
  const [showAward,   setShowAward]   = useState(false);
  const [awardForm,   setAwardForm]   = useState({ studentId: '', title: '', description: '' });
  const [awarding,    setAwarding]    = useState(false);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        api.get('/certificates'),
        api.get('/students'),
      ]);
      setCerts(cRes.data.certificates || []);
      setStudents(sRes.data?.students || sRes.data || []);
    } catch {
      flash('Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      flash('Failed to download PDF');
    } finally {
      setDownloading(null);
    }
  };

  const handleRevoke = async (cert) => {
    if (!window.confirm(`Revoke certificate "${cert.certificateNumber}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/certificates/${cert._id}`);
      flash('Certificate revoked');
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to revoke');
    }
  };

  const handleAward = async () => {
    if (!awardForm.studentId || !awardForm.title) return flash('Select student and enter title');
    setAwarding(true);
    try {
      await api.post('/certificates', awardForm);
      flash('Certificate awarded');
      setShowAward(false);
      setAwardForm({ studentId: '', title: '', description: '' });
      load();
    } catch (e) {
      flash(e.response?.data?.message || 'Failed to award');
    } finally {
      setAwarding(false);
    }
  };

  const inp  = { width: '100%', background: col.input, border: `1.5px solid ${col.border}`, borderRadius: 12, padding: '9px 12px', fontSize: 14, color: col.body, fontFamily: F, outline: 'none' };
  const btn  = (grad, text='#fff', disabled=false) => ({ background: disabled ? (isDarkMode ? '#2a2d40' : '#f5f0ec') : grad, color: disabled ? col.muted : text, border: 'none', borderRadius: 12, padding: '8px 16px', fontSize: 13, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', fontFamily: F, display: 'flex', alignItems: 'center', gap: 5 });

  const filtered = certs.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = c.studentId ? `${c.studentId.firstName} ${c.studentId.lastName}`.toLowerCase() : '';
    return name.includes(q) || c.certificateNumber?.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q);
  });

  return (
    <div style={{ fontFamily: F }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: col.heading }}>Certificates</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: col.muted }}>{certs.length} issued</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={14} color={col.muted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student or cert #..."
            style={{ ...inp, paddingLeft: 30, width: 220 }} />
        </div>
        <button onClick={load} style={{ ...btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body), padding: '8px 10px' }}><RefreshCw size={14} /></button>
        <button onClick={() => setShowAward(true)} style={btn('linear-gradient(135deg,#f97316,#f43f5e)')}>
          <Plus size={14} /> Award Certificate
        </button>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith('Failed') ? '#fef2f2' : '#f0fdf4', border: `1.5px solid ${msg.startsWith('Failed') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 700, color: msg.startsWith('Failed') ? '#dc2626' : '#16a34a' }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={32} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 60, textAlign: 'center' }}>
          <Award size={40} color={col.muted} style={{ margin: '0 auto 12px' }} />
          <p style={{ color: col.muted, fontWeight: 700 }}>No certificates yet</p>
        </div>
      ) : (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 100px 90px 80px', gap: 12, padding: '10px 18px', background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#fff8f0', borderBottom: `1.5px solid ${col.border}`, fontSize: 11, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            <span>Student</span><span>Certificate</span><span>Cert #</span><span>Issued</span><span>Type</span><span>Actions</span>
          </div>
          {filtered.map(cert => {
            const student = cert.studentId;
            const revoked = !!cert.revokedAt;
            return (
              <div key={cert._id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 100px 90px 80px', gap: 12, padding: '13px 18px', borderBottom: `1px solid ${col.border}`, alignItems: 'center', opacity: revoked ? 0.5 : 1 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: col.body }}>
                  {student ? `${student.firstName} ${student.lastName}` : '—'}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: col.heading }}>{cert.title}</div>
                  {cert.description && <div style={{ fontSize: 11, color: col.muted, marginTop: 1 }}>{cert.description}</div>}
                </div>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: col.muted }}>{cert.certificateNumber}</span>
                <span style={{ fontSize: 12, color: col.muted }}>{fmtDate(cert.issuedAt)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, background: cert.type === 'manual' ? (isDarkMode ? 'rgba(139,92,246,0.15)' : '#f3e8ff') : (isDarkMode ? 'rgba(16,185,129,0.12)' : '#f0fdf4'), color: cert.type === 'manual' ? '#8b5cf6' : '#16a34a', borderRadius: 999, padding: '3px 8px', textAlign: 'center' }}>
                  {cert.type}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => handleDownload(cert)} disabled={downloading === cert._id || revoked}
                    title="Download PDF"
                    style={{ background: 'none', border: `1px solid ${col.border}`, borderRadius: 8, padding: '5px 7px', cursor: revoked ? 'default' : 'pointer' }}>
                    {downloading === cert._id
                      ? <Loader2 size={13} color={col.muted} style={{ animation: 'spin .7s linear infinite' }} />
                      : <Download size={13} color={col.accent} />}
                  </button>
                  {!revoked && (
                    <button onClick={() => handleRevoke(cert)} title="Revoke"
                      style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 7px', cursor: 'pointer' }}>
                      <Trash2 size={13} color="#ef4444" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Award Modal ── */}
      {showAward && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div style={{ background: col.card, borderRadius: 24, padding: 28, width: '100%', maxWidth: 460, fontFamily: F }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1 }}>Award Certificate</h3>
              <button onClick={() => setShowAward(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Student *</label>
                <select value={awardForm.studentId} onChange={e => setAwardForm(p => ({ ...p, studentId: e.target.value }))} style={{ ...inp, marginTop: 4 }}>
                  <option value="">Select student</option>
                  {students.map(s => <option key={s._id} value={s._id}>{s.firstName} {s.lastName}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Certificate Title *</label>
                <input value={awardForm.title} onChange={e => setAwardForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Special Achievement Award" style={{ ...inp, marginTop: 4 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Description</label>
                <textarea value={awardForm.description} onChange={e => setAwardForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ ...inp, marginTop: 4, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAward(false)} style={btn(isDarkMode ? '#2a2d40' : '#f5f0ec', col.body)}>Cancel</button>
              <button onClick={handleAward} disabled={awarding} style={btn('linear-gradient(135deg,#f97316,#f43f5e)')}>
                {awarding ? 'Awarding…' : 'Award Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
