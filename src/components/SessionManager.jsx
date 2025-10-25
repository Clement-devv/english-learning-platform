import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, MapPin, Clock, AlertCircle, LogOut } from 'lucide-react';
import api from '../api';

export default function SessionManager({ userRole, onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/auth/sessions');
      setSessions(response.data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutSession = async (sessionToken) => {
    if (!window.confirm('Are you sure you want to logout from this device?')) return;

    try {
      setActionLoading(sessionToken);
      await api.post('/api/auth/logout-session', { sessionToken });
      
      // Remove from UI
      setSessions(prev => prev.filter(s => s.sessionToken !== sessionToken));
      
    } catch (err) {
      console.error('Error logging out session:', err);
      alert('Failed to logout from device');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!window.confirm('This will logout all other devices. Continue?')) return;

    try {
      setActionLoading('all');
      await api.post('/api/auth/logout-all-devices');
      
      // Keep only current session
      setSessions(prev => prev.filter(s => s.isCurrent));
      
      alert('Successfully logged out from all other devices');
    } catch (err) {
      console.error('Error logging out all devices:', err);
      alert('Failed to logout from all devices');
    } finally {
      setActionLoading(null);
    }
  };

  const getDeviceIcon = (device) => {
    const deviceLower = device?.toLowerCase() || '';
    if (deviceLower.includes('mobile') || deviceLower.includes('phone')) {
      return <Smartphone className="w-6 h-6" />;
    }
    if (deviceLower.includes('tablet') || deviceLower.includes('ipad')) {
      return <Tablet className="w-6 h-6" />;
    }
    return <Monitor className="w-6 h-6" />;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Active Sessions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your devices and logged-in sessions
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="ml-3 text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-6">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Monitor className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.sessionToken}
                  className={`p-4 rounded-lg border-2 transition ${
                    session.isCurrent
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      {/* Device Icon */}
                      <div className={`p-3 rounded-lg ${
                        session.isCurrent ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {getDeviceIcon(session.deviceInfo?.device)}
                      </div>

                      {/* Session Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {session.deviceInfo?.browser || 'Unknown Browser'}
                          </h3>
                          {session.isCurrent && (
                            <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded-full">
                              Current
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mt-1">
                          {session.deviceInfo?.os || 'Unknown OS'} • {session.deviceInfo?.device || 'Desktop'}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {session.ipAddress || 'Unknown'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getTimeAgo(session.lastActivity)}
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 mt-1">
                          Login: {formatDate(session.loginTime)}
                        </p>
                      </div>
                    </div>

                    {/* Logout Button */}
                    {!session.isCurrent && (
                      <button
                        onClick={() => handleLogoutSession(session.sessionToken)}
                        disabled={actionLoading === session.sessionToken}
                        className="ml-4 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                      >
                        {actionLoading === session.sessionToken ? (
                          'Logging out...'
                        ) : (
                          <>
                            <LogOut className="w-4 h-4 inline mr-1" />
                            Logout
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {sessions.length > 1 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={handleLogoutAllDevices}
              disabled={actionLoading === 'all'}
              className="w-full px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'all' ? (
                'Logging out...'
              ) : (
                <>
                  <LogOut className="w-4 h-4 inline mr-2" />
                  Logout From All Other Devices
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              This will keep you logged in on this device only
            </p>
          </div>
        )}
      </div>
    </div>
  );
}