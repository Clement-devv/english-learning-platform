import React, { useState, useEffect, lazy, Suspense } from "react";
import { BrandingProvider } from './context/BrandingContext.jsx';
import { AuthProvider }     from './context/AuthContext.jsx';
import {
  BrowserRouter as Router, Routes, Route,
  Navigate, useNavigate, useLocation
} from "react-router-dom";

// Auth guard — single component for all roles
import ActiveClassBanner  from "./components/ActiveClassBanner";
import AuthGuard          from "./components/AuthGuard";
import { RingProvider }   from "./context/RingContext";
import IncomingRingModal  from "./components/ring/IncomingRingModal";

// Login pages — small, load fast, keep static
import SuperAdminLogin     from "./pages/super-admin/SuperAdminLogin";
import AdminLogin          from "./pages/admin/AdminLogin";
import ParentLogin         from "./pages/parent/ParentLogin";
import ParentSetup         from "./pages/parent/ParentSetup";
import AdminResetPassword  from "./pages/admin/AdminResetPassword";
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

// Paths where the nav is hidden entirely (dashboards, full-screen flows)
// Use startsWith only for paths that can't conflict with login pages
const HIDE_NAV_ON = [
  "/sub-admin/setup",
  "/sub-admin/dashboard",
  "/classroom",
  "/teacher/dashboard",
  "/student/dashboard",
  "/super-admin/dashboard",
  "/parent/dashboard",
];

