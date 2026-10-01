// src/components/admin/auth/AnalyticsPinSettings.jsx
// Settings → Analytics PIN: set, change or remove the 4-digit PIN that guards
// revenue and analytics. Every change re-authenticates with the account password.
import { useEffect, useState } from 'react';
import { KeyRound, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../../../api';
import { clearAnalyticsUnlock } from '../../../utils/analyticsPin';
import { PinInput } from '../analytics/AnalyticsPinPrompt';

export default function AnalyticsPinSettings({ onClose, onSuccess }) {
  const [pinSet,          setPinSet]          = useState(null);   // null = loading
  const [mode,            setMode]            = useState('set');  // 'set' | 'remove'
  const [pin,             setPin]             = useState('');
  const [confirmPin,      setConfirmPin]      = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [error,           setError]           = useState('');
  const [saving,          setSaving]          = useState(false);

  useEffect(() => {
    api.get('/admin/analytics-pin/status')
      .then(res => setPinSet(!!res.data.data.pinSet))
      .catch(() => { setPinSet(false); setError('Could not load PIN status'); });
  }, []);

  const switchMode = (m) => { setMode(m); setError(''); setPin(''); setConfirmPin(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'set') {
      if (!/^\d{4}$/.test(pin)) return setError('PIN must be exactly 4 digits');
      if (pin !== confirmPin)   return setError('PINs do not match');
    }
    if (!currentPassword) return setError('Enter your account password to confirm');

    setSaving(true);
    try {
      if (mode === 'set') {
        await api.put('/admin/analytics-pin', { pin, currentPassword });
      } else {
        await api.delete('/admin/analytics-pin', { data: { currentPassword } });
      }
      clearAnalyticsUnlock();   // server revoked existing unlocks — re-enter the PIN
      onSuccess?.(mode === 'set'
        ? (pinSet ? 'Analytics PIN changed' : 'Analytics PIN set — revenue and analytics are now protected')
        : 'Analytics PIN removed');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save PIN');
    } finally {
      setSaving(false);
    }
  };

  const submitLabel = mode === 'remove' ? 'Remove PIN' : (pinSet ? 'Change PIN' : 'Set PIN');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true" aria-labelledby="apin-settings-title" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <KeyRound className="w-6 h-6 text-orange-600" />
            </div>
            <h2 id="apin-settings-title" className="text-2xl font-bold text-gray-900">Analytics PIN</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        {pinSet === null ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-orange-500 animate-spin" /></div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {pinSet
                ? 'Your revenue and analytics are protected. You enter this PIN once per login to view them.'
                : 'Set a 4-digit PIN to hide revenue and analytics until it is entered. You’ll be asked for it once per login.'}
            </p>

            {pinSet && (
              <div className="flex bg-gray-100 rounded-xl p-1 mb-4" role="tablist">
                {[['set', 'Change PIN'], ['remove', 'Remove PIN']].map(([m, label]) => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${mode === m ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              {mode === 'set' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">{pinSet ? 'New PIN' : 'PIN'}</label>
                    <PinInput value={pin} onChange={v => { setPin(v); setError(''); }} autoFocus label={pinSet ? 'New PIN' : 'PIN'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Confirm PIN</label>
                    <PinInput value={confirmPin} onChange={v => { setConfirmPin(v); setError(''); }} label="Confirm PIN" />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="apin-password" className="block text-sm font-medium text-gray-700 mb-2">Account Password</label>
                <div className="relative">
                  <input
                    id="apin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Confirm with your password"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)} aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
                {pinSet && mode === 'set' && (
                  <p className="text-xs text-gray-500 mt-2">Forgot your PIN? Just set a new one here — only your password is needed.</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={saving}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className={`flex-1 px-4 py-3 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'remove' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
                  {saving ? 'Saving…' : submitLabel}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
