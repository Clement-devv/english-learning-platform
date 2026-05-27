import React, { useState, useEffect, lazy, Suspense } from "react";
import { BrandingProvider } from './context/BrandingContext.jsx';
import { AuthProvider }     from './context/AuthContext.jsx';
import {
  BrowserRouter as Router, Routes, Route, Navigate, useLocation,
} from "react-router-dom";

// Auth guard — single component for all roles
import ActiveClassBanner  from "./components/ActiveClassBanner";
import AuthGuard          from "./components/AuthGuard";
import PWAInstallPrompt   from "./components/PWAInstallPrompt";
import { RingProvider }   from "./context/RingContext";
import IncomingRingModal  from "./components/ring/IncomingRingModal";
import MissedCallAlert    from "./components/ring/MissedCallAlert";
import MessageAlert       from "./components/chat/MessageAlert";

// Login pages — small, load fast, keep static
import SuperAdminLogin     from "./pages/super-admin/SuperAdminLogin";
import AdminLogin          from "./pages/admin/AdminLogin";
import ParentLogin         from "./pages/parent/ParentLogin";
import ParentSetup         from "./pages/parent/ParentSetup";
import AdminResetPassword       from "./pages/admin/AdminResetPassword";
import EmailChangeVerify        from "./pages/admin/EmailChangeVerify";
import EmailChangeCancelConfirm from "./pages/admin/EmailChangeCancelConfirm";
import SubAdminLogin       from "./pages/sub-admin/SubAdminLogin";
import TeacherLogin        from "./pages/teacher/TeacherLogin";
import StudentLogin        from "./pages/student/StudentLogin";

// Heavy pages — lazy loaded (each becomes its own JS chunk)
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard"));
const AdminDashboard      = lazy(() => import("./pages/admin/AdminDashboard"));
const SubAdminSetup            = lazy(() => import("./pages/sub-admin/SubAdminSetup"));
const SubAdminDashboard        = lazy(() => import("./pages/sub-admin/SubAdminDashboard"));
const SubAdminForgotPassword   = lazy(() => import("./pages/sub-admin/ForgotPassword"));
const SubAdminResetPassword    = lazy(() => import("./pages/sub-admin/ResetPassword"));
const TeacherDashboard    = lazy(() => import("./pages/teacher/TeacherDashboard"));
const TeacherSetup        = lazy(() => import("./pages/teacher/TeacherSetup"));
const ForgotPassword      = lazy(() => import("./pages/teacher/ForgotPassword"));
const ResetPassword       = lazy(() => import("./pages/teacher/ResetPassword"));
const StudentDashboard    = lazy(() => import("./pages/student/StudentDashboard"));
const StudentSetup        = lazy(() => import("./pages/student/StudentSetup"));
const StudentForgotPassword = lazy(() => import("./pages/student/ForgotPassword"));
const StudentResetPassword  = lazy(() => import("./pages/student/ResetPassword"));
const Classroom           = lazy(() => import("./pages/Classroom"));
const Join                = lazy(() => import("./pages/Join"));
const ParentDashboard     = lazy(() => import("./pages/parent/ParentDashboard"));
const CenterLandingPage   = lazy(() => import("./pages/landing-page/CenterLandingPage"));
const ClemifyHome         = lazy(() => import("./pages/clemify-home/ClemifyHome"));

