// src/components/SessionManagement.jsx
import { useState, useEffect } from 'react';
import { Monitor, Smartphone, Tablet, Laptop, MapPin, Clock, AlertCircle, X, Bell, BellOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '../api'; // Use shared api instance — automatically adds x-center-slug + auth token
import {
  pushSupported, pushPermission, getPushStatus, enablePush, disablePush,
  getTipsEnabled, setTipsEnabled,
} from '../utils/pushNotifications';

// Small accessible on/off switch
function Switch({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

export default function SessionManagement({ isOpen, onClose }) {
  const [sessions, setSessions]             = useState([]);
  const [lastLogin, setLastLogin]           = useState(null);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  // This device: notifications + weekly reminder
  const [pushOn,   setPushOn]   = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [tipsOn,   setTipsOn]   = useState(true);
  const supported = pushSupported();
  const blocked   = supported && pushPermission() === 'denied';

  useEffect(() => {
    if (!isOpen) return;
    fetchSessions();
    setTipsOn(getTipsEnabled());
    if (supported) getPushStatus().then(setPushOn);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePush = async (next) => {
    setPushBusy(true);
    setError('');
    if (next) {
      const { ok, reason } = await enablePush();
      setPushOn(ok);
      if (!ok) setError(reason === 'denied'
        ? 'Notifications are blocked for this site. Allow them in your browser\x27s site settings (🔒 next to the address), then try again.'
        : 'Could not turn on notifications right now.');
    } else {
      await disablePush();
      setPushOn(false);
    }
    setPushBusy(false);
    fetchSessions(); // refresh the per-device "Notifications on/off" badges
  };

  const toggleTips = (next) => { setTipsEnabled(next); setTipsOn(next); };

  const fetchSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/auth/sessions');
      if (response.data.success) {
        setSessions(response.data.sessions);
        setLastLogin(response.data.lastLogin);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  // Sign out ONE other device. It is disconnected at once, the app erases its
  // saved data there and returns to the login page; its notifications stop.
  const handleLogoutSession = async (session) => {
    const name = [session.deviceInfo?.browser, session.deviceInfo?.os].filter(Boolean).join(' on ') || 'this device';
    if (!confirm(`Log out ${name}?\n\nIt will be signed out right away, this app's saved data on it will be erased, and it will stop getting notifications.`)) return;
    try {
      const response = await api.post(`/auth/sessions/${session.id}/revoke`);
      if (response.data.success) {
        setSuccessMessage('Device logged out and its app data erased');
        fetchSessions();
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to logout session');
    }
  };

  const handleLogoutAllDevices = async () => {
    if (!confirm("Log out every other device? They will be signed out right away and this app's saved data on them will be erased. You stay logged in here.")) return;
    try {
      const response = await api.post('/auth/logout-all-devices', {});
      if (response.data.success) {
        setSuccessMessage('Logged out from all other devices successfully');
        fetchSessions();
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to logout from all devices');
    }
  };

  const getDeviceIcon = (deviceType) => {
    const type = deviceType?.toLowerCase() || 'desktop';
    if (type.includes('mobile') || type.includes('phone')) return <Smartphone className="w-5 h-5" />;
    if (type.includes('tablet'))  return <Tablet className="w-5 h-5" />;
    if (type.includes('laptop'))  return <Laptop className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now  = new Date();
    const diffMs    = now - date;
    const diffMins  = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays  = Math.floor(diffMs / 86400000);
    if (diffMins  < 1)  return 'Just now';
    if (diffMins  < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays  < 7)  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your devices</h2>
            <p className="text-blue-100 text-sm mt-1">Everywhere you are signed in. Log out any device you don't recognise.</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">

          {/* Last Login */}
          {lastLogin && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Clock className="w-5 h-5" />
                <span className="font-medium">Last Login:</span>
                <span>{formatDate(lastLogin)}</span>
              </div>
            </div>
          )}

          {/* This device */}
          <div className="border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/20 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-300" /> This device
            </h3>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Notifications on this device</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {!supported ? 'This browser does not support notifications.'
                    : blocked ? 'Blocked in this browser — allow them in site settings (🔒 next to the address).'
                    : 'Class reminders, messages and calls, even when the app is closed. Only this device.'}
                </p>
              </div>
              <Switch label="Notifications on this device" checked={pushOn} disabled={!supported || pushBusy || (blocked && !pushOn)} onChange={togglePush} />
            </div>
            <div className="flex items-start justify-between gap-4 mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-800/60">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Weekly reminder when they're off</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A small tip, at most once a week, while notifications are off here.</p>
              </div>
              <Switch label="Weekly reminder" checked={tipsOn} disabled={!supported} onChange={toggleTips} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-green-800 dark:text-green-300">{successMessage}</p>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No active sessions found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session, index) => (
                    <div
                      key={session.id || index}
                      className={`border rounded-lg p-4 ${
                        session.isCurrent
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4 flex-1">
                          {/* Device Icon */}
                          <div className={`p-3 rounded-lg ${
                            session.isCurrent
                              ? 'bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {getDeviceIcon(session.deviceInfo?.device)}
                          </div>

                          {/* Session Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900 dark:text-white">
                                {session.deviceInfo?.browser || 'Unknown Browser'}
                              </h3>
                              {session.isCurrent && (
                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                                  This device
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {session.deviceLocked ? (
                                <span title="Renewing this login needs a key that never leaves this device — a copied session will not work elsewhere"
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Locked to this device
                                </span>
                              ) : (
                                <span title="Older sign-in (or insecure connection). Logging in again locks it to the device."
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  <ShieldAlert className="w-3.5 h-3.5" /> Older sign-in
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${session.notifications ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                                {session.notifications ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                                {session.notifications ? 'Notifications on' : 'Notifications off'}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                              <div className="flex items-center gap-2">
                                <Monitor className="w-4 h-4" />
                                <span>{session.deviceInfo?.os || 'Unknown OS'}</span>
                                <span className="text-gray-400 dark:text-gray-500">•</span>
                                <span>{session.deviceInfo?.device || 'Desktop'}</span>
                              </div>
                              {session.ipAddress && session.ipAddress !== 'Unknown' && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{session.ipAddress}</span>
                                  {session.location && session.location !== 'Unknown' && (
                                    <>
                                      <span className="text-gray-400 dark:text-gray-500">•</span>
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
                            onClick={() => handleLogoutSession(session)}
                            className="ml-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                          >
                            Log out
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Logout All */}
              {sessions.length > 1 && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleLogoutAllDevices}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-5 h-5" />
                    Log out all other devices
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
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
