// src/pages/admin/EmailChangeVerify.jsx
// Public page — no auth required.
// Loaded when admin clicks the "Verify New Email" link.
// Calls POST /api/v1/admin/email-change/verify so email-client prefetchers
// cannot trigger the change just by loading the link preview.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/v1';

export default function EmailChangeVerify() {
  const { token } = useParams();
  const navigate  = useNavigate();

  const [status,  setStatus]  = useState('idle');   // idle | loading | success | expired | error
  const [message, setMessage] = useState('');

  // Don't auto-submit — show a confirm button instead
  const handleConfirm = async () => {
    setStatus('loading');
    try {
      const res = await axios.post(`${BASE_URL}/admin/email-change/verify`, { token });
      if (res.data.success) {
        setStatus('success');
        setMessage(res.data.message || 'Email changed successfully.');
        setTimeout(() => navigate('/admin/login?emailChanged=1'), 3000);
      } else {
        setStatus('error');
        setMessage(res.data.message || 'Something went wrong.');
      }
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 410) {
        setStatus(data?.expired ? 'expired' : 'invalid');
        setMessage(data?.message || 'This link is no longer valid.');
      } else {
        setStatus('error');
        setMessage(data?.message || 'Failed to verify. Please try again.');
      }
    }
  };

  const col = {
    bg:      '#f8f9ff',
    card:    '#ffffff',
    border:  '#e2e8f0',
    text:    '#1a1d2e',
    muted:   '#6b7280',
    accent:  '#6366f1',
    success: '#059669',
    danger:  '#dc2626',
    warn:    '#d97706',
  };

  const icons = {
    idle:    '📧',
    loading: '⏳',
    success: '✅',
    expired: '⏱',
    invalid: '⛔',
    error:   '⚠️',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: col.bg, fontFamily: 'Inter, Arial, sans-serif', padding: '20px',
    }}>
      <div style={{
        background: col.card, border: `1px solid ${col.border}`, borderRadius: '18px',
        padding: '40px 36px', maxWidth: '440px', width: '100%',
        boxShadow: '0 8px 32px rgba(99,102,241,0.08)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>
          {icons[status] || '📧'}
        </div>

        {status === 'idle' && (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.text }}>
              Confirm Email Change
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 28px', lineHeight: 1.6 }}>
              You are about to change the admin login email for this center. All existing sessions will be signed out.
            </p>
            <button
              onClick={handleConfirm}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg,#6366f1,#4f46e5)',
                color: '#fff', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
              }}
            >
              Confirm Email Change
            </button>
            <p style={{ marginTop: '14px', fontSize: '12px', color: col.muted }}>
              If you didn't request this, close this page — nothing will change.
            </p>
          </>
        )}

        {status === 'loading' && (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.text }}>
              Verifying…
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: 0 }}>Please wait.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.success }}>
              Email Changed
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 20px' }}>{message}</p>
            <p style={{ color: col.muted, fontSize: '13px', margin: 0 }}>
              Redirecting to login…
            </p>
          </>
        )}

        {(status === 'expired') && (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.warn }}>
              Link Expired
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 24px' }}>{message}</p>
            <button
              onClick={() => navigate('/admin/login')}
              style={{
                padding: '12px 24px', borderRadius: '10px', border: 'none',
                background: col.accent, color: '#fff', fontSize: '14px',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Back to Login
            </button>
          </>
        )}

        {(status === 'invalid' || status === 'error') && (
          <>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.danger }}>
              {status === 'invalid' ? 'Invalid Link' : 'Something Went Wrong'}
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 24px' }}>{message}</p>
            <button
              onClick={() => navigate('/admin/login')}
              style={{
                padding: '12px 24px', borderRadius: '10px', border: 'none',
                background: col.accent, color: '#fff', fontSize: '14px',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
