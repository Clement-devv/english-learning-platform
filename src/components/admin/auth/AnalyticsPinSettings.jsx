// src/components/admin/auth/AnalyticsPinSettings.jsx
// Settings → Analytics PIN: set, change (or reset a forgotten PIN) and remove the
// 4-digit PIN that guards revenue and analytics. Every change needs the account
// password AND a 6-digit code emailed to the admin — knowing the password alone
// is not enough to change the PIN.
import { useEffect, useState } from 'react';
import { KeyRound, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
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
  // Step 2: the code we emailed
  const [step,            setStep]            = useState('form'); // 'form' | 'code'
  const [sentTo,          setSentTo]          = useState('');
  const [code,            setCode]            = useState('');
  const [resendIn,        setResendIn]        = useState(0);

  useEffect(() => {
    api.get('/admin/analytics-pin/status')
      .then(res => setPinSet(!!res.data.data.pinSet))
      .catch(() => { setPinSet(false); setError('Could not load PIN status'); });
  }, []);

  // "Resend code" countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const switchMode = (m) => {
    setMode(m); setError(''); setPin(''); setConfirmPin(''); setStep('form');
  };

  // Step 1 — check the password and email a confirmation code
  const requestCode = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post('/admin/analytics-pin/request-change', {
        action: mode,
        pin: mode === 'set' ? pin : undefined,
        currentPassword,
      });
      setSentTo(data.data?.sentTo || 'your email');
      setCode('');
      setStep('code');
      setResendIn(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send the confirmation code');
    } finally {
      setSaving(false);
    }
  };

  // Step 2 — the emailed code applies the change
  const confirmCode = async () => {
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from the email');
    setSaving(true);
    try {
      await api.post('/admin/analytics-pin/confirm-change', { code });
      clearAnalyticsUnlock();   // server revoked existing unlocks — re-enter the PIN
      onSuccess?.(mode === 'set'
        ? (pinSet ? 'Analytics PIN changed' : 'Analytics PIN set — revenue and analytics are now protected')
        : 'Analytics PIN removed');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not confirm the change');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (step === 'code') return confirmCode();

    if (mode === 'set') {
      if (!/^\d{4}$/.test(pin)) return setError('PIN must be exactly 4 digits');
      if (pin !== confirmPin)   return setError('PINs do not match');
    }
    if (!currentPassword) return setError('Enter your account password to confirm');
    requestCode();
  };

  const submitLabel = step === 'code'
    ? (mode === 'remove' ? 'Confirm & remove PIN' : 'Confirm & save PIN')
    : 'Send confirmation code';

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

            {pinSet && step === 'form' && (
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
              {step === 'code' ? (
                <div>
                  <div className="flex items-start gap-3 p-3 mb-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <Mail className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-900">
                      We sent a 6-digit code to <strong>{sentTo}</strong>. Enter it to {mode === 'remove' ? 'remove' : 'save'} your PIN. It expires in 15 minutes.
                    </p>
                  </div>
                  <label htmlFor="apin-code" className="block text-sm font-medium text-gray-700 mb-2">Confirmation code</label>
                  <input
                    id="apin-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    value={code}
                    onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-[0.5em] font-mono focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="••••••"
                  />
                  <div className="flex justify-between mt-2 text-xs">
                    <button type="button" onClick={() => { setStep('form'); setError(''); }}
                      className="text-gray-500 hover:text-gray-700 underline">
                      Back
                    </button>
                    <button type="button" disabled={resendIn > 0 || saving} onClick={requestCode}
                      className="text-orange-600 hover:text-orange-700 underline disabled:no-underline disabled:text-gray-400">
                      {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
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
                    <p className="text-xs text-gray-500 mt-2">
                      {pinSet && mode === 'set' ? 'Forgot your PIN? Set a new one here. ' : ''}
                      For your security, we’ll email you a code to confirm this change.
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={saving}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className={`flex-1 px-4 py-3 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'remove' ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
                  {saving ? (step === 'code' ? 'Confirming…' : 'Sending…') : submitLabel}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
