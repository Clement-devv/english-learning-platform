// src/pages/super-admin/SuperAdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, LogOut, Building2, CheckCircle, Clock,
  XCircle, PauseCircle, Plus, X, Eye, EyeOff,
  Globe, RefreshCw, Trash2, Mail, KeyRound, Palette,
  BarChart2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Video, Mic, Film,
  AlertTriangle, RotateCcw, Zap, Send, Activity, Users, UserCheck, LogIn, Megaphone, SlidersHorizontal,
} from 'lucide-react';
import api from '../../api';
import { THEMES } from '../../data/themes';
import { LOGIN_THEMES } from '../../data/loginThemes';
import { DASHBOARD_THEMES } from '../../data/dashboardThemes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const TIMEZONES = [
  'UTC','Africa/Lagos','Africa/Nairobi','Africa/Accra','Africa/Cairo',
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Sao_Paulo','Asia/Dubai','Asia/Kolkata','Asia/Singapore',
  'Asia/Tokyo','Australia/Sydney','Europe/London','Europe/Paris','Europe/Berlin',
];

const EMPTY_FORM = {
  centerName: '', slug: '', adminEmail: '', password: '',
  phone: '', country: '', plan: 'basic',
  website: '', description: '', timezone: 'UTC',
  address: '', maxTeachers: '', maxStudents: '',
};

