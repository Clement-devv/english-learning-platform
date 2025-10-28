// src/components/TwoFactorLogin.jsx
import React, { useState } from 'react';
import { Shield, Key, AlertCircle } from 'lucide-react';

export default function TwoFactorLogin({ 
  onVerify, 
  onCancel, 
  loading = false,
  error = '' 
}) {
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (useBackupCode) {
      onVerify(null, backupCode);
    } else {
      onVerify(code, null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Shield className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Two-Factor Authentication
        </h2>
        <p className="text-gray-600">
          {useBackupCode 
            ? 'Enter one of your backup codes' 
            : 'Enter the 6-digit code from your authenticator app'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!useBackupCode ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Authentication Code
            </label>
            <input
              type="text"
              maxLength="6"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              required
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Backup Code
            </label>
            <input
              type="text"
              value={backupCode}
              onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-xl tracking-wider font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              required
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={loading || (!useBackupCode && code.length !== 6) || (useBackupCode && !backupCode)}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode);
              setCode('');
              setBackupCode('');
            }}
            className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 py-2"
          >
            <Key className="w-4 h-4" />
            {useBackupCode ? 'Use authenticator code instead' : 'Use backup code instead'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
