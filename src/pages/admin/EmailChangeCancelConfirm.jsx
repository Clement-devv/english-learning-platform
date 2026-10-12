// src/pages/admin/EmailChangeCancelConfirm.jsx
// Public page — no auth required.
// Loaded when admin clicks "Cancel This Change" in the security-alert email.
// Shows a confirmation screen before POSTing to the cancel endpoint so the
// cancel cannot be triggered by email-client prefetch of the link.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from "react-i18next";

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/v1';

export default function EmailChangeCancelConfirm() {
  const { t: tr } = useTranslation("admin");
  const { token } = useParams();
  const navigate  = useNavigate();

  const [status,  setStatus]  = useState('idle');   // idle | loading | success | expired | error
  const [message, setMessage] = useState('');

  const handleCancel = async () => {
    setStatus('loading');
    try {
      const res = await axios.post(`${BASE_URL}/admin/email-change/cancel`, { token });
      if (res.data.success) {
        setStatus('success');
        setMessage(res.data.message || tr("emailChangeCancelConfirm.emailChangeCancelled"));
        setTimeout(() => navigate('/admin/login'), 3500);
      } else {
        setStatus('error');
        setMessage(res.data.message || tr("emailChangeCancelConfirm.somethingWentWrong"));
      }
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 410) {
        setStatus('expired');
        setMessage(data?.message || tr("emailChangeCancelConfirm.thisCancelLinkIsNo"));
      } else {
        setStatus('error');
        setMessage(data?.message || tr("emailChangeCancelConfirm.failedToCancelPleaseTry"));
      }
    }
  };

  const col = {
    bg:      '#fff8f0',
    card:    '#ffffff',
    border:  '#ffe8cc',
    text:    '#1a1d2e',
    muted:   '#6b7280',
    accent:  '#6366f1',
    success: '#059669',
    danger:  '#dc2626',
    warn:    '#d97706',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: col.bg, fontFamily: 'Inter, Arial, sans-serif', padding: '20px',
    }}>
      <div style={{
        background: col.card, border: `1px solid ${col.border}`, borderRadius: '18px',
        padding: '40px 36px', maxWidth: '440px', width: '100%',
        boxShadow: '0 8px 32px rgba(220,38,38,0.07)', textAlign: 'center',
      }}>

        {status === 'idle' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>🚫</div>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.danger }}>
              {tr("emailChangeCancelConfirm.cancelEmailChange")}
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 12px', lineHeight: 1.6 }}>
              {tr("emailChangeCancelConfirm.youAreAboutToCancel")}
            </p>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 28px', lineHeight: 1.6 }}>
              {tr("emailChangeCancelConfirm.ifTheChangeWasAlready")}
            </p>
            <button
              onClick={handleCancel}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: col.danger, color: '#fff', fontSize: '15px', fontWeight: 800,
                cursor: 'pointer', marginBottom: '12px',
              }}
            >
              {tr("emailChangeCancelConfirm.yesCancelTheChange")}
            </button>
            <button
              onClick={() => navigate('/admin/login')}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px',
                border: `1px solid ${col.border}`, background: 'transparent',
                color: col.muted, fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {tr("emailChangeCancelConfirm.neverMindGoToLogin")}
            </button>
          </>
        )}

        {status === 'loading' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>⏳</div>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.text }}>
              {tr("emailChangeCancelConfirm.processing")}
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: 0 }}>{tr("emailChangeCancelConfirm.pleaseWait")}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.success }}>
              {tr("emailChangeCancelConfirm.cancelled")}
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 20px' }}>{message}</p>
            <p style={{ color: col.muted, fontSize: '13px', margin: 0 }}>{tr("emailChangeCancelConfirm.redirectingToLogin")}</p>
          </>
        )}

        {status === 'expired' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>⏱</div>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.warn }}>
              {tr("emailChangeCancelConfirm.linkExpired")}
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 24px' }}>{message}</p>
            <p style={{ color: col.muted, fontSize: '13px', margin: '0 0 20px' }}>
              {tr("emailChangeCancelConfirm.ifYouBelieveYourAccount")}
            </p>
            <button
              onClick={() => navigate('/admin/login')}
              style={{
                padding: '12px 24px', borderRadius: '10px', border: 'none',
                background: col.accent, color: '#fff', fontSize: '14px',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              {tr("emailChangeCancelConfirm.goToLogin")}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 900, color: col.danger }}>
              {tr("emailChangeCancelConfirm.somethingWentWrong2")}
            </h1>
            <p style={{ color: col.muted, fontSize: '14px', margin: '0 0 24px' }}>{message}</p>
            <button
              onClick={() => setStatus('idle')}
              style={{
                padding: '12px 24px', borderRadius: '10px', border: 'none',
                background: col.danger, color: '#fff', fontSize: '14px',
                fontWeight: 700, cursor: 'pointer',
              }}
            >
              {tr("emailChangeCancelConfirm.tryAgain")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
