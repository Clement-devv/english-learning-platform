import { Building2, RefreshCw, Palette, ToggleRight, SlidersHorizontal, LogIn, Trash2, Globe } from 'lucide-react';
import styles from '../SuperAdmin.module.css';

export default function CentersTab({
  centers, loading, loadData, setShowModal,
  handleApprove, handleReject, handleSuspend, handleEnterAsAdmin, impersonating,
  setDeleteTarget, setPlanModal, setPlanSelected, setPlanMsg,
  setThemeCenter, handleOpenLoginThemeModal, handleOpenTeacherThemeModal, handleOpenAdminLoginThemeModal, handleOpenDashThemeModal,
  setFeaturesCenter,
  setLimitsModal, setLimitsUnlimT, setLimitsUnlimS, setLimitsTeachers, setLimitsStudents, setLimitsMsg,
  statusColor, statusIcon,
  onEditWebsite,
}) {
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