function NavigationButtons() {
  const navigate = useNavigate();
  const location = useLocation();
  const path     = location.pathname;

  const [isSuperAdminLoggedIn, setIsSuperAdminLoggedIn] = useState(false);
  const [isAdminLoggedIn,    setIsAdminLoggedIn]    = useState(false);
  const [isTeacherLoggedIn,  setIsTeacherLoggedIn]  = useState(false);
  const [isStudentLoggedIn,  setIsStudentLoggedIn]  = useState(false);
  const [isParentLoggedIn,   setIsParentLoggedIn]   = useState(false);
  const [isSubAdminLoggedIn, setIsSubAdminLoggedIn] = useState(false);
  const [installPrompt,      setInstallPrompt]      = useState(null);
  const [installed,          setInstalled]          = useState(false);

  useEffect(() => {
    const get = (k) => !!(sessionStorage.getItem(k) || localStorage.getItem(k));
    setIsSuperAdminLoggedIn(get("superAdminToken"));
    setIsAdminLoggedIn(get("adminToken"));
    setIsTeacherLoggedIn(get("teacherToken"));
    setIsStudentLoggedIn(get("studentToken"));
    setIsSubAdminLoggedIn(get("subAdminToken"));
    setIsParentLoggedIn(get("parentToken"));
  }, [location]);

  // Capture the PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstallPrompt(null); setInstalled(true); });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") { setInstallPrompt(null); setInstalled(true); }
  };

  const shouldHide =
    path === "/" ||        // center landing page has its own nav
    path === "/admin" ||   // exact match — /admin/login must NOT be hidden
    HIDE_NAV_ON.some((p) => path.startsWith(p)) ||
    path.startsWith("/teacher/reset-password") ||
    path.startsWith("/student/reset-password") ||
    path.startsWith("/parent/setup");

  if (shouldHide) return null;

  const logout = (keys, setFn, redirect) => {
    keys.forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    setFn(false);
    navigate(redirect);
  };

  return (
    <>
      <style>{`
        .app-nav { font-family: var(--font-display, sans-serif); }
        .nav-role-btn { transition: background 0.15s, color 0.15s, transform 0.1s; }
        .nav-role-btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .nav-install-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        @media (max-width: 640px) {
          .nav-role-row { display: none !important; }
          .nav-install-btn span.label { display: none; }
        }
      `}</style>

      <nav className="app-nav" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        height: "60px",
        display: "flex", alignItems: "center",
        padding: "0 20px",
        gap: "16px",
      }}>

        {/* ── Logo ── */}
        <div
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", flexShrink: 0 }}
        >
          {/* Icon mark */}
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, #4f63d2 0%, #7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(79,99,210,0.35)",
            flexShrink: 0,
          }}>
            {/* Book + spark SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 7l1.5 3 3 .5-2.2 2.1.5 3L12 14l-2.8 1.6.5-3L7.5 10.5l3-.5L12 7z" fill="white" opacity="0.9"/>
            </svg>
          </div>

          {/* Brand text */}
          <div style={{ lineHeight: 1 }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#1e293b", letterSpacing: "-0.3px" }}>
              Edu<span style={{ color: "#4f63d2" }}>Learn</span>
            </p>
            <p style={{ margin: 0, fontSize: "9.5px", fontWeight: "700", color: "#94a3b8", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              English Platform
            </p>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* ── Role nav buttons ── */}
        <div className="nav-role-row" style={{ display: "flex", alignItems: "center", gap: "6px" }}>

          {isSuperAdminLoggedIn ? (
            <>
              <NavBtn onClick={() => navigate("/super-admin/dashboard")} active={path === "/super-admin/dashboard"} color="#d97706" bg="#fffbeb">Super Admin ↗</NavBtn>
              <NavBtn onClick={() => logout(["superAdminToken","superAdminInfo"], setIsSuperAdminLoggedIn, "/super-admin/login")} color="#ef4444" bg="#fef2f2">Logout</NavBtn>
            </>
          ) : (
            <NavBtn onClick={() => navigate("/super-admin/login")} active={path === "/super-admin/login"} color="#d97706" bg="#fffbeb">Super Admin</NavBtn>
          )}

          {isAdminLoggedIn ? (
            <>
              <NavBtn onClick={() => navigate("/admin")} active={path === "/admin"} color="#7c3aed" bg="#f5f3ff">Admin ↗</NavBtn>
              <NavBtn onClick={() => logout(["adminToken","adminInfo","adminSessionToken"], setIsAdminLoggedIn, "/admin/login")} color="#ef4444" bg="#fef2f2">Logout</NavBtn>
            </>
          ) : (
            <NavBtn onClick={() => navigate("/admin/login")} active={path === "/admin/login"} color="#7c3aed" bg="#f5f3ff">Admin</NavBtn>
          )}

          {isSubAdminLoggedIn ? (
            <>
              <NavBtn onClick={() => navigate("/sub-admin/dashboard")} active={path === "/sub-admin/dashboard"} color="#4f63d2" bg="#eef1ff">Sub-Admin ↗</NavBtn>
              <NavBtn onClick={() => logout(["subAdminToken","subAdminInfo"], setIsSubAdminLoggedIn, "/sub-admin/login")} color="#ef4444" bg="#fef2f2">Logout</NavBtn>
            </>
          ) : (
            <NavBtn onClick={() => navigate("/sub-admin/login")} active={path === "/sub-admin/login"} color="#4f63d2" bg="#eef1ff">Sub-Admin</NavBtn>
          )}

          {isTeacherLoggedIn ? (
            <>
              <NavBtn onClick={() => navigate("/teacher/dashboard")} active={path === "/teacher/dashboard"} color="#0284c7" bg="#e0f2fe">Teacher ↗</NavBtn>
              <NavBtn onClick={() => logout(["teacherToken","teacherInfo","teacherSessionToken"], setIsTeacherLoggedIn, "/teacher/login")} color="#ef4444" bg="#fef2f2">Logout</NavBtn>
            </>
          ) : (
            <NavBtn onClick={() => navigate("/teacher/login")} active={path === "/teacher/login"} color="#0284c7" bg="#e0f2fe">Teacher</NavBtn>
          )}

          {isStudentLoggedIn ? (
            <>
              <NavBtn onClick={() => navigate("/student/dashboard")} active={path === "/student/dashboard"} color="#059669" bg="#d1fae5">Student ↗</NavBtn>
              <NavBtn onClick={() => logout(["studentToken","studentInfo","studentSessionToken"], setIsStudentLoggedIn, "/student/login")} color="#ef4444" bg="#fef2f2">Logout</NavBtn>
            </>
          ) : (
            <NavBtn onClick={() => navigate("/student/login")} active={path === "/student/login"} color="#059669" bg="#d1fae5">Student</NavBtn>
          )}

          {isParentLoggedIn ? (
            <>
              <NavBtn onClick={() => navigate("/parent/dashboard")} active={path === "/parent/dashboard"} color="#f97316" bg="#fff7ed">Parent ↗</NavBtn>
              <NavBtn onClick={() => logout(["parentToken","parentInfo"], setIsParentLoggedIn, "/parent/login")} color="#ef4444" bg="#fef2f2">Logout</NavBtn>
            </>
          ) : (
            <NavBtn onClick={() => navigate("/parent/login")} active={path === "/parent/login"} color="#f97316" bg="#fff7ed">Parent</NavBtn>
          )}
        </div>

        {/* ── Install App button ── */}
        {(installPrompt && !installed) && (
          <button
            className="nav-install-btn"
            onClick={handleInstall}
            style={{
              display: "flex", alignItems: "center", gap: "7px",
              background: "linear-gradient(135deg, #4f63d2, #7c3aed)",
              color: "white", border: "none", borderRadius: "10px",
              padding: "8px 14px", fontSize: "13px", fontWeight: "700",
              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
              boxShadow: "0 4px 14px rgba(79,99,210,0.4)",
            }}
          >
            {/* Download icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span className="label">Install App</span>
          </button>
        )}

        {installed && (
          <div style={{ fontSize: "12px", fontWeight: "700", color: "#10b981", display: "flex", alignItems: "center", gap: "5px" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Installed
          </div>
        )}

      </nav>

      {/* Spacer so content isn't hidden behind nav */}
      <div style={{ height: "60px" }} />
    </>
  );
}

function NavBtn({ onClick, active, color, bg, children }) {
  return (
    <button
      className="nav-role-btn"
      onClick={onClick}
      style={{
        padding: "7px 13px", borderRadius: "9px", border: "none",
        cursor: "pointer", fontSize: "12.5px", fontWeight: "700",
        fontFamily: "inherit",
        background: active ? color : bg,
        color: active ? "white" : color,
        boxShadow: active ? `0 3px 10px ${color}40` : "none",
      }}
    >
      {children}
    </button>
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

function App() {
  return (
    <AuthProvider>
    <BrandingProvider>
      <Router>
      <RingProvider>
      <div className="min-h-screen">
        <ImpersonationBanner />
        <ActiveClassBanner />
        <NavigationButtons />
        <IncomingRingModal />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<CenterLandingPage />} />

            <Route path="/super-admin/login"     element={<SuperAdminLogin />} />
            <Route path="/super-admin/dashboard" element={<AuthGuard role="super-admin"><SuperAdminDashboard /></AuthGuard>} />

            <Route path="/admin/login"                      element={<AdminLogin />} />
            <Route path="/admin/reset-password/:token"     element={<AdminResetPassword />} />
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
