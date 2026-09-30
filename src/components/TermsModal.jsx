// src/components/TermsModal.jsx
// Shown once after login when the user hasn't accepted the Terms & Conditions yet.
// Blocks navigation — the user must accept or log out; they cannot dismiss it.
// Supports English / Vietnamese language toggle.
// Center name shown for teachers & students; "English Learning Platform" for admin.

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useBranding } from '../context/BrandingContext.jsx';
import api from '../api.js';

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    title:      'Terms & Conditions',
    subtitle:   'Please read and accept before continuing',
    scrollHint: '↓ Scroll to the bottom to enable the Accept button',
    decline:    'Decline & Log Out',
    accept:     '✓ I Accept',
    scrollTip:  'Please scroll to the bottom first',
    clauses: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By accessing and using this platform ("Platform"), you accept and agree to be bound by these Terms & Conditions. If you do not agree, you must not use the Platform.',
      },
      {
        heading: '2. Use of the Platform',
        body: 'The Platform is provided for educational purposes only. You agree to use it lawfully and only for its intended educational purposes. You must not misuse, disrupt, or attempt to gain unauthorised access to any part of the Platform.',
      },
      {
        heading: '3. Account Responsibility',
        body: 'You are responsible for maintaining the confidentiality of your login credentials. You must notify the administrator immediately if you suspect unauthorised use of your account. You are responsible for all activity that occurs under your account.',
      },
      {
        heading: '4. Privacy & Data',
        body: 'Your personal data (name, email, progress records) is stored securely and used solely to deliver the educational service. It is never sold to third parties. For full details, refer to the Privacy Policy provided by your center administrator.',
      },
      {
        heading: '5. Intellectual Property',
        body: 'All course materials, exercises, quizzes, and recordings available on the Platform are the intellectual property of the respective center or content creators. You may not reproduce, distribute, or share them without prior written consent.',
      },
      {
        heading: '6. Conduct',
        body: 'You agree to treat teachers, students, and administrators with respect at all times. Harassment, offensive language, or any form of misconduct may result in immediate suspension of your account without refund.',
      },
      {
        heading: '7. Recordings & Sessions',
        body: 'Live classes may be recorded for quality assurance and review purposes. By participating you consent to being recorded. Recordings remain the property of the center and will not be shared publicly without consent.',
      },
      {
        heading: '8. Payments & Refunds',
        body: "All payments for class credits are processed in accordance with the center's pricing policy. Refund requests are subject to the center's refund policy as communicated by the administrator.",
      },
      {
        heading: '9. Changes to Terms',
        body: 'These terms may be updated from time to time. When updated, you will be asked to review and accept the new terms before continuing to use the Platform.',
      },
      {
        heading: '10. Governing Law',
        body: "These terms are governed by the laws applicable in the jurisdiction of the center's operation. Any disputes shall be resolved through the center's internal dispute resolution process before escalation.",
      },
    ],
    eof: '— End of Terms & Conditions —',
  },

  vi: {
    title:      'Điều Khoản & Điều Kiện',
    subtitle:   'Vui lòng đọc và chấp nhận trước khi tiếp tục',
    scrollHint: '↓ Cuộn xuống cuối trang để kích hoạt nút Chấp nhận',
    decline:    'Từ chối & Đăng xuất',
    accept:     '✓ Tôi Đồng Ý',
    scrollTip:  'Vui lòng cuộn xuống cuối trước',
    clauses: [
      {
        heading: '1. Chấp nhận Điều khoản',
        body: 'Bằng việc truy cập và sử dụng nền tảng này ("Nền tảng"), bạn chấp nhận và đồng ý tuân theo các Điều khoản & Điều kiện này. Nếu bạn không đồng ý, bạn không được sử dụng Nền tảng.',
      },
      {
        heading: '2. Sử dụng Nền tảng',
        body: 'Nền tảng được cung cấp chỉ cho mục đích giáo dục. Bạn đồng ý sử dụng hợp pháp và chỉ cho các mục đích giáo dục của nó. Bạn không được lạm dụng, làm gián đoạn hoặc cố gắng truy cập trái phép vào bất kỳ phần nào của Nền tảng.',
      },
      {
        heading: '3. Trách nhiệm Tài khoản',
        body: 'Bạn có trách nhiệm bảo mật thông tin đăng nhập của mình. Bạn phải thông báo ngay cho quản trị viên nếu bạn nghi ngờ tài khoản bị sử dụng trái phép. Bạn chịu trách nhiệm về tất cả hoạt động xảy ra trên tài khoản của mình.',
      },
      {
        heading: '4. Quyền riêng tư & Dữ liệu',
        body: 'Dữ liệu cá nhân của bạn (tên, email, hồ sơ học tập) được lưu trữ an toàn và chỉ dùng để cung cấp dịch vụ giáo dục. Chúng tôi không bán dữ liệu cho bên thứ ba. Để biết chi tiết đầy đủ, hãy tham khảo Chính sách Bảo mật do quản trị viên trung tâm cung cấp.',
      },
      {
        heading: '5. Sở hữu Trí tuệ',
        body: 'Tất cả tài liệu khóa học, bài tập, bài kiểm tra và bản ghi âm trên Nền tảng là tài sản trí tuệ của trung tâm hoặc người tạo nội dung. Bạn không được sao chép, phân phối hoặc chia sẻ mà không có sự đồng ý bằng văn bản.',
      },
      {
        heading: '6. Quy tắc Ứng xử',
        body: 'Bạn đồng ý tôn trọng giáo viên, học sinh và quản trị viên mọi lúc. Quấy rối, ngôn ngữ xúc phạm hoặc bất kỳ hành vi sai trái nào có thể dẫn đến đình chỉ tài khoản ngay lập tức mà không hoàn tiền.',
      },
      {
        heading: '7. Ghi âm & Buổi học',
        body: 'Các buổi học trực tiếp có thể được ghi lại để đảm bảo chất lượng và xem xét. Khi tham gia, bạn đồng ý được ghi âm. Bản ghi âm vẫn là tài sản của trung tâm và sẽ không được chia sẻ công khai mà không có sự đồng ý.',
      },
      {
        heading: '8. Thanh toán & Hoàn tiền',
        body: 'Tất cả các khoản thanh toán cho tín chỉ lớp học được xử lý theo chính sách giá của trung tâm. Yêu cầu hoàn tiền tuân theo chính sách hoàn tiền của trung tâm theo thông báo của quản trị viên.',
      },
      {
        heading: '9. Thay đổi Điều khoản',
        body: 'Các điều khoản này có thể được cập nhật theo thời gian. Khi cập nhật, bạn sẽ được yêu cầu xem xét và chấp nhận các điều khoản mới trước khi tiếp tục sử dụng Nền tảng.',
      },
      {
        heading: '10. Luật Áp dụng',
        body: 'Các điều khoản này được điều chỉnh bởi pháp luật áp dụng tại địa bàn hoạt động của trung tâm. Mọi tranh chấp sẽ được giải quyết thông qua quy trình nội bộ của trung tâm trước khi leo thang.',
      },
    ],
    eof: '— Kết thúc Điều khoản & Điều kiện —',
  },
};

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function TermsModal() {
  const { pendingTerms, resolveTerms, logout } = useAuth();
  const { center } = useBranding();

  const [lang,     setLang]     = useState('en');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [scrolled, setScrolled] = useState(false);
  const bodyRef  = useRef(null);
  const navigate = useNavigate();

  if (!pendingTerms) return null;

  const { authToken, role } = pendingTerms;
  const tx = T[lang];

  // Center name: show actual center name for teachers & students; platform name for admin
  const platformName =
    role === 'admin'
      ? 'English Learning Platform'
      : (center?.centerName || 'English Learning Platform');

  const handleScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 60) {
      setScrolled(true);
    }
  };

  // Reset scroll gate when language changes (content length changes)
  const handleLangChange = (code) => {
    setLang(code);
    setScrolled(false);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };

  const handleAccept = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post(
        '/auth/accept-terms',
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      const navigateTo = resolveTerms();
      navigate(navigateTo);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <style>{css}</style>

      {/* Backdrop */}
      <div className="tm-backdrop" />

      {/* Modal */}
      <div className="tm-wrap" role="dialog" aria-modal="true" aria-labelledby="tm-title">

        {/* Header */}
        <div className="tm-header">
          <div className="tm-icon">📋</div>
          <div className="tm-header-text">
            <h2 id="tm-title" className="tm-title">{tx.title}</h2>
            <p className="tm-subtitle">
              <span className="tm-center-name">{platformName}</span>
              {' · '}{tx.subtitle}
            </p>
          </div>

          {/* Language switcher */}
          <div className="tm-lang-switcher">
            {LANGUAGES.map(({ code, label, flag }) => (
              <button
                key={code}
                className={`tm-lang-btn ${lang === code ? 'tm-lang-active' : ''}`}
                onClick={() => handleLangChange(code)}
                title={label}
              >
                <span>{flag}</span>
                <span className="tm-lang-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        {!scrolled && (
          <div className="tm-hint">{tx.scrollHint}</div>
        )}

        {/* Scrollable body */}
        <div className="tm-body" ref={bodyRef} onScroll={handleScroll}>
          {tx.clauses.map(({ heading, body }) => (
            <div key={heading}>
              <h3>{heading}</h3>
              <p>{body}</p>
            </div>
          ))}
          <div className="tm-eof">{tx.eof}</div>
        </div>

        {/* Error */}
        {error && <div className="tm-error">{error}</div>}

        {/* Footer */}
        <div className="tm-footer">
          <button
            className="tm-btn tm-btn-decline"
            onClick={handleDecline}
            disabled={loading}
          >
            {tx.decline}
          </button>
          <button
            className="tm-btn tm-btn-accept"
            onClick={handleAccept}
            disabled={!scrolled || loading}
            title={!scrolled ? tx.scrollTip : ''}
          >
            {loading ? <span className="tm-spinner" /> : tx.accept}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
.tm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.60);
  backdrop-filter: blur(4px);
  z-index: 10000;
}

