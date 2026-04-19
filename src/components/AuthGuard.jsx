// src/components/AuthGuard.jsx
// Single auth guard for all roles. Replaces the 6 separate *ProtectedRoute files.
//
// Usage:
//   <AuthGuard role="teacher">   <TeacherDashboard />  </AuthGuard>
//   <AuthGuard role="student">   <StudentDashboard />  </AuthGuard>
//   <AuthGuard role="admin">     <AdminDashboard />    </AuthGuard>
//   <AuthGuard role="sub-admin"> <SubAdminDashboard /> </AuthGuard>
//   <AuthGuard role="super-admin"><SuperAdminDashboard /></AuthGuard>
//   <AuthGuard role="classroom"> <Classroom />         </AuthGuard>

import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { ROLE_CONFIG, readStorage, clearAuth } from '../utils/authStorage.js';

// Classroom accepts any of these roles
const CLASSROOM_ROLES = ['teacher', 'student', 'sub-admin'];

function getToken(cfg) {
  return readStorage(cfg.tokenKey, cfg.localOnly);
}

function clearTokens(cfg) {
  clearAuth(Object.keys(ROLE_CONFIG).find((r) => ROLE_CONFIG[r] === cfg));
}

function clientSideValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 > Date.now() : true;
  } catch {
    return false;
  }
}

export default function AuthGuard({ role, children }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'denied'
  const loginPathRef         = useRef('/');

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // ── Classroom: accept teacher OR student OR sub-admin ────────────────
      if (role === 'classroom') {
        for (const r of CLASSROOM_ROLES) {
          const cfg   = ROLE_CONFIG[r];
          const token = getToken(cfg);
          if (!token) continue;

          if (cfg.clientSide) {
            if (clientSideValid(token)) {
              if (!cancelled) setStatus('ok');
              return;
            }
            clearTokens(cfg);
            continue;
          }

          try {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            await api.get(cfg.verifyPath);
            if (!cancelled) setStatus('ok');
            return;
          } catch {
            clearTokens(cfg);
          }
        }

        // No valid token for any role — redirect based on stored role hint
        const storedRole     = sessionStorage.getItem('role') || localStorage.getItem('role');
        loginPathRef.current = storedRole === 'student' ? '/student/login' : '/teacher/login';
        if (!cancelled) setStatus('denied');
        return;
      }

      // ── Single role ──────────────────────────────────────────────────────
      const cfg = ROLE_CONFIG[role];
      if (!cfg) {
        if (!cancelled) setStatus('denied');
        return;
      }

      loginPathRef.current = cfg.loginPath;
      const token = getToken(cfg);

      if (!token) {
        if (!cancelled) setStatus('denied');
        return;
      }

      // Sub-admin: client-side JWT check — no API call needed
      if (cfg.clientSide) {
        if (!clientSideValid(token)) clearTokens(cfg);
        else if (!cancelled) { setStatus('ok'); return; }
        if (!cancelled) setStatus('denied');
        return;
      }

      // All others: verify with backend
      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await api.get(cfg.verifyPath);
        if (!cancelled) setStatus('ok');
      } catch {
        clearTokens(cfg);
        if (!cancelled) setStatus('denied');
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [role]);

  if (status === 'loading') {
    const dark = role === 'super-admin';
    return dark ? (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09080e' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(245,158,11,0.2)', borderTopColor: '#f59e0b', animation: 'spin 0.75s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ) : (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (status === 'denied') return <Navigate to={loginPathRef.current} replace />;
  return children;
}
