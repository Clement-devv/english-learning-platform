import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router, Routes, Route,
  Navigate, useNavigate, useLocation
} from "react-router-dom";

// Auth guards — small, always needed immediately
import AdminProtectedRoute    from "./components/AdminProtectedRoute";
import SubAdminProtectedRoute from "./components/SubAdminProtectedRoute";
import ProtectedRoute         from "./components/ProtectedRoute";
import ClassroomProtectedRoute from "./components/ClassroomProtectedRoute";
import StudentProtectedRoute  from "./components/StudentProtectedRoute";

// Login pages — small, load fast, keep static
import AdminLogin          from "./pages/admin/AdminLogin";
import SubAdminLogin       from "./pages/sub-admin/SubAdminLogin";
import TeacherLogin        from "./pages/teacher/TeacherLogin";
import StudentLogin        from "./pages/student/StudentLogin";

// Heavy pages — lazy loaded (each becomes its own JS chunk)
const AdminDashboard      = lazy(() => import("./pages/admin/AdminDashboard"));
const SubAdminSetup       = lazy(() => import("./pages/sub-admin/SubAdminSetup"));
const SubAdminDashboard   = lazy(() => import("./pages/sub-admin/SubAdminDashboard"));
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

const HIDE_NAV_ON = [
  "/sub-admin/setup",
  "/classroom",
  "/admin",
  "/teacher/dashboard",
  "/student/dashboard",
  "/sub-admin/dashboard",
];

function NavigationButtons() {
  const navigate = useNavigate();
  const location = useLocation();
  const path     = location.pathname;

  const [isAdminLoggedIn,    setIsAdminLoggedIn]    = useState(false);
  const [isTeacherLoggedIn,  setIsTeacherLoggedIn]  = useState(false);
  const [isStudentLoggedIn,  setIsStudentLoggedIn]  = useState(false);
  const [isSubAdminLoggedIn, setIsSubAdminLoggedIn] = useState(false);
  const [installPrompt,      setInstallPrompt]      = useState(null);
  const [installed,          setInstalled]          = useState(false);

  useEffect(() => {
    setIsAdminLoggedIn(!!localStorage.getItem("adminToken"));
    setIsTeacherLoggedIn(!!localStorage.getItem("teacherToken"));
    setIsStudentLoggedIn(!!localStorage.getItem("studentToken") || !!sessionStorage.getItem("studentToken"));
    setIsSubAdminLoggedIn(!!localStorage.getItem("subAdminToken"));
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
    HIDE_NAV_ON.some((p) => path.startsWith(p)) ||
    path.startsWith("/teacher/reset-password") ||
    path.startsWith("/student/reset-password");

  if (shouldHide) return null;

  const logout = (keys, setFn, redirect) => {
    keys.forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
    setFn(false);
    navigate(redirect);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        .app-nav { font-family: 'Plus Jakarta Sans', sans-serif; }
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

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <NavigationButtons />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/admin/login" replace />} />

            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>} />

            <Route path="/sub-admin/login"     element={<SubAdminLogin />} />
            <Route path="/sub-admin/setup"     element={<SubAdminSetup />} />
            <Route path="/sub-admin/dashboard" element={<SubAdminProtectedRoute><SubAdminDashboard /></SubAdminProtectedRoute>} />

            <Route path="/classroom" element={<ClassroomProtectedRoute><Classroom /></ClassroomProtectedRoute>} />

            <Route path="/teacher/login"                 element={<TeacherLogin />} />
            <Route path="/teacher/forgot-password"       element={<ForgotPassword />} />
            <Route path="/teacher/reset-password/:token" element={<ResetPassword />} />
            <Route path="/teacher/dashboard"             element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/teacher/setup"                 element={<TeacherSetup />} />

            <Route path="/student/login"                 element={<StudentLogin />} />
            <Route path="/student/forgot-password"       element={<StudentForgotPassword />} />
            <Route path="/student/reset-password/:token" element={<StudentResetPassword />} />
            <Route path="/student/dashboard"             element={<StudentProtectedRoute><StudentDashboard /></StudentProtectedRoute>} />
            <Route path="/student/setup"                 element={<StudentSetup />} />

            <Route path="/join" element={<Join />} />

            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
