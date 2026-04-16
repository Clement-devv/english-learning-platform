// src/pages/student/dashboard-shells/brutalist/BrutalistShell.jsx
// INDUSTRIAL BRUTALISM — Tactical Telemetry mode.
// Visual language: CRT terminal, monospace everything, 90° corners, phosphor text.
// Palette: #0A0A0A / #EAEAEA / #E61919 accent / #4AF626 ONLY for live class status.
// Font: Space Mono (monospaced, uppercase-first).

import { useState } from "react";
import Confetti from "react-confetti";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from "recharts";
import { useBranding } from "../../../../context/BrandingContext";
import ChangePassword from "../../../../components/student/auth/ChangePassword";
import SessionManagement from "../../../../components/SessionManagement";
import SettingsModal from "../../../../components/SettingsModal";
import Classroom from "../../../Classroom";
import MessagesTab from "../../../../components/chat/MessagesTab";
import ClassConfirmation from "../../../../components/student/ClassConfirmation";
import StudentCompletedTab from "../../tabs/StudentCompletedTab";
import StudentScheduleTab  from "../../tabs/StudentScheduleTab";
import StudentHomeworkTab  from "../../tabs/HomeworkTab";
import StudentQuizTab      from "../../tabs/QuizTab";
import PronunciationTab   from "../../tabs/PronunciationTab";
import ConversationTab    from "../../tabs/ConversationTab";
import FlashcardsTab      from "../../tabs/FlashcardsTab";
import RecordingsTab      from "../../tabs/RecordingsTab";
import ReviewsTab        from "../../tabs/ReviewsTab";
import ReferralTab      from "../../tabs/ReferralTab";
import StreakWidget      from "../../components/StreakWidget";
import { useDashboardData, BADGE_DEFINITIONS } from "../useDashboardData";

// ── Palette ───────────────────────────────────────────────────────────────────
const B = {
  bg:     '#0A0A0A',
  panel:  '#0E0E0E',
  card:   '#111111',
  grill:  '#1C1C1C', // gap color for grid trick
  border: '#222222',
  text:   '#EAEAEA',
  dim:    '#777777',
  faint:  '#333333',
  red:    '#E61919',
  green:  '#4AF626', // ONLY for live class status — do not reuse
};

// ── Navigation sections ───────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',  label: 'DASHBOARD', tabs: ['dashboard']                             },
  { id: 'study',      label: 'STUDY',     tabs: ['homework', 'quiz', 'flashcards']        },
  { id: 'practice',   label: 'PRACTICE',  tabs: ['pronunciation', 'conversation']         },
  { id: 'messages',   label: 'MESSAGES',  tabs: ['messages']                              },
  { id: 'classes',    label: 'CLASSES',   tabs: ['completed-classes', 'schedule']         },
  { id: 'progress',   label: 'PROGRESS',  tabs: ['charts', 'badges']                      },
  { id: 'misc',       label: 'MISC',      tabs: ['recordings', 'reviews', 'referral']     },
];

const SUB = {
  study:    [{ k: 'homework', l: 'HOMEWORK' }, { k: 'quiz', l: 'QUIZZES' }, { k: 'flashcards', l: 'FLASHCARDS' }],
  practice: [{ k: 'pronunciation', l: 'SPEAK' }, { k: 'conversation', l: 'AI CHAT' }],
  classes:  [{ k: 'completed-classes', l: 'COMPLETED' }, { k: 'schedule', l: 'SCHEDULE' }],
  progress: [{ k: 'charts', l: 'CHARTS' }, { k: 'badges', l: 'BADGES' }],
  misc:     [{ k: 'recordings', l: 'RECORDINGS' }, { k: 'reviews', l: 'REVIEWS' }, { k: 'referral', l: 'INVITE' }],
};