// OTP step: 'email' → 'otp' → 'form' → 'done'
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const token    = localStorage.getItem('superAdminToken');
  const info     = JSON.parse(localStorage.getItem('superAdminInfo') || '{}');
  const authHeaders = { Authorization: `Bearer ${token}` };

  const [stats,    setStats]    = useState(null);
  const [centers,  setCenters]  = useState([]);
  const [domains,  setDomains]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('centers'); // 'centers' | 'domains'
  const [error,    setError]    = useState('');

  // ── Create center modal ──────────────────────────────────────────────────
  const [showModal, setShowModal]       = useState(false);
  const [step,      setStep]            = useState('email'); // 'email'|'otp'|'form'|'done'
  const [form,      setForm]            = useState(EMPTY_FORM);
  const [otpInput,  setOtpInput]        = useState('');
  const [sendingOtp,setSendingOtp]      = useState(false);
  const [otpError,  setOtpError]        = useState('');
  const [verifying, setVerifying]       = useState(false);
  const [verifyErr, setVerifyErr]       = useState('');
  const [creating,  setCreating]        = useState(false);
  const [createErr, setCreateErr]       = useState('');
  const [successMsg,setSuccessMsg]      = useState('');
  const [showPwd,   setShowPwd]         = useState(false);

  // ── Domain actions ───────────────────────────────────────────────────────
  const [domainAction, setDomainAction] = useState({}); // { [id]: 'verifying'|'removing' }

  // ── Usage ────────────────────────────────────────────────────────────────
  const [usage,         setUsage]         = useState([]);
  const [usageMonth,    setUsageMonth]    = useState('');
  const [expandedCenter,setExpandedCenter]= useState(null); // centerId with sessions open
  const [sessionDetail, setSessionDetail] = useState({});   // { [centerId]: { sessions, totalMinutes } }
  const [loadingDetail, setLoadingDetail] = useState({});   // { [centerId]: true }

  // ── Theme picker ─────────────────────────────────────────────────────────
  const [themeCenter,   setThemeCenter]   = useState(null);   // center object being themed
  const [applyingTheme, setApplyingTheme] = useState(null);   // theme id currently being applied

  // ── Feature toggles ──────────────────────────────────────────────────────
  const [featuresCenter, setFeaturesCenter] = useState(null); // center being edited
  const [savingFeature,  setSavingFeature]  = useState(null); // key currently saving

  // ── Soft delete ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleted,      setDeleted]      = useState([]);
  const [restoring,    setRestoring]    = useState(null);

  // ── Plan editor ──────────────────────────────────────────────────────────
  const [planModal,    setPlanModal]    = useState(null);  // center object
  const [planSelected, setPlanSelected] = useState('');
  const [planSaving,   setPlanSaving]   = useState(false);
  const [planMsg,      setPlanMsg]      = useState('');

  // ── Health tab ───────────────────────────────────────────────────────────
  const [health,        setHealth]        = useState([]);
  const [healthLoading, setHealthLoading] = useState(false);

  // ── Seat limits modal ─────────────────────────────────────────────────────
  const [limitsModal,   setLimitsModal]   = useState(null);  // center object
  const [limitsTeachers,setLimitsTeachers]= useState('');
  const [limitsStudents,setLimitsStudents]= useState('');
  const [limitsUnlimT,  setLimitsUnlimT]  = useState(false);
  const [limitsUnlimS,  setLimitsUnlimS]  = useState(false);
  const [limitsSaving,  setLimitsSaving]  = useState(false);
  const [limitsMsg,     setLimitsMsg]     = useState('');

  // ── Impersonation ─────────────────────────────────────────────────────────
  const [impersonating, setImpersonating] = useState(null); // centerId being entered

  // ── Broadcast email ───────────────────────────────────────────────────────
  const [broadcastModal,   setBroadcastModal]   = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting,     setBroadcasting]     = useState(false);
  const [broadcastResult,  setBroadcastResult]  = useState(null);

  // ── AI Chat Credits ───────────────────────────────────────────────────────
  const [creditCenters,    setCreditCenters]    = useState([]);
  const [creditTotals,     setCreditTotals]     = useState(null);
  const [creditLoading,    setCreditLoading]    = useState(false);
  const [allocModal,       setAllocModal]       = useState(null);  // center object
  const [allocAmount,      setAllocAmount]      = useState('');
  const [allocNote,        setAllocNote]        = useState('');
  const [allocating,       setAllocating]       = useState(false);
  const [allocMsg,         setAllocMsg]         = useState('');
  const [creditSearch,     setCreditSearch]     = useState('');
  const [expandedLog,      setExpandedLog]      = useState(null);  // centerId

  // ── Dashboard theme assignment ────────────────────────────────────────────
  const [dashThemeModal,      setDashThemeModal]      = useState(null);
  const [dashThemeAssignments,setDashThemeAssignments]= useState({});
  const [assigningDashTheme,  setAssigningDashTheme]  = useState(null);
  const [dashThemeMsg,        setDashThemeMsg]        = useState('');
  const [dashThemeTab,        setDashThemeTab]        = useState('student'); // 'student' | 'teacher'

  const loadDashThemeAssignments = async () => {
    try {
      const res  = await fetch(`${API_BASE}/super-admin/dashboard-themes`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setDashThemeAssignments(data.assignments);
    } catch (_) {}
  };

  const handleOpenDashThemeModal = (center) => {
    setDashThemeModal(center);
    setDashThemeMsg('');
    loadDashThemeAssignments();
  };

  const handleAssignDashTheme = async (themeId) => {
    if (!dashThemeModal) return;
    setAssigningDashTheme(themeId);
    setDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardTheme: themeId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, dashboardTheme: themeId } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, dashboardTheme: themeId } } : c
      ));
      setDashThemeMsg(data.message);
      loadDashThemeAssignments();
    } catch (err) {
      setDashThemeMsg(err.message || 'Failed to assign theme');
    } finally {
      setAssigningDashTheme(null);
    }
  };

  const handleUnassignDashTheme = async () => {
    if (!dashThemeModal) return;
    setAssigningDashTheme('__unassign__');
    setDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardTheme: null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, dashboardTheme: null } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, dashboardTheme: null } } : c
      ));
      setDashThemeMsg('Dashboard theme unassigned');
      loadDashThemeAssignments();
    } catch (err) {
      setDashThemeMsg(err.message || 'Failed to unassign');
    } finally {
      setAssigningDashTheme(null);
    }
  };

  // ── Login theme assignment ─────────────────────────────────────────────────
  const [loginThemeModal,      setLoginThemeModal]      = useState(null);  // center object
  const [loginThemeAssignments,setLoginThemeAssignments]= useState({});    // { themeId: { id, name, slug } }
  const [assigningLoginTheme,  setAssigningLoginTheme]  = useState(null);  // themeId being saved
  const [loginThemeMsg,        setLoginThemeMsg]        = useState('');

  const loadLoginThemeAssignments = async () => {
    try {
      const res  = await fetch(`${API_BASE}/super-admin/login-themes`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setLoginThemeAssignments(data.assignments);
    } catch (_) {}
  };

  const handleOpenLoginThemeModal = (center) => {
    setLoginThemeModal(center);
    setLoginThemeMsg('');
    loadLoginThemeAssignments();
  };

  const handleAssignLoginTheme = async (themeId) => {
    if (!loginThemeModal) return;
    setAssigningLoginTheme(themeId);
    setLoginThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${loginThemeModal._id}/login-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginTheme: themeId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      // Update local state
      setLoginThemeModal(c => c ? { ...c, branding: { ...c.branding, loginTheme: themeId } } : c);
      setCenters(cs => cs.map(c =>
        c._id === loginThemeModal._id ? { ...c, branding: { ...c.branding, loginTheme: themeId } } : c
      ));
      setLoginThemeMsg(data.message);
      loadLoginThemeAssignments();
    } catch (err) {
      setLoginThemeMsg(err.message || 'Failed to assign theme');
    } finally {
      setAssigningLoginTheme(null);
    }
  };

  const handleUnassignLoginTheme = async () => {
    if (!loginThemeModal) return;
    setAssigningLoginTheme('__unassign__');
    setLoginThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${loginThemeModal._id}/login-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginTheme: null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setLoginThemeModal(c => c ? { ...c, branding: { ...c.branding, loginTheme: null } } : c);
      setCenters(cs => cs.map(c =>
        c._id === loginThemeModal._id ? { ...c, branding: { ...c.branding, loginTheme: null } } : c
      ));
      setLoginThemeMsg('Login theme unassigned');
      loadLoginThemeAssignments();
    } catch (err) {
      setLoginThemeMsg(err.message || 'Failed to unassign');
    } finally {
      setAssigningLoginTheme(null);
    }
  };

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/super-admin/stats`,          { headers: authHeaders }).then(r => r.json()),
      fetch(`${API_BASE}/super-admin/centers`,         { headers: authHeaders }).then(r => r.json()),
      fetch(`${API_BASE}/super-admin/centers/domains`, { headers: authHeaders }).then(r => r.json()),
      fetch(`${API_BASE}/super-admin/usage`,           { headers: authHeaders }).then(r => r.json()),
      fetch(`${API_BASE}/super-admin/centers/deleted`, { headers: authHeaders }).then(r => r.json()),
    ])
      .then(([s, c, d, u, del]) => {
        if (s.success)   setStats(s.stats);
        if (c.success)   setCenters(c.centers);
        if (d.success)   setDomains(d.centers);
        if (u.success)   { setUsage(u.summary); setUsageMonth(u.thisMonth); }
        if (del.success) setDeleted(del.centers);
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHealth = useCallback(() => {
    setHealthLoading(true);
    fetch(`${API_BASE}/super-admin/centers/health`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success) setHealth(d.health); })
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCredits = useCallback(() => {
    setCreditLoading(true);
    fetch(`${API_BASE}/super-admin/chat-credits`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success) { setCreditCenters(d.centers); setCreditTotals(d.totals); } })
      .catch(() => {})
      .finally(() => setCreditLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'credits') loadCredits(); }, [tab, loadCredits]);
  useEffect(() => { if (tab === 'health')  loadHealth();  }, [tab, loadHealth]);

  const handleLogout = () => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminInfo');
    navigate('/super-admin/login');
  };

  // ── Centers actions ──────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/super-admin/centers/${id}/approve`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCenters(cs => cs.map(c => c._id === id ? { ...c, status: 'active' } : c));
      setStats(st => st ? { ...st, active: st.active + 1, pending: Math.max(0, st.pending - 1) } : st);
    } catch (err) {
      alert(err.message || 'Failed to approve');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason (optional):');
    if (reason === null) return; // cancelled
    try {
      const res = await fetch(`${API_BASE}/super-admin/centers/${id}/reject`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectReason: reason }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCenters(cs => cs.map(c => c._id === id ? { ...c, status: 'rejected' } : c));
    } catch (err) {
      alert(err.message || 'Failed to reject');
    }
  };

  const handleSuspend = async (id) => {
    if (!window.confirm('Suspend this center?')) return;
    try {
      const res = await fetch(`${API_BASE}/super-admin/centers/${id}/suspend`, {
        method: 'PATCH', headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCenters(cs => cs.map(c => c._id === id ? { ...c, status: 'suspended' } : c));
    } catch (err) {
      alert(err.message || 'Failed to suspend');
    }
  };

  // ── Domain actions ───────────────────────────────────────────────────────
  const handleVerifyDomain = async (id) => {
    setDomainAction(a => ({ ...a, [id]: 'verifying' }));
    try {
      const res = await fetch(`${API_BASE}/super-admin/centers/${id}/verify-domain`, {
        method: 'PATCH', headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) { alert(data.message); return; }
      setDomains(ds => ds.map(d => d._id === id ? { ...d, domainVerified: true } : d));
      alert('Domain verified!');
    } catch {
      alert('Verification failed. Please try again.');
    } finally {
      setDomainAction(a => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  const handleRemoveDomain = async (id, domain) => {
    if (!window.confirm(`Remove domain "${domain}" from this center?`)) return;
    setDomainAction(a => ({ ...a, [id]: 'removing' }));
    try {
      const res = await fetch(`${API_BASE}/super-admin/centers/${id}/remove-domain`, {
        method: 'PATCH', headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) { alert(data.message); return; }
      setDomains(ds => ds.filter(d => d._id !== id));
    } catch {
      alert('Failed to remove domain. Please try again.');
    } finally {
      setDomainAction(a => { const n = { ...a }; delete n[id]; return n; });
    }
  };

  // ── Feature toggle actions ────────────────────────────────────────────────
  const handleToggleFeature = async (centerId, key, currentValue) => {
    setSavingFeature(key);
    try {
      const res = await fetch(`${API_BASE}/super-admin/centers/${centerId}/features`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: !currentValue }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      // Update local state immediately
      setFeaturesCenter(fc => fc ? { ...fc, features: { ...fc.features, [key]: !currentValue } } : fc);
      setCenters(cs => cs.map(c => c._id === centerId
        ? { ...c, features: { ...c.features, [key]: !currentValue } }
        : c
      ));
    } catch (err) {
      alert(err.message || 'Failed to update feature');
    } finally {
      setSavingFeature(null);
    }
  };

  // ── Soft delete / restore ─────────────────────────────────────────────────
  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${deleteTarget._id}/soft-delete`, {
        method: 'PATCH', headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setCenters(cs => cs.filter(c => c._id !== deleteTarget._id));
      setDeleted(ds => [{ ...deleteTarget, status: 'deleted', scheduledDeletionAt: data.scheduledDeletionAt }, ...ds]);
      setStats(st => st ? { ...st, active: Math.max(0, st.active - 1) } : st);
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message || 'Failed to schedule deletion');
    } finally {
      setDeleting(false);
    }
  };

  const handleRestore = async (center) => {
    setRestoring(center._id);
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${center._id}/restore`, {
        method: 'PATCH', headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDeleted(ds => ds.filter(d => d._id !== center._id));
      setCenters(cs => [{ ...center, status: 'active', deletedAt: undefined, scheduledDeletionAt: undefined }, ...cs]);
      setStats(st => st ? { ...st, active: st.active + 1 } : st);
    } catch (err) {
      alert(err.message || 'Failed to restore center');
    } finally {
      setRestoring(null);
    }
  };

  const daysRemaining = (scheduledDeletionAt) => {
    const ms   = new Date(scheduledDeletionAt) - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  };

  // ── Usage actions ────────────────────────────────────────────────────────
  const toggleSessionDetail = async (centerId) => {
    if (expandedCenter === centerId) { setExpandedCenter(null); return; }
    setExpandedCenter(centerId);
    if (sessionDetail[centerId]) return; // already loaded
    setLoadingDetail(d => ({ ...d, [centerId]: true }));
    try {
      const res  = await fetch(`${API_BASE}/super-admin/usage/${centerId}?month=${usageMonth}`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setSessionDetail(d => ({ ...d, [centerId]: { sessions: data.sessions, totalMinutes: data.totalMinutes } }));
    } catch { /* silent */ } finally {
      setLoadingDetail(d => { const n = { ...d }; delete n[centerId]; return n; });
    }
  };

  const fmtMins = (m) => {
    if (!m) return '0 min';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  };

  // ── Theme actions ─────────────────────────────────────────────────────────
  const handleApplyTheme = async (centerId, theme) => {
    setApplyingTheme(theme.id);
    try {
      const res = await fetch(`${API_BASE}/super-admin/centers/${centerId}/theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryColor:   theme.primaryColor,
          secondaryColor: theme.secondaryColor,
          fontFamily:     theme.fontFamily,
          borderRadius:   theme.borderRadius,
          shadowStyle:    theme.shadowStyle,
          spacing:        theme.spacing,
          theme:          theme.id,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      // Reflect new active theme in both the picker and the centers list
      setThemeCenter(tc => tc ? { ...tc, branding: { ...tc.branding, theme: theme.id } } : tc);
      setCenters(cs => cs.map(c => c._id === centerId ? { ...c, branding: { ...c.branding, theme: theme.id } } : c));
    } catch (err) {
      alert(err.message || 'Failed to apply theme');
    } finally {
      setApplyingTheme(null);
    }
  };

  // ── Modal steps ──────────────────────────────────────────────────────────
  const closeModal = () => {
    setShowModal(false);
    setTimeout(() => {
      setStep('email');
      setForm(EMPTY_FORM);
      setOtpInput('');
      setOtpError('');
      setVerifyErr('');
      setCreateErr('');
      setSuccessMsg('');
      setShowPwd(false);
    }, 200);
  };

  const handleCenterNameChange = (val) => {
    const slug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setForm(f => ({ ...f, centerName: val, slug }));
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!form.adminEmail.trim()) return;
    setSendingOtp(true);
    setOtpError('');
    try {
      const res = await fetch(`${API_BASE}/super-admin/send-otp`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: form.adminEmail }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setStep('otp');
    } catch (err) {
      setOtpError(err.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setVerifyErr('');
    try {
      const res = await fetch(`${API_BASE}/super-admin/verify-otp`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: form.adminEmail, code: otpInput }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setStep('form');
    } catch (err) {
      setVerifyErr(err.message || 'Incorrect code');
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateCenter = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateErr('');
    try {
      // Register (creates center as 'pending')
      const regRes = await fetch(`${API_BASE}/register-center`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerName: form.centerName,
          slug:       form.slug,
          adminEmail: form.adminEmail,
          password:   form.password,
          phone:      form.phone,
          country:    form.country,
          website:    form.website,
          description:form.description,
          timezone:   form.timezone,
          address:    form.address,
          maxTeachers:form.maxTeachers ? Number(form.maxTeachers) : undefined,
          maxStudents:form.maxStudents ? Number(form.maxStudents) : undefined,
          plan:       form.plan,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.message || 'Registration failed');

      // Find the center by slug and immediately approve
      const centersRes = await fetch(`${API_BASE}/super-admin/centers`, { headers: authHeaders });
      const centersData = await centersRes.json();
      const newCenter = centersData.centers?.find(c => c.slug === form.slug);
      if (!newCenter) throw new Error('Center registered but not found for approval');

      const approveRes = await fetch(`${API_BASE}/super-admin/centers/${newCenter._id}/approve`, {
        method: 'PATCH', headers: authHeaders,
      });
      const approveData = await approveRes.json();
      if (!approveData.success) throw new Error(approveData.message || 'Approval failed');

      setSuccessMsg(`"${form.centerName}" is live! The admin can log in at once using their email and password.`);
      setStep('done');
      loadData();
    } catch (err) {
      setCreateErr(err.message || 'Failed to create center');
    } finally {
      setCreating(false);
    }
  };

  // ── Impersonation ─────────────────────────────────────────────────────────
  const handleEnterAsAdmin = async (center) => {
    setImpersonating(center._id);
    try {
      const res  = await fetch(`${API_BASE}/super-admin/impersonate/${center.slug}`, {
        method: 'POST', headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const exp = Date.now() + 30 * 60 * 1000;
      const url = `${window.location.origin}?imp_token=${encodeURIComponent(data.token)}&imp_center=${encodeURIComponent(center.slug)}&imp_name=${encodeURIComponent(center.centerName)}&imp_exp=${exp}`;
      window.open(url, '_blank');
    } catch (err) {
      alert(err.message || 'Failed to start impersonation');
    } finally {
      setImpersonating(null);
    }
  };

  // ── Broadcast ─────────────────────────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastMessage.trim()) return;
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res  = await fetch(`${API_BASE}/super-admin/broadcast`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: broadcastSubject, message: broadcastMessage }),
      });
      const data = await res.json();
      if (data.success) setBroadcastResult(data);
      else throw new Error(data.message);
    } catch (err) {
      alert(err.message || 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  };

  const statusColor = (s) => ({ active: '#10b981', pending: '#f59e0b', suspended: '#ef4444', rejected: '#6b7280' }[s] || '#6b7280');
  const statusIcon  = (s) => {
    if (s === 'active')    return <CheckCircle size={13} />;
    if (s === 'pending')   return <Clock size={13} />;
    if (s === 'suspended') return <PauseCircle size={13} />;
    return <XCircle size={13} />;
  };

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <Crown size={22} color="#f59e0b" />
          <span style={s.headerTitle}>Super Admin</span>
          {info.firstName && <span style={s.headerSub}>{info.firstName} {info.lastName}</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowModal(true)} style={s.createBtn}>
            <Plus size={15} /> Create Center
          </button>
          <button onClick={handleLogout} style={s.logoutBtn}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </div>

      <div style={s.body}>
        {error && <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>}

        {/* Stats */}
        {stats && (
          <div style={s.statsRow}>
            {[
              { label: 'Total',     value: stats.total,     color: '#6366f1', icon: Building2   },
              { label: 'Active',    value: stats.active,    color: '#10b981', icon: CheckCircle },
              { label: 'Pending',   value: stats.pending,   color: '#f59e0b', icon: Clock       },
              { label: 'Suspended', value: stats.suspended, color: '#ef4444', icon: PauseCircle },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} style={s.statCard}>
                <div style={{ ...s.statIcon, background: `${color}18` }}>
                  <Icon size={18} color={color} />
                </div>
                <div>
                  <p style={s.statValue}>{value ?? '—'}</p>
                  <p style={s.statLabel}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { key: 'centers', label: 'Centers',        icon: Building2  },
            { key: 'health',  label: 'Health',         icon: Activity   },
            { key: 'domains', label: 'Custom Domains', icon: Globe      },
            { key: 'usage',   label: 'Agora Usage',    icon: BarChart2  },
            { key: 'credits', label: 'AI Credits',     icon: Zap        },
            { key: 'deleted', label: 'Deleted',        icon: Trash2     },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{ ...s.tabBtn, ...(tab === key ? s.tabBtnActive : {}) }}
            >
              <Icon size={14} /> {label}
              {key === 'domains' && domains.length > 0 && (
                <span style={s.tabBadge}>{domains.length}</span>
              )}
              {key === 'deleted' && deleted.length > 0 && (
                <span style={{ ...s.tabBadge, background: '#ef4444' }}>{deleted.length}</span>
              )}
            </button>
          ))}
          </div>
          {/* Broadcast button */}
          <button
            onClick={() => { setBroadcastModal(true); setBroadcastSubject(''); setBroadcastMessage(''); setBroadcastResult(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0c0a00', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Megaphone size={14} /> Broadcast
          </button>
        </div>

        {/* ── Centers Table ── */}
        {tab === 'centers' && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={s.sectionTitle}><Building2 size={16} color="#f59e0b" /> All Centers</h2>
              <button onClick={loadData} style={s.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
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
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Center', 'Slug', 'Plan', 'Status', 'Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {centers.map(c => (
                      <tr key={c._id} style={s.tr}>
                        <td style={s.td}>
                          <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{c.centerName}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{c.adminEmail}</p>
                        </td>
                        <td style={s.td}><code style={s.slug}>{c.slug}</code></td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={s.planBadge}>{c.plan || 'basic'}</span>
                            <button
                              onClick={() => { setPlanModal(c); setPlanSelected(c.plan || 'basic'); setPlanMsg(''); }}
                              title="Change plan"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px 4px', borderRadius: 4, lineHeight: 1 }}
                            >✏️</button>
                          </div>
                        </td>
                        <td style={s.td}>
                          <span style={{ ...s.statusBadge, color: statusColor(c.status), borderColor: `${statusColor(c.status)}40`, background: `${statusColor(c.status)}12` }}>
                            {statusIcon(c.status)} {c.status}
                          </span>
                        </td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {c.status === 'pending' && (
                              <>
                                <button onClick={() => handleApprove(c._id)} style={s.approveBtn}>Approve</button>
                                <button onClick={() => handleReject(c._id)}  style={s.rejectBtn}>Reject</button>
                              </>
                            )}
                            {c.status === 'active' && (
                              <button onClick={() => handleSuspend(c._id)} style={s.suspendBtn}>Suspend</button>
                            )}
                            {(c.status === 'rejected' || c.status === 'suspended') && (
                              <button onClick={() => handleApprove(c._id)} style={s.approveBtn}>Reactivate</button>
                            )}
                            <button onClick={() => setThemeCenter(c)} style={s.themeBtn} title="Set theme">
                              <Palette size={12} /> Theme
                            </button>
                            <button
                              onClick={() => handleOpenLoginThemeModal(c)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#8b5cf6', cursor: 'pointer', fontFamily: 'inherit' }}
                              title="Assign exclusive login page theme"
                            >
                              <Palette size={12} /> Login Page
                            </button>
                            <button
                              onClick={() => handleOpenDashThemeModal(c)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', color: '#06b6d4', cursor: 'pointer', fontFamily: 'inherit' }}
                              title="Assign exclusive student dashboard theme"
                            >
                              <Palette size={12} /> Dashboard
                            </button>
                            <button onClick={() => setFeaturesCenter(c)} style={s.featuresBtn} title="Toggle features">
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
                            <button onClick={() => setDeleteTarget(c)} style={s.deleteBtn} title="Schedule deletion">
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
        )}

        {/* ── Domains Table ── */}
        {tab === 'domains' && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={s.sectionTitle}><Globe size={16} color="#f59e0b" /> Custom Domains</h2>
              <button onClick={loadData} style={s.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
            ) : domains.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                No custom domains submitted yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Center', 'Domain', 'Plan', 'DNS Status', 'Requested', 'Actions'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map(d => (
                      <tr key={d._id} style={s.tr}>
                        <td style={s.td}>
                          <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{d.centerName}</p>
                          <code style={{ ...s.slug, fontSize: '11px' }}>{d.slug}</code>
                        </td>
                        <td style={s.td}>
                          <span style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px' }}>{d.customDomain}</span>
                        </td>
                        <td style={s.td}><span style={s.planBadge}>{d.plan || 'basic'}</span></td>
                        <td style={s.td}>
                          {d.domainVerified ? (
                            <span style={{ ...s.statusBadge, color: '#10b981', borderColor: '#10b98140', background: '#10b98112' }}>
                              <CheckCircle size={12} /> Verified
                            </span>
                          ) : (
                            <span style={{ ...s.statusBadge, color: '#f59e0b', borderColor: '#f59e0b40', background: '#f59e0b12' }}>
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </td>
                        <td style={{ ...s.td, fontSize: '12px', color: '#6b7280' }}>
                          {d.domainRequestedAt ? new Date(d.domainRequestedAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={s.td}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {!d.domainVerified && (
                              <button
                                onClick={() => handleVerifyDomain(d._id)}
                                disabled={!!domainAction[d._id]}
                                style={s.approveBtn}
                              >
                                {domainAction[d._id] === 'verifying' ? '…' : 'Verify DNS'}
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveDomain(d._id, d.customDomain)}
                              disabled={!!domainAction[d._id]}
                              style={s.rejectBtn}
                            >
                              {domainAction[d._id] === 'removing' ? '…' : <Trash2 size={13} />}
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
        )}
        {/* ── Health Tab ── */}
        {tab === 'health' && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={s.sectionTitle}><Activity size={16} color="#34d399" /> Center Health</h2>
              <button onClick={loadHealth} style={s.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
              Live counts from each center's database. Last Activity shows the most recent booking.
            </p>
            {healthLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading health data…</div>
            ) : health.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>No active centers.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Center', 'Teachers', 'Students', 'Bookings (month)', 'Last Activity'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {health.map(h => {
                      const daysSince = h.lastActivity
                        ? Math.floor((Date.now() - new Date(h.lastActivity)) / 86400000)
                        : null;
                      const actColor = daysSince === null ? '#6b7280'
                        : daysSince <= 7  ? '#34d399'
                        : daysSince <= 30 ? '#f59e0b'
                        : '#f87171';
                      return (
                        <tr key={h._id} style={s.tr}>
                          <td style={s.td}>
                            <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f9' }}>{centers.find(c => c._id === String(h._id))?.centerName || h.slug}</p>
                            <code style={{ ...s.slug, fontSize: 11 }}>{h.slug}</code>
                          </td>
                          <td style={s.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <UserCheck size={13} color="#818cf8" />
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{h.teachers}</span>
                              {h.maxTeachers && h.maxTeachers !== -1 && (
                                <span style={{ color: '#6b7280', fontSize: 11 }}>/ {h.maxTeachers}</span>
                              )}
                            </div>
                          </td>
                          <td style={s.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Users size={13} color="#34d399" />
                              <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{h.students}</span>
                              {h.maxStudents && h.maxStudents !== -1 && (
                                <span style={{ color: '#6b7280', fontSize: 11 }}>/ {h.maxStudents}</span>
                              )}
                            </div>
                          </td>
                          <td style={{ ...s.td, fontWeight: 700, color: h.bookingsThisMonth > 0 ? '#34d399' : '#6b7280' }}>
                            {h.bookingsThisMonth}
                          </td>
                          <td style={{ ...s.td, color: actColor, fontSize: 12, fontWeight: 600 }}>
                            {h.lastActivity
                              ? daysSince === 0 ? 'Today'
                              : daysSince === 1 ? 'Yesterday'
                              : `${daysSince}d ago`
                              : 'No bookings yet'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Usage Tab ── */}
        {tab === 'usage' && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={s.sectionTitle}><BarChart2 size={16} color="#f59e0b" /> Agora Usage — {usageMonth || 'All Time'}</h2>
              <button onClick={loadData} style={s.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
              Each row shows how many Agora minutes a center has used. Click a row to see the session-by-session breakdown for this month.
            </p>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading…</div>
            ) : usage.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                No Agora usage recorded yet. Minutes will appear here after centers complete calls.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Center', 'This Month', 'Last Month', 'All Time', 'Sessions', ''].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map(u => (
                      <React.Fragment key={u.centerId}>
                        <tr
                          style={{ ...s.tr, cursor: 'pointer' }}
                          onClick={() => toggleSessionDetail(u.centerId)}
                        >
                          <td style={s.td}>
                            <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{u.centerName}</p>
                            <code style={{ ...s.slug, fontSize: '11px' }}>{u.centerId}</code>
                          </td>
                          <td style={s.td}>
                            <span style={{ color: '#34d399', fontWeight: '700', fontSize: '15px' }}>{fmtMins(u.thisMonthMinutes)}</span>
                          </td>
                          <td style={s.td}>
                            <span style={{ color: '#9ca3af', fontWeight: '600' }}>{fmtMins(u.lastMonthMinutes)}</span>
                          </td>
                          <td style={s.td}>
                            <span style={{ color: '#f1f5f9', fontWeight: '600' }}>{fmtMins(u.totalMinutes)}</span>
                          </td>
                          <td style={s.td}>
                            <span style={{ color: '#6b7280', fontSize: '13px' }}>{u.sessions} sessions</span>
                          </td>
                          <td style={s.td}>
                            {loadingDetail[u.centerId]
                              ? <span style={{ color: '#6b7280', fontSize: '12px' }}>Loading…</span>
                              : expandedCenter === u.centerId
                                ? <ChevronUp size={15} color="#f59e0b" />
                                : <ChevronDown size={15} color="#6b7280" />
                            }
                          </td>
                        </tr>

                        {/* Session detail rows */}
                        {expandedCenter === u.centerId && sessionDetail[u.centerId] && (
                          <tr style={{ background: 'rgba(245,158,11,0.03)' }}>
                            <td colSpan={6} style={{ padding: '0 14px 14px' }}>
                              <div style={{
                                borderTop: '1px solid rgba(245,158,11,0.15)',
                                marginTop: '4px',
                                paddingTop: '12px',
                              }}>
                                <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#f59e0b', fontWeight: '700' }}>
                                  Sessions in {usageMonth} — Total: {fmtMins(sessionDetail[u.centerId].totalMinutes)}
                                </p>
                                {sessionDetail[u.centerId].sessions.length === 0 ? (
                                  <p style={{ color: '#6b7280', fontSize: '12px' }}>No sessions this month.</p>
                                ) : (
                                  <table style={{ ...s.table, fontSize: '12px' }}>
                                    <thead>
                                      <tr>
                                        {['Date', 'Channel', 'Duration', 'Participants'].map(h => (
                                          <th key={h} style={{ ...s.th, fontSize: '10px' }}>{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sessionDetail[u.centerId].sessions.map(sess => (
                                        <tr key={sess._id} style={s.tr}>
                                          <td style={{ ...s.td, color: '#9ca3af' }}>
                                            {new Date(sess.sessionDate).toLocaleDateString()} {new Date(sess.sessionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </td>
                                          <td style={{ ...s.td }}>
                                            <code style={{ ...s.slug, fontSize: '10px' }}>{sess.channelName || '—'}</code>
                                          </td>
                                          <td style={{ ...s.td, color: '#34d399', fontWeight: '600' }}>
                                            {fmtMins(sess.durationMinutes)}
                                          </td>
                                          <td style={{ ...s.td, color: '#9ca3af' }}>
                                            {sess.participantCount} {sess.participantCount === 1 ? 'person' : 'people'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Deleted Tab ── */}
        {tab === 'deleted' && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={s.sectionTitle}><Trash2 size={16} color="#ef4444" /> Scheduled for Deletion</h2>
              <button onClick={loadData} style={s.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b7280' }}>
              Centers below will be permanently deleted after their countdown expires. Restore them before the deadline to reactivate.
            </p>

            {deleted.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                No centers are currently scheduled for deletion.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Center', 'Slug', 'Deleted On', 'Permanent Deletion', 'Days Left', ''].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deleted.map(c => {
                      const days = daysRemaining(c.scheduledDeletionAt);
                      const urgent = days <= 2;
                      return (
                        <tr key={c._id} style={s.tr}>
                          <td style={s.td}>
                            <p style={{ margin: 0, fontWeight: '600', color: '#f1f5f9' }}>{c.centerName}</p>
                            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{c.adminEmail}</p>
                          </td>
                          <td style={s.td}><code style={s.slug}>{c.slug}</code></td>
                          <td style={{ ...s.td, fontSize: '12px', color: '#6b7280' }}>
                            {c.deletedAt ? new Date(c.deletedAt).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ ...s.td, fontSize: '12px', color: urgent ? '#f87171' : '#9ca3af', fontWeight: urgent ? '700' : '400' }}>
                            {c.scheduledDeletionAt ? new Date(c.scheduledDeletionAt).toLocaleDateString() : '—'}
                          </td>
                          <td style={s.td}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '13px', fontWeight: '700',
                              color: days === 0 ? '#ef4444' : urgent ? '#f59e0b' : '#34d399',
                            }}>
                              {days === 0 ? '⚠️ Expired' : `${days} day${days === 1 ? '' : 's'}`}
                            </span>
                          </td>
                          <td style={s.td}>
                            <button
                              onClick={() => handleRestore(c)}
                              disabled={restoring === c._id}
                              style={s.approveBtn}
                            >
                              <RotateCcw size={12} />
                              {restoring === c._id ? 'Restoring…' : 'Restore'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── AI Chat Credits Tab ── */}
        {tab === 'credits' && (
          <div style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: 10 }}>
              <h2 style={s.sectionTitle}><Zap size={16} color="#a78bfa" /> AI Chat Credits</h2>
              <button onClick={loadCredits} style={s.refreshBtn} title="Refresh"><RefreshCw size={14} /></button>
            </div>

            {/* Summary totals */}
            {creditTotals && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Total Allocated', value: creditTotals.totalAllocated.toLocaleString(), color: '#a78bfa' },
                  { label: 'Currently Available', value: creditTotals.totalBalance.toLocaleString(), color: '#34d399' },
                  { label: 'Total Used by Students', value: creditTotals.totalUsed.toLocaleString(), color: '#fb923c' },
                ].map(t => (
                  <div key={t.label} style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.label}</p>
                    <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: t.color }}>{t.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                value={creditSearch}
                onChange={e => setCreditSearch(e.target.value)}
                placeholder="Search centers..."
                style={{ ...s.input, paddingLeft: 32, width: '100%', boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontSize: 14 }}>🔍</span>
            </div>

            {creditLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading credits...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Center', 'Plan', 'Balance', 'Total Allocated', 'Used', 'Log', ''].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {creditCenters
                      .filter(c => !creditSearch || c.centerName.toLowerCase().includes(creditSearch.toLowerCase()) || c.slug.includes(creditSearch.toLowerCase()))
                      .map(c => (
                        <React.Fragment key={c._id}>
                          <tr style={s.tr}>
                            <td style={s.td}>
                              <p style={{ margin: 0, fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>{c.centerName}</p>
                              <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{c.adminEmail}</p>
                            </td>
                            <td style={s.td}>
                              <span style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{c.plan}</span>
                            </td>
                            <td style={s.td}>
                              <span style={{
                                fontWeight: 800, fontSize: 16,
                                color: c.balance === 0 ? '#ef4444' : c.balance <= 50 ? '#f59e0b' : '#34d399',
                              }}>{c.balance.toLocaleString()}</span>
                            </td>
                            <td style={{ ...s.td, color: '#9ca3af', fontSize: 13 }}>{c.totalAllocated.toLocaleString()}</td>
                            <td style={{ ...s.td, color: '#fb923c', fontSize: 13 }}>{c.used.toLocaleString()}</td>
                            <td style={s.td}>
                              {c.log.length > 0 ? (
                                <button
                                  onClick={() => setExpandedLog(expandedLog === c._id ? null : c._id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                                >
                                  {expandedLog === c._id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                  {c.log.length} entr{c.log.length === 1 ? 'y' : 'ies'}
                                </button>
                              ) : <span style={{ color: '#4b5563', fontSize: 11 }}>No log</span>}
                            </td>
                            <td style={s.td}>
                              <button
                                onClick={() => { setAllocModal(c); setAllocAmount(''); setAllocNote(''); setAllocMsg(''); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                              >
                                <Zap size={12} /> Allocate
                              </button>
                            </td>
                          </tr>
                          {expandedLog === c._id && (
                            <tr>
                              <td colSpan={7} style={{ ...s.td, background: 'rgba(167,139,250,0.04)', padding: '10px 16px' }}>
                                <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>Allocation Log (last 10)</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {c.log.map((entry, i) => (
                                    <div key={i} style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                                      <span style={{ color: '#34d399', fontWeight: 700, minWidth: 60 }}>+{entry.amount}</span>
                                      <span>{entry.note || '—'}</span>
                                      <span style={{ color: '#6b7280' }}>by {entry.by || '—'}</span>
                                      <span style={{ marginLeft: 'auto' }}>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB') : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Plan Editor Modal ── */}
      {planModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && !planSaving && setPlanModal(null)}>
          <div style={{ ...s.modal, maxWidth: 380 }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={16} color="#818cf8" />
                <span style={s.modalTitle}>Change Plan</span>
              </div>
              {!planSaving && <button onClick={() => setPlanModal(null)} style={s.closeBtn}><X size={18} /></button>}
            </div>

            <div style={{ padding: 24 }}>
              {/* Center info */}
              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{planModal.centerName}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{planModal.adminEmail}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#818cf8' }}>
                  Current plan: <strong style={{ textTransform: 'capitalize' }}>{planModal.plan || 'basic'}</strong>
                </p>
              </div>

              {/* Plan options */}
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select plan</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {[
                  { key: 'free',       label: 'Free',       desc: 'Basic access',          color: '#6b7280' },
                  { key: 'basic',      label: 'Basic',      desc: 'Standard features',     color: '#818cf8' },
                  { key: 'pro',        label: 'Pro',        desc: 'Advanced features',     color: '#34d399' },
                  { key: 'enterprise', label: 'Enterprise', desc: 'Unlimited everything',  color: '#f59e0b' },
                ].map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPlanSelected(p.key)}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: planSelected === p.key ? `2px solid ${p.color}` : '1px solid #374151',
                      background: planSelected === p.key ? `${p.color}18` : 'rgba(255,255,255,0.03)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: planSelected === p.key ? p.color : '#d1d5db' }}>{p.label}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{p.desc}</p>
                  </button>
                ))}
              </div>

              {planMsg && (
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: planMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{planMsg}</p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setPlanModal(null)}
                  disabled={planSaving}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >Cancel</button>
                <button
                  disabled={planSaving || planSelected === planModal.plan}
                  onClick={async () => {
                    setPlanSaving(true); setPlanMsg('');
                    try {
                      const res = await fetch(`${API_BASE}/super-admin/centers/${planModal._id}/plan`, {
                        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ plan: planSelected }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setCenters(prev => prev.map(c => c._id === planModal._id ? { ...c, plan: planSelected } : c));
                        setPlanModal(null);
                      } else {
                        setPlanMsg('❌ ' + (d.message || 'Failed to update plan'));
                      }
                    } catch { setPlanMsg('❌ Network error'); }
                    finally { setPlanSaving(false); }
                  }}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 10, border: 'none', fontFamily: 'inherit',
                    background: planSaving || planSelected === planModal.plan ? '#374151' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                    color: '#fff', fontWeight: 700, cursor: planSaving || planSelected === planModal.plan ? 'not-allowed' : 'pointer',
                  }}
                >{planSaving ? 'Saving…' : 'Save Plan'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Allocate Credits Modal ── */}
      {allocModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && !allocating && setAllocModal(null)}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Zap size={16} color="#a78bfa" />
                <span style={s.modalTitle}>Allocate AI Credits</span>
              </div>
              {!allocating && <button onClick={() => setAllocModal(null)} style={s.closeBtn}><X size={18} /></button>}
            </div>

            <div style={{ padding: 24 }}>
              {/* Center info */}
              <div style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{allocModal.centerName}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{allocModal.adminEmail}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
                  Current balance: <strong>{allocModal.balance.toLocaleString()}</strong> credits
                </p>
              </div>

              {/* Preset amounts */}
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick amounts</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {[100, 250, 500, 1000, 2000, 5000].map(n => (
                  <button
                    key={n}
                    onClick={() => setAllocAmount(String(n))}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      border: allocAmount === String(n) ? '2px solid #7c3aed' : '1px solid #374151',
                      background: allocAmount === String(n) ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                      color: allocAmount === String(n) ? '#a78bfa' : '#9ca3af',
                    }}
                  >{n.toLocaleString()}</button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Amount *</label>
              <input
                type="number" min="1" max="100000"
                value={allocAmount}
                onChange={e => setAllocAmount(e.target.value)}
                placeholder="e.g. 500"
                style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 12 }}
              />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Note (optional)</label>
              <input
                value={allocNote}
                onChange={e => setAllocNote(e.target.value)}
                placeholder="e.g. Monthly plan allocation"
                style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 18 }}
              />

              {allocMsg && (
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: allocMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{allocMsg}</p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setAllocModal(null)}
                  disabled={allocating}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer' }}
                >Cancel</button>
                <button
                  disabled={allocating || !allocAmount}
                  onClick={async () => {
                    const amt = parseInt(allocAmount, 10);
                    if (!amt || amt < 1 || amt > 100000) { setAllocMsg('Enter a valid amount (1–100,000)'); return; }
                    setAllocating(true); setAllocMsg('');
                    try {
                      const res = await fetch(`${API_BASE}/super-admin/chat-credits/${allocModal._id}`, {
                        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: amt, note: allocNote.trim() || undefined }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setAllocMsg(`✅ ${amt.toLocaleString()} credits allocated! New balance: ${d.balance.toLocaleString()}`);
                        // update local list
                        setCreditCenters(prev => prev.map(c =>
                          c._id === allocModal._id
                            ? { ...c, balance: d.balance, totalAllocated: d.totalAllocated, used: d.totalAllocated - d.balance }
                            : c
                        ));
                        setCreditTotals(prev => prev ? {
                          ...prev,
                          totalBalance:    prev.totalBalance    + amt,
                          totalAllocated:  prev.totalAllocated  + amt,
                        } : prev);
                        setAllocModal(null);
                      } else {
                        setAllocMsg('❌ ' + (d.message || 'Failed'));
                      }
                    } catch { setAllocMsg('❌ Network error'); }
                    finally { setAllocating(false); }
                  }}
                  style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: allocating || !allocAmount ? '#374151' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700, cursor: allocating || !allocAmount ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Send size={13} /> {allocating ? 'Allocating…' : 'Allocate Credits'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Seat Limits Modal ── */}
      {limitsModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && !limitsSaving && setLimitsModal(null)}>
          <div style={{ ...s.modal, maxWidth: 400 }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SlidersHorizontal size={16} color="#fb923c" />
                <span style={s.modalTitle}>Seat Limits</span>
              </div>
              {!limitsSaving && <button onClick={() => setLimitsModal(null)} style={s.closeBtn}><X size={18} /></button>}
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{limitsModal.centerName}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Current: {limitsModal.maxTeachers === -1 ? '∞' : limitsModal.maxTeachers} teachers / {limitsModal.maxStudents === -1 ? '∞' : limitsModal.maxStudents} students</p>
              </div>

              {/* Max Teachers */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Max Teachers</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: limitsUnlimT ? '#fb923c' : '#6b7280' }}>
                    <input type="checkbox" checked={limitsUnlimT} onChange={e => setLimitsUnlimT(e.target.checked)} />
                    Unlimited
                  </label>
                </div>
                <input
                  type="number" min="1" placeholder="e.g. 10"
                  disabled={limitsUnlimT}
                  value={limitsTeachers}
                  onChange={e => setLimitsTeachers(e.target.value)}
                  style={{ ...s.input, width: '100%', boxSizing: 'border-box', opacity: limitsUnlimT ? 0.4 : 1 }}
                />
              </div>

              {/* Max Students */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Max Students</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: limitsUnlimS ? '#fb923c' : '#6b7280' }}>
                    <input type="checkbox" checked={limitsUnlimS} onChange={e => setLimitsUnlimS(e.target.checked)} />
                    Unlimited
                  </label>
                </div>
                <input
                  type="number" min="1" placeholder="e.g. 100"
                  disabled={limitsUnlimS}
                  value={limitsStudents}
                  onChange={e => setLimitsStudents(e.target.value)}
                  style={{ ...s.input, width: '100%', boxSizing: 'border-box', opacity: limitsUnlimS ? 0.4 : 1 }}
                />
              </div>

              {limitsMsg && (
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: limitsMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{limitsMsg}</p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setLimitsModal(null)} disabled={limitsSaving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button
                  disabled={limitsSaving}
                  onClick={async () => {
                    setLimitsSaving(true); setLimitsMsg('');
                    const body = {
                      maxTeachers: limitsUnlimT ? -1 : Number(limitsTeachers),
                      maxStudents: limitsUnlimS ? -1 : Number(limitsStudents),
                    };
                    try {
                      const res = await fetch(`${API_BASE}/super-admin/centers/${limitsModal._id}/limits`, {
                        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setCenters(prev => prev.map(c => c._id === limitsModal._id
                          ? { ...c, maxTeachers: d.maxTeachers, maxStudents: d.maxStudents } : c));
                        setLimitsModal(null);
                      } else { setLimitsMsg('❌ ' + (d.message || 'Failed')); }
                    } catch { setLimitsMsg('❌ Network error'); }
                    finally { setLimitsSaving(false); }
                  }}
                  style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: limitsSaving ? '#374151' : 'linear-gradient(135deg,#fb923c,#ea580c)', color: '#fff', fontWeight: 700, cursor: limitsSaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >{limitsSaving ? 'Saving…' : 'Save Limits'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Broadcast Email Modal ── */}
      {broadcastModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && !broadcasting && setBroadcastModal(false)}>
          <div style={{ ...s.modal, maxWidth: 500 }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Megaphone size={16} color="#f59e0b" />
                <span style={s.modalTitle}>Broadcast to All Centers</span>
              </div>
              {!broadcasting && <button onClick={() => setBroadcastModal(false)} style={s.closeBtn}><X size={18} /></button>}
            </div>
            <div style={{ padding: 24 }}>
              {broadcastResult ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <CheckCircle size={40} color="#34d399" style={{ marginBottom: 12 }} />
                  <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Broadcast Sent!</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>{broadcastResult.sent} emails sent, {broadcastResult.failed} failed (of {broadcastResult.total} centers)</p>
                  <button onClick={() => setBroadcastModal(false)} style={{ ...s.approveBtn, marginTop: 20, padding: '8px 24px' }}>Done</button>
                </div>
              ) : (
                <>
                  <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#9ca3af' }}>
                    This will email <strong style={{ color: '#f59e0b' }}>all {centers.filter(c => c.status === 'active').length} active centers</strong> simultaneously.
                  </div>

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Subject *</label>
                  <input
                    value={broadcastSubject}
                    onChange={e => setBroadcastSubject(e.target.value)}
                    placeholder="e.g. Scheduled maintenance on Sunday"
                    style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 14 }}
                    disabled={broadcasting}
                  />

                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Message *</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    placeholder="Write your message here…"
                    rows={6}
                    style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 18, resize: 'vertical', height: 120 }}
                    disabled={broadcasting}
                  />

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setBroadcastModal(false)} disabled={broadcasting} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                    <button
                      disabled={broadcasting || !broadcastSubject.trim() || !broadcastMessage.trim()}
                      onClick={handleBroadcast}
                      style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: broadcasting || !broadcastSubject.trim() || !broadcastMessage.trim() ? '#374151' : 'linear-gradient(135deg,#f59e0b,#d97706)', color: broadcasting || !broadcastSubject.trim() || !broadcastMessage.trim() ? '#6b7280' : '#0c0a00', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                    >
                      <Send size={13} /> {broadcasting ? 'Sending…' : 'Send to All Centers'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && !deleting && setDeleteTarget(null)}>
          <div style={{ ...s.modal, maxWidth: '460px' }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span style={{ ...s.modalTitle, color: '#f87171' }}>Schedule Center Deletion</span>
              </div>
              {!deleting && <button onClick={() => setDeleteTarget(null)} style={s.closeBtn}><X size={18} /></button>}
            </div>

            <div style={{ padding: '24px' }}>
              {/* Center info */}
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '14px 16px', marginBottom: '18px' }}>
                <p style={{ margin: '0 0 4px', fontWeight: '700', color: '#f1f5f9', fontSize: '15px' }}>{deleteTarget.centerName}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{deleteTarget.adminEmail}</p>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#9ca3af', lineHeight: '1.6' }}>
                This center will <strong style={{ color: '#f1f5f9' }}>not be deleted immediately</strong>. Here's what will happen:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  { icon: '📧', text: 'A warning email is sent to the center admin immediately.' },
                  { icon: '⏳', text: 'The center is moved to an inactive "Deleted" tab for 7 days.' },
                  { icon: '🔄', text: 'You can restore it at any time before the deadline.' },
                  { icon: '🗑️', text: 'After 7 days, the center becomes permanently removed.' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: '#9ca3af' }}>
                    <span style={{ fontSize: '15px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ lineHeight: '1.5' }}>{text}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  style={s.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSoftDelete}
                  disabled={deleting}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                    padding: '10px 22px', borderRadius: '10px', border: 'none',
                    background: deleting ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg, #dc2626, #ef4444)',
                    color: 'white', fontSize: '14px', fontWeight: '700',
                    cursor: deleting ? 'wait' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Trash2 size={14} />
                  {deleting ? 'Scheduling…' : 'Yes, Schedule Deletion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Features Modal ── */}
      {featuresCenter && (() => {
        const f = featuresCenter.features || {};
        const FEATURE_LIST = [
          {
            key:         'agora',
            label:       'Agora Video Calling',
            description: 'In-platform video calls using Agora RTC. Disable if the center uses only Google Meet.',
            icon:        Video,
            color:       '#6366f1',
          },
          {
            key:         'googleMeet',
            label:       'Google Meet',
            description: 'Allow teachers to set a Google Meet link for external video calls.',
            icon:        Globe,
            color:       '#10b981',
          },
          {
            key:         'recording',
            label:       'Session Recording',
            description: 'Let teachers record and save class sessions.',
            icon:        Film,
            color:       '#f59e0b',
          },
          {
            key:         'pronunciation',
            label:       'AI Pronunciation',
            description: 'AI-powered pronunciation feedback for students.',
            icon:        Mic,
            color:       '#e11d48',
          },
        ];

        return (
          <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setFeaturesCenter(null)}>
            <div style={{ ...s.modal, maxWidth: '500px' }}>
              <div style={s.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ToggleRight size={18} color="#f59e0b" />
                  <span style={s.modalTitle}>Feature Access</span>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>for {featuresCenter.centerName}</span>
                </div>
                <button onClick={() => setFeaturesCenter(null)} style={s.closeBtn}><X size={18} /></button>
              </div>

              <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={s.stepDesc}>
                  Toggle features on or off for this center. Changes take effect immediately — the center will see the update on their next page load.
                </p>

                {FEATURE_LIST.map(({ key, label, description, icon: Icon, color }) => {
                  const enabled  = f[key] !== false; // default true if undefined
                  const saving   = savingFeature === key;
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '12px',
                      background: enabled ? `${color}0c` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${enabled ? `${color}30` : 'rgba(255,255,255,0.07)'}`,
                      transition: 'all 0.2s',
                    }}>
                      {/* Icon */}
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                        background: enabled ? `${color}18` : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={17} color={enabled ? color : '#4b5563'} />
                      </div>

                      {/* Label + description */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: '700', color: enabled ? '#f1f5f9' : '#6b7280' }}>
                          {label}
                        </p>
                        <p style={{ margin: 0, fontSize: '11.5px', color: '#6b7280', lineHeight: '1.4' }}>
                          {description}
                        </p>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => !saving && handleToggleFeature(featuresCenter._id, key, enabled)}
                        disabled={saving}
                        style={{
                          background: 'none', border: 'none', cursor: saving ? 'wait' : 'pointer',
                          padding: 0, flexShrink: 0, opacity: saving ? 0.5 : 1,
                          display: 'flex', alignItems: 'center',
                        }}
                        title={enabled ? 'Click to disable' : 'Click to enable'}
                      >
                        {enabled
                          ? <ToggleRight size={32} color={color} />
                          : <ToggleLeft  size={32} color="#4b5563" />
                        }
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Theme Picker Modal ── */}
      {themeCenter && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setThemeCenter(null)}>
          <div style={{ ...s.modal, maxWidth: '880px' }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Palette size={18} color="#f59e0b" />
                <span style={s.modalTitle}>Choose Theme</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>for {themeCenter.centerName}</span>
              </div>
              <button onClick={() => setThemeCenter(null)} style={s.closeBtn}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px 28px' }}>
              <p style={s.stepDesc}>
                Themes control colors, font, button shape, shadows and spacing — the full look of the platform for this center.
                The change takes effect the next time their page loads.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '14px',
                marginTop: '18px',
              }}>
                {THEMES.map(theme => {
                  const isActive   = themeCenter.branding?.theme === theme.id;
                  const isApplying = applyingTheme === theme.id;
                  const radiusPx   = parseInt(theme.borderRadius, 10);
                  const shapeLabel = radiusPx <= 4 ? 'Sharp' : radiusPx >= 14 ? 'Rounded' : 'Soft';

                  return (
                    <div key={theme.id} style={{
                      borderRadius: '14px',
                      border: isActive
                        ? `2px solid ${theme.primaryColor}`
                        : '2px solid rgba(255,255,255,0.08)',
                      background: isActive
                        ? `${theme.primaryColor}14`
                        : 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}>

                      {/* Mini visual preview */}
                      <div style={{
                        height: '76px',
                        background: theme.primaryColor,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}>
                        {/* Mock nav bar */}
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <div style={{ width: '20px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.9)' }} />
                          <div style={{ width: '30px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.4)' }} />
                          <div style={{ width: '22px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.4)' }} />
                        </div>
                        {/* Font sample + button */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '22px', fontWeight: '700', color: 'white',
                            fontFamily: `'${theme.fontFamily}', sans-serif`,
                            lineHeight: 1,
                          }}>Aa</span>
                          <div style={{
                            fontSize: '9px', fontWeight: '700',
                            padding: '4px 9px',
                            borderRadius: theme.borderRadius,
                            background: 'rgba(255,255,255,0.22)',
                            color: 'white',
                            fontFamily: `'${theme.fontFamily}', sans-serif`,
                          }}>Button</div>
                        </div>
                      </div>

                      {/* Secondary color strip */}
                      <div style={{
                        height: '10px',
                        background: theme.secondaryColor,
                      }} />

                      {/* Info section */}
                      <div style={{ padding: '12px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color={theme.primaryColor} />}
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#6b7280', lineHeight: '1.4' }}>
                          {theme.description}
                        </p>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {[shapeLabel, theme.spacing, theme.shadowStyle === 'none' ? 'flat' : `${theme.shadowStyle} shadow`].map(tag => (
                            <span key={tag} style={{
                              fontSize: '9px', padding: '2px 6px', borderRadius: '20px',
                              background: 'rgba(255,255,255,0.06)', color: '#6b7280', fontWeight: '600',
                            }}>{tag}</span>
                          ))}
                        </div>
                      </div>

                      {/* Apply button */}
                      <div style={{ padding: '8px 12px 12px' }}>
                        <button
                          onClick={() => !isApplying && !isActive && handleApplyTheme(themeCenter._id, theme)}
                          disabled={isApplying || isActive}
                          style={{
                            width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none',
                            background: isActive
                              ? `${theme.primaryColor}20`
                              : isApplying
                                ? 'rgba(255,255,255,0.05)'
                                : theme.primaryColor,
                            color: isActive ? theme.primaryColor : 'white',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isApplying || isActive ? 'default' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: isApplying ? 0.6 : 1,
                          }}
                        >
                          {isApplying ? 'Applying…' : isActive ? '✓ Active' : 'Apply Theme'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard Theme Assignment Modal ── */}
      {dashThemeModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setDashThemeModal(null)}>
          <div style={{ ...s.modal, maxWidth: '880px' }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Palette size={18} color="#06b6d4" />
                <span style={s.modalTitle}>Dashboard Theme</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>for {dashThemeModal.centerName}</span>
              </div>
              <button onClick={() => setDashThemeModal(null)} style={s.closeBtn}><X size={18} /></button>
            </div>

            {/* Student / Teacher tab selector */}
            <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { key: 'student', label: '🎓 Student Dashboards' },
                { key: 'teacher', label: '👩‍🏫 Teacher Dashboards' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setDashThemeTab(key)}
                  style={{ padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, color: dashThemeTab === key ? '#06b6d4' : '#6b7280', borderBottom: dashThemeTab === key ? '2px solid #06b6d4' : '2px solid transparent', marginBottom: '-1px', transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px 24px 28px' }}>
              {dashThemeTab === 'student' && (
                <p style={{ ...s.stepDesc, marginBottom: '6px' }}>
                  Each theme is <strong>exclusive</strong> — only one center can hold it. Students see this design after login. Themes change the entire layout, fonts, animations and vibe without affecting functionality.
                </p>
              )}
              {dashThemeTab === 'teacher' && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4b5563' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🚧</div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#9ca3af', marginBottom: '6px' }}>Teacher Dashboards Coming Soon</p>
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>We're building teacher dashboard designs. Student dashboards are being finalized first. Check back after all student designs are confirmed.</p>
                </div>
              )}
              {dashThemeTab === 'student' && dashThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: dashThemeMsg.toLowerCase().includes('already') || dashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: dashThemeMsg.toLowerCase().includes('already') || dashThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${dashThemeMsg.toLowerCase().includes('already') || dashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {dashThemeMsg}
                </div>
              )}

              {dashThemeTab === 'student' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {DASHBOARD_THEMES.map(theme => {
                  const isActive    = dashThemeModal.branding?.dashboardTheme === theme.id;
                  const takenBy     = !isActive && dashThemeAssignments[theme.id];
                  const isAssigning = assigningDashTheme === theme.id;
                  const isLocked    = !!takenBy;

                  return (
                    <div key={theme.id} style={{
                      borderRadius: '16px',
                      border: isActive ? `2px solid ${theme.preview.accent}` : isLocked ? '2px solid rgba(255,255,255,0.04)' : '2px solid rgba(255,255,255,0.08)',
                      background: isActive ? `${theme.preview.accent}15` : isLocked ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      opacity: isLocked ? 0.5 : 1,
                      transition: 'border-color .15s, background .15s',
                    }}>
                      {/* Preview — mini dashboard mockup */}
                      <div style={{ height: '100px', background: theme.preview.bg, position: 'relative', overflow: 'hidden', padding: '10px' }}>
                        {/* Mock nav bar */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          {[theme.preview.accent, `${theme.preview.accent}55`, `${theme.preview.accent}33`, `${theme.preview.accent}22`].map((bg, i) => (
                            <div key={i} style={{ height: '18px', flex: i === 0 ? '0 0 48px' : '1', background: bg, borderRadius: '6px' }} />
                          ))}
                        </div>
                        {/* Mock welcome banner */}
                        <div style={{ height: '28px', background: `linear-gradient(135deg, ${theme.preview.accent}, ${theme.preview.card === '#ffffff' ? '#ec4899' : theme.preview.accent}99)`, borderRadius: '8px', marginBottom: '6px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                          <span style={{ fontSize: '14px' }}>{theme.emoji}</span>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.6)', borderRadius: '3px', marginLeft: '6px' }} />
                        </div>
                        {/* Mock stat cards */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[0,1,2,3].map(i => (
                            <div key={i} style={{ flex: 1, height: '16px', background: theme.preview.card, border: `1px solid ${theme.preview.accent}30`, borderRadius: '5px' }} />
                          ))}
                        </div>
                        {/* Theme name overlay */}
                        <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '18px' }}>{theme.emoji}</div>
                      </div>

                      {/* Info */}
                      <div style={{ padding: '10px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color={theme.preview.accent} />}
                        </div>
                        <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>
                          {theme.description}
                        </p>
                        {takenBy && (
                          <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>
                            🔒 Held by {takenBy.name}
                          </p>
                        )}
                      </div>

                      {/* Action */}
                      <div style={{ padding: '4px 12px 12px' }}>
                        <button
                          onClick={() => !isAssigning && !isActive && !isLocked && handleAssignDashTheme(theme.id)}
                          disabled={isAssigning || isActive || isLocked}
                          style={{
                            width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none',
                            background: isActive ? `${theme.preview.accent}22` : isLocked ? 'rgba(255,255,255,0.04)' : theme.preview.accent,
                            color: isActive ? theme.preview.accent : isLocked ? '#4b5563' : 'white',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isAssigning || isActive || isLocked ? 'default' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: isAssigning ? 0.6 : 1,
                          }}
                        >
                          {isAssigning ? 'Assigning…' : isActive ? '✓ Assigned' : isLocked ? 'Taken' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>}

              {/* Unassign row — only on student tab */}
              {dashThemeTab === 'student' && dashThemeModal.branding?.dashboardTheme && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Remove student dashboard theme → falls back to default (Sunshine Explorer)
                  </span>
                  <button
                    onClick={handleUnassignDashTheme}
                    disabled={assigningDashTheme === '__unassign__'}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {assigningDashTheme === '__unassign__' ? 'Removing…' : 'Unassign'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Login Theme Assignment Modal ── */}
      {loginThemeModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setLoginThemeModal(null)}>
          <div style={{ ...s.modal, maxWidth: '820px' }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Palette size={18} color="#8b5cf6" />
                <span style={s.modalTitle}>Login Page Theme</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>for {loginThemeModal.centerName}</span>
              </div>
              <button onClick={() => setLoginThemeModal(null)} style={s.closeBtn}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px 28px' }}>
              <p style={{ ...s.stepDesc, marginBottom: '6px' }}>
                Each login theme is <strong>exclusive</strong> — only one center can hold it. Students see this page when they sign in.
              </p>
              {loginThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: loginThemeMsg.toLowerCase().includes('already') || loginThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: loginThemeMsg.toLowerCase().includes('already') || loginThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${loginThemeMsg.toLowerCase().includes('already') || loginThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {loginThemeMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {LOGIN_THEMES.map(theme => {
                  const isActive      = loginThemeModal.branding?.loginTheme === theme.id;
                  const takenBy       = !isActive && loginThemeAssignments[theme.id];
                  const isAssigning   = assigningLoginTheme === theme.id;
                  const isLocked      = !!takenBy;

                  return (
                    <div key={theme.id} style={{
                      borderRadius: '14px',
                      border: isActive ? '2px solid #8b5cf6' : isLocked ? '2px solid rgba(255,255,255,0.04)' : '2px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(139,92,246,0.12)' : isLocked ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      opacity: isLocked ? 0.5 : 1,
                      transition: 'border-color .15s, background .15s, opacity .15s',
                    }}>
                      {/* Preview gradient */}
                      <div style={{
                        height: '72px',
                        background: `linear-gradient(135deg, ${theme.preview.bgStart}, ${theme.preview.bgEnd})`,
                        position: 'relative',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '32px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.4))' }}>{theme.emoji}</span>
                        <div style={{
                          position: 'absolute', bottom: '8px', right: '8px',
                          width: '14px', height: '14px', borderRadius: '50%',
                          background: theme.preview.accent, boxShadow: `0 0 8px ${theme.preview.accent}`,
                        }} />
                      </div>

                      {/* Info */}
                      <div style={{ padding: '10px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color="#8b5cf6" />}
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>
                          {theme.description}
                        </p>
                        {takenBy && (
                          <p style={{ margin: '0 0 6px', fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>
                            🔒 Held by {takenBy.name}
                          </p>
                        )}
                      </div>

                      {/* Action */}
                      <div style={{ padding: '4px 12px 12px' }}>
                        <button
                          onClick={() => !isAssigning && !isActive && !isLocked && handleAssignLoginTheme(theme.id)}
                          disabled={isAssigning || isActive || isLocked}
                          style={{
                            width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none',
                            background: isActive ? 'rgba(139,92,246,0.2)' : isLocked ? 'rgba(255,255,255,0.04)' : '#8b5cf6',
                            color: isActive ? '#8b5cf6' : isLocked ? '#4b5563' : 'white',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isAssigning || isActive || isLocked ? 'default' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: isAssigning ? 0.6 : 1,
                          }}
                        >
                          {isAssigning ? 'Assigning…' : isActive ? '✓ Assigned' : isLocked ? 'Taken' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unassign row */}
              {loginThemeModal.branding?.loginTheme && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Remove login theme from this center → falls back to default (Space Explorer)
                  </span>
                  <button
                    onClick={handleUnassignLoginTheme}
                    disabled={assigningLoginTheme === '__unassign__'}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {assigningLoginTheme === '__unassign__' ? 'Removing…' : 'Unassign'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Center Modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={s.modal}>
            {/* Modal header */}
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={18} color="#f59e0b" />
                <span style={s.modalTitle}>Create New Center</span>
                {step !== 'done' && (
                  <span style={s.stepTag}>
                    Step {step === 'email' ? 1 : step === 'otp' ? 2 : 3} / 3
                  </span>
                )}
              </div>
              <button onClick={closeModal} style={s.closeBtn}><X size={18} /></button>
            </div>

            {/* ── Step 1: Email ── */}
            {step === 'email' && (
              <form onSubmit={handleSendOtp} style={s.modalForm}>
                <p style={s.stepDesc}>
                  Enter the admin&apos;s email address. We&apos;ll send a verification code to confirm it&apos;s valid.
                </p>

                <div style={s.field}>
                  <label style={s.label}>Admin Email *</label>
                  <input
                    style={s.input}
                    type="email"
                    placeholder="admin@thecenter.com"
                    value={form.adminEmail}
                    onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                {otpError && <ErrorBox msg={otpError} />}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={closeModal} style={s.cancelBtn}>Cancel</button>
                  <button type="submit" style={s.submitBtn} disabled={sendingOtp}>
                    <Mail size={14} />
                    {sendingOtp ? 'Sending…' : 'Send Verification Code'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 2: OTP ── */}
            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} style={s.modalForm}>
                <p style={s.stepDesc}>
                  A 6-digit code was sent to <strong style={{ color: '#f59e0b' }}>{form.adminEmail}</strong>.
                  Enter it below. The code expires in 10 minutes.
                </p>

                <div style={s.field}>
                  <label style={s.label}>Verification Code *</label>
                  <input
                    style={{ ...s.input, letterSpacing: '0.3em', fontSize: '22px', textAlign: 'center' }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                  />
                </div>

                {verifyErr && <ErrorBox msg={verifyErr} />}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setStep('email'); setOtpInput(''); setVerifyErr(''); }}
                    style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}
                  >
                    ← Change email
                  </button>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" onClick={closeModal} style={s.cancelBtn}>Cancel</button>
                    <button type="submit" style={s.submitBtn} disabled={verifying || otpInput.length < 6}>
                      <KeyRound size={14} />
                      {verifying ? 'Verifying…' : 'Verify Code'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Step 3: Center Details Form ── */}
            {step === 'form' && (
              <form onSubmit={handleCreateCenter} style={s.modalForm}>
                <p style={s.stepDesc}>
                  Email <strong style={{ color: '#34d399' }}>✓ verified</strong>. Fill in the center details below.
                </p>

                {createErr && <ErrorBox msg={createErr} />}

                {/* Row: Center Name */}
                <div style={s.field}>
                  <label style={s.label}>Center Name *</label>
                  <input
                    style={s.input}
                    type="text"
                    placeholder="e.g. Greenfield Academy"
                    value={form.centerName}
                    onChange={e => handleCenterNameChange(e.target.value)}
                    required
                    disabled={creating}
                  />
                </div>

                {/* Row: Slug */}
                <div style={s.field}>
                  <label style={s.label}>Slug * <span style={{ color: '#6b7280', fontWeight: '400', textTransform: 'none' }}>(auto-generated, editable)</span></label>
                  <input
                    style={s.input}
                    type="text"
                    placeholder="greenfield-academy"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    required
                    disabled={creating}
                  />
                </div>

                {/* Row: Password + Phone */}
                <div style={s.twoCol}>
                  <div style={s.field}>
                    <label style={s.label}>Admin Password *</label>
                    <div style={s.passwordWrap}>
                      <input
                        style={{ ...s.input, border: 'none', padding: '0', flex: 1, background: 'transparent' }}
                        type={showPwd ? 'text' : 'password'}
                        placeholder="Min 8 characters"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        required
                        disabled={creating}
                        minLength={8}
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)} style={s.eyeBtn}>
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Phone</label>
                    <input
                      style={s.input}
                      type="text"
                      placeholder="+1234567890"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      disabled={creating}
                    />
                  </div>
                </div>

                {/* Row: Plan + Timezone */}
                <div style={s.twoCol}>
                  <div style={s.field}>
                    <label style={s.label}>Plan *</label>
                    <select
                      style={s.input}
                      value={form.plan}
                      onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}
                      disabled={creating}
                    >
                      {['free', 'basic', 'pro', 'enterprise'].map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Timezone</label>
                    <select
                      style={s.input}
                      value={form.timezone}
                      onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
                      disabled={creating}
                    >
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row: Country + Address */}
                <div style={s.twoCol}>
                  <div style={s.field}>
                    <label style={s.label}>Country</label>
                    <input
                      style={s.input}
                      type="text"
                      placeholder="e.g. Nigeria"
                      value={form.country}
                      onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                      disabled={creating}
                    />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>City / Address</label>
                    <input
                      style={s.input}
                      type="text"
                      placeholder="e.g. Lagos"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      disabled={creating}
                    />
                  </div>
                </div>

                {/* Row: Website + Limits */}
                <div style={s.twoCol}>
                  <div style={s.field}>
                    <label style={s.label}>Website</label>
                    <input
                      style={s.input}
                      type="url"
                      placeholder="https://thecenter.com"
                      value={form.website}
                      onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                      disabled={creating}
                    />
                  </div>
                  <div style={s.twoCol}>
                    <div style={s.field}>
                      <label style={s.label}>Max Teachers</label>
                      <input
                        style={s.input}
                        type="number"
                        min="1"
                        placeholder="∞"
                        value={form.maxTeachers}
                        onChange={e => setForm(f => ({ ...f, maxTeachers: e.target.value }))}
                        disabled={creating}
                      />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Max Students</label>
                      <input
                        style={s.input}
                        type="number"
                        min="1"
                        placeholder="∞"
                        value={form.maxStudents}
                        onChange={e => setForm(f => ({ ...f, maxStudents: e.target.value }))}
                        disabled={creating}
                      />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div style={s.field}>
                  <label style={s.label}>Description <span style={{ color: '#6b7280', fontWeight: '400', textTransform: 'none' }}>(optional)</span></label>
                  <textarea
                    style={{ ...s.input, height: '72px', resize: 'vertical' }}
                    placeholder="A brief description of what this center offers…"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    disabled={creating}
                  />
                </div>

                <div style={s.modalNote}>
                  The center will be registered and activated immediately. The admin can log in right away using the email and password above.
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={closeModal} style={s.cancelBtn} disabled={creating}>Cancel</button>
                  <button type="submit" style={s.submitBtn} disabled={creating}>
                    {creating ? 'Creating…' : 'Create & Activate Center'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Done ── */}
            {step === 'done' && (
              <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', textAlign: 'center' }}>
                <CheckCircle size={40} color="#34d399" />
                <p style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#f1f5f9' }}>Center Created!</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af', maxWidth: '360px', lineHeight: '1.6' }}>{successMsg}</p>
                <button onClick={closeModal} style={{ ...s.submitBtn, marginTop: '8px' }}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: '8px', padding: '10px 14px',
    }}>
      <XCircle size={15} color="#f87171" />
      <span style={{ color: '#f87171', fontSize: '13px' }}>{msg}</span>
    </div>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    background: '#09080e',
    color: '#f1f5f9',
    fontFamily: "'Sora', 'Segoe UI', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 28px',
    background: 'rgba(245,158,11,0.06)',
    borderBottom: '1px solid rgba(245,158,11,0.12)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerTitle: { fontSize: '18px', fontWeight: '700', color: '#f1f5f9' },
  headerSub:   { fontSize: '13px', color: '#6b7280' },
  createBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '8px',
    background: 'linear-gradient(135deg, #b45309, #f59e0b)',
    border: 'none', color: '#0c0a00',
    fontSize: '13px', fontWeight: '700',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  logoutBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', borderRadius: '8px',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#f87171', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  body: { padding: '28px', maxWidth: '1100px', margin: '0 auto' },
  statsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px', marginBottom: '24px',
  },
  statCard: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '18px 20px', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  statIcon: {
    width: '40px', height: '40px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statValue: { margin: '0 0 2px', fontSize: '24px', fontWeight: '700', color: '#f1f5f9' },
  statLabel: { margin: 0, fontSize: '12px', color: '#6b7280' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
  },
  tabBtnActive: {
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
    color: '#f59e0b',
  },
  tabBadge: {
    minWidth: '18px', height: '18px', borderRadius: '9px',
    background: '#f59e0b', color: '#0c0a00',
    fontSize: '10px', fontWeight: '800',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 4px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px', padding: '20px',
  },
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '15px', fontWeight: '700', color: '#f1f5f9',
    margin: 0,
  },
  refreshBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '7px', color: '#6b7280', cursor: 'pointer',
    padding: '6px', display: 'flex', alignItems: 'center',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '10px 14px',
    fontSize: '11px', fontWeight: '700', letterSpacing: '0.08em',
    color: '#6b7280', textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '12px 14px', verticalAlign: 'middle' },
  slug: {
    fontSize: '12px', padding: '2px 8px', borderRadius: '6px',
    background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
    fontFamily: 'monospace',
  },
  planBadge: {
    fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
    background: 'rgba(99,102,241,0.12)', color: '#818cf8',
    fontWeight: '600', textTransform: 'capitalize',
  },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    fontSize: '12px', fontWeight: '600',
    padding: '3px 10px', borderRadius: '20px',
    border: '1px solid', textTransform: 'capitalize',
  },
  approveBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
    background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
    color: '#34d399', cursor: 'pointer', fontFamily: 'inherit',
  },
  rejectBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#f87171', cursor: 'pointer', fontFamily: 'inherit',
  },
  suspendBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
    color: '#f59e0b', cursor: 'pointer', fontFamily: 'inherit',
  },
  themeBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
    color: '#818cf8', cursor: 'pointer', fontFamily: 'inherit',
  },
  featuresBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: '600',
    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
    color: '#34d399', cursor: 'pointer', fontFamily: 'inherit',
  },
  deleteBtn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '5px 8px', borderRadius: '7px', fontSize: '12px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    color: '#f87171', cursor: 'pointer', fontFamily: 'inherit',
  },

  // Modal
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    background: '#110f1a',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '18px',
    width: '100%', maxWidth: '620px',
    maxHeight: '92vh', overflowY: 'auto',
    boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    position: 'sticky', top: 0, background: '#110f1a', zIndex: 1,
  },
  modalTitle: { fontSize: '16px', fontWeight: '700', color: '#f1f5f9' },
  stepTag: {
    fontSize: '11px', fontWeight: '700',
    background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
    padding: '2px 8px', borderRadius: '20px',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#6b7280',
    cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
  },
  modalForm: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  stepDesc: { margin: 0, fontSize: '13.5px', color: '#9ca3af', lineHeight: '1.6' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '11.5px', fontWeight: '700', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.07em',
  },
  input: {
    width: '100%', padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: '#f1f5f9',
    fontSize: '14px', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  },
  passwordWrap: {
    display: 'flex', alignItems: 'center',
    padding: '0 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', height: '42px', gap: '8px',
  },
  eyeBtn: {
    background: 'none', border: 'none', color: '#6b7280',
    cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
  },
  modalNote: {
    fontSize: '12px', color: '#6b7280',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.12)',
    borderRadius: '8px', padding: '10px 14px',
    lineHeight: '1.5',
  },
  cancelBtn: {
    padding: '10px 20px', borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#9ca3af', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  submitBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '10px 22px', borderRadius: '10px',
    background: 'linear-gradient(135deg, #b45309, #f59e0b)',
    border: 'none', color: '#0c0a00',
    fontSize: '14px', fontWeight: '700',
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
