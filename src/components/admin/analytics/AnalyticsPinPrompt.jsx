// src/components/admin/analytics/AnalyticsPinPrompt.jsx
// 4-digit PIN entry used to unlock analytics/revenue for the current session.
import { useEffect, useRef, useState } from 'react';
import { Lock, Loader2, X } from 'lucide-react';
import api from '../../../api';
import { setAnalyticsUnlock } from '../../../utils/analyticsPin';

// Four single-digit boxes with auto-advance, backspace and paste support.
export function PinInput({ value, onChange, onComplete, disabled, autoFocus, isDarkMode, label = 'PIN' }) {
  const refs = useRef([]);
  const digits = [0, 1, 2, 3].map(i => value[i] || '');

  // Focus the first box on mount and whenever the value is cleared (e.g. wrong PIN)
  useEffect(() => { if (autoFocus && !value && !disabled) refs.current[0]?.focus(); }, [autoFocus, value, disabled]);

  const update = (next) => {
    onChange(next);
    if (next.length === 4) onComplete?.(next);
  };

  const handleChange = (i, raw) => {
    const d = raw.replace(/\D/g, '');
    if (!d) return;
    if (d.length > 1) {                         // paste / autofill of several digits
      const next = (value.slice(0, i) + d).slice(0, 4);
      update(next);
      refs.current[Math.min(next.length, 3)]?.focus();
      return;
    }
    const next = (value.slice(0, i) + d).slice(0, 4);
    update(next);
    if (i < 3) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const cut = digits[i] ? i : Math.max(0, i - 1);
      onChange(value.slice(0, cut));
      refs.current[cut]?.focus();
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 3) refs.current[i + 1]?.focus();
  };

  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label={`${label} digit ${i + 1}`}
          maxLength={4}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          style={{
            width: 52, height: 60, textAlign: 'center', fontSize: 26, fontWeight: 800,
            borderRadius: 14, outline: 'none',
            border: `2px solid ${d ? '#f97316' : (isDarkMode ? '#374151' : '#e5e7eb')}`,
            background: isDarkMode ? '#111827' : '#fff',
            color: isDarkMode ? '#f9fafb' : '#111827',
            transition: 'border-color 0.15s',
          }}
        />
      ))}
    </div>
  );
}

/**
 * PIN unlock panel.
 *  inline  — render as a card in place of locked content (Analytics tab)
 *  !inline — render as a modal overlay (Overview revenue eye)
 */
export default function AnalyticsPinPrompt({ isDarkMode, onUnlocked, onCancel, inline = false, title = 'Analytics locked' }) {
  const [pin,     setPin]     = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (value = pin) => {
    if (value.length !== 4 || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/admin/analytics-pin/verify', { pin: value });
      const { unlockToken, expiresIn } = res.data.data;
      setAnalyticsUnlock(unlockToken, expiresIn);
      onUnlocked?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const card = (
    <div
      role={inline ? undefined : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-labelledby="analytics-pin-title"
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%', maxWidth: 380, borderRadius: 20, padding: '28px 24px', textAlign: 'center', position: 'relative',
        background: isDarkMode ? '#1f2937' : '#fff',
        border: `1px solid ${isDarkMode ? '#374151' : '#f3e8dc'}`,
        boxShadow: inline ? 'none' : '0 20px 50px rgba(0,0,0,0.25)',
      }}
    >
      {onCancel && (
        <button onClick={onCancel} aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', cursor: 'pointer', color: isDarkMode ? '#9ca3af' : '#6b7280', padding: 4 }}>
          <X size={18} />
        </button>
      )}
      <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDarkMode ? 'rgba(249,115,22,0.15)' : '#fff7ed' }}>
        <Lock size={24} color="#f97316" />
      </div>
      <h2 id="analytics-pin-title" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: isDarkMode ? '#f9fafb' : '#111827' }}>{title}</h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: isDarkMode ? '#9ca3af' : '#6b7280' }}>
        Enter your 4-digit analytics PIN to view revenue and analytics.
      </p>

      <form onSubmit={e => { e.preventDefault(); submit(); }}>
        <PinInput value={pin} onChange={v => { setPin(v); setError(''); }} onComplete={submit} disabled={loading} autoFocus isDarkMode={isDarkMode} label="Analytics PIN" />

        <div aria-live="polite" style={{ minHeight: 20, marginTop: 12, fontSize: 13, fontWeight: 600, color: '#ef4444' }}>{error}</div>

        <button type="submit" disabled={pin.length !== 4 || loading}
          style={{
            marginTop: 6, width: '100%', padding: '11px', borderRadius: 12, border: 'none',
            background: pin.length === 4 && !loading ? 'linear-gradient(135deg,#f97316,#ea580c)' : (isDarkMode ? '#374151' : '#f3f4f6'),
            color: pin.length === 4 && !loading ? '#fff' : (isDarkMode ? '#6b7280' : '#9ca3af'),
            fontWeight: 800, fontSize: 14, cursor: pin.length === 4 && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {loading && <Loader2 size={15} style={{ animation: 'apin-spin 0.8s linear infinite' }} />}
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
      <p style={{ margin: '14px 0 0', fontSize: 12, color: isDarkMode ? '#6b7280' : '#9ca3af' }}>
        Forgot it? Reset your PIN in Settings → Analytics PIN using your account password.
      </p>
      <style>{`@keyframes apin-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (inline) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>{card}</div>;
  }

  return (
    <div onClick={onCancel}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {card}
    </div>
  );
}