// ── Brutalist Badges ──────────────────────────────────────────────────────────
function BrutalistBadges({ badges, progress, completedClasses, shareAchievement }) {
  const [filter, setFilter] = useState('all');
  const cats = ['ALL', 'JOURNEY', 'CONSISTENCY', 'WEEKLY', 'SPECIAL'];
  const shown = BADGE_DEFINITIONS.filter(b => filter === 'ALL' || b.category.toUpperCase() === filter);
  const pct = Math.round((badges.length / BADGE_DEFINITIONS.length) * 100);
  const getCur = b => b.type === 'streak' ? progress.streakDays : b.type === 'total' ? completedClasses.length : b.type === 'weekly' ? progress.weeklyCompleted : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderBottom: 'none', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '11px', color: B.dim, letterSpacing: '.1em' }}>[ ACHIEVEMENT REGISTRY ]</div>
          <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '13px', color: B.text, marginTop: '4px' }}>
            <span style={{ color: B.red }}>{badges.length}</span> / {BADGE_DEFINITIONS.length} EARNED &nbsp;·&nbsp; {pct}% COMPLETE
          </div>
        </div>
        {badges.length > 0 && (
          <button onClick={() => shareAchievement('badge')}
            style={{ background: B.red, color: '#fff', border: 'none', padding: '8px 18px', fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.08em', cursor: 'pointer' }}>
            SHARE ALL &gt;&gt;
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ background: B.card, border: `1px solid ${B.border}`, borderBottom: 'none', padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: 0, height: '6px', background: B.border }}>
          <div style={{ width: `${pct}%`, background: B.red, transition: 'width 1s' }} />
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1px' }}>
        {cats.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{ flex: 1, padding: '8px 0', border: `1px solid ${B.border}`, borderRight: cat === 'SPECIAL' ? `1px solid ${B.border}` : 'none', background: filter === cat ? B.red : B.card, color: filter === cat ? '#fff' : B.dim, fontFamily: 'Space Mono,monospace', fontSize: '10px', letterSpacing: '.08em', cursor: 'pointer' }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Badge grid using gap trick */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '1px', background: B.grill }}>
        {shown.map(badge => {
          const earned = badges.some(b => b.id === badge.id);
          const cur = getCur(badge);
          const bpct = badge.type === 'special' ? (earned ? 100 : 0) : Math.min((cur / badge.requirement) * 100, 100);
          return (
            <div key={badge.id} style={{ background: B.card, padding: '16px', opacity: earned ? 1 : 0.45 }}>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '28px', marginBottom: '8px', filter: earned ? 'none' : 'grayscale(1)' }}>{badge.icon}</div>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '11px', color: B.text, fontWeight: 700, letterSpacing: '.04em', marginBottom: '4px' }}>{badge.name.toUpperCase()}</div>
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '10px', color: B.dim, lineHeight: 1.4, marginBottom: '10px' }}>{badge.desc.toUpperCase()}</div>
              {!earned && badge.type !== 'special' && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ background: B.border, height: '4px' }}>
                    <div style={{ width: `${bpct}%`, height: '100%', background: B.red, transition: 'width .6s' }} />
                  </div>
                  <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '10px', color: B.dim, marginTop: '4px' }}>{cur} / {badge.requirement}</div>
                </div>
              )}
              <div style={{ fontFamily: 'Space Mono,monospace', fontSize: '10px', color: earned ? B.red : B.faint, letterSpacing: '.1em' }}>
                {earned ? '[EARNED]' : '[LOCKED]'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function BrutalistShell() {
  const { branding } = useBranding();
  const d = useDashboardData();
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [show2FA, setShow2FA] = useState(false);

  const activeSection = NAV.find(n => n.tabs.includes(d.activeTab))?.id || 'dashboard';
  const subTabs = SUB[activeSection] || [];
  const centerName = branding.centerName || 'ETS';
  const initials = centerName.substring(0, 3).toUpperCase();

  const tooltipStyle = { backgroundColor: B.card, border: `1px solid ${B.red}`, color: B.text, fontFamily: 'Space Mono,monospace', fontSize: '11px', borderRadius: 0 };

  if (d.loading) return (
    <div style={{ minHeight: '100vh', background: B.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Mono,monospace' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap'); @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
      <div>
        <div style={{ color: B.dim, fontSize: '11px', letterSpacing: '.1em', marginBottom: '8px' }}>// INITIALIZING ETS v1.0</div>
        <div style={{ color: B.dim, fontSize: '11px', letterSpacing: '.1em', marginBottom: '8px' }}>// AUTHENTICATING OPERATOR...</div>
        <div style={{ color: B.dim, fontSize: '11px', letterSpacing: '.1em', marginBottom: '8px' }}>// LOADING MISSION DATA...</div>
        <div style={{ color: B.green, fontSize: '11px', letterSpacing: '.1em', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          &gt; <span style={{ animation: 'blink 1s infinite' }}>█</span>
        </div>
      </div>
    </div>
  );

  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="student" onLeave={d.handleLeaveClassroom} />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: B.bg, fontFamily: 'Space Mono,monospace', color: B.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }

        /* CRT scanlines overlay */
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px);
          pointer-events: none;
          z-index: 9997;
        }

        .b-nav-item:hover { background: rgba(230,25,25,0.06) !important; color: ${B.text} !important; }
        .b-btn { cursor: pointer; transition: opacity 0.1s; }
        .b-btn:hover { opacity: 0.8; }
        .b-btn:active { opacity: 0.6; }
        .b-sub-active { background: ${B.red} !important; color: #fff !important; }
        .b-sub:hover { color: ${B.text} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${B.panel}; }
        ::-webkit-scrollbar-thumb { background: ${B.faint}; }
      `}</style>

      {/* Confetti */}
      {d.showCelebration && (
        <>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={200} gravity={0.4} colors={[B.red, B.text, '#fff']} />
          <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, pointerEvents: 'none' }}>
            <div style={{ background: B.card, border: `2px solid ${B.red}`, padding: '40px 56px', textAlign: 'center', pointerEvents: 'auto', maxWidth: '90vw' }}>
              <div style={{ fontSize: '11px', color: B.dim, letterSpacing: '.1em', marginBottom: '12px' }}>[ ACHIEVEMENT UNLOCKED ]</div>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>{d.celebrationEmoji}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: B.red, letterSpacing: '.04em', marginBottom: '8px' }}>{d.celebrationMessage.toUpperCase()}</div>
              <div style={{ fontSize: '11px', color: B.dim, marginBottom: '20px', letterSpacing: '.06em' }}>MISSION STATUS: EXCEPTIONAL</div>
              <button className="b-btn" onClick={() => d.shareAchievement(d.newBadge ? 'badge' : d.progress.streakDays >= 5 ? 'streak' : 'total')}
                style={{ background: B.red, color: '#fff', border: 'none', padding: '10px 24px', fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.1em' }}>
                &gt;&gt; BROADCAST
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {d.toast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, padding: '10px 18px', border: `1px solid ${d.toast.type === 'error' ? B.red : B.green}`, background: B.card, color: d.toast.type === 'error' ? B.red : B.green, fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.06em' }}>
          {d.toast.type === 'error' ? '[ERR] ' : '[OK] '}{d.toast.message.toUpperCase()}
        </div>
      )}

      {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────────── */}
      <aside style={{ width: '210px', background: B.panel, borderRight: `1px solid ${B.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px', borderBottom: `1px solid ${B.border}` }}>
          <div style={{ color: B.red, fontSize: '13px', fontWeight: 700, letterSpacing: '.06em' }}>▣ {initials}</div>
          <div style={{ color: B.dim, fontSize: '9px', letterSpacing: '.12em', marginTop: '3px' }}>TRAINING SYSTEM v1.0</div>
        </div>

        {/* Nav section header */}
        <div style={{ padding: '12px 16px 6px', borderBottom: `1px solid ${B.border}` }}>
          <div style={{ fontSize: '9px', color: B.faint, letterSpacing: '.14em' }}>// NAVIGATION</div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(({ id, label, tabs }) => {
            const isActive = activeSection === id;
            const hw = id === 'study' && (d.homeworkPending + d.quizPending) > 0 ? d.homeworkPending + d.quizPending : null;
            return (
              <button key={id} className="b-nav-item b-btn"
                onClick={() => { const s = SUB[id]; d.setActiveTab(s ? s[0].k : id === 'messages' ? 'messages' : 'dashboard'); }}
                style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'transparent', textAlign: 'left', borderLeft: isActive ? `2px solid ${B.red}` : '2px solid transparent', color: isActive ? B.red : B.dim, fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.08em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{isActive ? '>> ' : '   '}{label}</span>
                {hw && <span style={{ background: B.red, color: '#fff', fontSize: '9px', padding: '1px 6px', letterSpacing: '.04em' }}>{hw}</span>}
              </button>
            );
          })}
        </nav>

        {/* System section */}
        <div style={{ borderTop: `1px solid ${B.border}`, padding: '6px 0 8px' }}>
          <div style={{ padding: '8px 16px 4px', fontSize: '9px', color: B.faint, letterSpacing: '.14em' }}>// SYSTEM</div>
          <button className="b-nav-item b-btn" onClick={() => setShowSettingsPanel(true)}
            style={{ width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', textAlign: 'left', color: B.dim, fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.08em' }}>
            &nbsp;&nbsp;&nbsp;SETTINGS
          </button>
          <button className="b-nav-item b-btn" onClick={d.handleLogout}
            style={{ width: '100%', padding: '8px 16px', border: 'none', background: 'transparent', textAlign: 'left', color: B.red, fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.08em' }}>
            &nbsp;&nbsp;&nbsp;EXIT
          </button>
        </div>

        {/* Status bar */}
        <div style={{ borderTop: `1px solid ${B.border}`, padding: '10px 16px' }}>
          <div style={{ fontSize: '9px', color: B.faint, letterSpacing: '.1em' }}>
            <div>OPERATOR: {(d.student.firstName || 'USER').toUpperCase()}</div>
            <div style={{ marginTop: '3px' }}>STATUS: <span style={{ color: B.green }}>ACTIVE</span></div>
          </div>
        </div>
      </aside>

      {/* ── MAIN AREA ────────────────────────────────────────────────────────── */}
      <div style={{ marginLeft: '210px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <header style={{ height: '48px', background: B.panel, borderBottom: `1px solid ${B.red}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: '16px', position: 'sticky', top: 0, zIndex: 40 }}>
          <span style={{ fontSize: '11px', letterSpacing: '.1em', color: B.text, fontWeight: 700 }}>[[ {centerName.toUpperCase()} ]]</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.06em' }}>REMAINING: <span style={{ color: B.red }}>{d.progress.classesRemaining}</span></span>
          <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.06em' }}>STREAK: <span style={{ color: B.red }}>{d.progress.streakDays}D</span></span>
          <button className="b-btn" onClick={() => d.notificationsEnabled ? d.disableNotifications() : d.enableNotifications()}
            style={{ background: 'transparent', border: `1px solid ${d.notificationsEnabled ? B.red : B.border}`, color: d.notificationsEnabled ? B.red : B.dim, padding: '4px 10px', fontFamily: 'Space Mono,monospace', fontSize: '10px', letterSpacing: '.06em' }}>
            {d.notificationsEnabled ? '[NOTIF: ON]' : '[NOTIF: OFF]'}
          </button>
        </header>

        {/* Pending confirmations */}
        {d.pendingConfirmations.length > 0 && (
          <div style={{ background: B.card, borderBottom: `1px solid ${B.red}`, padding: '10px 20px' }}>
            {d.pendingConfirmations.map(conf => (
              <div key={conf.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ fontSize: '11px', color: B.red, letterSpacing: '.04em' }}>
                  [!] ATTENDANCE CONFIRMATION: "{conf.title.toUpperCase()}" — AUTO-CONFIRMS IN {d.getTimeRemaining(conf.autoConfirmAt)}
                </div>
                <button className="b-btn" onClick={() => { d.setSelectedConfirmation(conf); d.setShowConfirmationModal(true); }}
                  style={{ background: B.red, color: '#fff', border: 'none', padding: '5px 14px', fontFamily: 'Space Mono,monospace', fontSize: '10px', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
                  REVIEW &gt;&gt;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Sub-tabs */}
        {subTabs.length > 0 && (
          <div style={{ background: B.panel, borderBottom: `1px solid ${B.border}`, display: 'flex', gap: 0 }}>
            {subTabs.map(({ k, l }) => {
              const isActive = d.activeTab === k;
              const hw = k === 'homework' && d.homeworkPending > 0 ? d.homeworkPending : k === 'quiz' && d.quizPending > 0 ? d.quizPending : null;
              return (
                <button key={k} onClick={() => d.setActiveTab(k)}
                  className={`b-sub ${isActive ? 'b-sub-active' : ''}`}
                  style={{ padding: '10px 20px', border: 'none', borderRight: `1px solid ${B.border}`, background: 'transparent', color: isActive ? '#fff' : B.dim, fontFamily: 'Space Mono,monospace', fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {l}
                  {hw && <span style={{ background: B.red, color: '#fff', fontSize: '9px', padding: '0 5px' }}>{hw}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <main style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '1px' }}>

          {/* ══ DASHBOARD ══ */}
          {d.activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>

              {/* Command header — gap trick for 1px grid lines */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: B.grill }}>
                <div style={{ background: B.card, padding: '16px 20px' }}>
                  <div style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em', marginBottom: '6px' }}>// OPERATOR BRIEF</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: B.text, letterSpacing: '.02em', marginBottom: '4px' }}>{(d.student.name || d.student.firstName).toUpperCase()}</div>
                  <div style={{ fontSize: '11px', color: B.dim, letterSpacing: '.04em' }}>
                    SESSIONS REMAINING: <span style={{ color: B.red }}>{d.progress.classesRemaining}</span>
                  </div>
                </div>
                <div style={{ background: B.card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: B.dim, letterSpacing: '.12em', marginBottom: '4px' }}>ACTIVE MISSIONS</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: d.activeClasses.length > 0 ? B.green : B.faint }}>{d.activeClasses.length}</div>
                  </div>
                  {d.activeClasses.length > 0 && (
                    <div>
                      <div style={{ width: '8px', height: '8px', background: B.green, borderRadius: '50%', animation: 'blink 1.5s infinite' }} />
                    </div>
                  )}
                  <button className="b-btn" onClick={() => d.setActiveTab('completed-classes')}
                    style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${B.border}`, color: B.dim, padding: '6px 14px', fontFamily: 'Space Mono,monospace', fontSize: '10px', letterSpacing: '.08em' }}>
                    RECORDS &gt;&gt;
                  </button>
                </div>
              </div>

              {/* Stats grid — gap trick */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: B.grill }}>
                {[
                  { label: 'COMPLETED', value: d.progress.completedLessons, unit: 'SESSIONS' },
                  { label: 'REMAINING', value: d.progress.classesRemaining,  unit: 'SESSIONS' },
                  { label: 'STREAK',    value: d.progress.streakDays,        unit: 'DAYS' },
                  { label: 'THIS WEEK', value: d.progress.weeklyCompleted,   unit: 'SESSIONS' },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ background: B.card, padding: '16px' }}>
                    <div style={{ fontSize: '9px', color: B.dim, letterSpacing: '.12em', marginBottom: '8px' }}>{label}</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: B.red, lineHeight: 1, marginBottom: '4px' }}>{value}</div>
                    <div style={{ fontSize: '9px', color: B.faint, letterSpacing: '.1em' }}>{unit}</div>
                  </div>
                ))}
              </div>

              {/* Main content grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1px', background: B.grill }}>
                {/* Left: active + upcoming */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: B.grill }}>
                  {/* Active classes */}
                  <div style={{ background: B.card, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: `1px solid ${B.border}`, paddingBottom: '10px' }}>
                      <div style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ LIVE MISSIONS ]</div>
                      {d.activeClasses.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <div style={{ width: '6px', height: '6px', background: B.green, borderRadius: '50%' }} />
                          <span style={{ fontSize: '9px', color: B.green, letterSpacing: '.1em' }}>{d.activeClasses.length} ACTIVE</span>
                        </div>
                      )}
                    </div>
                    {d.activeClasses.length === 0 ? (
                      <div style={{ fontSize: '11px', color: B.faint, letterSpacing: '.06em' }}>// NO ACTIVE SESSIONS</div>
                    ) : (
                      d.activeClasses.map(cls => (
                        <div key={cls.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${B.border}` }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              {cls.status === 'live' && <div style={{ width: '6px', height: '6px', background: B.green, borderRadius: '50%' }} />}
                              <span style={{ fontSize: '12px', color: B.text, letterSpacing: '.02em' }}>{cls.title.toUpperCase()}</span>
                            </div>
                            <div style={{ fontSize: '10px', color: B.dim, letterSpacing: '.04em' }}>
                              {cls.status === 'live' ? <span style={{ color: B.green }}>// IN PROGRESS</span> : '// STARTING SOON'} — {cls.teacher.toUpperCase()}
                            </div>
                          </div>
                          <button className="b-btn" onClick={() => d.handleJoinClass(cls)}
                            style={{ background: B.red, color: '#fff', border: 'none', padding: '8px 16px', fontFamily: 'Space Mono,monospace', fontSize: '10px', letterSpacing: '.08em' }}>
                            JOIN &gt;&gt;
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Upcoming */}
                  <div style={{ background: B.card, padding: '16px 20px' }}>
                    <div style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em', marginBottom: '14px', borderBottom: `1px solid ${B.border}`, paddingBottom: '10px' }}>[ SCHEDULED MISSIONS ]</div>
                    {d.upcomingClasses.length === 0 ? (
                      <div style={{ fontSize: '11px', color: B.faint, letterSpacing: '.06em' }}>// NO UPCOMING SESSIONS</div>
                    ) : (
                      d.upcomingClasses.slice(0, 4).map(cls => (
                        <div key={cls.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${B.border}`, fontSize: '11px' }}>
                          <span style={{ color: B.text, letterSpacing: '.02em' }}>{cls.title.toUpperCase()}</span>
                          <span style={{ color: B.dim, letterSpacing: '.02em', fontSize: '10px' }}>{cls.time}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: B.grill }}>
                  {/* Progress */}
                  <div style={{ background: B.card, padding: '16px' }}>
                    <div style={{ fontSize: '9px', color: B.dim, letterSpacing: '.12em', marginBottom: '12px', borderBottom: `1px solid ${B.border}`, paddingBottom: '8px' }}>[ PERFORMANCE DATA ]</div>
                    {[
                      { label: 'COMPLETED', v: d.progress.completedLessons, max: d.progress.totalLessons },
                      { label: 'WEEKLY',    v: d.progress.weeklyCompleted,  max: d.progress.weeklyGoal   },
                    ].map(({ label, v, max }) => {
                      const p = max > 0 ? Math.min((v / max) * 100, 100) : 0;
                      return (
                        <div key={label} style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '9px', color: B.dim, letterSpacing: '.1em' }}>{label}</span>
                            <span style={{ fontSize: '9px', color: B.red }}>{v}/{max}</span>
                          </div>
                          <div style={{ background: B.border, height: '4px' }}>
                            <div style={{ width: `${p}%`, height: '100%', background: B.red, transition: 'width 1s' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Streak */}
                  <div style={{ background: B.card, padding: '16px' }}>
                    <div style={{ fontSize: '9px', color: B.dim, letterSpacing: '.12em', marginBottom: '10px' }}>[ STREAK TRACKER ]</div>
                    <StreakWidget isDarkMode={true} onLoad={d.handleStreakLoaded} />
                  </div>

                  {/* Badges */}
                  <div style={{ background: B.card, padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: `1px solid ${B.border}`, paddingBottom: '8px' }}>
                      <span style={{ fontSize: '9px', color: B.dim, letterSpacing: '.12em' }}>[ EARNED INSIGNIA ]</span>
                      <button className="b-btn" onClick={() => d.setActiveTab('badges')} style={{ background: 'transparent', border: 'none', color: B.dim, fontFamily: 'Space Mono,monospace', fontSize: '9px', letterSpacing: '.08em' }}>ALL &gt;</button>
                    </div>
                    {d.badges.length === 0 ? (
                      <div style={{ fontSize: '10px', color: B.faint, letterSpacing: '.06em' }}>// NONE EARNED YET</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {d.badges.slice(-6).map(b => (
                          <span key={b.id} title={b.name} style={{ fontSize: '22px' }}>{b.icon}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notifications */}
                  <div style={{ background: B.card, padding: '16px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: `1px solid ${B.border}`, paddingBottom: '8px' }}>
                      <span style={{ fontSize: '9px', color: B.dim, letterSpacing: '.12em' }}>[ ALERTS ]</span>
                      {d.notifications.length > 0 && (
                        <button className="b-btn" onClick={() => d.setNotifications([])} style={{ background: 'transparent', border: 'none', color: B.dim, fontFamily: 'Space Mono,monospace', fontSize: '9px', letterSpacing: '.08em' }}>CLR</button>
                      )}
                    </div>
                    {d.notifications.length === 0 ? (
                      <div style={{ fontSize: '10px', color: B.faint, letterSpacing: '.06em' }}>// NO ACTIVE ALERTS</div>
                    ) : (
                      d.notifications.slice(0, 3).map(n => (
                        <div key={n.id} style={{ fontSize: '10px', color: B.text, letterSpacing: '.03em', padding: '5px 0', borderBottom: `1px solid ${B.border}` }}>
                          [!] {n.message.toUpperCase()}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ CONTENT TABS ══ */}
          {d.activeTab === 'homework' && (
            <div style={{ background: B.card, border: `1px solid ${B.border}` }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B.border}` }}>
                <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ HOMEWORK ASSIGNMENTS ]</span>
              </div>
              <div style={{ padding: '16px' }}><StudentHomeworkTab studentInfo={d.student} isDarkMode={true} /></div>
            </div>
          )}

          {d.activeTab === 'quiz' && (
            <div style={{ background: B.card, border: `1px solid ${B.border}` }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B.border}` }}>
                <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ ASSESSMENT QUEUE ]</span>
              </div>
              <div style={{ padding: '16px' }}><StudentQuizTab studentInfo={d.student} isDarkMode={true} /></div>
            </div>
          )}

          {d.activeTab === 'flashcards' && <FlashcardsTab isDarkMode={true} />}

          {d.activeTab === 'pronunciation' && (
            <div style={{ background: B.card, border: `1px solid ${B.border}` }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B.border}` }}>
                <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ SPEECH TRAINING ]</span>
              </div>
              <div style={{ padding: '16px' }}><PronunciationTab isDarkMode={true} /></div>
            </div>
          )}

          {d.activeTab === 'conversation' && (
            <div style={{ background: B.card, border: `1px solid ${B.border}` }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B.border}` }}>
                <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ AI DIALOGUE SYSTEM ]</span>
              </div>
              <div style={{ padding: '16px' }}><ConversationTab studentInfo={d.student} isDarkMode={true} /></div>
            </div>
          )}

          {d.activeTab === 'messages' && (
            <div style={{ background: B.card, border: `1px solid ${B.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B.border}` }}>
                <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ COMMS CHANNEL ]</span>
              </div>
              <MessagesTab userRole="student" />
            </div>
          )}

          {d.activeTab === 'completed-classes' && (
            <div style={{ background: B.card, border: `1px solid ${B.border}` }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B.border}` }}>
                <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ MISSION ARCHIVE ]</span>
              </div>
              <div style={{ padding: '16px' }}><StudentCompletedTab studentId={d.student.id} isDarkMode={true} /></div>
            </div>
          )}

          {d.activeTab === 'schedule' && (
            <div style={{ background: B.card, border: `1px solid ${B.border}` }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${B.border}` }}>
                <span style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em' }}>[ DEPLOYMENT SCHEDULE ]</span>
              </div>
              <div style={{ padding: '16px' }}><StudentScheduleTab studentId={d.student.id} isDarkMode={true} /></div>
            </div>
          )}

          {d.activeTab === 'charts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: B.grill }}>
              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1px', background: B.grill }}>
                {[
                  { label: 'TOTAL SESSIONS', value: d.completedClasses.length },
                  { label: 'STREAK DAYS',    value: d.progress.streakDays },
                  { label: 'TOTAL HOURS',    value: d.completedClasses.length > 0 ? Math.round(d.completedClasses.reduce((s, c) => s + c.duration, 0) / 60) : 0 },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: B.card, padding: '16px' }}>
                    <div style={{ fontSize: '9px', color: B.dim, letterSpacing: '.12em', marginBottom: '8px' }}>{label}</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: B.red }}>{value}</div>
                  </div>
                ))}
              </div>

              {[{ title: 'LAST 7 DAYS', data: d.chartData.last7, type: 'bar' }, { title: 'LAST 30 DAYS', data: d.chartData.last30, type: 'line' }].map(({ title, data, type }) => (
                <div key={title} style={{ background: B.card, padding: '16px' }}>
                  <div style={{ fontSize: '10px', color: B.dim, letterSpacing: '.12em', marginBottom: '14px' }}>[ {title} ]</div>
                  <ResponsiveContainer width="100%" height={200}>
                    {type === 'bar' ? (
                      <BarChart data={data}><XAxis dataKey="date" stroke={B.faint} style={{ fontFamily: 'Space Mono,monospace', fontSize: 10 }} /><YAxis stroke={B.faint} style={{ fontFamily: 'Space Mono,monospace', fontSize: 10 }} /><RechartsTooltip contentStyle={tooltipStyle} /><Bar dataKey="classes" fill={B.red} radius={0} name="SESSIONS" /></BarChart>
                    ) : (
                      <LineChart data={data}><XAxis dataKey="date" stroke={B.faint} style={{ fontFamily: 'Space Mono,monospace', fontSize: 10 }} /><YAxis stroke={B.faint} style={{ fontFamily: 'Space Mono,monospace', fontSize: 10 }} /><RechartsTooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="classes" stroke={B.red} strokeWidth={1.5} dot={{ fill: B.red, r: 3, strokeWidth: 0 }} name="SESSIONS" /></LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}

          {d.activeTab === 'badges' && (
            <BrutalistBadges badges={d.badges} progress={d.progress} completedClasses={d.completedClasses} shareAchievement={d.shareAchievement} />
          )}

          {d.activeTab === 'recordings' && <RecordingsTab isDarkMode={true} />}
          {d.activeTab === 'reviews'    && <ReviewsTab isDarkMode={true} />}
          {d.activeTab === 'referral'   && <ReferralTab isDarkMode={true} />}
        </main>
      </div>

      {/* ── Share modal ───────────────────────────────────────────────────────── */}
      {d.showShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: B.card, border: `1px solid ${B.red}`, padding: '28px', maxWidth: '420px', width: 'calc(100% - 32px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: `1px solid ${B.border}` }}>
              <div style={{ fontSize: '11px', color: B.dim, letterSpacing: '.12em' }}>[ BROADCAST ACHIEVEMENT ]</div>
              <button className="b-btn" onClick={() => d.setShowShareModal(false)} style={{ background: 'transparent', border: `1px solid ${B.border}`, color: B.dim, padding: '3px 10px', fontFamily: 'Space Mono,monospace', fontSize: '11px' }}>✕</button>
            </div>
            <div style={{ background: B.panel, border: `1px solid ${B.border}`, padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: B.red, marginBottom: '4px', letterSpacing: '.04em' }}>{d.shareData?.title?.toUpperCase()}</div>
              <div style={{ fontSize: '11px', color: B.dim }}>{d.shareData?.message}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="b-btn" onClick={d.copyShareText} style={{ padding: '10px', border: `1px solid ${B.border}`, background: 'transparent', color: B.text, fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.06em' }}>
                &gt;&gt; COPY TO CLIPBOARD
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[['twitter','TWITTER','#1DA1F2'],['facebook','FACEBOOK','#1877F2'],['whatsapp','WHATSAPP','#25D366'],['linkedin','LINKEDIN','#0A66C2']].map(([p,label,bg]) => (
                  <button key={p} className="b-btn" onClick={() => d.shareOnSocial(p)} style={{ padding: '9px', background: bg, color: '#fff', border: 'none', fontFamily: 'Space Mono,monospace', fontSize: '10px', letterSpacing: '.08em' }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings panel ────────────────────────────────────────────────────── */}
      {showSettingsPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: B.card, border: `1px solid ${B.border}`, padding: '0', maxWidth: '360px', width: 'calc(100% - 32px)' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${B.red}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: B.dim, letterSpacing: '.12em' }}>[ SYSTEM SETTINGS ]</span>
              <button className="b-btn" onClick={() => setShowSettingsPanel(false)} style={{ background: 'transparent', border: `1px solid ${B.border}`, color: B.dim, padding: '3px 10px', fontFamily: 'Space Mono,monospace', fontSize: '11px' }}>✕</button>
            </div>
            {[
              { label: 'CHANGE PASSWORD', action: () => { setShowSettingsPanel(false); d.setShowChangePassword(true); } },
              { label: 'MANAGE SESSIONS', action: () => { setShowSettingsPanel(false); d.setShowSessionManagement(true); } },
              { label: 'TWO-FACTOR AUTH', action: () => { setShowSettingsPanel(false); setShow2FA(true); } },
            ].map(({ label, action }) => (
              <button key={label} className="b-btn b-nav-item" onClick={action}
                style={{ width: '100%', padding: '13px 20px', border: 'none', borderBottom: `1px solid ${B.border}`, background: 'transparent', textAlign: 'left', color: B.dim, fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.08em' }}>
                &gt; {label}
              </button>
            ))}
            <button className="b-btn" onClick={d.handleLogout}
              style={{ width: '100%', padding: '13px 20px', border: 'none', background: 'transparent', textAlign: 'left', color: B.red, fontFamily: 'Space Mono,monospace', fontSize: '11px', letterSpacing: '.08em' }}>
              &gt; EXIT SYSTEM
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {d.showChangePassword && <ChangePassword onClose={() => d.setShowChangePassword(false)} onSuccess={() => { d.setShowChangePassword(false); d.showToast('PASSWORD UPDATED'); }} />}
      {d.showSessionManagement && <SessionManagement isOpen onClose={() => d.setShowSessionManagement(false)} userType="student" />}
      {show2FA && <SettingsModal isOpen onClose={() => setShow2FA(false)} userType="student" />}
      {d.showConfirmationModal && d.selectedConfirmation && (
        <ClassConfirmation booking={d.selectedConfirmation} isDarkMode={true}
          onConfirm={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast('CLASS CONFIRMED'); d.fetchStudentData(); }}
          onDispute={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast('DISPUTE FILED'); d.fetchStudentData(); }}
          onClose={() => { d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); }} />
      )}
    </div>
  );
}
