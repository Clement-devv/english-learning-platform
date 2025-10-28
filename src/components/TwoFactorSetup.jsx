// src/components/TwoFactorSetup.jsx
import React, { useState } from 'react';
import { Shield, Copy, Check, X, AlertCircle, Download } from 'lucide-react';
import api from '../api';

export default function TwoFactorSetup({ isOpen, onClose, userType = 'student' }) {
  const [step, setStep] = useState(1); // 1: Initial, 2: QR Code, 3: Backup Codes
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [savedCodes, setSavedCodes] = useState(false);

  // Get the correct token based on user type
  const getToken = () => {
    if (userType === 'teacher') return localStorage.getItem('teacherToken');
    if (userType === 'admin') return localStorage.getItem('adminToken');
    return localStorage.getItem('studentToken');
  };

  // Step 1: Setup 2FA and get QR code
  const handleSetup = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = getToken();
      const response = await api.post('/api/2fa/setup', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setQrCode(response.data.qrCode);
        setSecret(response.data.secret);
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify 2FA code
  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = getToken();
      const response = await api.post('/api/2fa/verify', 
        { token: verificationCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setBackupCodes(response.data.backupCodes);
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  // Copy secret to clipboard
  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download backup codes
  const handleDownloadCodes = () => {
    const content = `Two-Factor Authentication Backup Codes\n\n${backupCodes.join('\n')}\n\nSave these codes securely. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '2FA-Backup-Codes.txt';
    a.click();
    setSavedCodes(true);
  };

  const handleClose = () => {
    if (step === 3 && !savedCodes) {
      if (!confirm('Have you saved your backup codes? You won\'t be able to see them again!')) {
        return;
      }
    }
    setStep(1);
    setQrCode('');
    setSecret('');
    setVerificationCode('');
    setBackupCodes([]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-white" />
              <h2 className="text-2xl font-bold text-white">
                Two-Factor Authentication
              </h2>
            </div>
            <button onClick={handleClose} className="text-white hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Initial Screen */}
          {step === 1 && (
            <div className="text-center space-y-4">
              <div className="mb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Secure Your Account</h3>
                <p className="text-gray-600">
                  Add an extra layer of security with two-factor authentication
                </p>
              </div>

              <button
                onClick={handleSetup}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Setting up...' : 'Setup 2FA'}
              </button>
            </div>
          )}

          {/* Step 2: Scan QR & Verify */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Scan QR Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Use an authenticator app like Google Authenticator or Authy
                </p>

                {qrCode && (
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                    <img src={qrCode} alt="2FA QR Code" className="w-64 h-64" />
                  </div>
                )}

                {/* Manual Entry */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 mb-2">Can't scan? Enter this code manually:</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-sm font-mono bg-white px-3 py-2 rounded border">
                      {secret}
                    </code>
                    <button
                      onClick={handleCopySecret}
                      className="p-2 hover:bg-gray-200 rounded transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Verification Code Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter 6-digit code from your app
                </label>
                <input
                  type="text"
                  maxLength="6"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={handleVerify}
                disabled={loading || verificationCode.length !== 6}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Enable 2FA'}
              </button>
            </div>
          )}

          {/* Step 3: Backup Codes */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2FA Enabled Successfully!</h3>
                <p className="text-sm text-gray-600">
                  Save these backup codes in a safe place
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Important!</p>
                    <p className="text-xs text-amber-800 mt-1">
                      Each backup code can only be used once. Keep them secure and accessible.
                    </p>
                  </div>
                </div>
              </div>

              {/* Backup Codes Display */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="bg-white px-3 py-2 rounded border border-gray-300 text-center font-mono text-sm">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleDownloadCodes}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
              >
                <Download className="w-5 h-5" />
                Download Backup Codes
              </button>

              <button
                onClick={handleClose}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300"
              >
                I've Saved My Codes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
