// src/components/TwoFactorManagement.jsx
import React, { useState, useEffect } from 'react';
import { Shield, Check, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import api from '../api';
import TwoFactorSetup from './TwoFactorSetup';

export default function TwoFactorManagement({ userType = 'student' }) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const getToken = () => {
    if (userType === 'teacher') return localStorage.getItem('teacherToken');
    if (userType === 'admin') return localStorage.getItem('adminToken');
    return localStorage.getItem('studentToken');
  };

  // Check 2FA status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = getToken();
      const response = await api.get('/api/2fa/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTwoFactorEnabled(response.data.twoFactorEnabled);
    } catch (err) {
      console.error('Error fetching 2FA status:', err);
    }
  };

  const handleDisable2FA = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = getToken();
      const response = await api.post('/api/2fa/disable', 
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setSuccessMessage('2FA has been disabled');
        setTwoFactorEnabled(false);
        setShowDisable(false);
        setPassword('');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!confirm('Are you sure? Your current backup codes will no longer work.')) {
      return;
    }

    const password = prompt('Enter your password to confirm:');
    if (!password) return;

    setLoading(true);
    setError('');
    
    try {
      const token = getToken();
      const response = await api.post('/api/2fa/regenerate-backup-codes',
        { password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Download new codes
        const codes = response.data.backupCodes;
        const content = `Two-Factor Authentication Backup Codes\n\n${codes.join('\n')}\n\nSave these codes securely.`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '2FA-Backup-Codes-New.txt';
        a.click();
        
        setSuccessMessage('New backup codes generated and downloaded');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate codes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
          
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            twoFactorEnabled 
              ? 'bg-green-100 text-green-700' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            {twoFactorEnabled ? (
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4" /> Enabled
              </span>
            ) : (
              'Disabled'
            )}
          </div>
        </div>

        {successMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {!twoFactorEnabled ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Protect your account with an authenticator app like Google Authenticator or Authy.
            </p>
            <button
              onClick={() => setShowSetup(true)}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Enable Two-Factor Authentication
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={handleRegenerateBackupCodes}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-700 py-2 rounded-lg font-medium hover:bg-blue-200 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate Backup Codes
            </button>
            
            {!showDisable ? (
              <button
                onClick={() => setShowDisable(true)}
                className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-700 py-2 rounded-lg font-medium hover:bg-red-200"
              >
                <Trash2 className="w-4 h-4" />
                Disable 2FA
              </button>
            ) : (
              <div className="space-y-2 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-900">Enter password to disable 2FA:</p>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDisable2FA}
                    disabled={loading || !password}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? 'Disabling...' : 'Confirm Disable'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDisable(false);
                      setPassword('');
                      setError('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Setup Modal */}
      <TwoFactorSetup 
        isOpen={showSetup} 
        onClose={() => {
          setShowSetup(false);
          fetchStatus(); // Refresh status after setup
        }} 
        userType={userType}
      />
    </>
  );
}
