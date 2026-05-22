import { useState } from 'react';
import { Mail, Eye, EyeOff } from 'lucide-react';
import api from '../../../api';

export default function ChangeEmail({ onClose, onSuccess }) {
  const [currentPassword,     setCurrentPassword]     = useState('');
  const [newEmail,            setNewEmail]            = useState('');
  const [showPassword,        setShowPassword]        = useState(false);
  const [error,               setError]               = useState('');
  const [loading,             setLoading]             = useState(false);
  const [sent,                setSent]                = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!currentPassword || !newEmail) {
      setError('All fields are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      await api.post('/admin/email-change/request', { currentPassword, newEmail });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send verification email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Mail className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Change Email</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        {sent ? (
          <div>
            <div className="mb-5 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
              <p className="text-sm font-semibold text-green-800 mb-1">Verification email sent!</p>
              <p className="text-sm text-green-700">
                Check <strong>{newEmail}</strong> and click the link within <strong>1 hour</strong> to confirm the change.
              </p>
            </div>
            <p className="text-xs text-gray-500 text-center mb-5">
              A security alert was also sent to your current email. If you didn't request this, use the cancel link in that email.
            </p>
            <button
              onClick={() => { onSuccess?.('Verification email sent — check your inbox.'); onClose(); }}
              className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-5">
              We'll send a verification link to the new address. Your current email stays active until you confirm the change.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Enter your current password"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showPassword ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="new@email.com"
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={loading}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Sending…' : 'Send Verification'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
