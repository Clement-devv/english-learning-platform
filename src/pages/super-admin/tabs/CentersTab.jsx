import { useState } from 'react';
import { Building2, RefreshCw, Palette, ToggleRight, SlidersHorizontal, LogIn, Trash2, Globe, Users, KeyRound, Copy, Check } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/v1';

export default function CentersTab({
  centers, loading, loadData, setShowModal,
  handleApprove, handleReject, handleSuspend, handleEnterAsAdmin, impersonating,
  setDeleteTarget, setPlanModal, setPlanSelected, setPlanMsg,
  setThemeCenter, handleOpenLoginThemeModal, handleOpenTeacherThemeModal, handleOpenAdminLoginThemeModal, handleOpenDashThemeModal,
  setFeaturesCenter,
  setLimitsModal, setLimitsUnlimT, setLimitsUnlimS, setLimitsTeachers, setLimitsStudents, setLimitsMsg,
  setPartnershipModal,
  statusColor, statusIcon,
  onEditWebsite,
}) {
  const [overrideCenter,  setOverrideCenter]  = useState(null);
  const [overrideEmail,   setOverrideEmail]   = useState('');
  const [overrideReason,  setOverrideReason]  = useState('');
  const [overrideStep,    setOverrideStep]     = useState('form'); // 'form' | 'confirm'
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMsg,     setOverrideMsg]      = useState(null);  // { type: 'success'|'error', text }
  const [copiedCode,      setCopiedCode]       = useState(false);

  const openOverride = (center) => {
    setOverrideCenter(center);
    setOverrideEmail('');
    setOverrideReason('');
    setOverrideStep('form');
    setOverrideMsg(null);
  };

  const closeOverride = () => {
    if (overrideLoading) return;
    setOverrideCenter(null);
    setOverrideMsg(null);
  };

  const submitOverride = async () => {
    setOverrideLoading(true);
    setOverrideMsg(null);
    try {
      const token = localStorage.getItem('superAdminToken');
      const res   = await fetch(`${API_BASE}/super-admin/centers/${overrideCenter._id}/override-email`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ newEmail: overrideEmail, reason: overrideReason }),
      });
      const data = await res.json();
      if (data.success) {
        setOverrideMsg({ type: 'success', text: `Email updated to ${data.newEmail}. Both addresses have been notified.` });
        setOverrideStep('form');
        loadData(); // refresh centers list
      } else {
        setOverrideMsg({ type: 'error', text: data.message || 'Override failed' });
        setOverrideStep('form');
      }
    } catch (e) {
      setOverrideMsg({ type: 'error', text: 'Network error — please try again' });
      setOverrideStep('form');
    } finally {
      setOverrideLoading(false);
    }
  };

  const copyRecoveryCode = () => {
    if (!overrideCenter?.recoveryCode) return;
    navigator.clipboard.writeText(overrideCenter.recoveryCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }).catch(() => {
      // Clipboard API unavailable (non-HTTPS or denied) — select the text as fallback
      try {
        const el = document.createElement('textarea');
        el.value = overrideCenter.recoveryCode;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } catch { /* execCommand also failed — user can copy manually */ }
    });
  };

  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 className={styles.sectionTitle}><Building2 size={16} color="#f59e0b" /> All Centers</h2>
        <button onClick={loadData} className={styles.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
      ) : centers.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          No centers yet.{' '}
          <button onClick={() => setShowModal(true)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontWeight: '600' }}>
            Create one →
          </button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                {['Center', 'Slug', 'Plan', 'Status', 'Website', 'Actions'].map(h => (
                  <th key={h} className={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {centers.map(c => (
                <tr key={c._id} className={styles.tr}>
                  <td className={styles.td}>
                    <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{c.centerName}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{c.adminEmail}</p>
                  </td>
                  <td className={styles.td}><code className={styles.slug}>{c.slug}</code></td>
                  <td className={styles.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={styles.planBadge}>{c.plan || 'basic'}</span>
                      <button
                        onClick={() => { setPlanModal(c); setPlanSelected(c.plan || 'basic'); setPlanMsg(''); }}
                        title="Change plan"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                      >✏️</button>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.statusBadge} style={{ color: statusColor(c.status), borderColor: `${statusColor(c.status)}40`, background: `${statusColor(c.status)}12` }}>
                      {statusIcon(c.status)} {c.status}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <WebsiteCell center={c} onEdit={onEditWebsite} />
                  </td>
                  <td className={styles.td}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {c.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(c._id)} className={styles.approveBtn}>Approve</button>
                          <button onClick={() => handleReject(c._id)}  className={styles.rejectBtn}>Reject</button>
                        </>
                      )}
                      {c.status === 'active' && (
                        <button onClick={() => handleSuspend(c._id)} className={styles.suspendBtn}>Suspend</button>
                      )}
                      {(c.status === 'rejected' || c.status === 'suspended') && (
                        <button onClick={() => handleApprove(c._id)} className={styles.approveBtn}>Reactivate</button>
                      )}
                      <button onClick={() => setThemeCenter(c)} className={styles.themeBtn} title="Set theme">
                        <Palette size={12} /> Theme
                      </button>
                      <button
                        onClick={() => handleOpenLoginThemeModal(c)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', cursor: 'pointer', fontFamily: 'inherit' }}
                        title="Assign exclusive student login page theme"
                      >
                        <Palette size={12} /> Student Login
                      </button>
                      <button
                        onClick={() => handleOpenTeacherThemeModal(c)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', color: '#22d3ee', cursor: 'pointer', fontFamily: 'inherit' }}
                        title="Assign exclusive teacher login page theme"
                      >
                        <Palette size={12} /> Teacher Login
                      </button>
                      <button
                        onClick={() => handleOpenAdminLoginThemeModal(c)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', cursor: 'pointer', fontFamily: 'inherit' }}
                        title="Assign exclusive admin login page theme"
                      >
                        <Palette size={12} /> Admin Login
                      </button>
                      <button
                        onClick={() => handleOpenDashThemeModal(c)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4', cursor: 'pointer', fontFamily: 'inherit' }}
                        title="Assign exclusive student dashboard theme"
                      >
                        <Palette size={12} /> Dashboard
                      </button>
                      <button onClick={() => setFeaturesCenter(c)} className={styles.featuresBtn} title="Toggle features">
                        <ToggleRight size={12} /> Features
                      </button>
                      <button
                        onClick={() => {
                          setLimitsModal(c);
                          setLimitsUnlimT(c.maxTeachers === -1);
                          setLimitsUnlimS(c.maxStudents === -1);
                          setLimitsTeachers(c.maxTeachers === -1 ? '' : String(c.maxTeachers || ''));
                          setLimitsStudents(c.maxStudents === -1 ? '' : String(c.maxStudents || ''));
                          setLimitsMsg('');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.2)', color: '#fb923c', cursor: 'pointer', fontFamily: 'inherit' }}
                        title="Edit seat limits"
                      >
                        <SlidersHorizontal size={12} /> Limits
                      </button>
                      <button
                        onClick={() => setPartnershipModal(c)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', color: '#a78bfa', cursor: 'pointer', fontFamily: 'inherit' }}
                        title="Set partnership text"
                      >
                        <Users size={12} /> Partnership
                      </button>
                      {c.status === 'active' && (
                        <button
                          onClick={() => handleEnterAsAdmin(c)}
                          disabled={impersonating === c._id}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer', fontFamily: 'inherit' }}
                          title="Open admin panel for this center (30 min session)"
                        >
                          <LogIn size={12} /> {impersonating === c._id ? '…' : 'Enter'}
                        </button>
                      )}
                      <button
                        onClick={() => openOverride(c)}
                        title="Emergency: override admin login email"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <KeyRound size={12} /> Email
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className={styles.deleteBtn} title="Schedule deletion">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    <>
    {/* ── Emergency Email Override Modal ──────────────────────────────────── */}
    {overrideCenter && (
      <div
        onClick={closeOverride}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#1a1d2e', border: '1px solid #2a2d40', borderRadius: '18px',
            padding: '28px 30px', maxWidth: '480px', width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <KeyRound size={17} color="#f87171" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#f1f5f9' }}>
                Emergency Email Override
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                {overrideCenter.centerName}
              </p>
            </div>
          </div>

          {/* Recovery Code */}
          {overrideCenter.recoveryCode && (
            <div style={{ background: '#0f1117', border: '1px solid #2a2d40', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>Recovery code</span>
              <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#a5b4fc', flex: 1, letterSpacing: '0.06em' }}>
                {overrideCenter.recoveryCode}
              </span>
              <button
                onClick={copyRecoveryCode}
                title="Copy recovery code"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedCode ? '#34d399' : '#6b7280', display: 'flex', padding: '2px' }}
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}

          {/* Current email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current email
            </label>
            <div style={{ padding: '10px 12px', background: '#0f1117', border: '1px solid #2a2d40', borderRadius: '8px', fontSize: '13px', color: '#94a3b8' }}>
              {overrideCenter.adminEmail}
            </div>
          </div>

          {overrideStep === 'form' && (
            <>
              {overrideMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: 600, background: overrideMsg.type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: overrideMsg.type === 'success' ? '#34d399' : '#f87171', border: `1px solid ${overrideMsg.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                  {overrideMsg.text}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  New email *
                </label>
                <input
                  type="email"
                  value={overrideEmail}
                  onChange={e => setOverrideEmail(e.target.value)}
                  placeholder="new@email.com"
                  style={{ width: '100%', padding: '10px 12px', background: '#0f1117', border: '1px solid #2a2d40', borderRadius: '8px', color: '#e8eaf6', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Reason (required, min 10 chars) *
                </label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="e.g. Admin reported account compromise — verified via recovery code XXXX"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f1117', border: '1px solid #2a2d40', borderRadius: '8px', color: '#e8eaf6', fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={closeOverride}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #2a2d40', background: 'transparent', color: '#6b7280', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!overrideEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(overrideEmail)) {
                      setOverrideMsg({ type: 'error', text: 'Please enter a valid new email' });
                      return;
                    }
                    if (!overrideReason || overrideReason.trim().length < 10) {
                      setOverrideMsg({ type: 'error', text: 'Please enter a reason (min 10 characters)' });
                      return;
                    }
                    setOverrideMsg(null);
                    setOverrideStep('confirm');
                  }}
                  style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Override Email →
                </button>
              </div>
            </>
          )}

          {overrideStep === 'confirm' && (
            <>
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#f1f5f9', fontWeight: 700 }}>
                  Confirm override for <em>{overrideCenter.centerName}</em>
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8' }}>
                  <strong>From:</strong> {overrideCenter.adminEmail}
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#94a3b8' }}>
                  <strong>To:</strong> {overrideEmail}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                  <strong>Reason:</strong> {overrideReason}
                </p>
              </div>
              <p style={{ margin: '0 0 18px', fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
                All active admin sessions will be signed out. Both email addresses will receive a notification. This action is audit-logged.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setOverrideStep('form'); setOverrideMsg(null); }}
                  disabled={overrideLoading}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #2a2d40', background: 'transparent', color: '#6b7280', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Back
                </button>
                <button
                  onClick={submitOverride}
                  disabled={overrideLoading}
                  style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: overrideLoading ? '#374151' : 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', fontSize: '13px', fontWeight: 800, cursor: overrideLoading ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                >
                  {overrideLoading ? 'Overriding…' : 'Yes, Override Email'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}

function WebsiteCell({ center, onEdit }) {
  const lp        = center.landingPage;
  const published = lp?.published;
  const template  = lp?.template;
  const hasPage   = lp && (lp.hero?.headline || lp.about?.body || lp.teachers?.length);

  let badge, badgeColor, badgeBg;
  if (published) {
    badge = 'Live'; badgeColor = '#10b981'; badgeBg = 'rgba(16,185,129,0.1)';
  } else if (hasPage) {
    badge = 'Draft'; badgeColor = '#f59e0b'; badgeBg = 'rgba(245,158,11,0.1)';
  } else {
    badge = 'None'; badgeColor = '#64748b'; badgeBg = 'rgba(100,116,139,0.08)';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
        color: badgeColor, background: badgeBg,
        border: `1px solid ${badgeColor}30`,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {badge}
      </span>
      {template && published && (
        <span style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>
          {template}
        </span>
      )}
      {onEdit && (
        <button
          onClick={() => onEdit(center)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(99,102,241,0.25)',
            background: 'rgba(99,102,241,0.08)', color: '#818cf8',
            cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          <Globe size={11} /> Edit
        </button>
      )}
    </div>
  );
}
