// src/pages/super-admin/SuperAdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabErrorBoundary } from '../../components/ErrorBoundary';
import { useAuth }           from '../../context/AuthContext.jsx';
import {
  Crown, LogOut, Building2, CheckCircle, Clock,
  XCircle, PauseCircle, Plus, X, Eye, EyeOff,
  Globe, RefreshCw, Trash2, Mail, KeyRound, Palette,
  BarChart2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Video, Mic, Film,
  AlertTriangle, RotateCcw, Zap, Send, Activity, Users, UserCheck, LogIn, Megaphone, SlidersHorizontal, Award, Sun, Moon, Menu,
} from 'lucide-react';
import api from '../../api';
import { TIMEZONE_OPTIONS } from '../../utils/timezone';
import { THEMES } from '../../data/themes';
import { LOGIN_THEMES, TEACHER_LOGIN_THEMES, ADMIN_LOGIN_THEMES } from '../../data/loginThemes';
import { DASHBOARD_THEMES } from '../../data/dashboardThemes';
import { TEACHER_DASHBOARD_THEMES } from '../../data/teacherDashboardThemes';
import { ADMIN_DASHBOARD_THEMES }       from '../../data/adminDashboardThemes';
import { SUBADMIN_DASHBOARD_THEMES }   from '../../data/subAdminDashboardThemes';
import CentersTab  from './tabs/CentersTab';
import DomainsTab  from './tabs/DomainsTab';
import HealthTab   from './tabs/HealthTab';
import UsageTab    from './tabs/UsageTab';
import PeopleTab   from './tabs/PeopleTab';
import ClassesTab  from './tabs/ClassesTab';
import DeletedTab  from './tabs/DeletedTab';
import CreditsTab             from './tabs/CreditsTab';
import CertificateTemplatesTab from './tabs/CertificateTemplatesTab';
import LandingPagesTab         from './tabs/LandingPagesTab';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';


const EMPTY_FORM = {
  centerName: '', slug: '', adminEmail: '', password: '',
  phone: '', country: '', plan: 'basic',
  website: '', description: '', timezone: 'UTC',
  address: '', maxTeachers: '', maxStudents: '',
};