// Full-screen spinner shown while a lazy chunk loads
function PageLoader() {
  return (
    <div style={{
      position: "fixed", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "#fff", zIndex: 9999,
    }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "50%",
        border: "4px solid #e5e7eb", borderTopColor: "#6366f1",
        animation: "spin 0.75s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}


function ImpersonationBanner() {
  const location = useLocation();
  const [info, setInfo]       = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const slug    = sessionStorage.getItem('impersonationCenterSlug');
    const expStr  = sessionStorage.getItem('impersonationExpiresAt');
    const rawInfo = sessionStorage.getItem('adminInfo');
    if (!slug) { setInfo(null); return; }
    try {
      const parsed = JSON.parse(rawInfo || '{}');
      if (parsed.impersonation) setInfo(parsed);
    } catch { setInfo(null); }

    if (!expStr) return;
    const tick = () => {
      const ms = Number(expStr) - Date.now();
      if (ms <= 0) { setTimeLeft('Expired'); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTimeLeft(`${m}m ${s < 10 ? '0' : ''}${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [location]);

  if (!info) return null;

  const handleExit = () => {
    ['adminToken','adminInfo','impersonationCenterSlug','impersonationExpiresAt']
      .forEach(k => sessionStorage.removeItem(k));
    window.close();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: 'linear-gradient(90deg,#7c3aed,#4f46e5)',
      color: '#fff', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', padding: '8px 20px',
      fontSize: '13px', fontWeight: '600', boxShadow: '0 2px 12px rgba(124,58,237,0.4)',
    }}>
      <span>
        👁️ Viewing <strong>{info.centerName}</strong> as Admin
        {timeLeft && <span style={{ marginLeft: 10, opacity: 0.8, fontWeight: 400 }}>— Session expires in {timeLeft}</span>}
      </span>
      <button
        onClick={handleExit}
        style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '4px 12px', fontWeight: 700, fontSize: 12 }}
      >
        Exit Session ×
      </button>
    </div>
  );
}

// On center subdomains (school.clemify.com) or custom domains show the center landing page.
// On clemify.com / localhost (main domain) show the Clemify company home page.
// Dev override: set VITE_CENTER_SLUG=your-slug in .env.local to preview the landing page at /
function HomeRoute() {
  const h = window.location.hostname;
  const devSlug = import.meta.env.DEV ? (import.meta.env.VITE_CENTER_SLUG || null) : null;
  const isCenter =
    !!devSlug ||
    h.endsWith('.clemify.com') ||
    (!h.includes('clemify.com') && h !== 'localhost' && h !== '127.0.0.1');
  return isCenter ? <CenterLandingPage /> : <ClemifyHome />;
}

function App() {
  return (
    <AuthProvider>
    <BrandingProvider>
      <Router>
      <RingProvider>
      <div className="min-h-screen">
        <ImpersonationBanner />
        <ActiveClassBanner />
        <PWAInstallPrompt />
        <IncomingRingModal />
        <MissedCallAlert />
        <MessageAlert />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomeRoute />} />

            <Route path="/super-admin/login"     element={<SuperAdminLogin />} />
            <Route path="/super-admin/dashboard" element={<AuthGuard role="super-admin"><SuperAdminDashboard /></AuthGuard>} />

            <Route path="/admin/login"                          element={<AdminLogin />} />
            <Route path="/admin/reset-password/:token"         element={<AdminResetPassword />} />
            <Route path="/admin/email-change/verify/:token"    element={<EmailChangeVerify />} />
            <Route path="/admin/email-change/cancel/:token"    element={<EmailChangeCancelConfirm />} />
            <Route path="/admin" element={<AuthGuard role="admin"><AdminDashboard /></AuthGuard>} />

            <Route path="/sub-admin/login"                  element={<SubAdminLogin />} />
            <Route path="/sub-admin/forgot-password"        element={<SubAdminForgotPassword />} />
            <Route path="/sub-admin/reset-password/:token"  element={<SubAdminResetPassword />} />
            <Route path="/sub-admin/setup"                  element={<SubAdminSetup />} />
            <Route path="/sub-admin/dashboard"              element={<AuthGuard role="sub-admin"><SubAdminDashboard /></AuthGuard>} />

            <Route path="/classroom" element={<AuthGuard role="classroom"><Classroom /></AuthGuard>} />

            <Route path="/teacher/login"                 element={<TeacherLogin />} />
            <Route path="/teacher/forgot-password"       element={<ForgotPassword />} />
            <Route path="/teacher/reset-password/:token" element={<ResetPassword />} />
            <Route path="/teacher/dashboard"             element={<AuthGuard role="teacher"><TeacherDashboard /></AuthGuard>} />
            <Route path="/teacher/setup"                 element={<TeacherSetup />} />

            <Route path="/student/login"                 element={<StudentLogin />} />
            <Route path="/student/forgot-password"       element={<StudentForgotPassword />} />
            <Route path="/student/reset-password/:token" element={<StudentResetPassword />} />
            <Route path="/student/dashboard"             element={<AuthGuard role="student"><StudentDashboard /></AuthGuard>} />
            <Route path="/student/setup"                 element={<StudentSetup />} />

            <Route path="/parent/login"              element={<ParentLogin />} />
            <Route path="/parent/setup/:token"      element={<ParentSetup />} />
            <Route path="/parent/dashboard"         element={<AuthGuard role="parent"><ParentDashboard /></AuthGuard>} />

            <Route path="/join" element={<Join />} />

            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </Suspense>
      </div>
      </RingProvider>
    </Router>
    </BrandingProvider>
    </AuthProvider>
  );
}

export default App;
