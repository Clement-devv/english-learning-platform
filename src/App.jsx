import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Admin & Teacher
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminProtectedRoute from "./components/AdminProtectedRoute";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherLogin from "./pages/teacher/TeacherLogin";
import ForgotPassword from "./pages/teacher/ForgotPassword";
import ResetPassword from "./pages/teacher/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

// Student
import StudentLogin from "./pages/student/StudentLogin";
import StudentForgotPassword from "./pages/student/ForgotPassword";
import StudentResetPassword from "./pages/student/ResetPassword";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentProtectedRoute from "./components/StudentProtectedRoute";

// Navigation component
function NavigationButtons() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [isStudentLoggedIn, setIsStudentLoggedIn] = useState(false);

  // Check if admin, teacher or student is logged in
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    const teacherToken = localStorage.getItem('teacherToken');
    const studentToken = localStorage.getItem('studentToken');
    setIsAdminLoggedIn(!!adminToken);
    setIsTeacherLoggedIn(!!teacherToken);
    setIsStudentLoggedIn(!!studentToken);
  }, [location]);

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    setIsAdminLoggedIn(false);
    navigate('/admin/login');
  };

  const handleTeacherLogout = () => {
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('teacherInfo');
    setIsTeacherLoggedIn(false);
    navigate('/teacher/login');
  };

  const handleStudentLogout = () => {
    localStorage.removeItem('studentToken');
    localStorage.removeItem('studentInfo');
    setIsStudentLoggedIn(false);
    navigate('/student/login');
  };

  const currentPath = location.pathname;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-2 flex space-x-2">
        {/* Admin Button */}
        {isAdminLoggedIn ? (
          <>
            <button
              onClick={() => navigate('/admin')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentPath === '/admin'
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Admin
            </button>
            <button
              onClick={handleAdminLogout}
              className="px-4 py-2 rounded-md font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
            >
              Logout
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate('/admin/login')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              currentPath === '/admin/login'
                ? "bg-purple-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Admin Login
          </button>
        )}

        {/* Teacher Button */}
        {isTeacherLoggedIn ? (
          <>
            <button
              onClick={() => navigate('/teacher/dashboard')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentPath === '/teacher/dashboard'
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Teacher
            </button>
            <button
              onClick={handleTeacherLogout}
              className="px-4 py-2 rounded-md font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
            >
              Logout
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate('/teacher/login')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              currentPath === '/teacher/login'
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Teacher Login
          </button>
        )}

        {/* Student Button */}
        {isStudentLoggedIn ? (
          <>
            <button
              onClick={() => navigate('/student/dashboard')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentPath === '/student/dashboard'
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Student
            </button>
            <button
              onClick={handleStudentLogout}
              className="px-4 py-2 rounded-md font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
            >
              Logout
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate('/student/login')}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              currentPath === '/student/login'
                ? "bg-green-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Student Login
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <NavigationButtons />

        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route 
            path="/admin" 
            element={
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            } 
          />

          {/* Teacher Routes */}
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/teacher/forgot-password" element={<ForgotPassword />} />
          <Route path="/teacher/reset-password/:token" element={<ResetPassword />} />
          <Route 
            path="/teacher/dashboard" 
            element={
              <ProtectedRoute>
                <TeacherDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Student Routes */}
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/forgot-password" element={<StudentForgotPassword />} />
          <Route path="/student/reset-password/:token" element={<StudentResetPassword />} />
          <Route 
            path="/student/dashboard" 
            element={
              <StudentProtectedRoute>
                <StudentDashboard />
              </StudentProtectedRoute>
            } 
          />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;