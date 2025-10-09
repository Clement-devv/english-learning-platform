// src/App.jsx
{/*import React, { useState } from "react";
// Import your actual dashboard components
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import Login from "./pages/login";

function App() {
  const [currentView, setCurrentView] = useState("admin");

  return (
    <div className="min-h-screen">
      {/* Fixed navigation button -----
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-2 flex space-x-2">
          <button
            onClick={() => setCurrentView("admin")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              currentView === "admin"
                ? "bg-purple-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => setCurrentView("teacher")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              currentView === "teacher"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Teacher
          </button>

          <button
            onClick={() => setCurrentView("Login")}
            className={`px-4 py-2 rounded-md font-medium transition-all ${
              currentView === "Login"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Login
          </button>
        </div>
      </div>

      {/* Show the selected dashboard -----
      {currentView === "admin" ? <AdminDashboard /> :<TeacherDashboard />}
    </div>
  );
}

export default App;*/}



{/*import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import TeacherLogin from './pages/TeacherLogin';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes 
        <Route path="/" element={<Navigate to="/teacher/login" replace />} />
        <Route path="/teacher/login" element={<TeacherLogin />} />

        {/* Protected Teacher Routes 
        <Route 
          path="/teacher/dashboard" 
          element={
            <ProtectedRoute>
              <TeacherDashboard />
            </ProtectedRoute>
          } 
        />

        {/* 404 Catch All 
        <Route path="*" element={<Navigate to="/teacher/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;*/}

///////////////////////////////////////////////////////////////////////////////


{/*import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Import your actual dashboard components
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherLogin from "./pages/teacher/TeacherLogin";
import ForgotPassword from "./pages/teacher/ForgotPassword";
import ResetPassword from "./pages/teacher/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

// Navigation component that uses router hooks
function NavigationButtons() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if teacher is logged in
  useEffect(() => {
    const token = localStorage.getItem('teacherToken');
    setIsLoggedIn(!!token);
  }, [location]);

  const handleLogout = () => {
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('teacherInfo');
    setIsLoggedIn(false);
    navigate('/teacher/login');
  };

  const currentPath = location.pathname;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-2 flex space-x-2">
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

        {isLoggedIn ? (
          <>
            <button
              onClick={() => navigate('/teacher/dashboard')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                currentPath === '/teacher/dashboard'
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Teacher Dashboard
            </button>
            <button
              onClick={handleLogout}
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
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        {/* Navigation appears on all pages *
        <NavigationButtons />

        {/* Routes 
        <Routes>
          {/* Default redirect to admin 
          <Route path="/" element={<Navigate to="/admin" replace />} />

           {/* Forgot Password (public) *
          <Route path="/teacher/forgot-password" element={<ForgotPassword />} />

          {/* Reset Password with Token (public) *
          <Route path="/teacher/reset-password/:token" element={<ResetPassword />} />
          
          {/* Admin Dashboard (public for now) *
          <Route path="/admin" element={<AdminDashboard />} />
          
          {/* Teacher Login (public) *
          <Route path="/teacher/login" element={<TeacherLogin />} />
          
          {/* Teacher Dashboard (protected) *
          <Route 
            path="/teacher/dashboard" 
            element={
              <ProtectedRoute>
                <TeacherDashboard />
              </ProtectedRoute>
            } 
          />

          {/* 404 - redirect to admin *
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;*/}


{/*import React from "react";
import StudentDashboard from "./pages/student/StudentDashboard";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <StudentDashboard />
    </div>
  );
}*/}





import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';

// Admin & Teacher
import AdminDashboard from "./pages/admin/AdminDashboard";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherLogin from "./pages/teacher/TeacherLogin";
import ForgotPassword from "./pages/teacher/ForgotPassword";
import ResetPassword from "./pages/teacher/ResetPassword";
import ProtectedRoute from "./components/ProtectedRoute";

// Student
import StudentLogin from "./pages/student/StudentLogin";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentProtectedRoute from "./components/StudentProtectedRoute";

// Navigation component that uses router hooks
function NavigationButtons() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [isStudentLoggedIn, setIsStudentLoggedIn] = useState(false);

  // Check if teacher or student is logged in
  useEffect(() => {
    const teacherToken = localStorage.getItem('teacherToken');
    const studentToken = localStorage.getItem('studentToken');
    setIsTeacherLoggedIn(!!teacherToken);
    setIsStudentLoggedIn(!!studentToken);
  }, [location]);

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
        {/* Navigation appears on all pages */}
        <NavigationButtons />

        {/* Routes */}
        <Routes>
          {/* Default redirect to admin */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* Teacher Routes */}
          <Route path="/teacher/forgot-password" element={<ForgotPassword />} />
          <Route path="/teacher/reset-password/:token" element={<ResetPassword />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
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
          <Route 
            path="/student/dashboard" 
            element={
              <StudentProtectedRoute>
                <StudentDashboard />
              </StudentProtectedRoute>
            } 
          />
          
          {/* Admin Dashboard (public for now) */}
          <Route path="/admin" element={<AdminDashboard />} />

          {/* 404 - redirect to admin */}
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