.tm-wrap {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10001;
  display: flex;
  flex-direction: column;
  width: min(700px, 94vw);
  max-height: 88vh;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.30);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
}

/* ── Header ── */
.tm-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 24px;
  background: linear-gradient(135deg, #0369a1, #0ea5e9);
  color: #fff;
  flex-shrink: 0;
}

.tm-icon {
  font-size: 30px;
  line-height: 1;
  flex-shrink: 0;
}

.tm-header-text {
  flex: 1;
  min-width: 0;
}

.tm-title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.tm-subtitle {
  margin: 3px 0 0;
  font-size: 12.5px;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tm-center-name {
  font-weight: 700;
  opacity: 1;
}

/* ── Language switcher ── */
.tm-lang-switcher {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.tm-lang-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 20px;
  border: 1.5px solid rgba(255,255,255,0.30);
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tm-lang-btn:hover {
  background: rgba(255,255,255,0.22);
}

.tm-lang-active {
  background: rgba(255,255,255,0.28) !important;
  border-color: rgba(255,255,255,0.80) !important;
  font-weight: 700;
}

.tm-lang-label {
  display: inline;
}

/* ── Scroll hint ── */
.tm-hint {
  background: #f0f9ff;
  color: #0369a1;
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 24px;
  flex-shrink: 0;
  border-bottom: 1px solid #bae6fd;
}

/* ── Body ── */
.tm-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 24px;
  font-size: 14px;
  line-height: 1.75;
  color: #374151;
}

.tm-body h3 {
  font-size: 13.5px;
  font-weight: 700;
  color: #0369a1;
  margin: 20px 0 5px;
}

.tm-body h3:first-child {
  margin-top: 0;
}

.tm-body p {
  margin: 0 0 4px;
  color: #4b5563;
}

.tm-eof {
  margin-top: 28px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  padding-bottom: 4px;
}

/* ── Error ── */
.tm-error {
  margin: 0 24px 4px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 13px;
  flex-shrink: 0;
}

/* ── Footer ── */
.tm-footer {
  display: flex;
  gap: 10px;
  padding: 14px 24px 18px;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
  flex-shrink: 0;
  justify-content: flex-end;
}

.tm-btn {
  padding: 10px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tm-btn:active { transform: scale(0.97); }

.tm-btn-decline {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #cbd5e1;
}

.tm-btn-decline:hover:not(:disabled) {
  background: #fee2e2;
  color: #b91c1c;
  border-color: #fca5a5;
}

.tm-btn-accept {
  background: linear-gradient(135deg, #0369a1, #0ea5e9);
  color: #fff;
  min-width: 120px;
  justify-content: center;
}

.tm-btn-accept:hover:not(:disabled) {
  opacity: 0.88;
}

.tm-btn-accept:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
}

.tm-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: tm-spin 0.65s linear infinite;
}

@keyframes tm-spin { to { transform: rotate(360deg); } }

.tm-body::-webkit-scrollbar { width: 5px; }
.tm-body::-webkit-scrollbar-track { background: #f1f5f9; }
.tm-body::-webkit-scrollbar-thumb { background: #bae6fd; border-radius: 3px; }

/* Compact on small screens */
@media (max-width: 480px) {
  .tm-lang-label { display: none; }
  .tm-lang-btn { padding: 5px 8px; }
  .tm-header { padding: 16px 16px; }
  .tm-body { padding: 18px 16px; }
  .tm-footer { padding: 12px 16px 16px; }
}
`;
