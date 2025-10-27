// src/components/SessionManagement.jsx
import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, Laptop, MapPin, Clock, AlertCircle, X } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function SessionManagement({ isOpen, onClose, userType = 'student' }) {
  const [sessions, setSessions] = useState([]);
  const [lastLogin, setLastLogin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ✅ FIXED: Get the correct token based on user type
  const getToken = () => {
    if (userType === 'teacher') return localStorage.getItem('teacherToken');
    if (userType === 'admin') return localStorage.getItem('adminToken');
    return localStorage.getItem('studentToken');
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = getToken(); // ✅ FIXED
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/auth/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setSessions(response.data.sessions);
        setLastLogin(response.data.lastLogin);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err.response?.data?.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutSession = async (sessionToken) => {
    try {
      const token = getToken(); // ✅ FIXED
      
      const response = await axios.post(
        `${API_BASE_URL}/auth/logout-session`,
        { sessionToken },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setSuccessMessage('Session logged out successfully');
        fetchSessions(); // Refresh the list
        
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error logging out session:', err);
      setError(err.response?.data?.message || 'Failed to logout session');
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!confirm('Are you sure you want to logout from all other devices? You will remain logged in on this device.')) {
      return;
    }

    try {
      const token = getToken(); // ✅ FIXED
      
      const response = await axios.post(
        `${API_BASE_URL}/auth/logout-all-devices`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setSuccessMessage('Logged out from all other devices successfully');
        fetchSessions(); // Refresh the list
        
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      console.error('Error logging out all devices:', err);
      setError(err.response?.data?.message || 'Failed to logout from all devices');
    }
  };

  const getDeviceIcon = (deviceType) => {
    const type = deviceType?.toLowerCase() || 'desktop';
    
    if (type.includes('mobile') || type.includes('phone')) {
      return <Smartphone className="w-5 h-5" />;
    } else if (type.includes('tablet')) {
      return <Tablet className="w-5 h-5" />;
    } else if (type.includes('laptop')) {
      return <Laptop className="w-5 h-5" />;
    } else {
      return <Monitor className="w-5 h-5" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Active Sessions</h2>
            <p className="text-blue-100 text-sm mt-1">
              Manage your devices and security
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Last Login Info */}
          {lastLogin && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-blue-800">
                <Clock className="w-5 h-5" />
                <span className="font-medium">Last Login:</span>
                <span>{formatDate(lastLogin)}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Sessions List */}
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No active sessions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session, index) => (
                    <div
                      key={session.sessionToken || index}
                      className={`border rounded-lg p-4 ${
                        session.isCurrent
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4 flex-1">
                          {/* Device Icon */}
                          <div className={`p-3 rounded-lg ${
                            session.isCurrent ? 'bg-green-200' : 'bg-gray-100'
                          }`}>
                            {getDeviceIcon(session.deviceInfo?.device)}
                          </div>

                          {/* Session Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">
                                {session.deviceInfo?.browser || 'Unknown Browser'}
                              </h3>
                              {session.isCurrent && (
                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                  Current Device
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Monitor className="w-4 h-4" />
                                <span>{session.deviceInfo?.os || 'Unknown OS'}</span>
                                <span className="text-gray-400">•</span>
                                <span>{session.deviceInfo?.device || 'Desktop'}</span>
                              </div>

                              {session.ipAddress && session.ipAddress !== 'Unknown' && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{session.ipAddress}</span>
                                  {session.location && session.location !== 'Unknown' && (
                                    <>
                                      <span className="text-gray-400">•</span>
                                      <span>{session.location}</span>
                                    </>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>Login: {formatDate(session.loginTime)}</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>Last activity: {formatDate(session.lastActivity)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Logout Button */}
                        {!session.isCurrent && (
                          <button
                            onClick={() => handleLogoutSession(session.sessionToken)}
                            className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                          >
                            Logout
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Logout All Devices Button */}
              {sessions.length > 1 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleLogoutAllDevices}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-5 h-5" />
                    Logout from All Other Devices
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    You will remain logged in on this device
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}