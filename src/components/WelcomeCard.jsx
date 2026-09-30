// src/components/WelcomeCard.jsx
// Shown once per user on their first visit to the dashboard after login.
// Dismissed state lives in localStorage — no backend change needed.

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useBranding } from '../context/BrandingContext.jsx';
import {
  // Teacher
  CalendarDays, CheckCircle2, DollarSign,
  // Student
  CalendarPlus, LayoutList, Trophy,
  // Admin
  BarChart3, GraduationCap, Users,
  // Sub-admin
  UserCog, BookOpen, MessageCircle,
  // Parent
  Baby, Clock, MessageSquare,
  // Header role icons
  BookMarked, School, Building2, Briefcase, HeartHandshake,
  // UI
  X,
} from 'lucide-react';

// ── Per-role content ──────────────────────────────────────────────────────────
const ROLE_CONTENT = {
  teacher: {
    HeaderIcon: BookMarked,
    tagline: 'Your teaching dashboard is ready.',
    items: [
      {
        Icon: CalendarDays, iconColor: '#0284c7', iconBg: '#e0f2fe',
        title: 'My Classes',
        desc: 'View your upcoming lessons, student details, and class links all in one place.',
      },
      {
        Icon: CheckCircle2, iconColor: '#059669', iconBg: '#d1fae5',
        title: 'Completed Classes',
        desc: 'Review finished lessons, mark attendance, and track your teaching history.',
      },
      {
        Icon: DollarSign, iconColor: '#d97706', iconBg: '#fef3c7',
        title: 'Payment',
        desc: 'See your earnings, completed lesson count, and payment records.',
      },
    ],
  },

  student: {
    HeaderIcon: GraduationCap,
    tagline: 'Your learning journey starts here.',
    items: [
      {
        Icon: CalendarPlus, iconColor: '#7c3aed', iconBg: '#ede9fe',
        title: 'Book a Class',
        desc: 'Pick a teacher and schedule your first lesson from the Booking Calendar tab.',
      },
      {
        Icon: LayoutList, iconColor: '#0284c7', iconBg: '#e0f2fe',
        title: 'My Schedule',
        desc: 'See all your upcoming and past classes at a glance.',
      },
      {
        Icon: Trophy, iconColor: '#d97706', iconBg: '#fef3c7',
        title: 'Leaderboard',
        desc: 'Track your streak, earn certificates, and see how you rank among learners.',
      },
    ],
  },

  admin: {
    HeaderIcon: Building2,
    tagline: 'Your center dashboard is ready.',
    items: [
      {
        Icon: BarChart3, iconColor: '#0284c7', iconBg: '#e0f2fe',
        title: 'Overview',
        desc: "See your center's key stats — active students, teachers, and revenue at a glance.",
      },
      {
        Icon: BookMarked, iconColor: '#7c3aed', iconBg: '#ede9fe',
        title: 'Teachers',
        desc: 'Invite teachers, set their rates, and manage their status.',
      },
      {
        Icon: Users, iconColor: '#059669', iconBg: '#d1fae5',
        title: 'Students',
        desc: 'Enroll students, manage credits, and monitor their progress.',
      },
    ],
  },

  'sub-admin': {
    HeaderIcon: Briefcase,
    tagline: 'Your management panel is ready.',
    items: [
      {
        Icon: UserCog, iconColor: '#0284c7', iconBg: '#e0f2fe',
        title: 'Teachers',
        desc: 'View and monitor the teachers assigned to your scope.',
      },
      {
        Icon: BookOpen, iconColor: '#7c3aed', iconBg: '#ede9fe',
        title: 'Bookings',
        desc: 'Track class scheduling and session attendance.',
      },
      {
        Icon: MessageCircle, iconColor: '#059669', iconBg: '#d1fae5',
        title: 'Messages',
        desc: 'Stay in contact with teachers and students directly.',
      },
    ],
  },

  parent: {
    HeaderIcon: HeartHandshake,
    tagline: "Your child's learning dashboard is ready.",
    items: [
      {
        Icon: Baby, iconColor: '#db2777', iconBg: '#fce7f3',
        title: "My Child's Progress",
        desc: 'See lesson history, credits, and learning milestones for your child.',
      },
      {
        Icon: Clock, iconColor: '#0284c7', iconBg: '#e0f2fe',
        title: 'Upcoming Classes',
        desc: "Check what's scheduled so you can prepare your child.",
      },
      {
        Icon: MessageSquare, iconColor: '#059669', iconBg: '#d1fae5',
        title: 'Messages',
        desc: 'Send messages directly to teachers whenever you need an update.',
      },
    ],
  },
};

