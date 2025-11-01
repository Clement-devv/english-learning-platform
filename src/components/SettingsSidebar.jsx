// src/components/SettingsSidebar.jsx - 
import React, { useState } from 'react';
import { 
  Settings, 
  X, 
  Key, 
  Shield, 
  Monitor, 
  ChevronRight,
  Lock,
  User,
  Mail,
  Globe
} from 'lucide-react';

export default function SettingsSidebar({ 
  isOpen, 
  onClose, 
  onChangePassword,
  onManageSessions,
  onManage2FA,
  userInfo = null // NEW: Accept user info to display email and continent
}) {
  const [activeSection, setActiveSection] = useState(null);

  const menuItems = [
    {
      id: 'password',
      label: 'Change Password',
      icon: Key,
      description: 'Update your account password',
      onClick: () => {
        onChangePassword();
        onClose();
      }
    },
    {
      id: 'sessions',
      label: 'Active Sessions',
      icon: Monitor,
      description: 'Manage logged-in devices',
      onClick: () => {
        onManageSessions();
        onClose();
      }
    },
    {
      id: '2fa',
      label: 'Two-Factor Authentication',
      icon: Shield,
      description: 'Secure your account with 2FA',
      onClick: () => {
        onManage2FA();
        onClose();
      }
    }
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Settings</h2>
                <p className="text-sm text-blue-100">Account & Security</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* FIX #3: User Profile Section - Display email and continent */}
        {userInfo && (
          <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-full">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">
                  {userInfo.firstName} {userInfo.lastName}
                </h3>
                <p className="text-xs text-gray-500">Account Information</p>
              </div>
            </div>
            
            <div className="space-y-2 bg-white rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">{userInfo.email}</span>
              </div>
              
              {userInfo.continent && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">{userInfo.continent}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Menu Items */}
        <div className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={item.onClick}
              onMouseEnter={() => setActiveSection(item.id)}
              onMouseLeave={() => setActiveSection(null)}
              className={`w-full p-4 rounded-lg text-left transition-all duration-200 ${
                activeSection === item.id
                  ? 'bg-blue-50 border-2 border-blue-200 shadow-md'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    activeSection === item.id
                      ? 'bg-blue-100'
                      : 'bg-gray-200'
                  }`}>
                    <item.icon className={`w-5 h-5 ${
                      activeSection === item.id
                        ? 'text-blue-600'
                        : 'text-gray-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.label}</h3>
                    <p className="text-sm text-gray-500">{item.description}</p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 transition-transform ${
                  activeSection === item.id
                    ? 'text-blue-600 transform translate-x-1'
                    : 'text-gray-400'
                }`} />
              </div>
            </button>
          ))}
        </div>

        {/* Security Notice */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-amber-50 border-t border-amber-200">
          <div className="flex items-start gap-2">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Security Tip</p>
              <p className="text-xs text-amber-700">
                Enable 2FA and regularly review your active sessions to keep your account secure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
