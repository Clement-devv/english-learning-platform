// src/components/SettingsSidebar.jsx
import React, { useState } from 'react';
import { Settings, X, Key, Shield, Monitor, ChevronRight, Lock, User, Mail, Globe } from 'lucide-react';

export default function SettingsSidebar({
  isOpen,
  onClose,
  onChangePassword,
  onChangeEmail,
  onManageSessions,
  onManage2FA,
  userInfo = null,
  isMobile = false,
  forcedMode = null,
  onSetViewMode = null,
}) {
  const [activeSection, setActiveSection] = useState(null);

  const menuItems = [
    {
      id: 'password',
      label: 'Change Password',
      icon: Key,
      description: 'Update your account password',
      onClick: () => { onChangePassword(); onClose(); },
    },
    ...(onChangeEmail ? [{
      id: 'email',
      label: 'Change Email',
      icon: Mail,
      description: 'Update your login email address',
      onClick: () => { onChangeEmail(); onClose(); },
    }] : []),
    {
      id: 'sessions',
      label: 'Active Sessions',
      icon: Monitor,
      description: 'Manage logged-in devices',
      onClick: () => { onManageSessions(); onClose(); },
    },
    {
      id: '2fa',
      label: 'Two-Factor Authentication',
      icon: Shield,
      description: 'Secure your account with 2FA',
      onClick: () => { onManage2FA(); onClose(); },
    },
  ];

  // Show view toggle on any small-screen device (phone/tablet) regardless of current mode
  const showViewToggle = onSetViewMode && window.screen.width < 1024;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 shadow-2xl z-50 overflow-y-auto flex flex-col"
           style={{ background: 'var(--ss-bg, #fff)' }}>

        <style>{`
          @media (prefers-color-scheme: dark) { :root { --ss-bg: #111827; } }
          .dark { --ss-bg: #111827; }
          .ss-item { transition: all 0.18s; }
          .ss-item:hover { transform: translateX(2px); }
        `}</style>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', padding: '24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 10 }}>
                <Settings style={{ width: 22, height: 22, color: '#fff' }} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>Settings</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Account &amp; Security</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ padding: 8, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              <X style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>

        {/* User Profile */}
        {userInfo && (
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(249,115,22,0.15)', background: 'linear-gradient(135deg, #fff7ed, #fef3c7)' }}
               className="dark:bg-gray-800">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ padding: 10, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #f59e0b)', flexShrink: 0 }}>
                <User style={{ width: 20, height: 20, color: '#fff' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#111827' }} className="dark:text-white">
                  {userInfo.firstName} {userInfo.lastName}
                </h3>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Account Information</p>
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #fed7aa', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Mail style={{ width: 15, height: 15, color: '#9ca3af', flexShrink: 0 }} />
                <span style={{ color: '#374151' }}>{userInfo.email}</span>
              </div>
              {userInfo.continent && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <Globe style={{ width: 15, height: 15, color: '#9ca3af', flexShrink: 0 }} />
                  <span style={{ color: '#374151' }}>{userInfo.continent}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* View Mode Toggle */}
        {showViewToggle && (
          <div style={{ padding: '16px', borderBottom: '1px solid #f3f4f6' }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Display Mode
            </p>
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 14, padding: 4, gap: 4 }}
                 className="dark:bg-gray-800">
              {[
                { mode: 'auto',    label: '📱 Mobile',  sub: 'App layout'  },
                { mode: 'desktop', label: '🖥️ Desktop', sub: 'Full site'   },
              ].map(({ mode, label, sub }) => {
                const isActive = mode === 'desktop' ? forcedMode === 'desktop' : forcedMode !== 'desktop';
                return (
                  <button
                    key={mode}
                    onClick={() => { onSetViewMode(mode); if (mode === 'desktop') onClose(); }}
                    style={{
                      flex: 1, border: 'none', cursor: 'pointer', borderRadius: 10, padding: '8px 6px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      background: isActive ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'transparent',
                      color: isActive ? '#fff' : '#6b7280',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 800 }}>{label}</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {menuItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                className="ss-item"
                onClick={item.onClick}
                onMouseEnter={() => setActiveSection(item.id)}
                onMouseLeave={() => setActiveSection(null)}
                style={{
                  width: '100%', padding: 16, borderRadius: 16, textAlign: 'left',
                  border: active ? '2px solid #fed7aa' : '2px solid transparent',
                  background: active ? 'linear-gradient(135deg,#fff7ed,#fef3c7)' : '#f9fafb',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.18s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 8, borderRadius: 10, background: active ? '#fff7ed' : '#f3f4f6', flexShrink: 0 }}>
                    <item.icon style={{ width: 18, height: 18, color: active ? '#f97316' : '#6b7280' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }} className="dark:text-white">
                      {item.label}
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{item.description}</p>
                  </div>
                </div>
                <ChevronRight style={{
                  width: 18, height: 18,
                  color: active ? '#f97316' : '#9ca3af',
                  transform: active ? 'translateX(3px)' : 'none',
                  transition: 'transform 0.15s',
                  flexShrink: 0,
                }} />
              </button>
            );
          })}
        </div>

        {/* Security Notice */}
        <div style={{ margin: '0 16px 24px', padding: '14px 16px', borderRadius: 16, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <Lock style={{ width: 16, height: 16, color: '#d97706', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#92400e' }}>Security Tip</p>
              <p style={{ margin: 0, fontSize: 12, color: '#b45309', lineHeight: 1.5 }}>
                Enable 2FA and review your active sessions to keep your account secure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
