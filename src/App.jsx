import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router, Routes, Route,
  Navigate, useNavigate, useLocation
} from "react-router-dom";

// Admin
import AdminDashboard    from "./pages/admin/AdminDashboard";
import AdminLogin        from "./pages/admin/AdminLogin";
import AdminProtectedRoute from "./components/AdminProtectedRoute";

// Sub-Admin
import SubAdminLogin from "./pages/sub-admin/SubAdminLogin";
import SubAdminSetup from "./pages/sub-admin/SubAdminSetup";
import SubAdminDashboard    from "./pages/sub-admin/SubAdminDashboard";    
import SubAdminProtectedRoute from "./components/SubAdminProtectedRoute"; 

// Teacher
import TeacherDashboard  from "./pages/teacher/TeacherDashboard";
import TeacherLogin      from "./pages/teacher/TeacherLogin";
import ForgotPassword    from "./pages/teacher/ForgotPassword";
import ResetPassword     from "./pages/teacher/ResetPassword";
import ProtectedRoute    from "./components/ProtectedRoute";
import ClassroomProtectedRoute from "./components/ClassroomProtectedRoute";

// Student
import StudentLogin          from "./pages/student/StudentLogin";
import StudentForgotPassword from "./pages/student/ForgotPassword";
import StudentResetPassword  from "./pages/student/ResetPassword";
import StudentDashboard      from "./pages/student/StudentDashboard";
import StudentProtectedRoute from "./components/StudentProtectedRoute";

// Classroom
import Classroom from "./pages/Classroom";

// ─────────────────────────────────────────────────────────────────────────────
// Pages where the floating nav should NOT appear
// ─────────────────────────────────────────────────────────────────────────────
const HIDE_NAV_ON = [
  "/admin/login",
  "/teacher/login",
  "/teacher/forgot-password",
  "/student/login",
  "/student/forgot-password",
  "/sub-admin/login",
  "/sub-admin/setup",
  "/classroom",
];

function NavigationButtons() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const path      = location.pathname;

  const [isAdminLoggedIn,   setIsAdminLoggedIn]   = useState(false);
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [isStudentLoggedIn, setIsStudentLoggedIn] = useState(false);
  const [isSubAdminLoggedIn, setIsSubAdminLoggedIn] = useState(false);

  useEffect(() => {
    setIsAdminLoggedIn(!!localStorage.getItem("adminToken"));
    setIsTeacherLoggedIn(!!localStorage.getItem("teacherToken"));
    setIsStudentLoggedIn(!!localStorage.getItem("studentToken"));
    setIsSubAdminLoggedIn(!!localStorage.getItem("subAdminToken"));
  }, [location]);

  // Hide on login / setup pages
  const shouldHide =
    HIDE_NAV_ON.some((p) => path.startsWith(p)) ||
    path.startsWith("/teacher/reset-password") ||
    path.startsWith("/student/reset-password");

  if (shouldHide) return null;

  const logout = (tokenKey, infoKey, setFn, redirect) => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(infoKey);
    setFn(false);
    navigate(redirect);
  };

  const Btn = ({ onClick, active, color, children }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md font-medium transition-all text-sm ${
        active
          ? `bg-${color}-600 text-white shadow-md`
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-2 flex space-x-2 flex-wrap gap-1">

        {/* Admin */}
        {isAdminLoggedIn ? (
          <>
            <Btn onClick={() => navigate("/admin")} active={path === "/admin"} color="purple">Admin</Btn>
            <Btn onClick={() => logout("adminToken", "adminInfo", setIsAdminLoggedIn, "/admin/login")} color="red">
              <span className="text-red-600">Logout</span>
            </Btn>
          </>
        ) : (
          <Btn onClick={() => navigate("/admin/login")} active={path === "/admin/login"} color="purple">
            Admin Login
          </Btn>
        )}

        {/* Sub-Admin */}
        {isSubAdminLoggedIn ? (
          <>
            <Btn onClick={() => navigate("/sub-admin/dashboard")} active={path === "/sub-admin/dashboard"} color="indigo">
              Sub-Admin
            </Btn>
            <Btn onClick={() => logout("subAdminToken", "subAdminInfo", setIsSubAdminLoggedIn, "/sub-admin/login")} color="red">
              <span className="text-red-600">Logout</span>
            </Btn>
          </>
        ) : null /* don't show Sub-Admin Login in nav — it has its own portal */ }

        {/* Teacher */}
        {isTeacherLoggedIn ? (
          <>
            <Btn onClick={() => navigate("/teacher/dashboard")} active={path === "/teacher/dashboard"} color="blue">Teacher</Btn>
            <Btn onClick={() => logout("teacherToken", "teacherInfo", setIsTeacherLoggedIn, "/teacher/login")} color="red">
              <span className="text-red-600">Logout</span>
            </Btn>
          </>
        ) : (
          <Btn onClick={() => navigate("/teacher/login")} active={path === "/teacher/login"} color="blue">
            Teacher Login
          </Btn>
        )}

        {/* Student */}
        {isStudentLoggedIn ? (
          <>
            <Btn onClick={() => navigate("/student/dashboard")} active={path === "/student/dashboard"} color="green">Student</Btn>
            <Btn onClick={() => logout("studentToken", "studentInfo", setIsStudentLoggedIn, "/student/login")} color="red">
              <span className="text-red-600">Logout</span>
            </Btn>
          </>
        ) : (
          <Btn onClick={() => navigate("/student/login")} active={path === "/student/login"} color="green">
            Student Login
          </Btn>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <NavigationButtons />

        <Routes>
          {/* Default */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />

          {/* ── Admin ── */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            }
          />

          {/* ── Sub-Admin ── */}
          <Route path="/sub-admin/login" element={<SubAdminLogin />} />
          <Route path="/sub-admin/setup" element={<SubAdminSetup />} />
          
          <Route
            path="/sub-admin/dashboard"
            element={
              <SubAdminProtectedRoute>
                <SubAdminDashboard />
              </SubAdminProtectedRoute>
            }
          />
        
          {/* Temporary placeholder until dashboard is built */}
          <Route
            path="/sub-admin/dashboard"
            element={<Navigate to="/sub-admin/login" replace />}
          />

          {/* ── Classroom (shared) ── */}
          <Route
            path="/classroom"
            element={
              <ClassroomProtectedRoute>
                <Classroom />
              </ClassroomProtectedRoute>
            }
          />

          {/* ── Teacher ── */}
          <Route path="/teacher/login"                    element={<TeacherLogin />} />
          <Route path="/teacher/forgot-password"          element={<ForgotPassword />} />
          <Route path="/teacher/reset-password/:token"    element={<ResetPassword />} />
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />

          {/* ── Student ── */}
          <Route path="/student/login"                   element={<StudentLogin />} />
          <Route path="/student/forgot-password"         element={<StudentForgotPassword />} />
          <Route path="/student/reset-password/:token"   element={<StudentResetPassword />} />
          <Route
            path="/student/dashboard"
            element={
              <StudentProtectedRoute>
                <StudentDashboard />
              </StudentProtectedRoute>
            }
          />

          {/* 404 → admin login */}
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
