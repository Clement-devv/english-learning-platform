// src/components/LanguageSwitcher.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher({ col, fontFamily, compact = false }) {
  const { i18n } = useTranslation();
  const isVi = i18n.language === 'vi';

  const toggle = () => {
    const next = isVi ? 'en' : 'vi';
    i18n.changeLanguage(next);
    localStorage.setItem('elp_lang', next);
  };

  if (compact) {
    return (
      <button onClick={toggle} title={isVi ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
        style={{
          background: 'none', border: `1px solid ${col?.border || 'rgba(255,255,255,0.12)'}`,
          borderRadius: '8px', cursor: 'pointer', padding: '4px 8px',
          fontSize: '13px', fontWeight: 700, color: col?.body || '#64748b',
          fontFamily: fontFamily || 'inherit', display: 'flex', alignItems: 'center', gap: '4px',
          transition: 'all 0.15s',
        }}>
        {isVi ? '🇻🇳 VI' : '🇬🇧 EN'}
      </button>
    );
  }

  return (
    <button onClick={toggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', borderRadius: '12px', border: 'none', cursor: 'pointer',
        background: 'transparent', fontFamily: fontFamily || 'inherit',
        transition: 'all 0.15s',
      }}
      className="lang-switcher-btn"
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>{isVi ? '🇻🇳' : '🇬🇧'}</span>
      <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: col?.body || '#64748b', textAlign: 'left' }}>
        {isVi ? 'Tiếng Việt' : 'English'}
      </span>
      <span style={{ fontSize: '10px', color: col?.muted || '#9ca3af', fontWeight: 700 }}>
        {isVi ? 'EN' : 'VI'}
      </span>
    </button>
  );
}