// OTP step: 'email' → 'otp' → 'form' → 'done'
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { logout: authLogout } = useAuth();

  // Super-admin uses localStorage exclusively. Read token and info directly so
  // a concurrent teacher/student session (in sessionStorage) can't shadow them.
  const superAdminToken = localStorage.getItem('superAdminToken');
  const info = (() => {
    try { return JSON.parse(localStorage.getItem('superAdminInfo') || 'null'); } catch { return null; }
  })();
  const authHeaders = { Authorization: `Bearer ${superAdminToken}` };

  const [stats,       setStats]       = useState(null);
  const [centers,     setCenters]     = useState([]);
  const [domains,     setDomains]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('centers');
  const [error,       setError]       = useState('');
  const [isMobile,    setIsMobile]    = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('saAdminDark') !== 'false');

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
  const [detailMonth,   setDetailMonth]   = useState(''); // month shown in session drill-down
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

  // ── Website (landing page) cross-tab navigation ───────────────────────────
  const [websitesFocusId, setWebsitesFocusId] = useState(null); // centerId to auto-expand in Websites tab

  const handleEditWebsite = (center) => {
    setWebsitesFocusId(center._id);
    setTab('websites');
  };

  // ── Broadcast email ───────────────────────────────────────────────────────
  const [broadcastModal,   setBroadcastModal]   = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting,     setBroadcasting]     = useState(false);
  const [broadcastResult,  setBroadcastResult]  = useState(null);
  const [broadcastTarget,  setBroadcastTarget]  = useState('all'); // 'all' | center _id

  // ── AI Chat Credits ───────────────────────────────────────────────────────
  const [creditCenters,    setCreditCenters]    = useState([]);
  const [creditTotals,     setCreditTotals]     = useState(null);
  const [creditLoading,    setCreditLoading]    = useState(false);
  const [allocModal,       setAllocModal]       = useState(null);
  const [allocAmount,      setAllocAmount]      = useState('');
  const [allocNote,        setAllocNote]        = useState('');
  const [allocating,       setAllocating]       = useState(false);
  const [allocMsg,         setAllocMsg]         = useState('');
  const [creditSearch,     setCreditSearch]     = useState('');
  const [expandedLog,      setExpandedLog]      = useState(null);

  // ── Pronunciation Credits ─────────────────────────────────────────────────
  const [pronCenters,      setPronCenters]      = useState([]);
  const [pronTotals,       setPronTotals]       = useState(null);
  const [pronLoading,      setPronLoading]      = useState(false);
  const [pronAllocModal,   setPronAllocModal]   = useState(null);
  const [pronAllocAmount,  setPronAllocAmount]  = useState('');
  const [pronAllocNote,    setPronAllocNote]    = useState('');
  const [pronAllocating,   setPronAllocating]   = useState(false);
  const [pronAllocMsg,     setPronAllocMsg]     = useState('');
  const [pronSearch,       setPronSearch]       = useState('');
  const [pronExpandedLog,  setPronExpandedLog]  = useState(null);

  // ── People tab ───────────────────────────────────────────────────────────
  const [peopleCenter,  setPeopleCenter]  = useState('');
  const [peopleData,    setPeopleData]    = useState({ teachers: [], students: [] });
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleSubTab,  setPeopleSubTab]  = useState('teachers');
  const [peopleSearch,  setPeopleSearch]  = useState('');

  // ── Classes tab ──────────────────────────────────────────────────────────
  const [classesData,         setClassesData]         = useState([]);
  const [classesLoading,      setClassesLoading]      = useState(false);
  const [classesDateFrom,     setClassesDateFrom]     = useState('');
  const [classesDateTo,       setClassesDateTo]       = useState('');
  const [classesFilterCenter, setClassesFilterCenter] = useState('');
  const [classesGrandTotal,   setClassesGrandTotal]   = useState(0);
  const [classesExpanded,     setClassesExpanded]     = useState(null);

  // ── Dashboard theme assignment ────────────────────────────────────────────
  const [dashThemeModal,      setDashThemeModal]      = useState(null);
  const [dashThemeAssignments,setDashThemeAssignments]= useState({});
  const [assigningDashTheme,  setAssigningDashTheme]  = useState(null);
  const [dashThemeMsg,        setDashThemeMsg]        = useState('');
  const [dashThemeTab,              setDashThemeTab]              = useState('student'); // 'student' | 'teacher' | 'admin' | 'subadmin'
  const [teacherDashThemeAssignments, setTeacherDashThemeAssignments] = useState({});
  const [assigningTeacherDashTheme,   setAssigningTeacherDashTheme]   = useState(null);
  const [teacherDashThemeMsg,         setTeacherDashThemeMsg]         = useState('');
  const [adminDashThemeAssignments,   setAdminDashThemeAssignments]   = useState({});
  const [assigningAdminDashTheme,     setAssigningAdminDashTheme]     = useState(null);
  const [adminDashThemeMsg,           setAdminDashThemeMsg]           = useState('');
  const [subAdminDashThemeAssignments, setSubAdminDashThemeAssignments] = useState({});
  const [assigningSubAdminDashTheme,   setAssigningSubAdminDashTheme]   = useState(null);
  const [subAdminDashThemeMsg,         setSubAdminDashThemeMsg]         = useState('');

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
    setTeacherDashThemeMsg('');
    setAdminDashThemeMsg('');
    setSubAdminDashThemeMsg('');
    loadDashThemeAssignments();
    loadTeacherDashThemeAssignments();
    loadAdminDashThemeAssignments();
    loadSubAdminDashThemeAssignments();
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

  // ── Teacher dashboard theme assignment ────────────────────────────────────
  const loadTeacherDashThemeAssignments = async () => {
    try {
      const res  = await fetch(`${API_BASE}/super-admin/teacher-dashboard-themes`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setTeacherDashThemeAssignments(data.assignments);
    } catch (_) {}
  };

  const handleAssignTeacherDashTheme = async (themeId) => {
    if (!dashThemeModal) return;
    setAssigningTeacherDashTheme(themeId);
    setTeacherDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/teacher-dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherDashboardTheme: themeId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, teacherDashboardTheme: themeId } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, teacherDashboardTheme: themeId } } : c
      ));
      setTeacherDashThemeMsg(data.message);
      loadTeacherDashThemeAssignments();
    } catch (err) {
      setTeacherDashThemeMsg(err.message || 'Failed to assign theme');
    } finally {
      setAssigningTeacherDashTheme(null);
    }
  };

  const handleUnassignTeacherDashTheme = async () => {
    if (!dashThemeModal) return;
    setAssigningTeacherDashTheme('__unassign__');
    setTeacherDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/teacher-dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherDashboardTheme: null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, teacherDashboardTheme: null } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, teacherDashboardTheme: null } } : c
      ));
      setTeacherDashThemeMsg('Teacher dashboard theme unassigned');
      loadTeacherDashThemeAssignments();
    } catch (err) {
      setTeacherDashThemeMsg(err.message || 'Failed to unassign');
    } finally {
      setAssigningTeacherDashTheme(null);
    }
  };

  // ── Admin dashboard theme assignment ─────────────────────────────────────
  const loadAdminDashThemeAssignments = async () => {
    try {
      const res  = await fetch(`${API_BASE}/super-admin/admin-dashboard-themes`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setAdminDashThemeAssignments(data.assignments);
    } catch (_) {}
  };

  const handleAssignAdminDashTheme = async (themeId) => {
    if (!dashThemeModal) return;
    setAssigningAdminDashTheme(themeId);
    setAdminDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/admin-dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminDashboardTheme: themeId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, adminDashboardTheme: themeId } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, adminDashboardTheme: themeId } } : c
      ));
      setAdminDashThemeMsg(data.message);
      loadAdminDashThemeAssignments();
    } catch (err) {
      setAdminDashThemeMsg(err.message || 'Failed to assign theme');
    } finally {
      setAssigningAdminDashTheme(null);
    }
  };

  const handleUnassignAdminDashTheme = async () => {
    if (!dashThemeModal) return;
    setAssigningAdminDashTheme('__unassign__');
    setAdminDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/admin-dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminDashboardTheme: null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, adminDashboardTheme: null } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, adminDashboardTheme: null } } : c
      ));
      setAdminDashThemeMsg('Admin dashboard theme unassigned');
      loadAdminDashThemeAssignments();
    } catch (err) {
      setAdminDashThemeMsg(err.message || 'Failed to unassign');
    } finally {
      setAssigningAdminDashTheme(null);
    }
  };

  // ── Sub-admin dashboard theme assignment ──────────────────────────────────
  const loadSubAdminDashThemeAssignments = async () => {
    try {
      const res  = await fetch(`${API_BASE}/super-admin/sub-admin-dashboard-themes`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setSubAdminDashThemeAssignments(data.assignments);
    } catch (_) {}
  };

  const handleAssignSubAdminDashTheme = async (themeId) => {
    if (!dashThemeModal) return;
    setAssigningSubAdminDashTheme(themeId);
    setSubAdminDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/sub-admin-dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subAdminDashboardTheme: themeId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, subAdminDashboardTheme: themeId } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, subAdminDashboardTheme: themeId } } : c
      ));
      setSubAdminDashThemeMsg(data.message);
      loadSubAdminDashThemeAssignments();
    } catch (err) {
      setSubAdminDashThemeMsg(err.message || 'Failed to assign theme');
    } finally {
      setAssigningSubAdminDashTheme(null);
    }
  };

  const handleUnassignSubAdminDashTheme = async () => {
    if (!dashThemeModal) return;
    setAssigningSubAdminDashTheme('__unassign__');
    setSubAdminDashThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${dashThemeModal._id}/sub-admin-dashboard-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subAdminDashboardTheme: null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setDashThemeModal(c => c ? { ...c, branding: { ...c.branding, subAdminDashboardTheme: null } } : c);
      setCenters(cs => cs.map(c =>
        c._id === dashThemeModal._id ? { ...c, branding: { ...c.branding, subAdminDashboardTheme: null } } : c
      ));
      setSubAdminDashThemeMsg('Sub-admin dashboard theme unassigned');
      loadSubAdminDashThemeAssignments();
    } catch (err) {
      setSubAdminDashThemeMsg(err.message || 'Failed to unassign');
    } finally {
      setAssigningSubAdminDashTheme(null);
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

  // ── Teacher login theme assignment ────────────────────────────────────────
  const [teacherThemeModal,      setTeacherThemeModal]      = useState(null);
  const [teacherThemeAssignments,setTeacherThemeAssignments]= useState({});
  const [assigningTeacherTheme,  setAssigningTeacherTheme]  = useState(null);
  const [teacherThemeMsg,        setTeacherThemeMsg]        = useState('');

  const loadTeacherThemeAssignments = async () => {
    try {
      const res  = await fetch(`${API_BASE}/super-admin/teacher-login-themes`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setTeacherThemeAssignments(data.assignments);
    } catch (_) {}
  };

  const handleOpenTeacherThemeModal = (center) => {
    setTeacherThemeModal(center);
    setTeacherThemeMsg('');
    loadTeacherThemeAssignments();
  };

  const handleAssignTeacherTheme = async (themeId) => {
    if (!teacherThemeModal) return;
    setAssigningTeacherTheme(themeId);
    setTeacherThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${teacherThemeModal._id}/teacher-login-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherLoginTheme: themeId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setTeacherThemeModal(c => c ? { ...c, branding: { ...c.branding, teacherLoginTheme: themeId } } : c);
      setCenters(cs => cs.map(c =>
        c._id === teacherThemeModal._id ? { ...c, branding: { ...c.branding, teacherLoginTheme: themeId } } : c
      ));
      setTeacherThemeMsg(data.message);
      loadTeacherThemeAssignments();
    } catch (err) {
      setTeacherThemeMsg(err.message || 'Failed to assign theme');
    } finally {
      setAssigningTeacherTheme(null);
    }
  };

  const handleUnassignTeacherTheme = async () => {
    if (!teacherThemeModal) return;
    setAssigningTeacherTheme('__unassign__');
    setTeacherThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${teacherThemeModal._id}/teacher-login-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherLoginTheme: null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setTeacherThemeModal(c => c ? { ...c, branding: { ...c.branding, teacherLoginTheme: null } } : c);
      setCenters(cs => cs.map(c =>
        c._id === teacherThemeModal._id ? { ...c, branding: { ...c.branding, teacherLoginTheme: null } } : c
      ));
      setTeacherThemeMsg('Teacher login theme unassigned');
      loadTeacherThemeAssignments();
    } catch (err) {
      setTeacherThemeMsg(err.message || 'Failed to unassign');
    } finally {
      setAssigningTeacherTheme(null);
    }
  };

  // ── Admin login theme assignment ─────────────────────────────────────────
  const [adminLoginThemeModal,      setAdminLoginThemeModal]      = useState(null);
  const [adminLoginThemeAssignments,setAdminLoginThemeAssignments]= useState({});
  const [assigningAdminLoginTheme,  setAssigningAdminLoginTheme]  = useState(null);
  const [adminLoginThemeMsg,        setAdminLoginThemeMsg]        = useState('');

  const loadAdminLoginThemeAssignments = async () => {
    try {
      const res  = await fetch(`${API_BASE}/super-admin/admin-login-themes`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setAdminLoginThemeAssignments(data.assignments);
    } catch (_) {}
  };

  const handleOpenAdminLoginThemeModal = (center) => {
    setAdminLoginThemeModal(center);
    setAdminLoginThemeMsg('');
    loadAdminLoginThemeAssignments();
  };

  const handleAssignAdminLoginTheme = async (themeId) => {
    if (!adminLoginThemeModal) return;
    setAssigningAdminLoginTheme(themeId);
    setAdminLoginThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${adminLoginThemeModal._id}/admin-login-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminLoginTheme: themeId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setAdminLoginThemeModal(c => c ? { ...c, branding: { ...c.branding, adminLoginTheme: themeId } } : c);
      setCenters(cs => cs.map(c =>
        c._id === adminLoginThemeModal._id ? { ...c, branding: { ...c.branding, adminLoginTheme: themeId } } : c
      ));
      setAdminLoginThemeMsg(data.message);
      loadAdminLoginThemeAssignments();
    } catch (err) {
      setAdminLoginThemeMsg(err.message || 'Failed to assign theme');
    } finally {
      setAssigningAdminLoginTheme(null);
    }
  };

  const handleUnassignAdminLoginTheme = async () => {
    if (!adminLoginThemeModal) return;
    setAssigningAdminLoginTheme('__unassign__');
    setAdminLoginThemeMsg('');
    try {
      const res  = await fetch(`${API_BASE}/super-admin/centers/${adminLoginThemeModal._id}/admin-login-theme`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminLoginTheme: null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setAdminLoginThemeModal(c => c ? { ...c, branding: { ...c.branding, adminLoginTheme: null } } : c);
      setCenters(cs => cs.map(c =>
        c._id === adminLoginThemeModal._id ? { ...c, branding: { ...c.branding, adminLoginTheme: null } } : c
      ));
      setAdminLoginThemeMsg('Admin login theme unassigned');
      loadAdminLoginThemeAssignments();
    } catch (err) {
      setAdminLoginThemeMsg(err.message || 'Failed to unassign');
    } finally {
      setAssigningAdminLoginTheme(null);
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
        if (u.success)   { setUsage(u.summary); setUsageMonth(u.thisMonth); setDetailMonth(prev => prev || u.thisMonth); }
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

  const loadPronCredits = useCallback(() => {
    setPronLoading(true);
    fetch(`${API_BASE}/super-admin/pronunciation-credits`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success) { setPronCenters(d.centers); setPronTotals(d.totals); } })
      .catch(() => {})
      .finally(() => setPronLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCenterPeople = useCallback((centerId) => {
    if (!centerId) return;
    setPeopleLoading(true);
    fetch(`${API_BASE}/super-admin/centers/${centerId}/people`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => { if (d.success) setPeopleData(d.data || { teachers: [], students: [] }); })
      .catch(() => {})
      .finally(() => setPeopleLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadClasses = useCallback((from, to, centerId) => {
    setClassesLoading(true);
    const params = new URLSearchParams();
    if (from)     params.set('from', from);
    if (to)       params.set('to', to);
    if (centerId) params.set('center', centerId);
    fetch(`${API_BASE}/super-admin/classes?${params}`, { headers: authHeaders })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setClassesData(d.centers || []);
          setClassesGrandTotal(d.grandTotal || 0);
        }
      })
      .catch(() => {})
      .finally(() => setClassesLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'credits') { loadCredits(); loadPronCredits(); } }, [tab, loadCredits, loadPronCredits]);
  useEffect(() => { if (tab === 'health')  loadHealth();  }, [tab, loadHealth]);
  useEffect(() => { if (tab === 'classes') loadClasses('', '', ''); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { localStorage.setItem('saAdminDark', String(darkMode)); }, [darkMode]);

  const handleLogout = () => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminInfo');
    authLogout();
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
  const changeDetailMonth = (month) => {
    setDetailMonth(month);
    setSessionDetail({});   // clear cache so rows re-fetch with new month
    setExpandedCenter(null);
  };

  const toggleSessionDetail = async (centerId) => {
    if (expandedCenter === centerId) { setExpandedCenter(null); return; }
    setExpandedCenter(centerId);
    if (sessionDetail[centerId]) return; // already loaded for current detailMonth
    setLoadingDetail(d => ({ ...d, [centerId]: true }));
    try {
      const res  = await fetch(`${API_BASE}/super-admin/usage/${centerId}?month=${detailMonth}`, { headers: authHeaders });
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
      const body = { subject: broadcastSubject, message: broadcastMessage };
      if (broadcastTarget !== 'all') body.centerId = broadcastTarget;
      const res  = await fetch(`${API_BASE}/super-admin/broadcast`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const s = buildStyles(darkMode, isMobile, sidebarOpen);
  const TABS = [
    { key: 'centers',      label: 'Centers',        icon: Building2  },
    { key: 'health',       label: 'Health',          icon: Activity   },
    { key: 'domains',      label: 'Custom Domains',  icon: Globe      },
    { key: 'usage',        label: 'Agora Usage',     icon: BarChart2  },
    { key: 'people',       label: 'People',          icon: Users      },
    { key: 'classes',      label: 'Classes',         icon: Video      },
    { key: 'credits',      label: 'AI Credits',      icon: Zap        },
    { key: 'certificates', label: 'Certificates',    icon: Award      },
    { key: 'websites',     label: 'Websites',        icon: Globe      },
    { key: 'deleted',      label: 'Deleted',         icon: Trash2     },
  ];

  return (
    <div style={s.root}>

      {/* ── Mobile sidebar backdrop ── */}
      <div style={s.sidebarOverlay} onClick={() => setSidebarOpen(false)} />

      {/* ── Sidebar ── */}
      <div style={s.sidebar}>
        {/* Brand */}
        <div style={s.sidebarBrand}>
          <div style={s.sidebarLogoWrap}>
            <Crown size={20} color="#fff" />
          </div>
          <div>
            <div style={s.sidebarBrandName}>SuperAdmin</div>
            {info?.firstName && <div style={s.sidebarBrandSub}>{info.firstName} {info.lastName}</div>}
          </div>
        </div>

        {/* Nav items */}
        <nav style={s.sidebarNav}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); if (isMobile) setSidebarOpen(false); }} style={{ ...s.navItem, ...(tab === key ? s.navItemActive : {}) }}>
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {key === 'domains'  && domains.length > 0 && <span style={s.navBadge}>{domains.length}</span>}
              {key === 'deleted'  && deleted.length > 0 && <span style={{ ...s.navBadge, background: '#ef4444' }}>{deleted.length}</span>}
            </button>
          ))}
        </nav>

        {/* Footer actions */}
        <div style={s.sidebarFooter}>
          <button
            onClick={() => { setBroadcastModal(true); setBroadcastSubject(''); setBroadcastMessage(''); setBroadcastResult(null); setBroadcastTarget('all'); }}
            style={s.broadcastBtn}
          >
            <Megaphone size={14} /> Broadcast
          </button>
          <button onClick={() => setDarkMode(d => !d)} style={s.darkToggleBtn}>
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button onClick={handleLogout} style={s.logoutBtn}>
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={s.main}>

        {/* Top bar */}
        <div style={s.topBar}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button style={s.hamburgerBtn} onClick={() => setSidebarOpen(o => !o)}>
              <Menu size={18} />
            </button>
            <div>
              <div style={s.topBarTitle}>{TABS.find(t => t.key === tab)?.label || 'Dashboard'}</div>
              {error && <p style={{ color: '#ef4444', margin: '4px 0 0', fontSize: 13 }}>{error}</p>}
            </div>
          </div>
          <button onClick={() => setShowModal(true)} style={s.createBtn}>
            <Plus size={15} /> Create Center
          </button>
        </div>

        <div style={s.content}>
          {/* Stats strip — centres tab only */}
          {stats && tab === 'centers' && (
            <div style={s.statsRow}>
              {[
                { label: 'Total',     value: stats.total,     color: '#0ea5e9', icon: Building2   },
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

          {/* ── Tab content ── */}
          <TabErrorBoundary key={tab}>
            {tab === 'centers' && (
              <CentersTab
                centers={centers} loading={loading} loadData={loadData} setShowModal={setShowModal}
                handleApprove={handleApprove} handleReject={handleReject} handleSuspend={handleSuspend}
                handleEnterAsAdmin={handleEnterAsAdmin} impersonating={impersonating}
                setDeleteTarget={setDeleteTarget}
                setPlanModal={setPlanModal} setPlanSelected={setPlanSelected} setPlanMsg={setPlanMsg}
                setThemeCenter={setThemeCenter}
                handleOpenLoginThemeModal={handleOpenLoginThemeModal}
                handleOpenTeacherThemeModal={handleOpenTeacherThemeModal}
                handleOpenAdminLoginThemeModal={handleOpenAdminLoginThemeModal}
                handleOpenDashThemeModal={handleOpenDashThemeModal}
                setFeaturesCenter={setFeaturesCenter}
                setLimitsModal={setLimitsModal} setLimitsUnlimT={setLimitsUnlimT} setLimitsUnlimS={setLimitsUnlimS}
                setLimitsTeachers={setLimitsTeachers} setLimitsStudents={setLimitsStudents} setLimitsMsg={setLimitsMsg}
                statusColor={statusColor} statusIcon={statusIcon}
                onEditWebsite={handleEditWebsite}
              />
            )}
            {tab === 'domains' && (
              <DomainsTab
                domains={domains} loading={loading} loadData={loadData}
                handleVerifyDomain={handleVerifyDomain} handleRemoveDomain={handleRemoveDomain}
                domainAction={domainAction}
              />
            )}
            {tab === 'health' && (
              <HealthTab health={health} healthLoading={healthLoading} loadHealth={loadHealth} centers={centers} />
            )}
            {tab === 'usage' && (
              <UsageTab
                usage={usage} loading={loading} usageMonth={usageMonth} loadData={loadData}
                expandedCenter={expandedCenter} sessionDetail={sessionDetail} loadingDetail={loadingDetail}
                toggleSessionDetail={toggleSessionDetail} fmtMins={fmtMins}
                centers={centers} detailMonth={detailMonth} onMonthChange={changeDetailMonth}
                authHeaders={authHeaders} apiBase={API_BASE}
              />
            )}
            {tab === 'deleted' && (
              <DeletedTab
                deleted={deleted} loadData={loadData} restoring={restoring}
                handleRestore={handleRestore} daysRemaining={daysRemaining}
              />
            )}
            {tab === 'certificates' && (
              <CertificateTemplatesTab centers={centers} />
            )}
            {tab === 'websites' && (
              <LandingPagesTab centers={centers} darkMode={darkMode} focusCenterId={websitesFocusId} />
            )}
            {tab === 'credits' && (
              <CreditsTab
                creditCenters={creditCenters} creditLoading={creditLoading} creditTotals={creditTotals}
                loadCredits={loadCredits} creditSearch={creditSearch} setCreditSearch={setCreditSearch}
                expandedLog={expandedLog} setExpandedLog={setExpandedLog}
                setAllocModal={setAllocModal} setAllocAmount={setAllocAmount} setAllocNote={setAllocNote} setAllocMsg={setAllocMsg}
                pronCenters={pronCenters} pronLoading={pronLoading} pronTotals={pronTotals}
                loadPronCredits={loadPronCredits} pronSearch={pronSearch} setPronSearch={setPronSearch}
                pronExpandedLog={pronExpandedLog} setPronExpandedLog={setPronExpandedLog}
                setPronAllocModal={setPronAllocModal} setPronAllocAmount={setPronAllocAmount} setPronAllocNote={setPronAllocNote} setPronAllocMsg={setPronAllocMsg}
              />
            )}
            {tab === 'people' && (
              <PeopleTab
                centers={centers} peopleCenter={peopleCenter} setPeopleCenter={setPeopleCenter}
                peopleData={peopleData} peopleLoading={peopleLoading}
                peopleSubTab={peopleSubTab} setPeopleSubTab={setPeopleSubTab}
                peopleSearch={peopleSearch} setPeopleSearch={setPeopleSearch}
                loadCenterPeople={loadCenterPeople}
              />
            )}
            {tab === 'classes' && (
              <ClassesTab
                centers={centers}
                classesData={classesData} classesLoading={classesLoading}
                classesDateFrom={classesDateFrom} classesDateTo={classesDateTo} classesFilterCenter={classesFilterCenter}
                setClassesDateFrom={setClassesDateFrom} setClassesDateTo={setClassesDateTo} setClassesFilterCenter={setClassesFilterCenter}
                classesGrandTotal={classesGrandTotal} classesExpanded={classesExpanded} setClassesExpanded={setClassesExpanded}
                loadClasses={loadClasses}
              />
            )}
          </TabErrorBoundary>
        </div>
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

      {/* ── Pronunciation Credits Alloc Modal ── */}
      {pronAllocModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && !pronAllocating && setPronAllocModal(null)}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>🎤</span>
                <span style={s.modalTitle}>Allocate Pronunciation Credits</span>
              </div>
              {!pronAllocating && <button onClick={() => setPronAllocModal(null)} style={s.closeBtn}><X size={18} /></button>}
            </div>

            <div style={{ padding: 24 }}>
              <div style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
                <p style={{ margin: '0 0 2px', fontWeight: 700, color: '#f1f5f9', fontSize: 14 }}>{pronAllocModal.centerName}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{pronAllocModal.adminEmail}</p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#fb923c', fontWeight: 600 }}>
                  Current balance: <strong>{pronAllocModal.balance.toLocaleString()}</strong> credits
                </p>
              </div>

              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick amounts</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {[100, 250, 500, 1000, 2000, 5000].map(n => (
                  <button key={n} onClick={() => setPronAllocAmount(String(n))}
                    style={{ padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', border: pronAllocAmount === String(n) ? '2px solid #f97316' : '1px solid #374151', background: pronAllocAmount === String(n) ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)', color: pronAllocAmount === String(n) ? '#fb923c' : '#9ca3af' }}>
                    {n.toLocaleString()}
                  </button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Amount *</label>
              <input type="number" min="1" max="100000" value={pronAllocAmount} onChange={e => setPronAllocAmount(e.target.value)}
                placeholder="e.g. 500" style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />

              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Note (optional)</label>
              <input value={pronAllocNote} onChange={e => setPronAllocNote(e.target.value)} placeholder="e.g. Monthly allocation"
                style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 18 }} />

              {pronAllocMsg && (
                <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: pronAllocMsg.startsWith('✅') ? '#34d399' : '#f87171' }}>{pronAllocMsg}</p>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setPronAllocModal(null)} disabled={pronAllocating}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button disabled={pronAllocating || !pronAllocAmount}
                  onClick={async () => {
                    const amt = parseInt(pronAllocAmount, 10);
                    if (!amt || amt < 1 || amt > 100000) { setPronAllocMsg('Enter a valid amount (1–100,000)'); return; }
                    setPronAllocating(true); setPronAllocMsg('');
                    try {
                      const res = await fetch(`${API_BASE}/super-admin/pronunciation-credits/${pronAllocModal._id}`, {
                        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: amt, note: pronAllocNote.trim() || undefined }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setPronAllocMsg(`✅ ${amt.toLocaleString()} credits allocated! New balance: ${d.balance.toLocaleString()}`);
                        setPronCenters(prev => prev.map(c =>
                          c._id === pronAllocModal._id
                            ? { ...c, balance: d.balance, totalAllocated: d.totalAllocated, used: d.totalAllocated - d.balance }
                            : c
                        ));
                        setPronTotals(prev => prev ? { ...prev, totalBalance: prev.totalBalance + amt, totalAllocated: prev.totalAllocated + amt } : prev);
                        setPronAllocModal(null);
                      } else {
                        setPronAllocMsg('❌ ' + (d.message || 'Failed'));
                      }
                    } catch { setPronAllocMsg('❌ Network error'); }
                    finally { setPronAllocating(false); }
                  }}
                  style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: pronAllocating || !pronAllocAmount ? '#374151' : 'linear-gradient(135deg,#f97316,#fb923c)', color: '#fff', fontWeight: 700, cursor: pronAllocating || !pronAllocAmount ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  🎤 {pronAllocating ? 'Allocating…' : 'Allocate Credits'}
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
      {broadcastModal && (() => {
        const activeCenters  = centers.filter(c => c.status === 'active');
        const selectedCenter = activeCenters.find(c => c._id === broadcastTarget);
        const recipientLabel = broadcastTarget === 'all'
          ? `all ${activeCenters.length} active centers`
          : selectedCenter ? `${selectedCenter.centerName} only` : 'select a center below';
        const canSend = broadcastSubject.trim() && broadcastMessage.trim() &&
          (broadcastTarget === 'all' || !!selectedCenter);
        return (
          <div style={s.overlay} onClick={e => e.target === e.currentTarget && !broadcasting && setBroadcastModal(false)}>
            <div style={{ ...s.modal, maxWidth: 520 }}>
              <div style={s.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Megaphone size={16} color="#0ea5e9" />
                  <span style={s.modalTitle}>Broadcast Email</span>
                </div>
                {!broadcasting && <button onClick={() => setBroadcastModal(false)} style={s.closeBtn}><X size={18} /></button>}
              </div>

              <div style={{ padding: 24 }}>
                {broadcastResult ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CheckCircle size={42} color="#34d399" style={{ marginBottom: 14 }} />
                    <p style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: s.modalTitle.color }}>Sent!</p>
                    <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                      {broadcastResult.sent} email{broadcastResult.sent !== 1 ? 's' : ''} sent
                      {broadcastResult.failed > 0 && `, ${broadcastResult.failed} failed`}
                      {' '}(of {broadcastResult.total} center{broadcastResult.total !== 1 ? 's' : ''})
                    </p>
                    <button onClick={() => setBroadcastModal(false)} style={{ ...s.submitBtn, marginTop: 22 }}>Done</button>
                  </div>
                ) : (
                  <>
                    {/* ── Target selector ── */}
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Send To</p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      {[
                        { key: 'all',      label: '📢 All Centers',      desc: `${activeCenters.length} active` },
                        { key: 'specific', label: '🏫 Specific Center',  desc: 'Choose one below' },
                      ].map(opt => {
                        const active = broadcastTarget === 'all' ? opt.key === 'all' : opt.key === 'specific';
                        return (
                          <button
                            key={opt.key}
                            onClick={() => setBroadcastTarget(opt.key === 'all' ? 'all' : '')}
                            disabled={broadcasting}
                            style={{
                              flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                              textAlign: 'left', fontFamily: 'inherit',
                              border: active ? '2px solid #0ea5e9' : `1px solid ${s.input.border}`,
                              background: active ? 'rgba(14,165,233,0.1)' : s.input.background,
                              transition: 'all 0.15s',
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#0ea5e9' : '#6b7280' }}>{opt.label}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* ── Center picker (specific mode) ── */}
                    {broadcastTarget !== 'all' && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase' }}>Select Center *</label>
                        <select
                          value={broadcastTarget}
                          onChange={e => setBroadcastTarget(e.target.value)}
                          disabled={broadcasting}
                          style={{ ...s.input, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
                        >
                          <option value="">— choose a center —</option>
                          {activeCenters.map(c => (
                            <option key={c._id} value={c._id}>{c.centerName} ({c.adminEmail})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* ── Recipient info banner ── */}
                    <div style={{ background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 10, padding: '9px 14px', marginBottom: 18, fontSize: 12, color: '#6b7280' }}>
                      This will email <strong style={{ color: '#0ea5e9' }}>{recipientLabel}</strong>.
                    </div>

                    {/* ── Subject ── */}
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase' }}>Subject *</label>
                    <input
                      value={broadcastSubject}
                      onChange={e => setBroadcastSubject(e.target.value)}
                      placeholder="e.g. Scheduled maintenance on Sunday"
                      style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 14 }}
                      disabled={broadcasting}
                    />

                    {/* ── Message ── */}
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 5, textTransform: 'uppercase' }}>Message *</label>
                    <textarea
                      value={broadcastMessage}
                      onChange={e => setBroadcastMessage(e.target.value)}
                      placeholder="Write your message here…"
                      rows={6}
                      style={{ ...s.input, width: '100%', boxSizing: 'border-box', marginBottom: 20, resize: 'vertical', height: 120 }}
                      disabled={broadcasting}
                    />

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => setBroadcastModal(false)}
                        disabled={broadcasting}
                        style={s.cancelBtn}
                      >Cancel</button>
                      <button
                        disabled={broadcasting || !canSend}
                        onClick={handleBroadcast}
                        style={{
                          flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                          background: !canSend || broadcasting ? (s.input.background) : 'linear-gradient(135deg,#0284c7,#38bdf8)',
                          color: !canSend || broadcasting ? '#6b7280' : '#fff',
                          fontWeight: 700, cursor: !canSend || broadcasting ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          boxShadow: canSend && !broadcasting ? '0 4px 12px rgba(14,165,233,0.3)' : 'none',
                          transition: 'all 0.15s',
                        }}
                      >
                        <Send size={13} />
                        {broadcasting ? 'Sending…' : broadcastTarget === 'all' ? 'Send to All Centers' : `Send to ${selectedCenter?.centerName || 'Center'}`}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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

            {/* Student / Teacher / Admin tab selector */}
            <div style={{ display: 'flex', gap: '4px', padding: '16px 24px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { key: 'student',  label: '🎓 Student Dashboards'   },
                { key: 'teacher',  label: '👩‍🏫 Teacher Dashboards'  },
                { key: 'admin',    label: '🛡️ Admin Dashboards'    },
                { key: 'subadmin', label: '🔰 Sub-Admin Dashboards' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setDashThemeTab(key)}
                  style={{ padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, color: dashThemeTab === key ? '#06b6d4' : '#6b7280', borderBottom: dashThemeTab === key ? '2px solid #06b6d4' : '2px solid transparent', marginBottom: '-1px', transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding: '20px 24px 28px' }}>
              <p style={{ ...s.stepDesc, marginBottom: '6px' }}>
                Each theme is <strong>exclusive</strong> — only one center can hold it. {dashThemeTab === 'student' ? 'Students' : dashThemeTab === 'teacher' ? 'Teachers' : dashThemeTab === 'admin' ? 'Admins' : 'Sub-Admins'} see this design after login. Themes change the entire layout, fonts, animations and vibe without affecting functionality.
              </p>

              {dashThemeTab === 'student' && dashThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: dashThemeMsg.toLowerCase().includes('already') || dashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: dashThemeMsg.toLowerCase().includes('already') || dashThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${dashThemeMsg.toLowerCase().includes('already') || dashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {dashThemeMsg}
                </div>
              )}
              {dashThemeTab === 'teacher' && teacherDashThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: teacherDashThemeMsg.toLowerCase().includes('already') || teacherDashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: teacherDashThemeMsg.toLowerCase().includes('already') || teacherDashThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${teacherDashThemeMsg.toLowerCase().includes('already') || teacherDashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {teacherDashThemeMsg}
                </div>
              )}
              {dashThemeTab === 'admin' && adminDashThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: adminDashThemeMsg.toLowerCase().includes('already') || adminDashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: adminDashThemeMsg.toLowerCase().includes('already') || adminDashThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${adminDashThemeMsg.toLowerCase().includes('already') || adminDashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {adminDashThemeMsg}
                </div>
              )}
              {dashThemeTab === 'subadmin' && subAdminDashThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: subAdminDashThemeMsg.toLowerCase().includes('already') || subAdminDashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: subAdminDashThemeMsg.toLowerCase().includes('already') || subAdminDashThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${subAdminDashThemeMsg.toLowerCase().includes('already') || subAdminDashThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {subAdminDashThemeMsg}
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

              {dashThemeTab === 'teacher' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {TEACHER_DASHBOARD_THEMES.map(theme => {
                  const isActive    = dashThemeModal.branding?.teacherDashboardTheme === theme.id;
                  const takenBy     = !isActive && teacherDashThemeAssignments[theme.id];
                  const isAssigning = assigningTeacherDashTheme === theme.id;
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
                      <div style={{ height: '100px', background: theme.preview.bg, position: 'relative', overflow: 'hidden', padding: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          {[theme.preview.accent, `${theme.preview.accent}55`, `${theme.preview.accent}33`, `${theme.preview.accent}22`].map((bg, i) => (
                            <div key={i} style={{ height: '18px', flex: i === 0 ? '0 0 48px' : '1', background: bg, borderRadius: '6px' }} />
                          ))}
                        </div>
                        <div style={{ height: '28px', background: `linear-gradient(135deg, ${theme.preview.accent}, ${theme.preview.accent}99)`, borderRadius: '8px', marginBottom: '6px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                          <span style={{ fontSize: '14px' }}>{theme.emoji}</span>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.6)', borderRadius: '3px', marginLeft: '6px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[0,1,2,3].map(i => (
                            <div key={i} style={{ flex: 1, height: '16px', background: theme.preview.card, border: `1px solid ${theme.preview.accent}30`, borderRadius: '5px' }} />
                          ))}
                        </div>
                        <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '18px' }}>{theme.emoji}</div>
                      </div>
                      <div style={{ padding: '10px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color={theme.preview.accent} />}
                        </div>
                        <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>{theme.description}</p>
                        {takenBy && (
                          <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>🔒 Held by {takenBy.name}</p>
                        )}
                      </div>
                      <div style={{ padding: '4px 12px 12px' }}>
                        <button
                          onClick={() => !isAssigning && !isActive && !isLocked && handleAssignTeacherDashTheme(theme.id)}
                          disabled={isAssigning || isActive || isLocked}
                          style={{
                            width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none',
                            background: isActive ? `${theme.preview.accent}22` : isLocked ? 'rgba(255,255,255,0.04)' : theme.preview.accent,
                            color: isActive ? theme.preview.accent : isLocked ? '#4b5563' : 'white',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isAssigning || isActive || isLocked ? 'default' : 'pointer',
                            fontFamily: 'inherit', opacity: isAssigning ? 0.6 : 1,
                          }}
                        >
                          {isAssigning ? 'Assigning…' : isActive ? '✓ Assigned' : isLocked ? 'Taken' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>}

              {/* Unassign row */}
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
              {dashThemeTab === 'teacher' && dashThemeModal.branding?.teacherDashboardTheme && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Remove teacher dashboard theme → falls back to default (Sunshine Explorer)
                  </span>
                  <button
                    onClick={handleUnassignTeacherDashTheme}
                    disabled={assigningTeacherDashTheme === '__unassign__'}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {assigningTeacherDashTheme === '__unassign__' ? 'Removing…' : 'Unassign'}
                  </button>
                </div>
              )}

              {dashThemeTab === 'admin' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {ADMIN_DASHBOARD_THEMES.map(theme => {
                  const isActive    = dashThemeModal.branding?.adminDashboardTheme === theme.id;
                  const takenBy     = !isActive && adminDashThemeAssignments[theme.id];
                  const isAssigning = assigningAdminDashTheme === theme.id;
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
                      <div style={{ height: '100px', background: theme.preview.bg, position: 'relative', overflow: 'hidden', padding: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          {[theme.preview.accent, `${theme.preview.accent}55`, `${theme.preview.accent}33`, `${theme.preview.accent}22`].map((bg, i) => (
                            <div key={i} style={{ height: '18px', flex: i === 0 ? '0 0 48px' : '1', background: bg, borderRadius: '6px' }} />
                          ))}
                        </div>
                        <div style={{ height: '28px', background: `linear-gradient(135deg, ${theme.preview.accent}, ${theme.preview.accent}99)`, borderRadius: '8px', marginBottom: '6px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                          <span style={{ fontSize: '14px' }}>{theme.emoji}</span>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.6)', borderRadius: '3px', marginLeft: '6px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[0,1,2,3].map(i => (
                            <div key={i} style={{ flex: 1, height: '16px', background: theme.preview.card, border: `1px solid ${theme.preview.accent}30`, borderRadius: '5px' }} />
                          ))}
                        </div>
                        <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '18px' }}>{theme.emoji}</div>
                      </div>
                      <div style={{ padding: '10px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color={theme.preview.accent} />}
                        </div>
                        <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>{theme.description}</p>
                        {takenBy && (
                          <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>🔒 Held by {takenBy.name}</p>
                        )}
                      </div>
                      <div style={{ padding: '4px 12px 12px' }}>
                        <button
                          onClick={() => !isAssigning && !isActive && !isLocked && handleAssignAdminDashTheme(theme.id)}
                          disabled={isAssigning || isActive || isLocked}
                          style={{
                            width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none',
                            background: isActive ? `${theme.preview.accent}22` : isLocked ? 'rgba(255,255,255,0.04)' : theme.preview.accent,
                            color: isActive ? theme.preview.accent : isLocked ? '#4b5563' : 'white',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isAssigning || isActive || isLocked ? 'default' : 'pointer',
                            fontFamily: 'inherit', opacity: isAssigning ? 0.6 : 1,
                          }}
                        >
                          {isAssigning ? 'Assigning…' : isActive ? '✓ Assigned' : isLocked ? 'Taken' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>}

              {dashThemeTab === 'admin' && dashThemeModal.branding?.adminDashboardTheme && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Remove admin dashboard theme → falls back to default (Sunshine Explorer)
                  </span>
                  <button
                    onClick={handleUnassignAdminDashTheme}
                    disabled={assigningAdminDashTheme === '__unassign__'}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {assigningAdminDashTheme === '__unassign__' ? 'Removing…' : 'Unassign'}
                  </button>
                </div>
              )}

              {/* ── Sub-Admin Dashboard Themes ── */}
              {dashThemeTab === 'subadmin' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {SUBADMIN_DASHBOARD_THEMES.map(theme => {
                  const isActive    = dashThemeModal.branding?.subAdminDashboardTheme === theme.id;
                  const takenBy     = !isActive && subAdminDashThemeAssignments[theme.id];
                  const isAssigning = assigningSubAdminDashTheme === theme.id;
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
                      <div style={{ height: '100px', background: theme.preview.bg, position: 'relative', overflow: 'hidden', padding: '10px' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                          {[theme.preview.accent, `${theme.preview.accent}55`, `${theme.preview.accent}33`, `${theme.preview.accent}22`].map((bg, i) => (
                            <div key={i} style={{ height: '18px', flex: i === 0 ? '0 0 48px' : '1', background: bg, borderRadius: '6px' }} />
                          ))}
                        </div>
                        <div style={{ height: '28px', background: `linear-gradient(135deg, ${theme.preview.accent}, ${theme.preview.accent}99)`, borderRadius: '8px', marginBottom: '6px', display: 'flex', alignItems: 'center', paddingLeft: '8px' }}>
                          <span style={{ fontSize: '14px' }}>{theme.emoji}</span>
                          <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.6)', borderRadius: '3px', marginLeft: '6px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[0,1,2,3].map(i => (
                            <div key={i} style={{ flex: 1, height: '16px', background: theme.preview.card, border: `1px solid ${theme.preview.accent}30`, borderRadius: '5px' }} />
                          ))}
                        </div>
                        <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '18px' }}>{theme.emoji}</div>
                      </div>
                      <div style={{ padding: '10px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color={theme.preview.accent} />}
                        </div>
                        <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>{theme.description}</p>
                        {takenBy && (
                          <p style={{ margin: '0 0 5px', fontSize: '10px', color: '#f59e0b', fontWeight: '700' }}>🔒 Held by {takenBy.name}</p>
                        )}
                      </div>
                      <div style={{ padding: '4px 12px 12px' }}>
                        <button
                          onClick={() => !isAssigning && !isActive && !isLocked && handleAssignSubAdminDashTheme(theme.id)}
                          disabled={isAssigning || isActive || isLocked}
                          style={{
                            width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none',
                            background: isActive ? `${theme.preview.accent}22` : isLocked ? 'rgba(255,255,255,0.04)' : theme.preview.accent,
                            color: isActive ? theme.preview.accent : isLocked ? '#4b5563' : 'white',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isAssigning || isActive || isLocked ? 'default' : 'pointer',
                            fontFamily: 'inherit', opacity: isAssigning ? 0.6 : 1,
                          }}
                        >
                          {isAssigning ? 'Assigning…' : isActive ? '✓ Assigned' : isLocked ? 'Taken' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>}

              {dashThemeTab === 'subadmin' && dashThemeModal.branding?.subAdminDashboardTheme && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Remove sub-admin dashboard theme → falls back to default (Sunshine Explorer)
                  </span>
                  <button
                    onClick={handleUnassignSubAdminDashTheme}
                    disabled={assigningSubAdminDashTheme === '__unassign__'}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {assigningSubAdminDashTheme === '__unassign__' ? 'Removing…' : 'Unassign'}
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

      {/* ── Teacher Login Theme Modal ── */}
      {teacherThemeModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setTeacherThemeModal(null)}>
          <div style={{ ...s.modal, maxWidth: '820px' }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Palette size={18} color="#f59e0b" />
                <span style={s.modalTitle}>Teacher Login Theme</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>for {teacherThemeModal.centerName}</span>
              </div>
              <button onClick={() => setTeacherThemeModal(null)} style={s.closeBtn}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px 28px' }}>
              <p style={{ ...s.stepDesc, marginBottom: '6px' }}>
                Each teacher login theme is <strong>exclusive</strong> — only one center can hold it. Teachers see this page when they sign in.
              </p>
              {teacherThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: teacherThemeMsg.toLowerCase().includes('already') || teacherThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: teacherThemeMsg.toLowerCase().includes('already') || teacherThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${teacherThemeMsg.toLowerCase().includes('already') || teacherThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {teacherThemeMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {TEACHER_LOGIN_THEMES.map(theme => {
                  const isActive    = teacherThemeModal.branding?.teacherLoginTheme === theme.id;
                  const takenBy     = !isActive && teacherThemeAssignments[theme.id];
                  const isAssigning = assigningTeacherTheme === theme.id;
                  const isLocked    = !!takenBy;

                  return (
                    <div key={theme.id} style={{
                      borderRadius: '14px',
                      border: isActive ? '2px solid #f59e0b' : isLocked ? '2px solid rgba(255,255,255,0.04)' : '2px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(245,158,11,0.12)' : isLocked ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      opacity: isLocked ? 0.5 : 1,
                      transition: 'border-color .15s, background .15s, opacity .15s',
                    }}>
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

                      <div style={{ padding: '10px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color="#f59e0b" />}
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

                      <div style={{ padding: '4px 12px 12px' }}>
                        <button
                          onClick={() => !isAssigning && !isActive && !isLocked && handleAssignTeacherTheme(theme.id)}
                          disabled={isAssigning || isActive || isLocked}
                          style={{
                            width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none',
                            background: isActive ? 'rgba(245,158,11,0.2)' : isLocked ? 'rgba(255,255,255,0.04)' : '#f59e0b',
                            color: isActive ? '#f59e0b' : isLocked ? '#4b5563' : '#0c0a00',
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

              {teacherThemeModal.branding?.teacherLoginTheme && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>
                    Remove teacher login theme from this center → falls back to default
                  </span>
                  <button
                    onClick={handleUnassignTeacherTheme}
                    disabled={assigningTeacherTheme === '__unassign__'}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {assigningTeacherTheme === '__unassign__' ? 'Removing…' : 'Unassign'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Login Theme Modal ── */}
      {adminLoginThemeModal && (
        <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && setAdminLoginThemeModal(null)}>
          <div style={{ ...s.modal, maxWidth: '820px' }}>
            <div style={s.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Palette size={18} color="#22d3ee" />
                <span style={s.modalTitle}>Admin Login Theme</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>for {adminLoginThemeModal.centerName}</span>
              </div>
              <button onClick={() => setAdminLoginThemeModal(null)} style={s.closeBtn}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px 24px 28px' }}>
              <p style={{ ...s.stepDesc, marginBottom: '6px' }}>
                Each admin login theme is <strong>exclusive</strong> — only one center can hold it. Admins see this page when they sign in. <em>Executive Command</em> is the default for all centers.
              </p>
              {adminLoginThemeMsg && (
                <div style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', marginBottom: '14px',
                  background: adminLoginThemeMsg.toLowerCase().includes('already') || adminLoginThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                  color: adminLoginThemeMsg.toLowerCase().includes('already') || adminLoginThemeMsg.toLowerCase().includes('failed') ? '#ef4444' : '#22c55e',
                  border: `1px solid ${adminLoginThemeMsg.toLowerCase().includes('already') || adminLoginThemeMsg.toLowerCase().includes('failed') ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.2)'}`,
                }}>
                  {adminLoginThemeMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px', marginTop: '8px' }}>
                {ADMIN_LOGIN_THEMES.map(theme => {
                  const isActive    = (adminLoginThemeModal.branding?.adminLoginTheme || 'executive') === theme.id;
                  const takenBy     = !isActive && adminLoginThemeAssignments[theme.id];
                  const isAssigning = assigningAdminLoginTheme === theme.id;
                  const isLocked    = !!takenBy;

                  return (
                    <div key={theme.id} style={{
                      borderRadius: '14px',
                      border: isActive ? '2px solid #22d3ee' : isLocked ? '2px solid rgba(255,255,255,0.04)' : '2px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(34,211,238,0.08)' : isLocked ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                      overflow: 'hidden',
                      opacity: isLocked ? 0.5 : 1,
                      transition: 'border-color .15s, background .15s',
                    }}>
                      <div style={{ height: '72px', background: `linear-gradient(135deg, ${theme.preview.bgStart}, ${theme.preview.bgEnd})`, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '32px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.4))' }}>{theme.emoji}</span>
                        <div style={{ position: 'absolute', bottom: '8px', right: '8px', width: '14px', height: '14px', borderRadius: '50%', background: theme.preview.accent, boxShadow: `0 0 8px ${theme.preview.accent}` }} />
                      </div>
                      <div style={{ padding: '10px 12px 6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#f1f5f9' }}>{theme.name}</span>
                          {isActive && <CheckCircle size={14} color="#22d3ee" />}
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: '10px', color: '#6b7280', lineHeight: '1.4' }}>{theme.description}</p>
                        {takenBy && <p style={{ margin: '0 0 6px', fontSize: '10px', color: '#22d3ee', fontWeight: '700' }}>🔒 Held by {takenBy.name}</p>}
                      </div>
                      <div style={{ padding: '4px 12px 12px' }}>
                        <button
                          onClick={() => !isAssigning && !isActive && !isLocked && handleAssignAdminLoginTheme(theme.id)}
                          disabled={isAssigning || isActive || isLocked}
                          style={{ width: '100%', padding: '7px 0', borderRadius: '8px', border: 'none', background: isActive ? 'rgba(34,211,238,0.15)' : isLocked ? 'rgba(255,255,255,0.04)' : '#22d3ee', color: isActive ? '#22d3ee' : isLocked ? '#4b5563' : '#060a14', fontSize: '12px', fontWeight: '700', cursor: isAssigning || isActive || isLocked ? 'default' : 'pointer', fontFamily: 'inherit', opacity: isAssigning ? 0.6 : 1 }}
                        >
                          {isAssigning ? 'Assigning…' : isActive ? '✓ Active' : isLocked ? 'Taken' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {adminLoginThemeModal.branding?.adminLoginTheme && (
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', color: '#6b7280' }}>Remove custom theme → falls back to Executive Command (default)</span>
                  <button onClick={handleUnassignAdminLoginTheme} disabled={assigningAdminLoginTheme === '__unassign__'}
                    style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {assigningAdminLoginTheme === '__unassign__' ? 'Removing…' : 'Unassign'}
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
                      {TIMEZONE_OPTIONS.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
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

function buildStyles(isDark, isMobile = false, sidebarOpen = false) {
  const sky    = '#0ea5e9';
  const skyDim = isDark ? 'rgba(14,165,233,0.14)' : 'rgba(14,165,233,0.09)';
  const skyBdr = isDark ? 'rgba(14,165,233,0.28)' : 'rgba(14,165,233,0.35)';
  const bg     = isDark ? '#060e1c' : '#f0f9ff';
  const sbBg   = isDark ? 'linear-gradient(180deg,#0a1830 0%,#060e1c 100%)' : '#ffffff';
  const card   = isDark ? 'rgba(14,165,233,0.05)' : '#ffffff';
  const bdr    = isDark ? 'rgba(14,165,233,0.12)' : '#bae6fd';
  const text   = isDark ? '#f0f9ff' : '#0c1a2e';
  const muted  = isDark ? '#64748b' : '#64748b';
  const font   = "'Sora','Segoe UI',sans-serif";
  const mBg    = isDark ? '#0d1f36' : '#ffffff';
  const mBdr   = isDark ? 'rgba(14,165,233,0.2)' : '#bae6fd';

  return {
    // ── Shell ────────────────────────────────────────────────────────────────
    root: {
      minHeight: '100vh', display: 'flex',
      background: bg, color: text, fontFamily: font,
    },

    // ── Sidebar ──────────────────────────────────────────────────────────────
    sidebar: {
      width: 232, flexShrink: 0,
      background: sbBg,
      borderRight: `1px solid ${bdr}`,
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto',
      ...(isMobile ? {
        position: 'fixed', top: 0, left: 0, zIndex: 300,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s ease',
        boxShadow: '4px 0 24px rgba(0,0,0,0.45)',
      } : {
        position: 'sticky', top: 0,
      }),
    },
    sidebarOverlay: {
      display: isMobile && sidebarOpen ? 'block' : 'none',
      position: 'fixed', inset: 0, zIndex: 299,
      background: 'rgba(0,0,0,0.55)',
    },
    sidebarBrand: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '22px 18px 18px',
      borderBottom: `1px solid ${bdr}`,
    },
    sidebarLogoWrap: {
      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
      background: 'linear-gradient(135deg,#0284c7,#38bdf8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(14,165,233,0.45)',
    },
    sidebarBrandName: { fontSize: 15, fontWeight: 800, color: text, lineHeight: 1.1 },
    sidebarBrandSub:  { fontSize: 11, color: muted, marginTop: 3 },
    sidebarNav: {
      flex: 1, overflowY: 'auto',
      padding: '10px 8px',
      display: 'flex', flexDirection: 'column', gap: 2,
    },
    navItem: {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 12px', borderRadius: 10,
      fontSize: 13, fontWeight: 600,
      background: 'transparent', border: 'none',
      color: muted, cursor: 'pointer',
      fontFamily: font, width: '100%', textAlign: 'left',
      transition: 'all 0.15s',
    },
    navItemActive: {
      background: skyDim,
      color: sky,
      borderLeft: `3px solid ${sky}`,
      paddingLeft: 9,
      boxShadow: isDark ? 'inset 0 0 12px rgba(14,165,233,0.06)' : 'none',
    },
    navBadge: {
      minWidth: 18, height: 18, borderRadius: 9,
      background: sky, color: '#fff',
      fontSize: 10, fontWeight: 800,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
    },
    sidebarFooter: {
      padding: '10px 8px 14px',
      borderTop: `1px solid ${bdr}`,
      display: 'flex', flexDirection: 'column', gap: 5,
    },
    broadcastBtn: {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 12px', borderRadius: 10,
      fontSize: 13, fontWeight: 700,
      background: 'linear-gradient(135deg,#f59e0b,#d97706)',
      border: 'none', color: '#fff',
      cursor: 'pointer', fontFamily: font, width: '100%',
    },
    darkToggleBtn: {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 12px', borderRadius: 10,
      fontSize: 13, fontWeight: 600,
      background: isDark ? 'rgba(255,255,255,0.06)' : skyDim,
      border: `1px solid ${bdr}`,
      color: isDark ? '#94a3b8' : '#0284c7',
      cursor: 'pointer', fontFamily: font, width: '100%',
    },
    logoutBtn: {
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 12px', borderRadius: 10,
      fontSize: 13, fontWeight: 600,
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
      color: '#f87171', cursor: 'pointer',
      fontFamily: font, width: '100%',
    },

    // ── Main area ────────────────────────────────────────────────────────────
    main: {
      flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto',
    },
    topBar: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 28px',
      background: isDark ? 'rgba(14,165,233,0.04)' : 'rgba(14,165,233,0.03)',
      borderBottom: `1px solid ${bdr}`,
      position: 'sticky', top: 0, zIndex: 10,
      backdropFilter: 'blur(10px)',
    },
    topBarTitle: { fontSize: 20, fontWeight: 800, color: text },
    hamburgerBtn: {
      display: isMobile ? 'flex' : 'none',
      alignItems: 'center', justifyContent: 'center',
      width: 38, height: 38, borderRadius: 10,
      background: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)',
      border: `1px solid ${bdr}`,
      color: sky, cursor: 'pointer', flexShrink: 0, marginRight: 10,
    },
    createBtn: {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '9px 18px', borderRadius: 10,
      background: 'linear-gradient(135deg,#0284c7,#38bdf8)',
      border: 'none', color: '#fff',
      fontSize: 13, fontWeight: 700, cursor: 'pointer',
      fontFamily: font, boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
    },
    content: { padding: '24px 28px', flex: 1 },

    // ── Stats row ────────────────────────────────────────────────────────────
    statsRow: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
      gap: 16, marginBottom: 24,
    },
    statCard: {
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '18px 20px', borderRadius: 14,
      background: card, border: `1px solid ${bdr}`,
      boxShadow: isDark ? 'none' : '0 2px 10px rgba(14,165,233,0.07)',
    },
    statIcon: {
      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    statValue: { margin: '0 0 2px', fontSize: 24, fontWeight: 700, color: text },
    statLabel: { margin: 0, fontSize: 12, color: muted },

    // ── Legacy tab row (kept for any tab that still renders it) ───────────────
    tabRow: { display: 'flex', gap: 8, marginBottom: 16 },
    tabBtn: {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      background: isDark ? 'rgba(255,255,255,0.04)' : '#f1f9ff',
      border: `1px solid ${bdr}`,
      color: muted, cursor: 'pointer', fontFamily: font,
    },
    tabBtnActive: { background: skyDim, border: `1px solid ${skyBdr}`, color: sky },
    tabBadge: {
      minWidth: 18, height: 18, borderRadius: 9,
      background: sky, color: '#fff',
      fontSize: 10, fontWeight: 800,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
    },

    // ── Shared card / table ──────────────────────────────────────────────────
    card: { background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: 20 },
    sectionTitle: {
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 15, fontWeight: 700, color: text, margin: 0,
    },
    refreshBtn: {
      background: isDark ? 'rgba(255,255,255,0.05)' : skyDim,
      border: `1px solid ${bdr}`, borderRadius: 7, color: muted,
      cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center',
    },
    table: { width: '100%', borderCollapse: 'collapse' },
    th: {
      textAlign: 'left', padding: '10px 14px',
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      color: muted, textTransform: 'uppercase',
      borderBottom: `1px solid ${bdr}`,
    },
    tr: { borderBottom: `1px solid ${bdr}` },
    td: { padding: '12px 14px', verticalAlign: 'middle' },
    slug: {
      fontSize: 12, padding: '2px 8px', borderRadius: 6,
      background: isDark ? 'rgba(14,165,233,0.1)' : 'rgba(14,165,233,0.08)',
      color: sky, fontFamily: 'monospace',
    },
    planBadge: {
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.1)',
      color: '#818cf8', fontWeight: 600, textTransform: 'capitalize',
    },
    statusBadge: {
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      border: '1px solid', textTransform: 'capitalize',
    },

    // ── Action buttons ────────────────────────────────────────────────────────
    approveBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
      background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
      color: '#34d399', cursor: 'pointer', fontFamily: font,
    },
    rejectBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
      color: '#f87171', cursor: 'pointer', fontFamily: font,
    },
    suspendBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
      color: '#f59e0b', cursor: 'pointer', fontFamily: font,
    },
    themeBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
      background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
      color: '#818cf8', cursor: 'pointer', fontFamily: font,
    },
    featuresBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
      background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
      color: '#34d399', cursor: 'pointer', fontFamily: font,
    },
    deleteBtn: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '5px 8px', borderRadius: 7, fontSize: 12,
      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
      color: '#f87171', cursor: 'pointer', fontFamily: font,
    },

    // ── Modals ────────────────────────────────────────────────────────────────
    overlay: {
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    },
    modal: {
      background: mBg, border: `1px solid ${mBdr}`,
      borderRadius: 18, width: '100%', maxWidth: 620,
      maxHeight: '92vh', overflowY: 'auto',
      boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
    },
    modalHeader: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 24px', borderBottom: `1px solid ${mBdr}`,
      position: 'sticky', top: 0, background: mBg, zIndex: 1,
    },
    modalTitle: { fontSize: 16, fontWeight: 700, color: isDark ? '#f0f9ff' : '#0c1a2e' },
    stepTag: {
      fontSize: 11, fontWeight: 700,
      background: 'rgba(14,165,233,0.12)', color: sky,
      padding: '2px 8px', borderRadius: 20,
    },
    closeBtn: {
      background: 'none', border: 'none', color: muted,
      cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
    },
    modalForm: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16 },
    stepDesc: { margin: 0, fontSize: 13.5, color: muted, lineHeight: 1.6 },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
    field: { display: 'flex', flexDirection: 'column', gap: 6 },
    label: {
      fontSize: 11.5, fontWeight: 700, color: muted,
      textTransform: 'uppercase', letterSpacing: '0.07em',
    },
    input: {
      width: '100%', padding: '10px 14px',
      background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
      borderRadius: 10, color: isDark ? '#f0f9ff' : '#0f172a',
      fontSize: 14, fontFamily: font, outline: 'none', boxSizing: 'border-box',
    },
    passwordWrap: {
      display: 'flex', alignItems: 'center',
      padding: '0 14px',
      background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
      borderRadius: 10, height: 42, gap: 8,
    },
    eyeBtn: {
      background: 'none', border: 'none', color: muted,
      cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center',
    },
    modalNote: {
      fontSize: 12, color: muted,
      background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.15)',
      borderRadius: 8, padding: '10px 14px', lineHeight: 1.5,
    },
    cancelBtn: {
      padding: '10px 20px', borderRadius: 10,
      background: isDark ? 'rgba(255,255,255,0.05)' : '#f1f9ff',
      border: `1px solid ${bdr}`,
      color: muted, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: font,
    },
    submitBtn: {
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '10px 22px', borderRadius: 10,
      background: 'linear-gradient(135deg,#0284c7,#38bdf8)',
      border: 'none', color: '#fff',
      fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: font,
      boxShadow: '0 4px 14px rgba(14,165,233,0.35)',
    },
  };
}