// Routes where the card may appear
const DASHBOARD_ROUTES = [
  '/admin',
  '/teacher/dashboard',
  '/student/dashboard',
  '/sub-admin/dashboard',
  '/parent/dashboard',
];

const storageKey = (role, userId) => `elp_welcome_${role}_${userId}`;

// ── Component ─────────────────────────────────────────────────────────────────
export default function WelcomeCard() {
  const { user, role, pendingTerms } = useAuth();
  const { center } = useBranding();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const userId = user?.id;
  useEffect(() => {
    if (!role || !userId || pendingTerms) return;
    if (!DASHBOARD_ROUTES.includes(location.pathname)) return;
    if (!ROLE_CONTENT[role]) return;
    if (localStorage.getItem(storageKey(role, userId))) return;
    setVisible(true);
  }, [role, userId, pendingTerms, location.pathname]);

  const dismiss = () => {
    localStorage.setItem(storageKey(role, userId), '1');
    setVisible(false);
  };

  if (!visible) return null;

  const content      = ROLE_CONTENT[role];
  const { HeaderIcon } = content;
  const name         = user?.firstName || 'there';
  const platformName = role === 'admin'
    ? 'English Learning Platform'
    : (center?.centerName || 'English Learning Platform');

  return (
    <>
      <style>{css}</style>

      <div className="wc-backdrop" onClick={dismiss} />

      <div className="wc-wrap" role="dialog" aria-modal="true" aria-label="Welcome">

        {/* Header */}
        <div className="wc-header">
          <div className="wc-header-icon">
            <HeaderIcon size={22} color="#fff" strokeWidth={2} />
          </div>
          <div className="wc-header-text">
            <h2 className="wc-title">Welcome, {name}! 👋</h2>
            <p className="wc-subtitle">{platformName} · {content.tagline}</p>
          </div>
          <button className="wc-close" onClick={dismiss} aria-label="Close">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="wc-body">
          <p className="wc-lead">Here's a quick look at what you can do:</p>
          <div className="wc-items">
            {content.items.map(({ Icon, iconColor, iconBg, title, desc }) => (
              <div key={title} className="wc-item">
                <div className="wc-item-icon" style={{ background: iconBg }}>
                  <Icon size={20} color={iconColor} strokeWidth={2} />
                </div>
                <div className="wc-item-text">
                  <span className="wc-item-title">{title}</span>
                  <span className="wc-item-desc">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="wc-footer">
          <button className="wc-skip" onClick={dismiss}>Skip for now</button>
          <button className="wc-btn" onClick={dismiss}>Got it, let's go →</button>
        </div>

      </div>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
.wc-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(3px);
  z-index: 9990;
}

.wc-wrap {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 9991;
  width: min(500px, 92vw);
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
  animation: wc-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes wc-pop {
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.93); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

/* ── Header ── */
.wc-header {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 20px 20px 18px;
  background: linear-gradient(135deg, #0369a1, #0ea5e9);
  color: #fff;
  position: relative;
}

.wc-header-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.20);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1.5px solid rgba(255, 255, 255, 0.28);
}

.wc-header-text { flex: 1; min-width: 0; }

.wc-title {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.3px;
}

.wc-subtitle {
  margin: 3px 0 0;
  font-size: 11.5px;
  opacity: 0.82;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wc-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}
.wc-close:hover { background: rgba(255, 255, 255, 0.30); }

/* ── Body ── */
.wc-body { padding: 18px 20px 6px; }

.wc-lead {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: #6b7280;
  font-weight: 500;
}

.wc-items { display: flex; flex-direction: column; gap: 8px; }

.wc-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: border-color 0.15s, background 0.15s;
}
.wc-item:hover { background: #f0f9ff; border-color: #bae6fd; }

.wc-item-icon {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wc-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wc-item-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
}

.wc-item-desc {
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

/* ── Footer ── */
.wc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 18px;
  margin-top: 10px;
}

.wc-skip {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  font-family: inherit;
  transition: color 0.15s;
}
.wc-skip:hover { color: #64748b; }

.wc-btn {
  background: linear-gradient(135deg, #0369a1, #0ea5e9);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s, transform 0.1s;
  box-shadow: 0 4px 14px rgba(3, 105, 161, 0.28);
}
.wc-btn:hover  { opacity: 0.88; }
.wc-btn:active { transform: scale(0.97); }

@media (max-width: 400px) {
  .wc-header { padding: 16px 14px; }
  .wc-body   { padding: 14px 14px 4px; }
  .wc-footer { padding: 12px 14px 16px; }
}
`;
