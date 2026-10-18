// src/pages/super-admin/tabs/CentersTab.jsx
// Super admin → Centers. Paged list (20 a page, pending first) with status tabs,
// search and plan filter; each row shows plan, seat usage, App Health signals and
// website state. Everything else lives in the "Manage" side panel.
// Server: GET /api/v1/super-admin/centers?page&status&plan&q&withUsage=1
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2, RefreshCw, Palette, ToggleRight, SlidersHorizontal, LogIn, Trash2, Globe, Users, KeyRound, Copy, Check, Video,
  Search, Settings2, CheckCircle, XCircle, Crown, ChevronRight, X, PauseCircle, RotateCcw, LayoutDashboard, Send,
} from 'lucide-react';
import Pagination from '../../../components/Pagination';
import styles from '../SuperAdmin.module.css';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/v1';

export default function CentersTab({
  centers, loadData, setShowModal, apiBase = API_BASE, authHeaders,
  handleApprove, handleReject, handleSuspend, handleEnterAsAdmin, impersonating,
  setDeleteTarget, setPlanModal, setPlanSelected, setPlanMsg,
  setThemeCenter, handleOpenLoginThemeModal, handleOpenTeacherThemeModal, handleOpenAdminLoginThemeModal, handleOpenDashThemeModal,
  handleOpenClassroomThemeModal,
  setFeaturesCenter,
  setLimitsModal, setLimitsUnlimT, setLimitsUnlimS, setLimitsTeachers, setLimitsStudents, setLimitsMsg,
  setPartnershipModal,
  onEditWebsite,
  openCenter = null,   // { id, n } — open this center's Manage panel (search / overview)
}) {
  const [overrideCenter,  setOverrideCenter]  = useState(null);
  const [overrideEmail,   setOverrideEmail]   = useState('');
  const [overrideReason,  setOverrideReason]  = useState('');
  const [overrideStep,    setOverrideStep]     = useState('form'); // 'form' | 'confirm'
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideMsg,     setOverrideMsg]      = useState(null);  // { type: 'success'|'error', text }
  const [copiedCode,      setCopiedCode]       = useState(false);

  // ── The paged list ──────────────────────────────────────────────────────────
  const [status, setStatus]   = useState('all');
  const [plan, setPlan]       = useState('');
  const [search, setSearch]   = useState('');
  const [query, setQuery]     = useState('');
  const [page, setPage]       = useState(1);
  const [list, setList]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [manage, setManage]   = useState(null);
  // Invited centers: resend the invite (routes/centerInviteRoutes.js)
  const [resending, setResending] = useState(null);
  const [inviteNote, setInviteNote] = useState(null); // { centerName, message, inviteUrl, emailed }
  const resendInvite = async (c) => {
    setResending(c._id); setError('');
    try {
      const res = await fetch(`${apiBase}/super-admin/center-invites/${c._id}/resend`, { method: 'POST', headers: headersRef.current });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not resend the invite');
      setInviteNote({ centerName: c.centerName, message: data.message, inviteUrl: data.data.inviteUrl, emailed: data.data.emailed });
      loadPage();
    } catch (e) {
      setError(e.message || 'Could not resend the invite');
    } finally {
      setResending(null);
    }
  };
  const reqId = useRef(0);
  const headersRef = useRef(authHeaders);
  headersRef.current = authHeaders || { Authorization: `Bearer ${localStorage.getItem('superAdminToken')}` };

  const loadPage = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), withUsage: '1' });
    if (status !== 'all') params.set('status', status);
    if (plan) params.set('plan', plan);
    if (query) params.set('q', query);
    try {
      const res = await fetch(`${apiBase}/super-admin/centers?${params}`, { headers: headersRef.current });
      const data = await res.json();
      if (id !== reqId.current) return; // a newer request is on its way
      if (!data.success) throw new Error(data.message || 'Could not load centers');
      setList(data); setError('');
      if (data.pagination && data.pagination.page !== page) setPage(data.pagination.page);
    } catch (e) {
      if (id === reqId.current) setError(e.message || 'Could not load centers');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [apiBase, page, status, plan, query]);
  // `centers` changes after every action in the dashboard (approve, plan, theme…) → refresh this page too
  useEffect(() => { loadPage(); }, [loadPage, centers]);

  // Opened from Ctrl/⌘ K search or the overview: show that center's Manage panel straight away
  useEffect(() => {
    if (!openCenter?.id) return;
    const c = (list?.centers || []).find((x) => x._id === openCenter.id) || centers.find((x) => x._id === openCenter.id);
    if (c) setManage(c);
  }, [openCenter?.n]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch {
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

  const rows = list?.centers || [];
  const counts = list?.counts || { all: 0, pending: 0, active: 0, suspended: 0, rejected: 0 };
  const pager = list?.pagination || { page: 1, totalPages: 1, total: 0, limit: PAGE_SIZE };

  return (
    <>
    <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header: title, search, plan filter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '18px 20px 14px' }}>
        {/* the page header already names this page; this line just says what's listed */}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--sa-muted)' }}>
          <strong style={{ color: 'var(--sa-text)', fontVariantNumeric: 'tabular-nums' }}>{(list?.pagination?.total ?? 0)}</strong> center{(list?.pagination?.total ?? 0) === 1 ? '' : 's'} · pending first · press <strong style={{ color: 'var(--sa-text)' }}>Manage</strong> for everything else
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <form onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }} style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} onBlur={() => { if (search.trim() !== query) { setQuery(search.trim()); setPage(1); } }}
              placeholder="Search name, slug, email, domain" aria-label="Search centers" className={styles.input} style={{ paddingLeft: 32, width: 250, fontSize: 13 }} />
          </form>
          <select value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }} aria-label="Filter by plan" className={styles.input} style={{ width: 130, fontSize: 13 }}>
            <option value="">All plans</option>
            {['free', 'basic', 'pro', 'enterprise'].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </select>
          <button onClick={() => { loadPage(); loadData(); }} className={styles.refreshBtn} title="Refresh" aria-label="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Status tabs with counts */}
      <div role="tablist" aria-label="Center status" style={{ display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid var(--sa-w06)', overflowX: 'auto' }}>
        {STATUS_TABS.map(t => {
          const on = status === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={on} onClick={() => { setStatus(t.key); setPage(1); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 12px', border: 'none', borderBottom: `2px solid ${on ? t.color : 'transparent'}`, background: 'transparent', color: on ? 'var(--sa-text)' : '#6b7280', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', marginBottom: -1 }}>
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 999, background: on ? `${t.color}22` : 'var(--sa-w05)', color: on ? t.color : 'var(--sa-muted)' }}>{counts[t.key] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {error && <div role="alert" style={{ margin: '12px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: 'var(--sa-red-text)', fontSize: 13 }}>{error}</div>}
      {inviteNote && (
        <div role="status" style={{ margin: '12px 20px 0', padding: '10px 14px', borderRadius: 10, background: inviteNote.emailed ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.12)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--sa-text)', fontWeight: 600 }}>{inviteNote.centerName}: {inviteNote.message}</span>
          <button type="button" onClick={() => navigator.clipboard?.writeText(inviteNote.inviteUrl).catch(() => {})} style={ghostBtn('var(--sa-text)')}><Copy size={13} /> Copy link</button>
          <button type="button" onClick={() => setInviteNote(null)} style={{ ...ghostBtn('var(--sa-muted)'), marginLeft: 'auto' }} aria-label="Dismiss"><X size={13} /></button>
        </div>
      )}

      {loading && !list ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#6b7280' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#6b7280' }}>
          <Building2 size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
          {query || plan || status !== 'all' ? (
            <p style={{ margin: 0 }}>No centers match these filters.</p>
          ) : (
            <p style={{ margin: 0 }}>No centers yet.{' '}
              <button onClick={() => setShowModal(true)} style={{ background: 'none', border: 'none', color: 'var(--sa-accent)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Create one →</button>
            </p>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ ...ROW, padding: '10px 20px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <span>Center</span><span>Plan</span><span>Usage</span><span>Health</span><span>Website</span><span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {rows.map(c => (
              <div key={c._id} style={{ ...ROW, padding: '12px 20px', borderTop: '1px solid var(--sa-w05)', background: c.status === 'pending' ? 'rgba(245,158,11,0.05)' : 'transparent' }}>
                {/* Center */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <Avatar center={c} />
                  <div style={{ minWidth: 0 }}>
                    <button onClick={() => setManage(c)} style={{ all: 'unset', cursor: 'pointer', fontWeight: 700, color: 'var(--sa-text)', fontSize: 14, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{c.centerName}</button>
                    <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <code style={{ color: 'var(--sa-muted)' }}>{c.slug}</code>
                      {c.customDomain && <> · {c.customDomain} {c.domainVerified ? <CheckCircle size={11} color="#34d399" style={{ verticalAlign: -1 }} /> : <span style={{ color: '#f59e0b' }}>(unverified)</span>}</>}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.adminEmail}</div>
                  </div>
                </div>
                {/* Plan */}
                <div><span style={pillStyle(PLAN_COLORS[c.plan || 'free'])}>{c.plan || 'free'}</span></div>
                {/* Usage */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.status === 'active' && c.usage ? (
                    <>
                      <UsageBar label="Teachers" used={c.usage.teachers} max={c.maxTeachers} />
                      <UsageBar label="Students" used={c.usage.students} max={c.maxStudents} />
                    </>
                  ) : <span style={{ fontSize: 12, color: '#4b5563' }}>—</span>}
                </div>
                {/* Health */}
                <HealthCell center={c} />
                {/* Website */}
                <div><WebsiteBadge center={c} /></div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                  {c.status === 'pending' && isInvited(c) && (
                    <button onClick={() => resendInvite(c)} disabled={resending === c._id} style={ghostBtn('#0ea5e9')} title="Send a new invite link (the old one stops working)">
                      <Send size={13} /> {resending === c._id ? 'Sending…' : 'Resend'}
                    </button>
                  )}
                  {c.status === 'pending' && !isInvited(c) && (
                    <>
                      <button onClick={() => handleApprove(c._id)} className={styles.approveBtn}>Approve</button>
                      <button onClick={() => handleReject(c._id)} className={styles.rejectBtn}>Reject</button>
                    </>
                  )}
                  {c.status === 'active' && (
                    <button onClick={() => handleEnterAsAdmin(c)} disabled={impersonating === c._id} style={ghostBtn('#6366f1')} title="Open this center's admin panel (30 min session)">
                      <LogIn size={13} /> {impersonating === c._id ? '…' : 'Enter'}
                    </button>
                  )}
                  {(c.status === 'rejected' || c.status === 'suspended') && (
                    <button onClick={() => handleApprove(c._id)} className={styles.approveBtn}>Reactivate</button>
                  )}
                  <button onClick={() => setManage(c)} style={ghostBtn('var(--sa-text)')} title="Plan, features, themes, website, account">
                    <Settings2 size={13} /> Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '12px 20px 16px', borderTop: rows.length ? '1px solid var(--sa-w05)' : 'none' }}>
        <Pagination page={pager.page} totalPages={pager.totalPages} total={pager.total} pageSize={pager.limit} onPage={setPage} isDarkMode />
      </div>
    </div>

    {manage && (
      <ManagePanel
        center={manage}
        onClose={() => setManage(null)}
        run={(fn) => { setManage(null); fn(); }}
        actions={{
          plan:       (c) => { setPlanModal(c); setPlanSelected(c.plan || 'basic'); setPlanMsg(''); },
          features:   (c) => setFeaturesCenter(c),
          limits:     (c) => {
            setLimitsModal(c);
            setLimitsUnlimT(c.maxTeachers === -1);
            setLimitsUnlimS(c.maxStudents === -1);
            setLimitsTeachers(c.maxTeachers === -1 ? '' : String(c.maxTeachers || ''));
            setLimitsStudents(c.maxStudents === -1 ? '' : String(c.maxStudents || ''));
            setLimitsMsg('');
          },
          theme:          (c) => setThemeCenter(c),
          studentLogin:   (c) => handleOpenLoginThemeModal(c),
          teacherLogin:   (c) => handleOpenTeacherThemeModal(c),
          adminLogin:     (c) => handleOpenAdminLoginThemeModal(c),
          dashboard:      (c) => handleOpenDashThemeModal(c),
          classroom:      (c) => handleOpenClassroomThemeModal?.(c),
          website:        onEditWebsite ? (c) => onEditWebsite(c) : null,
          partnership:    (c) => setPartnershipModal(c),
          enter:          (c) => handleEnterAsAdmin(c),
          overrideEmail:  (c) => openOverride(c),
          suspend:        (c) => handleSuspend(c._id),
          reactivate:     (c) => handleApprove(c._id),
          approve:        (c) => handleApprove(c._id),
          resendInvite:   (c) => resendInvite(c),
          reject:         (c) => handleReject(c._id),
          remove:         (c) => setDeleteTarget(c),
        }}
      />
    )}

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
            background: 'var(--sa-modal)', border: '1px solid #2a2d40', borderRadius: '18px',
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
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--sa-text)' }}>
                Emergency Email Override
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                {overrideCenter.centerName}
              </p>
            </div>
          </div>

          {/* Recovery Code */}
          {overrideCenter.recoveryCode && (
            <div style={{ background: 'var(--sa-panel)', border: '1px solid #2a2d40', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>Recovery code</span>
              <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: 'var(--sa-accent-text)', flex: 1, letterSpacing: '0.06em' }}>
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
            <div style={{ padding: '10px 12px', background: 'var(--sa-panel)', border: '1px solid #2a2d40', borderRadius: '8px', fontSize: '13px', color: '#94a3b8' }}>
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
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--sa-panel)', border: '1px solid #2a2d40', borderRadius: '8px', color: '#e8eaf6', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
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
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--sa-panel)', border: '1px solid #2a2d40', borderRadius: '8px', color: '#e8eaf6', fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
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
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: 'var(--sa-text)', fontWeight: 700 }}>
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

// ── Layout + small pieces ─────────────────────────────────────────────────────
const PAGE_SIZE = 20;
const ROW = { display: 'grid', gridTemplateColumns: 'minmax(210px,2fr) 72px minmax(140px,1.2fr) minmax(120px,1fr) 64px 196px', gap: 14, alignItems: 'center' };
const STATUS_TABS = [
  { key: 'all',       label: 'All',       color: '#6366f1' },
  { key: 'active',    label: 'Active',    color: '#10b981' },
  { key: 'pending',   label: 'Pending',   color: '#f59e0b' },
  { key: 'suspended', label: 'Suspended', color: '#ef4444' },
  { key: 'rejected',  label: 'Rejected',  color: '#6b7280' },
];
const STATUS_COLORS = { active: '#10b981', pending: '#f59e0b', suspended: '#ef4444', rejected: '#6b7280' };
const PLAN_COLORS = { free: '#64748b', basic: '#3b82f6', pro: '#6366f1', enterprise: '#0f766e' };   // same as the overview's plan chart
const AVATAR_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#8b5cf6', '#f97316', '#64748b'];

const pillStyle = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
  fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize',
  color, background: `${color}18`, border: `1px solid ${color}33`,
});
const ghostBtn = (color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8,
  fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  background: 'var(--sa-w03)', border: '1px solid var(--sa-w10)', color,
});

function Avatar({ center, size = 38 }) {
  const name = center.centerName || center.slug || '?';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const color = AVATAR_COLORS[[...(center.slug || name)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const logo = center.branding?.logoUrl || center.logoUrl;
  return logo ? (
    <img src={logo} alt="" style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0, background: '#111' }} />
  ) : (
    <div aria-hidden style={{ width: size, height: size, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.36, color, background: `${color}1f`, border: `1px solid ${color}33` }}>{initials}</div>
  );
}

function UsageBar({ label, used = 0, max }) {
  const unlimited = max === -1 || !max;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / max) * 100));
  const color = pct >= 100 ? '#ef4444' : pct >= 85 ? '#f59e0b' : '#6366f1';
  return (
    <div title={unlimited ? `${used} ${label.toLowerCase()} (no limit)` : `${used} of ${max} ${label.toLowerCase()} (${pct}%)`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--sa-muted)' }}>
        <span>{label}</span>
        <span style={{ color: pct >= 85 ? color : 'var(--sa-text-2)', fontWeight: 700 }}>{used}{unlimited ? '' : ` / ${max}`}</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--sa-w06)', marginTop: 3, overflow: 'hidden' }}>
        <div style={{ width: unlimited ? '100%' : `${pct}%`, height: '100%', background: unlimited ? 'rgba(244,114,182,0.25)' : color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

const isInvited = (c) => !!c.invite?.sentAt && !c.invite?.acceptedAt;
const shortDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function HealthCell({ center: c }) {
  if (c.status === 'pending' && isInvited(c)) {
    const expired = c.invite.expiresAt && new Date(c.invite.expiresAt) < new Date();
    return (
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={pillStyle(expired ? '#ef4444' : '#0ea5e9')}>{expired ? 'Invite expired' : 'Invite sent'}</span>
        <span style={{ fontSize: 11.5, color: 'var(--sa-muted)' }}>{expired ? `Expired ${shortDate(c.invite.expiresAt)}` : `Sent ${shortDate(c.invite.sentAt)} · waiting for admin`}</span>
      </span>
    );
  }
  if (c.status !== 'active') {
    return <span style={pillStyle(STATUS_COLORS[c.status] || '#6b7280')}>{c.status}</span>;
  }
  const h = c.health;
  let color = '#34d399', text = 'Healthy';
  if (!h) { color = '#6b7280'; text = 'Not checked yet'; }
  else if (h.ok === false) { color = '#ef4444'; text = h.error || 'Database problem'; }
  else if (h.missed24h >= 3 || h.unanswered > 0) {
    color = '#f59e0b';
    text = [h.missed24h ? `${h.missed24h} missed (24h)` : null, h.unanswered ? `${h.unanswered} request${h.unanswered === 1 ? '' : 's'} waiting` : null].filter(Boolean).join(' · ');
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--sa-text-2)' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 0 3px ${color}26`, flexShrink: 0 }} />
      {text}
    </span>
  );
}

function websiteState(center) {
  const lp = center.landingPage;
  if (lp?.published) return { label: 'Live', color: '#10b981' };
  if (lp && (lp.hero?.headline || lp.about?.body || lp.teachers?.length)) return { label: 'Draft', color: '#f59e0b' };
  return { label: 'None', color: '#64748b' };
}
function WebsiteBadge({ center }) {
  const w = websiteState(center);
  return <span style={pillStyle(w.color)}>{w.label}</span>;
}

// ── Manage panel (slides in from the right) ───────────────────────────────────
function ManagePanel({ center: c, onClose, run, actions }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const item = (key, Icon, label, hint, opts = {}) => {
    const fn = actions[key];
    if (!fn || opts.hidden) return null;
    return (
      <button key={key} type="button" onClick={() => run(() => fn(c))}
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: opts.danger ? '#f87171' : 'var(--sa-text)' }}
        onMouseEnter={e => { e.currentTarget.style.background = opts.danger ? 'rgba(239,68,68,0.08)' : 'var(--sa-w04)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: opts.danger ? 'rgba(239,68,68,0.1)' : 'var(--sa-w05)', flexShrink: 0 }}>
          <Icon size={15} color={opts.danger ? '#f87171' : opts.color || '#9ca3af'} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{label}</span>
          {hint && <span style={{ display: 'block', fontSize: 11.5, color: '#6b7280', marginTop: 1 }}>{hint}</span>}
        </span>
        <ChevronRight size={15} color="#4b5563" />
      </button>
    );
  };
  const section = (title, children) => {
    const items = children.filter(Boolean);
    if (!items.length) return null;
    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 12px 6px' }}>{title}</div>
        {items}
      </div>
    );
  };

  const isActive = c.status === 'active';
  const w = websiteState(c);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside onClick={e => e.stopPropagation()} role="dialog" aria-label={`Manage ${c.centerName}`}
        style={{ width: 'min(440px, 100vw)', height: '100%', overflowY: 'auto', background: 'var(--sa-panel)', borderLeft: '1px solid var(--sa-w08)', padding: '20px 16px 28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '0 4px' }}>
          <Avatar center={c} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--sa-text)' }}>{c.centerName}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={pillStyle(STATUS_COLORS[c.status] || '#6b7280')}>{c.status}</span>
              <span style={pillStyle(PLAN_COLORS[c.plan || 'free'])}>{c.plan || 'free'}</span>
              <span style={pillStyle(w.color)}>Website: {w.label}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ ...ghostBtn('var(--sa-muted)'), padding: 7 }}><X size={15} /></button>
        </div>

        <div style={{ margin: '16px 4px 0', padding: 14, borderRadius: 12, background: 'var(--sa-w03)', border: '1px solid var(--sa-w06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', fontSize: 12.5 }}>
          <div><div style={{ color: '#6b7280', fontSize: 11 }}>Slug</div><code style={{ color: 'var(--sa-text-2)' }}>{c.slug}</code></div>
          <div><div style={{ color: '#6b7280', fontSize: 11 }}>Created</div><span style={{ color: 'var(--sa-text-2)' }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></div>
          <div style={{ gridColumn: '1 / -1', minWidth: 0 }}><div style={{ color: '#6b7280', fontSize: 11 }}>Admin email</div><span style={{ color: 'var(--sa-text-2)', wordBreak: 'break-all' }}>{c.adminEmail || '—'}</span></div>
          {c.customDomain && <div style={{ gridColumn: '1 / -1' }}><div style={{ color: '#6b7280', fontSize: 11 }}>Custom domain</div><span style={{ color: 'var(--sa-text-2)' }}>{c.customDomain} {c.domainVerified ? '· verified' : '· not verified'}</span></div>}
          {isActive && c.usage && (
            <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <UsageBar label="Teachers" used={c.usage.teachers} max={c.maxTeachers} />
              <UsageBar label="Students" used={c.usage.students} max={c.maxStudents} />
            </div>
          )}
          {isActive && <div style={{ gridColumn: '1 / -1' }}><HealthCell center={c} /></div>}
        </div>

        {c.status === 'pending' && isInvited(c) && section('Invite', [
          item('resendInvite', Send, 'Resend invite', `Sent to ${c.adminEmail} ${c.invite.sentCount > 1 ? `(${c.invite.sentCount} times)` : ''} — a new link replaces the old one`, { color: '#0ea5e9' }),
        ])}
        {c.status === 'pending' && !isInvited(c) && section('Registration', [
          item('approve', CheckCircle, 'Approve center', 'Creates its database and emails the admin', { color: '#34d399' }),
          item('reject', XCircle, 'Reject registration', null, { danger: true }),
        ])}
        {section('Plan and access', [
          item('plan', Crown, 'Change plan', `Currently ${c.plan || 'free'}`, { color: '#6366f1' }),
          item('features', ToggleRight, 'Features', 'Video calling, recording, AI tools…'),
          item('limits', SlidersHorizontal, 'Seat limits', `${c.maxTeachers === -1 ? 'Unlimited' : c.maxTeachers ?? '—'} teachers · ${c.maxStudents === -1 ? 'unlimited' : c.maxStudents ?? '—'} students`),
        ])}
        {section('Look and feel', [
          item('theme', Palette, 'Center theme', 'Brand colours across the app'),
          item('studentLogin', LogIn, 'Student login page'),
          item('teacherLogin', LogIn, 'Teacher login page'),
          item('adminLogin', LogIn, 'Admin login page'),
          item('dashboard', LayoutDashboard, 'Dashboards', 'Student, teacher, admin and sub-admin'),
          item('classroom', Video, 'Classroom theme'),
        ])}
        {section('Website and branding', [
          item('website', Globe, 'Edit website', `Landing page · ${w.label.toLowerCase()}`),
          item('partnership', Users, 'Partnership text', 'Co-branding shown on their pages'),
        ])}
        {section('Account', [
          item('enter', LogIn, 'Enter as admin', 'Opens their admin panel for 30 minutes', { hidden: !isActive, color: '#6366f1' }),
          item('overrideEmail', KeyRound, 'Override admin email', 'Emergency: admin lost access to their email'),
          item('suspend', PauseCircle, 'Suspend center', 'Blocks all logins until reactivated', { hidden: !isActive, danger: true }),
          item('reactivate', RotateCcw, 'Reactivate center', null, { hidden: !(c.status === 'suspended' || c.status === 'rejected'), color: '#34d399' }),
          item('remove', Trash2, 'Schedule deletion', 'Can be restored until the countdown ends', { danger: true }),
        ])}
      </aside>
    </div>
  );
}
