// src/pages/parent/ParentDashboard.jsx
// Read-only parent portal: attendance, homework, schedule, certificates per child.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, BookOpen, Award, LayoutDashboard, LogOut, RefreshCw, Loader2, ChevronRight, Users } from 'lucide-react';
import api from '../../api';

const F = "'Nunito','Inter',sans-serif";
const ACCENT  = 'linear-gradient(135deg,#f97316,#f43f5e)';
const FONT_URL = 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap';

const fmtDate   = (iso) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtTime   = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
const isUpcoming = (iso) => iso && new Date(iso) > new Date();

// ── Palette ───────────────────────────────────────────────────────────────────
const col = {
  bg:      '#fff8f0',
  card:    '#ffffff',
  border:  '#ffe8cc',
  heading: '#3d2e20',
  body:    '#5a4a3a',
  muted:   '#a89480',
  accent:  '#f97316',
  sidebar: '#ffffff',
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    completed:   { bg: '#f0fdf4', color: '#16a34a', label: 'Completed' },
    'in-progress':{ bg: '#eff6ff', color: '#2563eb', label: 'Live' },
    scheduled:   { bg: '#fff7ed', color: '#ea580c', label: 'Upcoming' },
    pending:     { bg: '#fefce8', color: '#ca8a04', label: 'Pending' },
    cancelled:   { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
    missed:      { bg: '#fef2f2', color: '#dc2626', label: 'Missed' },
  };
  const s = map[status] || { bg: '#f8fafc', color: '#64748b', label: status };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>
      {s.label}
    </span>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab({ child, classes, homework, certs }) {
  const upcoming  = (classes  || []).filter(b => isUpcoming(b.scheduledTime) && b.status === 'scheduled');
  const completed = (classes  || []).filter(b => b.status === 'completed').length;
  const hwDue     = (homework || []).filter(h => !h.submittedAt && h.dueDate && new Date(h.dueDate) > new Date()).length;
  const nextClass = upcoming[0];

  const stat = (icon, label, value, sub) => (
    <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: '20px 22px' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: col.heading }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: col.body, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: col.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 900, color: col.heading }}>
        Overview — {child?.firstName} {child?.lastName}
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14, marginBottom: 28 }}>
        {stat('📚', 'Class Credits', child?.classCredits ?? '—', 'remaining')}
        {stat('✅', 'Classes Done', completed, 'all time')}
        {stat('📅', 'Upcoming', upcoming.length, 'classes')}
        {stat('📝', 'Homework Due', hwDue, 'assignments')}
        {stat('🏆', 'Certificates', certs?.length ?? 0, 'earned')}
      </div>

      {nextClass && (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 22, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Next Class</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: 16, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={22} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: col.heading }}>{nextClass.classTitle || nextClass.topic || 'English Class'}</div>
              <div style={{ fontSize: 13, color: col.muted, marginTop: 2 }}>
                {fmtDate(nextClass.scheduledTime)} at {fmtTime(nextClass.scheduledTime)}
                {nextClass.teacherId && ` · ${nextClass.teacherId.firstName} ${nextClass.teacherId.lastName}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent homework */}
      {homework?.length > 0 && (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: col.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>Recent Homework</div>
          {homework.slice(0, 4).map(hw => (
            <div key={hw._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${col.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: col.heading }}>{hw.title}</div>
                <div style={{ fontSize: 11, color: col.muted }}>Due: {hw.dueDate ? fmtDate(hw.dueDate) : 'No deadline'}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, background: hw.submittedAt ? '#f0fdf4' : '#fff7ed', color: hw.submittedAt ? '#16a34a' : '#ea580c', borderRadius: 999, padding: '2px 8px' }}>
                {hw.submittedAt ? 'Submitted' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Classes tab ───────────────────────────────────────────────────────────────
function ClassesTab({ classes, loading }) {
  const [view, setView] = useState('upcoming'); // upcoming | past
  const filtered = (classes || []).filter(b =>
    view === 'upcoming'
      ? isUpcoming(b.scheduledTime) && !['cancelled','completed','missed'].includes(b.status)
      : ['completed','missed','cancelled'].includes(b.status) || (!isUpcoming(b.scheduledTime) && b.status !== 'scheduled')
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['upcoming','past'].map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ background: view === v ? 'linear-gradient(135deg,#f97316,#f43f5e)' : col.card, color: view === v ? '#fff' : col.body, border: `2px solid ${view === v ? 'transparent' : col.border}`, borderRadius: 12, padding: '7px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: F, textTransform: 'capitalize' }}>
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 60, textAlign: 'center', color: col.muted, fontWeight: 700 }}>
          No {view} classes
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(b => (
            <div key={b._id} style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Calendar size={20} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: col.heading }}>{b.classTitle || b.topic || 'English Class'}</div>
                <div style={{ fontSize: 12, color: col.muted, marginTop: 2 }}>
                  {fmtDate(b.scheduledTime)} at {fmtTime(b.scheduledTime)}
                  {b.duration && ` · ${b.duration} min`}
                  {b.teacherId && ` · ${b.teacherId.firstName} ${b.teacherId.lastName}`}
                </div>
              </div>
              <StatusBadge status={b.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Homework tab ──────────────────────────────────────────────────────────────
function HomeworkTab({ homework, loading }) {
  return (
    <div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : !homework?.length ? (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 60, textAlign: 'center', color: col.muted, fontWeight: 700 }}>
          No homework assigned yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {homework.map(hw => {
            const submitted = !!hw.submittedAt;
            const overdue   = !submitted && hw.dueDate && new Date(hw.dueDate) < new Date();
            return (
              <div key={hw._id} style={{ background: col.card, border: `2px solid ${overdue ? '#fecaca' : col.border}`, borderRadius: 18, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: col.heading }}>{hw.title}</div>
                    {hw.description && <div style={{ fontSize: 12, color: col.body, marginTop: 4 }}>{hw.description.slice(0, 120)}</div>}
                    <div style={{ fontSize: 11, color: col.muted, marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {hw.dueDate && <span>📅 Due: {fmtDate(hw.dueDate)}</span>}
                      {hw.teacherId && <span>👨‍🏫 {hw.teacherId.firstName} {hw.teacherId.lastName}</span>}
                      {submitted && <span>✅ Submitted: {fmtDate(hw.submittedAt)}</span>}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, background: submitted ? '#f0fdf4' : overdue ? '#fef2f2' : '#fff7ed', color: submitted ? '#16a34a' : overdue ? '#dc2626' : '#ea580c', borderRadius: 999, padding: '3px 10px' }}>
                      {submitted ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                    </span>
                    {typeof hw.grade === 'number' && (
                      <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900, color: col.accent }}>{hw.grade}<span style={{ fontSize: 11, color: col.muted }}>/100</span></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Certificates tab ──────────────────────────────────────────────────────────
function CertificatesTab({ certs, loading }) {
  return (
    <div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : !certs?.length ? (
        <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 60, textAlign: 'center' }}>
          <Award size={48} color={col.muted} style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 15, fontWeight: 800, color: col.heading, margin: '0 0 6px' }}>No certificates yet</p>
          <p style={{ fontSize: 13, color: col.muted }}>Certificates are awarded at 10, 25, 50, and 100 completed classes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {certs.map(cert => (
            <div key={cert._id} style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: ACCENT }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, paddingTop: 6 }}>
                <div style={{ width: 50, height: 50, borderRadius: 16, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Award size={24} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: col.heading }}>{cert.title}</div>
                  {cert.description && <div style={{ fontSize: 13, color: col.body, marginTop: 3 }}>{cert.description}</div>}
                  <div style={{ fontSize: 11, color: col.muted, marginTop: 6, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>📅 {fmtDate(cert.issuedAt)}</span>
                    <span>🔖 {cert.certificateNumber}</span>
                    {cert.classesCompleted > 0 && <span>📚 {cert.classesCompleted} classes</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
const NAV = [
  { key: 'overview',      label: 'Overview',      icon: LayoutDashboard },
  { key: 'classes',       label: 'Classes',        icon: Calendar        },
  { key: 'homework',      label: 'Homework',       icon: BookOpen        },
  { key: 'certificates',  label: 'Certificates',   icon: Award           },
];

export default function ParentDashboard() {
  const navigate = useNavigate();

  const [parent,       setParent]       = useState(null);
  const [children,     setChildren]     = useState([]);
  const [selectedId,   setSelectedId]   = useState(null);
  const [activeTab,    setActiveTab]    = useState('overview');
  const [authLoading,  setAuthLoading]  = useState(true);

  const [classes,    setClasses]    = useState([]);
  const [homework,   setHomework]   = useState([]);
  const [certs,      setCerts]      = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  const selectedChild = children.find(c => c._id === selectedId);

  // Auth check + load profile
  useEffect(() => {
    const token = sessionStorage.getItem('parentToken');
    if (!token) { navigate('/parent/login'); return; }
    api.get('/parents/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setParent(res.data.parent);
        const kids = res.data.children || [];
        setChildren(kids);
        if (kids.length > 0) setSelectedId(kids[0]._id);
      })
      .catch(() => {
        sessionStorage.removeItem('parentToken');
        sessionStorage.removeItem('parentInfo');
        navigate('/parent/login');
      })
      .finally(() => setAuthLoading(false));
  }, []);

  // Fetch data when child or tab changes
  const fetchTabData = useCallback(async (studentId, tab) => {
    if (!studentId) return;
    const token = sessionStorage.getItem('parentToken');
    const headers = { Authorization: `Bearer ${token}` };
    setTabLoading(true);
    try {
      if (tab === 'overview' || tab === 'classes') {
        const r = await api.get(`/parents/me/child/${studentId}/classes`, { headers });
        setClasses(r.data.bookings || []);
      }
      if (tab === 'overview' || tab === 'homework') {
        const r = await api.get(`/parents/me/child/${studentId}/homework`, { headers });
        setHomework(r.data.homework || []);
      }
      if (tab === 'overview' || tab === 'certificates') {
        const r = await api.get(`/parents/me/child/${studentId}/certificates`, { headers });
        setCerts(r.data.certificates || []);
      }
    } catch { /* fail silently — tab will show empty state */ }
    setTabLoading(false);
  }, []);

  useEffect(() => {
    if (selectedId) fetchTabData(selectedId, activeTab);
  }, [selectedId, activeTab]);

  const handleLogout = () => {
    sessionStorage.removeItem('parentToken');
    sessionStorage.removeItem('parentInfo');
    navigate('/parent/login');
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: col.bg }}>
        <Loader2 size={36} color={col.accent} style={{ animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const tabContent = () => {
    switch (activeTab) {
      case 'overview':     return <OverviewTab child={selectedChild} classes={classes} homework={homework} certs={certs} />;
      case 'classes':      return <ClassesTab classes={classes} loading={tabLoading} />;
      case 'homework':     return <HomeworkTab homework={homework} loading={tabLoading} />;
      case 'certificates': return <CertificatesTab certs={certs} loading={tabLoading} />;
      default:             return null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: F, background: col.bg }}>
      <style>{`
        @import url('${FONT_URL}');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .p-nav:hover { background: rgba(249,115,22,0.08) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #ffe8cc; border-radius: 10px; }
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside style={{ width: 228, flexShrink: 0, background: col.sidebar, borderRight: `2px solid ${col.border}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 14px', borderBottom: `2px solid ${col.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>👨‍👩‍👧</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: col.heading }}>Parent Portal</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>{parent?.firstName} {parent?.lastName}</div>
            </div>
          </div>
        </div>

        {/* Child switcher */}
        {children.length > 0 && (
          <div style={{ padding: '14px 10px 8px', borderBottom: `2px solid ${col.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 6px 6px' }}>Your Children</div>
            {children.map(child => (
              <button key={child._id} className="p-nav"
                onClick={() => { setSelectedId(child._id); setActiveTab('overview'); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: F, textAlign: 'left', background: selectedId === child._id ? 'rgba(249,115,22,0.12)' : 'transparent', borderLeft: selectedId === child._id ? '3px solid #f97316' : '3px solid transparent', marginBottom: 2 }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                  {child.firstName?.[0]?.toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: selectedId === child._id ? '#f97316' : col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {child.firstName} {child.lastName}
                  </div>
                  <div style={{ fontSize: 10, color: col.muted, fontWeight: 600 }}>{child.classCredits ?? 0} credits</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 8px' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: '.08em', textTransform: 'uppercase', padding: '6px 8px 4px' }}>Dashboard</div>
          {NAV.map(item => {
            const active = activeTab === item.key;
            const Icon = item.icon;
            return (
              <button key={item.key} className="p-nav"
                onClick={() => setActiveTab(item.key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: F, textAlign: 'left', background: active ? 'rgba(249,115,22,0.12)' : 'transparent', borderLeft: active ? '3px solid #f97316' : '3px solid transparent', marginBottom: 2 }}>
                <Icon size={17} strokeWidth={1.8} color={active ? '#f97316' : col.body} />
                <span style={{ fontSize: 13, fontWeight: active ? 800 : 600, color: active ? '#f97316' : col.body }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '8px 8px 16px', borderTop: `2px solid ${col.border}` }}>
          <button className="p-nav" onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 14, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ height: 64, background: col.sidebar, borderBottom: `2px solid ${col.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 14, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: col.heading, fontFamily: F }}>
              {NAV.find(n => n.key === activeTab)?.label || 'Overview'}
            </h1>
            {selectedChild && (
              <p style={{ margin: 0, fontSize: 12, color: col.muted, fontWeight: 600 }}>
                {selectedChild.firstName} {selectedChild.lastName}
              </p>
            )}
          </div>
          <button onClick={() => fetchTabData(selectedId, activeTab)}
            style={{ background: 'none', border: `1.5px solid ${col.border}`, borderRadius: 10, padding: '7px 10px', cursor: 'pointer' }}>
            <RefreshCw size={15} color={col.muted} />
          </button>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 15, flexShrink: 0 }}>
            {parent?.firstName?.[0]?.toUpperCase() || 'P'}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children.length === 0 ? (
            <div style={{ background: col.card, border: `2px solid ${col.border}`, borderRadius: 20, padding: 60, textAlign: 'center' }}>
              <Users size={48} color={col.muted} style={{ margin: '0 auto 16px' }} />
              <p style={{ fontSize: 16, fontWeight: 800, color: col.heading, margin: '0 0 6px' }}>No children linked yet</p>
              <p style={{ fontSize: 13, color: col.muted }}>Contact your child's school to link your account.</p>
            </div>
          ) : (
            tabContent()
          )}
        </main>
      </div>
    </div>
  );
}
