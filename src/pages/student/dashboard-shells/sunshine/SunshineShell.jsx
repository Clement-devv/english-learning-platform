// src/pages/student/dashboard-shells/sunshine/SunshineShell.jsx
// Sunshine Explorer — warm orange palette, bubbly Nunito font, vertical sidebar nav.

import { useState, useEffect, lazy, Suspense } from "react";
import { useViewMode } from "../../../../hooks/useViewMode";
const GroupClassTab        = lazy(() => import('../../tabs/GroupClassTab'));
const BookingCalendarTab   = lazy(() => import('../../tabs/BookingCalendarTab'));
const ClassReportsTab      = lazy(() => import('../../tabs/ClassReportsTab'));
const CertificatesTab      = lazy(() => import('../../tabs/CertificatesTab'));
import Confetti from "react-confetti";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Home, BookOpen, FileText, Layers, Mic2, MessageSquare, MessageCircle,
  CheckCircle2, CalendarDays, TrendingUp, Award, Users,
  Video, Star, Gift, Settings, LogOut, Bell, ChevronDown, ChevronRight,
  Moon, Sun, Shield, KeyRound, PhoneMissed, X, Radio, Target,
  LayoutGrid,
} from "lucide-react";
import { useTranslation }        from "react-i18next";
import { useBranding }           from "../../../../context/BrandingContext";
import { getDashboardThemeById } from "../../../../data/dashboardThemes";
import { useRing }               from "../../../../context/RingContext";
import LanguageSwitcher          from "../../../../components/LanguageSwitcher";
import ActiveClasses     from "../../components/ActiveClasses";
import UpcomingClasses   from "../../components/UpcomingClasses";
import ProgressCard      from "../../components/ProgressCard";
import NotificationsCard from "../../components/NotificationsCard";
import SessionManagement from "../../../../components/SessionManagement";
import SettingsSidebar   from "../../../../components/SettingsSidebar";
import SettingsModal     from "../../../../components/SettingsModal";
import ClassConfirmation from "../../../../components/student/ClassConfirmation";
import StreakWidget        from "../../components/StreakWidget";
import { useDashboardData, BADGE_DEFINITIONS } from "../useDashboardData";
import DashboardAlertsBar from "../../../../components/DashboardAlertsBar";
// Tabs load on demand (see src/pages/student/tabs/lazyTabs.js)
import { ChangePassword, StudentCompletedTab, StudentScheduleTab, StudentHomeworkTab, StudentQuizTab, PronunciationTab, ConversationTab, FlashcardsTab, RecordingsTab, ReviewsTab, ReferralTab, LeaderboardTab, MessagesTab, Classroom } from "../../tabs/lazyTabs";
import { dateLocale } from "../../../../i18n/dateLocale.js";
import { adminAccent, adminOnAccent } from "../../../../utils/adminAccent";
import { DoodleBackdrop, DoodleSunset, DoodleBannerArt } from "../../../../components/dashboard/DoodleArt";

// ── Sidebar nav groups ────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    labelKey: null,
    items: [{ key: "dashboard", icon: "🏠", labelKey: "nav.home", lucide: Home }],
  },
  {
    labelKey: "nav.learning",
    items: [
      { key: "homework",      icon: "📚", labelKey: "nav.homework",   lucide: BookOpen  },
      { key: "quiz",          icon: "📝", labelKey: "nav.quizzes",    lucide: FileText  },
      { key: "flashcards",    icon: "📖", labelKey: "nav.flashcards", lucide: Layers    },
    ],
  },
  {
    labelKey: "nav.practice",
    items: [
      { key: "pronunciation", icon: "🎤", labelKey: "nav.speaking", lucide: Mic2          },
      { key: "conversation",  icon: "🤖", labelKey: "nav.aiChat",   lucide: MessageSquare },
    ],
  },
  {
    labelKey: "nav.classes",
    items: [
      { key: "book-class",        icon: "📆", labelKey: "nav.bookClass",     lucide: CalendarDays  },
      { key: "group-classes",     icon: "👥", labelKey: "nav.groupClasses",  lucide: Users         },
      { key: "messages",          icon: "💬", labelKey: "nav.messages",      lucide: MessageCircle },
      { key: "completed-classes", icon: "✅", labelKey: "nav.completed",     lucide: CheckCircle2  },
      { key: "class-reports",     icon: "📝", labelKey: "nav.classReports",  lucide: CheckCircle2  },
      { key: "schedule",          icon: "📅", labelKey: "nav.schedule",      lucide: CalendarDays  },
    ],
  },
  {
    labelKey: "nav.progress",
    items: [
      { key: "charts",       icon: "📊", labelKey: "nav.charts",       lucide: TrendingUp },
      { key: "badges",       icon: "🏅", labelKey: "nav.badges",       lucide: Award      },
      { key: "certificates", icon: "🎓", labelKey: "nav.certificates", lucide: Award      },
      { key: "leaderboard",  icon: "🏆", labelKey: "nav.leaderboard",  lucide: Award      },
    ],
  },
  {
    labelKey: "nav.more",
    items: [
      { key: "recordings", icon: "🎬", labelKey: "nav.recordings", lucide: Video },
      { key: "reviews",    icon: "⭐", labelKey: "nav.reviews",    lucide: Star  },
      { key: "referral",   icon: "🎁", labelKey: "nav.invite",     lucide: Gift  },
    ],
  },
];

// Topic colour per nav group (see .cat-* in index.css)
// Whole-page look: true = liquid glass (frosted translucent panes over colour glows,
// gradient border — same as the teacher shell); false = solid panels, thick pink border.
const GLASS_PAGE = true;

const GROUP_CAT = { "nav.learning": "sky", "nav.practice": "teal", "nav.classes": "amber", "nav.progress": "green", "nav.more": "rose" };

// ── BadgesTab (unchanged logic, same as before) ───────────────────────────────
function BadgesTab({ badges, progress, completedClasses, col, isDarkMode, shareAchievement, accentGradient, tabShadow, fontFamily }) {
  const { t: tr } = useTranslation("student");
  const [badgeFilter, setBadgeFilter] = useState("all");
  const categories = [
    { key: "all",         label: tr("sunshineShell.all")        },
    { key: "journey",     label: tr("sunshineShell.journey")     },
    { key: "consistency", label: tr("sunshineShell.consistency") },
    { key: "weekly",      label: tr("sunshineShell.weekly")      },
    { key: "special",     label: tr("sunshineShell.special")     },
  ];
  const shown  = BADGE_DEFINITIONS.filter(b => badgeFilter === "all" || b.category === badgeFilter);
  const pct    = Math.round((badges.length / BADGE_DEFINITIONS.length) * 100);
  const nextUp = BADGE_DEFINITIONS.filter(b => !badges.some(e => e.id === b.id) && b.type !== "special").slice(0, 3);

  const getCur = (badge) => {
    if (badge.type === "streak")  return progress.streakDays;
    if (badge.type === "total")   return completedClasses.length;
    if (badge.type === "weekly")  return progress.weeklyCompleted;
    return 0;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <style>{`
        @keyframes badge-shine  { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes badge-float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .badge-earned { transition: all 0.25s; }
        .badge-earned:hover { transform: translateY(-4px) scale(1.03); }
        .badge-locked { filter: grayscale(1); opacity: 0.42; }
      `}</style>

      <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}><Award size={20} color={col.accent} strokeWidth={2} /> {tr("sunshineShell.achievementBadges")}</h2>
            <p style={{ margin: 0, color: col.muted, fontSize: "14px", fontWeight: 600 }}>
              {badges.length === 0 ? tr("sunshineShell.completeClassesToStartEarning") : tr("sunshineShell.ofEarned", { badgesCount: badges.length, BADGEDEFINITIONSCount: BADGE_DEFINITIONS.length, pct })}
            </p>
          </div>
          {badges.length > 0 && (
            <button onClick={() => shareAchievement("badge")}
              style={{ background: accentGradient, color: "#fff", border: "none", borderRadius: "14px", padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontFamily: `${fontFamily},sans-serif`, fontSize: "14px", boxShadow: `0 4px 14px ${tabShadow}` }}>
              {tr("sunshineShell.shareAll")}
            </button>
          )}
        </div>
        <div style={{ background: col.border, borderRadius: "999px", height: "10px", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: accentGradient, transition: "width 1s ease" }} />
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {categories.map(cat => (
            <button key={cat.key} onClick={() => setBadgeFilter(cat.key)}
              style={{ padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer", fontFamily: `${fontFamily},sans-serif`, fontSize: "12px", fontWeight: 800, background: badgeFilter === cat.key ? accentGradient : ('var(--a-ink)'), color: badgeFilter === cat.key ? "#fff" : col.muted, boxShadow: badgeFilter === cat.key ? `0 3px 10px ${tabShadow}` : "none" }}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(155px,1fr))", gap: "14px" }}>
        {shown.map(badge => {
          const earned = badges.some(b => b.id === badge.id);
          const cur    = getCur(badge);
          const bPct   = badge.type === "special" ? (earned ? 100 : 0) : Math.min((cur / badge.requirement) * 100, 100);
          return (
            <div key={badge.id} className={earned ? "badge-earned" : "badge-locked"}
              style={{ borderRadius: "22px", padding: "20px 14px 14px", textAlign: "center", border: `2px solid ${earned ? badge.grad[0] + "60" : col.border}`, background: earned ? (isDarkMode ? `linear-gradient(145deg,${badge.grad[0]}18,${badge.grad[1]}10)` : `linear-gradient(145deg,${badge.grad[0]}12,${badge.grad[1]}08)`) : col.cardAlt, position: "relative", overflow: "hidden" }}>
              {earned && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})`, borderRadius: "22px 22px 0 0" }} />}
              <div style={{ fontSize: "48px", marginBottom: "10px", animation: earned ? "badge-float 3s ease-in-out infinite" : "none", display: "inline-block" }}>{badge.icon}</div>
              <h3 style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 900, color: col.heading }}>{badge.name}</h3>
              <p style={{ margin: "0 0 10px", fontSize: "11px", color: col.muted, fontWeight: 600, lineHeight: 1.4 }}>{badge.desc}</p>
              {!earned && badge.type !== "special" && (
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ background: col.border, borderRadius: "999px", height: "6px", overflow: "hidden" }}>
                    <div style={{ width: `${bPct}%`, height: "100%", borderRadius: "999px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})` }} />
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "10px", fontWeight: 700, color: col.muted }}>{cur} / {badge.requirement}</p>
                </div>
              )}
              {earned
                ? <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: `linear-gradient(135deg,${badge.grad[0]},${badge.grad[1]})`, color: "#fff" }}>{tr("sunshineShell.earned")}</span>
                : <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800, background: col.border, color: col.muted }}>{tr("sunshineShell.locked")}</span>
              }
            </div>
          );
        })}
      </div>

      {nextUp.length > 0 && (
        <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: "20px", fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}><Target size={19} color={col.accent} strokeWidth={2} /> {tr("sunshineShell.almostThere")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {nextUp.map(badge => {
              const cur = getCur(badge);
              const p   = Math.min((cur / badge.requirement) * 100, 100);
              return (
                <div key={badge.id} style={{ borderRadius: "18px", padding: "16px", border: `1px solid ${col.border}`, background: col.cardAlt }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "36px" }}>{badge.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 2px", fontWeight: 900, color: col.heading, fontSize: "14px" }}>{badge.name}</h4>
                      <p style={{ margin: 0, fontSize: "12px", color: col.muted, fontWeight: 600 }}>{badge.desc}</p>
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: badge.grad[0] }}>{cur}/{badge.requirement}</span>
                  </div>
                  <div style={{ background: col.border, borderRadius: "999px", height: "8px", overflow: "hidden" }}>
                    <div style={{ width: `${p}%`, height: "100%", borderRadius: "999px", background: `linear-gradient(90deg,${badge.grad[0]},${badge.grad[1]})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SunshineShell
// ══════════════════════════════════════════════════════════════════════════════
export default function SunshineShell() {
  const { t: tr } = useTranslation("student");
  const { t } = useTranslation();
  const { branding, center } = useBranding();
  // Sunshine look = the admin tokens (src/index.css .as-root) + this center's accent.
  // Fonts / loading text still come from the theme definition.
  const baseTheme = getDashboardThemeById(branding.dashboardTheme);
  const dashTheme = {
    ...baseTheme,
    accentGradient:  "var(--a-accent-grad)",
    tabGradient:     "var(--a-accent-grad)",
    welcomeGradient: "var(--a-accent-grad)",
    tabShadow:       "color-mix(in srgb, var(--a-accent) 45%, transparent)",
    scrollbarThumb:  () => "var(--a-line-strong)",
    palette: () => ({
      bg: "var(--a-bg)", card: GLASS_PAGE ? "var(--as-glass-card)" : "var(--a-surface)", cardAlt: "var(--a-raised)", border: "var(--a-line)",
      heading: "var(--a-ink)", body: "var(--a-ink-2)", muted: "var(--a-muted)", accent: "var(--a-accent)", sidebar: GLASS_PAGE ? "var(--as-glass-card)" : "var(--a-surface)",
    }),
  };
  const accent = adminAccent(branding);
  const d   = useDashboardData();
  const { missedCalls, missedCallCount, clearMissedCalls } = useRing();
  const { isMobile, forcedMode, setViewMode, viewportWidth } = useViewMode({ phoneDefault: true });
  // Touch layout on a wide screen (iPad portrait): keep the tab bar, but use the room —
  // 4 stat tiles, side-by-side panels. `compact` = phone-sized.
  const wideTouch = isMobile && viewportWidth >= 700;
  const compact   = isMobile && !wideTouch;
  // Phone/iPad Chat tab: the page area becomes a fixed frame and only the messages scroll
  const chatFill  = isMobile && d.activeTab === "messages";
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  useEffect(() => {
    if (!showMobileMenu) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowMobileMenu(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showMobileMenu]);
  const col = dashTheme.palette(d.isDarkMode);
  // Nunito is loaded once from index.html (early); only import other fonts here
  const fontCss = dashTheme.fontImport && !/family=Nunito/.test(dashTheme.fontImport) ? `@import url('${dashTheme.fontImport}');` : '';
  const F   = `'${dashTheme.font}',sans-serif`;
  const tooltipStyle = { backgroundColor: "var(--a-surface)", border: `1px solid ${col.border}`, color: col.heading, borderRadius: "12px", fontFamily: F };

  // Loading screen
  if (d.loading) return (
    <div className="as-root" data-theme={d.isDarkMode ? "dark" : "light"} style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: col.bg, fontFamily: F, "--a-accent": accent, "--a-on-accent": adminOnAccent(accent) }}>
      <style>{`${fontCss} @keyframes bounce{to{transform:translateY(-16px)}}`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "64px", animation: "bounce 0.8s infinite alternate" }}>{dashTheme.loadingEmoji}</div>
        <p style={{ color: "var(--a-accent-ink)", fontWeight: 700, fontSize: "18px", marginTop: "16px" }}>{dashTheme.loadingText}</p>
      </div>
    </div>
  );

  // Classroom overlay
  if (d.isClassroomOpen && d.activeClass)
    return <Classroom classData={d.activeClass} userRole="student" onLeave={d.handleLeaveClassroom} />;

  return (
    <div className={GLASS_PAGE ? "as-root as-glass as-shine" : "as-root"} data-theme={d.isDarkMode ? "dark" : "light"} style={{ display: "flex", height: "100dvh", overflow: "hidden", position: "relative", fontFamily: F, background: col.bg, "--a-accent": accent, "--a-on-accent": adminOnAccent(accent) }}>
      <style>{`
        ${fontCss}
        * { box-sizing: border-box; }
        .ss-navitem { transition: background-color 150ms ease, color 150ms ease, transform 120ms ease-out; }
        .ss-navitem:active { transform: scale(0.98); }
        /* mobile tab bar + "More" sheet styles: shared in src/index.css (.ss-tabbar, .ss-sheet…) */
        @media (hover: hover) and (pointer: fine) { .ss-navitem:not([aria-current="page"]):hover { background: ${GLASS_PAGE ? "color-mix(in srgb, var(--a-surface) 55%, transparent)" : "var(--a-raised)"} !important; } }
        .as-root button:focus-visible { outline: 2px solid var(--a-accent); outline-offset: 2px; }
        .ss-navscroll { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--a-pink) 45%, transparent) transparent; }
        .ss-navscroll::-webkit-scrollbar { width: 6px; }
        .ss-navscroll::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--a-pink) 45%, transparent); border-radius: 999px; }
        .ss-navscroll::-webkit-scrollbar-track { background: transparent; }
        .kid-card { transition: transform 0.2s, box-shadow 0.2s; }
        
        .kid-btn { transition: transform 0.15s; }
        .kid-btn:hover { transform: scale(1.05); }
        .kid-btn:active { transform: scale(0.97); }
        .pop-in { animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes popIn { from{transform:scale(0.5);opacity:0} to{transform:scale(1);opacity:1} }
        .wiggle:hover { animation: wiggle 0.4s; }
        @keyframes wiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
        .fade-up { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        .hero-float { animation: heroFloat 5s ease-in-out infinite; }
        @keyframes heroFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .hero-orb { animation: heroOrb 7s ease-in-out infinite; }
        @keyframes heroOrb { 0%,100%{transform:scale(1) rotate(0deg)} 50%{transform:scale(1.15) rotate(15deg)} }
        .stat-card { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .stat-card:nth-child(1){animation-delay:0.05s} .stat-card:nth-child(2){animation-delay:0.12s}
        .lang-switcher-btn:hover { background: var(--a-raised) !important; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dashTheme.scrollbarThumb(d.isDarkMode)}; border-radius: 10px; }
      `}</style>

      {/* Confetti */}
      {d.showCelebration && (
        <>
          <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} numberOfPieces={compact ? 220 : 500} gravity={0.3} />
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, pointerEvents: "none", padding: 16 }}>
            {/* compact card (smaller on phones); tap to dismiss — it also closes by itself */}
            <button type="button" className="pop-in" onClick={() => d.setShowCelebration(false)} aria-label={d.celebrationMessage}
              style={{ background: dashTheme.welcomeGradient, color: "#fff", padding: compact ? "20px 24px" : "28px 40px", borderRadius: compact ? 22 : 28, textAlign: "center", boxShadow: "0 20px 48px -12px rgba(0,0,0,0.35)", pointerEvents: "auto", maxWidth: compact ? 300 : 380, width: "auto", border: "none", cursor: "pointer", fontFamily: F }}>
              <div style={{ fontSize: compact ? 44 : 56, lineHeight: 1, marginBottom: 8 }} aria-hidden="true">{d.celebrationEmoji}</div>
              <h2 style={{ margin: "0 0 4px", fontSize: compact ? 18 : 22, fontWeight: 900, lineHeight: 1.25 }}>{d.celebrationMessage}</h2>
              <p style={{ margin: 0, opacity: 0.9, fontSize: compact ? 13 : 14, fontWeight: 600 }}>{t('dashboard.keepUpWork')}</p>
            </button>
          </div>
        </>
      )}

      {/* Toast */}
      {d.toast && (
        <div className="ui-toast-in" role="status" style={{ position: "fixed", top: "20px", right: "20px", zIndex: 99999, padding: "11px 18px", borderRadius: 14, fontWeight: 700, fontSize: 13.5, background: "var(--a-surface)", color: col.heading, border: `1px solid ${col.border}`, borderLeft: `1px solid ${col.border}`, fontFamily: F, boxShadow: "var(--a-shadow-pop)" }}>
          {d.toast.type === "error" ? "😬" : "✅"} {d.toast.message}
        </div>
      )}

      {/* Colour glows across the page — what the glass panes blur */}
      {GLASS_PAGE && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden", opacity: d.isDarkMode ? 0.5 : 1 }}>
          {[
            { l: "-6%",  t: "-12%", s: 420, c: "color-mix(in srgb, var(--a-pink) 55%, transparent)" },
            { l: "8%",   t: "45%",  s: 380, c: "rgba(56,189,248,0.40)" },
            { l: "38%",  t: "-18%", s: 520, c: "color-mix(in srgb, var(--a-accent) 42%, transparent)" },
            { l: "72%",  t: "8%",   s: 440, c: "rgba(251,191,36,0.45)" },
            { l: "55%",  t: "60%",  s: 480, c: "rgba(45,212,191,0.32)" },
            { l: "-4%",  t: "78%",  s: 360, c: "rgba(251,191,36,0.40)" },
            { l: "85%",  t: "70%",  s: 380, c: "color-mix(in srgb, var(--a-pink) 45%, transparent)" },
          ].map((g, i) => (
            <div key={i} style={{ position: "absolute", left: g.l, top: g.t, width: g.s, height: g.s, borderRadius: "50%", background: `radial-gradient(circle, ${g.c} 0%, transparent 68%)` }} />
          ))}
        </div>
      )}

      {/* ── SIDEBAR ──────────────────────────────────────────────────────────── */}
      <aside className={GLASS_PAGE ? "as-glass-ring" : undefined} style={{
        width: 220, flexShrink: 0,
        // Floating rounded panel — liquid glass, or solid with a thick pink border
        margin: "12px 0 12px 12px",
        borderRadius: 26,
        position: "relative",
        ...(GLASS_PAGE ? {
          background: d.isDarkMode
            ? "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.07) 100%)"
            : "linear-gradient(160deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.30) 45%, rgba(255,255,255,0.46) 100%)",
          backdropFilter: "blur(24px) saturate(185%)",
          WebkitBackdropFilter: "blur(24px) saturate(185%)",
          border: "none",
          boxShadow: d.isDarkMode
            ? "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.05), 0 24px 48px -20px rgba(0,0,0,0.6), 0 0 0 1px color-mix(in srgb, var(--a-pink) 22%, transparent)"
            : "inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(255,255,255,0.4), inset 0 0 24px rgba(255,255,255,0.35), 0 24px 48px -22px color-mix(in srgb, var(--a-pink) 55%, transparent), 0 0 0 1px color-mix(in srgb, var(--a-pink) 22%, transparent)",
        } : {
          background: "color-mix(in srgb, var(--a-pink) 7%, var(--a-surface))",
          border: "3px solid color-mix(in srgb, var(--a-pink) 70%, var(--a-surface))",
          boxShadow: "0 10px 30px -12px color-mix(in srgb, var(--a-pink) 45%, transparent)",
        }),
        display: isMobile ? "none" : "flex", flexDirection: "column",
        overflow: "hidden",
        zIndex: 100,
      }}>
        {/* Glass sheen — light catching the top edge */}
        {GLASS_PAGE && (
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "inherit", pointerEvents: "none",
            background: "linear-gradient(180deg, " + "rgba(255,255,255," + (d.isDarkMode ? 0.1 : 0.55) + ")" + " 0%, rgba(255,255,255,0) 22%), radial-gradient(120% 50% at 0% 0%, " + "rgba(255,255,255," + (d.isDarkMode ? 0.08 : 0.4) + ")" + " 0%, transparent 60%)" }} />
        )}
        {/* Brand */}
        <div style={{ flexShrink: 0, position: "relative", padding: "16px 16px 12px", borderBottom: GLASS_PAGE ? "1px solid " + "rgba(255,255,255," + (d.isDarkMode ? 0.1 : 0.7) + ")" : `2px solid ${col.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {branding?.logo ? (
              <img src={branding.logo} alt="" style={{ width: 38, height: 38, borderRadius: 11, objectFit: "cover", flexShrink: 0, boxShadow: `0 0 0 1px ${col.border}` }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--a-accent-grad)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, boxShadow: `0 4px 12px ${dashTheme.tabShadow}`, flexShrink: 0 }}>☀️</div>
            )}
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: col.heading, lineHeight: 1.1 }}>{center?.centerName}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: col.muted }}>{t('sidebar.learningPlatform')}</div>
              {branding?.partnershipText && (
                <div style={{ fontSize: 10, color: col.muted, opacity: 0.75, marginTop: 2, fontStyle: 'italic' }}>{branding.partnershipText}</div>
              )}
            </div>
          </div>
        </div>

        {/* Student card */}
        <div style={{ flexShrink: 0, margin: "10px 10px 6px", position: "relative", background: GLASS_PAGE ? "rgba(255,255,255," + (d.isDarkMode ? 0.06 : 0.5) + ")" : "var(--a-raised)", boxShadow: GLASS_PAGE ? "inset 0 0 0 1px " + "rgba(255,255,255," + (d.isDarkMode ? 0.1 : 0.8) + ")" : "none", borderRadius: 14, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--a-accent-soft)", boxShadow: "inset 0 0 0 1px var(--a-accent-line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--a-accent-ink)", fontWeight: 900, fontSize: 15, flexShrink: 0 }}>
            {(d.student.firstName?.[0] || "S").toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: col.heading, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.student.firstName}</div>
            {d.student.studentId && (
              <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "monospace", letterSpacing: "0.03em", color: col.muted }}>{d.student.studentId}</div>
            )}
            <div style={{ fontSize: 11, fontWeight: 600, color: col.muted }}>{t('sidebar.classesDone', { count: d.progress.completedLessons })}</div>
          </div>
        </div>

        {/* Nav groups — each group has a topic colour (same idea as the admin) */}
        <nav className="ss-navscroll" style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "4px 8px" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={`cat-${GROUP_CAT[group.labelKey] || "accent"}`} style={{ marginBottom: 6 }}>
              {group.labelKey && (
                <div style={{ fontSize: 10, fontWeight: 800, color: col.muted, letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px 10px 4px" }}>
                  {t(group.labelKey)}
                </div>
              )}
              {group.items.map(item => {
                const isActive = d.activeTab === item.key;
                const badge = item.key === "homework" && d.homeworkPending > 0 ? d.homeworkPending
                            : item.key === "quiz"     && d.quizPending > 0     ? d.quizPending
                            : item.key === "badges"   ? (d.badges.length > 0 ? d.badges.length : null)
                            : item.key === "messages" && missedCallCount > 0   ? missedCallCount
                            : null;
                const LI = item.lucide;
                return (
                  <button key={item.key} className="ss-navitem"
                    onClick={() => d.setActiveTab(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 10, border: "none", cursor: "pointer",
                      background: isActive ? (GLASS_PAGE ? `color-mix(in srgb, var(--cat) ${d.isDarkMode ? 22 : 16}%, rgba(255,255,255,${d.isDarkMode ? 0.06 : 0.45}))` : "var(--cat-soft)") : "transparent",
                      boxShadow: isActive && GLASS_PAGE ? `inset 0 0 0 1px rgba(255,255,255,${d.isDarkMode ? 0.1 : 0.6})` : "none",                      fontFamily: F, textAlign: "left", marginBottom: 1,
                    }}>
                    <LI size={17} strokeWidth={isActive ? 2.1 : 1.8} color="var(--cat)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 800 : 600, color: isActive ? "var(--cat-ink)" : col.body }}>
                      {t(item.labelKey)}
                    </span>
                    {badge != null && (
                      <span style={{ background: "var(--a-accent-grad)", color: "var(--a-on-accent)", borderRadius: 999, fontSize: 10, fontWeight: 800, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ flexShrink: 0, position: "relative", padding: "2px 8px 4px", borderTop: GLASS_PAGE ? "1px solid " + "rgba(255,255,255," + (d.isDarkMode ? 0.1 : 0.7) + ")" : `2px solid ${col.border}` }}>
          {/* Dark mode toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", marginBottom: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: col.muted }}>{d.isDarkMode ? t('sidebar.darkMode') : t('sidebar.lightMode')}</span>
            <button onClick={() => d.setIsDarkMode(v => !v)} role="switch" aria-checked={d.isDarkMode} aria-label={t('sidebar.darkMode')}
              style={{ width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", background: d.isDarkMode ? "var(--a-accent)" : "var(--a-line-strong)", position: "relative", transition: "background-color 200ms ease", flexShrink: 0 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: 3, transform: `translateX(${d.isDarkMode ? 18 : 0}px)`, transition: "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
            </button>
          </div>

          <button className="ss-navitem" onClick={() => d.setShowSettingsSidebar(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: "transparent", fontFamily: F, marginBottom: 1 }}>
            <Settings size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('sidebar.settings')}</span>
          </button>

          <LanguageSwitcher col={col} fontFamily={dashTheme.font} />

          <button className="ss-navitem" onClick={d.handleLogout}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: 14, border: "none", cursor: "pointer", background: "transparent", fontFamily: F }}>
            <LogOut size={17} color={col.muted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: col.body }}>{t('sidebar.signOut')}</span>
          </button>

        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div className={GLASS_PAGE && !isMobile ? "as-glass-ring" : undefined} style={{
        flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative",
        // Desktop: rounded panel matching the sidebar
        ...(isMobile ? null : {
          margin: 12, borderRadius: 26,
          ...(GLASS_PAGE ? {
            background: "var(--as-glass-frame)",
            border: "none",
            boxShadow: "inset 0 1px 0 var(--as-glass-edge), 0 24px 48px -24px var(--as-glass-glow)",
          } : {
            background: col.bg,
            border: "3px solid color-mix(in srgb, var(--a-pink) 70%, var(--a-surface))",
            boxShadow: "0 10px 30px -12px color-mix(in srgb, var(--a-pink) 45%, transparent)",
          }),
        }),
      }}>
        {!isMobile && d.activeTab !== "messages" && <DoodleSunset />}

        {/* ── TOP BAR ── */}
        <header style={{ height: 60, position: "relative", zIndex: 2, background: col.sidebar, borderBottom: `1px solid ${col.border}`, display: "flex", alignItems: "center", padding: isMobile ? "0 12px" : "0 24px", gap: isMobile ? 8 : 16, flexShrink: 0 }}>
          {/* Page title */}
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {(() => { const it = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === d.activeTab); const LI = it?.lucide || Home; return <LI size={20} strokeWidth={2.2} color={col.accent} />; })()}
            {(() => { const it = NAV_GROUPS.flatMap(g => g.items).find(i => i.key === d.activeTab); return it ? t(it.labelKey) : t('nav.home'); })()}
          </h1>

          {/* Streak pill */}
          {d.progress.streakDays > 0 && !isMobile && (
            <div className="cat-amber" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--cat-soft)", border: "1px solid var(--cat-line)", borderRadius: 999, padding: "5px 12px" }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: "var(--cat-ink)" }}>{tr("sunshineShell.dayStreak", { streakDays: d.progress.streakDays })}</span>
            </div>
          )}

          {/* ── Notification chips — desktop only ── */}
          {!isMobile && d.unreadMessages > 0 && (
            <button onClick={() => { d.setActiveTab("messages"); d.setUnreadMessages(0); }} title={tr("sunshineShell.goToMessages")}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--a-surface)", border: `1px solid ${col.border}`, borderRadius: 999, padding: "5px 12px 5px 10px", cursor: "pointer", fontFamily: F }}>
              <MessageCircle size={14} color="var(--a-accent)" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: col.heading }}>{tr("sunshineShell.new", { unreadMessages: d.unreadMessages })}</span>
            </button>
          )}
          {!isMobile && missedCallCount > 0 && (
            <button onClick={clearMissedCalls} title={tr("sunshineShell.clearMissedCalls")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: d.isDarkMode ? "rgba(239,68,68,0.12)" : "#fff5f5", border: `2px solid ${d.isDarkMode ? "rgba(239,68,68,0.3)" : "#fecaca"}`, borderRadius: 999, padding: "5px 14px", cursor: "pointer", fontFamily: F }}>
              <span style={{ fontSize: 13 }}>📞</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#ef4444" }}>{tr("sunshineShell.missed", { missedCallCount })}</span>
            </button>
          )}

          {/* Notification bell */}
          <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer", color: col.muted, display: "flex", padding: 6 }}>
            <Bell size={20} />
            {d.notifications.filter(n => !n.read).length > 0 && (
              <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, background: "#ef4444", borderRadius: "50%", border: `2px solid ${d.isDarkMode ? "var(--a-line)" : "#fff"}` }} />
            )}
          </button>

          {/* Notifications toggle */}
          <button className="kid-btn wiggle" onClick={() => d.notificationsEnabled ? d.disableNotifications() : d.enableNotifications()}
            style={{ width: 38, height: 38, borderRadius: 12, border: `1px solid ${col.border}`, background: d.notificationsEnabled ? "linear-gradient(135deg,#10b981,#059669)" : col.cardAlt, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            🔔
          </button>

        </header>

        {/* ── SCROLL AREA ── */}
        <main style={{ flex: 1, minWidth: 0, overflowY: chatFill ? "hidden" : "auto", display: chatFill ? "flex" : undefined, flexDirection: chatFill ? "column" : undefined, overflowX: "hidden", overscrollBehavior: "contain", padding: chatFill ? `10px ${wideTouch ? 20 : 10}px calc(74px + env(safe-area-inset-bottom, 0px))` : isMobile ? `14px ${wideTouch ? 20 : 12}px calc(86px + env(safe-area-inset-bottom, 0px))` : 24, position: "relative" }}>
          {!isMobile && d.activeTab !== "messages" && <DoodleBackdrop />}
          <div style={chatFill ? { position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : { position: "relative" }}>
          {/* Missed calls & new messages while away */}
          {!chatFill && <DashboardAlertsBar isDark={d.isDarkMode} onOpenMessages={() => d.setActiveTab("messages")} />}

          {/* Pending confirmation banner */}
          {d.pendingConfirmations.length > 0 && d.pendingConfirmations.map(conf => (
            <div key={conf.id} className="kid-card pop-in" style={{ background: d.isDarkMode ? "rgba(251,191,36,0.1)" : "#fffbeb", border: "2px solid #fbbf24", borderRadius: "20px", padding: "16px 20px", marginBottom: "16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "20px" }}>⚠️</span>
                  <strong style={{ color: d.isDarkMode ? "#fbbf24" : "#92400e", fontSize: "14px" }}>{t('dashboard.attendanceNeeded')}</strong>
                </div>
                <p style={{ margin: "0 0 4px", color: d.isDarkMode ? "#fcd34d" : "#b45309", fontSize: "13px" }}>
                  {t('dashboard.attendanceBody', { title: conf.title })}
                </p>
                <p style={{ margin: 0, color: d.isDarkMode ? "#f59e0b" : "#d97706", fontSize: "12px" }}>
                  ⏰ {t('dashboard.autoConfirm', { time: d.getTimeRemaining(conf.autoConfirmAt) })}
                </p>
              </div>
              <button className="kid-btn" onClick={() => { d.setSelectedConfirmation(conf); d.setShowConfirmationModal(true); }}
                style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#fff", border: "none", borderRadius: "14px", padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: "13px", flexShrink: 0 }}>
                {t('dashboard.review')}
              </button>
            </div>
          ))}

          {/* ══ DASHBOARD ══ */}
          {d.activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22, fontFamily: F }}>

              {/* Welcome banner — bright sunrise glow + the student's own crayon doodles */}
              <section className="fade-up" style={{ position: "relative", overflow: "hidden", background: col.card, border: `1px solid ${col.border}`, borderRadius: compact ? 20 : 24, padding: compact ? "16px 18px" : "26px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: compact ? 12 : 24, boxShadow: "var(--a-shadow)" }}>
                {!isMobile && <DoodleBannerArt />}
                <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 4px", background: "var(--a-accent-grad)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", display: "inline-block", fontSize: compact ? 12 : 14, fontWeight: 800 }}>{t('dashboard.greeting', { name: d.student.firstName })}</p>
                  <h1 style={{ margin: "0 0 6px", fontSize: compact ? 20 : 27, fontWeight: 900, letterSpacing: "-0.5px", lineHeight: 1.2, color: col.heading }}>{t('dashboard.heroTitle')}</h1>
                  <p style={{ margin: 0, fontSize: compact ? 11.5 : 14, fontWeight: 700, color: col.body }}>
                    {d.homeworkPending > 0 ? t('dashboard.homeworkDue', { count: d.homeworkPending }) : t('dashboard.noPendingHomework')} · {t('dashboard.classesLeft', { count: d.progress.classesRemaining })}
                  </p>
                </div>
                <div className="cat-amber" style={{ position: "relative", background: "color-mix(in srgb, var(--a-surface) 80%, transparent)", backdropFilter: "blur(8px)", border: "1px solid var(--cat-line)", borderRadius: compact ? 14 : 18, padding: compact ? "10px 14px" : "14px 22px", textAlign: "center", flexShrink: 0, boxShadow: "var(--a-shadow)" }}>
                  <div style={{ fontSize: compact ? 22 : 32 }}>🔥</div>
                  <div style={{ fontSize: compact ? 22 : 30, fontWeight: 900, marginTop: 2, color: col.heading, fontVariantNumeric: "tabular-nums" }}>{d.progress.streakDays}</div>
                  <div style={{ fontSize: compact ? 9 : 11, fontWeight: 800, letterSpacing: "0.1em", color: "var(--cat-ink)" }}>{t('dashboard.dayStreak')}</div>
                </div>
              </section>

              {/* Missed calls alert */}
              {missedCallCount > 0 && (
                <div style={{ background: d.isDarkMode ? "rgba(239,68,68,0.1)" : "#fff5f5", border: `2px solid ${d.isDarkMode ? "rgba(239,68,68,0.3)" : "#fecaca"}`, borderRadius: 20, padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#ef4444,#dc2626)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(239,68,68,0.35)" }}>
                    <PhoneMissed size={20} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: d.isDarkMode ? "#fca5a5" : "#dc2626", fontFamily: F }}>
                        {missedCallCount} {missedCallCount > 1 ? t('dashboard.missedCalls') : t('dashboard.missedCall')}
                      </h3>
                      <span style={{ fontSize: 11, color: col.muted, fontWeight: 600 }}>{t('dashboard.whileAway')}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {missedCalls.map((mc, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: d.isDarkMode ? "rgba(255,255,255,0.06)" : "#fff", border: `1px solid ${d.isDarkMode ? "rgba(239,68,68,0.2)" : "#fecaca"}`, borderRadius: 12, padding: "7px 12px" }}>
                          <div style={{ width: 30, height: 30, borderRadius: 10, background: "linear-gradient(135deg,#ef4444,var(--a-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                            {(mc.callerName?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: col.heading, lineHeight: 1.2 }}>{mc.callerName}</p>
                            <p style={{ margin: 0, fontSize: 10, color: col.muted, fontWeight: 600 }}>
                              {mc.callerRole === "teacher" ? t('common.teacher') : mc.callerRole === "admin" ? t('common.admin') : mc.callerRole} · {new Date(mc.at).toLocaleTimeString(dateLocale(), { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={clearMissedCalls} title={tr("sunshineShell.markAllAsSeen")} style={{ background: d.isDarkMode ? "rgba(255,255,255,0.08)" : "#fff", border: `1px solid ${d.isDarkMode ? "rgba(255,255,255,0.12)" : "#fecaca"}`, borderRadius: 10, padding: "6px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: col.muted, flexShrink: 0, fontFamily: F }}>
                    <X size={12} /> {t('dashboard.markSeen')}
                  </button>
                </div>
              )}

              {/* Stats row — topic tiles (solid icon in the topic colour + a corner wash) */}
              <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 14 }}>
                {[
                  { Icon: BookOpen,     n: d.progress.completedLessons, l: t('dashboard.stats.classesDone'),  cat: "green" },
                  { Icon: CalendarDays, n: d.progress.classesRemaining, l: t('dashboard.stats.classesLeft'),  cat: "sky"   },
                  { Icon: Award,        n: d.badges.length,             l: t('dashboard.stats.badgesEarned'), cat: "rose"  },
                  { Icon: Star,         n: d.progress.weeklyCompleted,  l: t('dashboard.stats.thisWeek'),     cat: "amber" },
                ].map((s, i) => (
                  <div key={i} className={`stat-card cat-${s.cat}`} style={{ position: "relative", overflow: "hidden", background: `radial-gradient(120% 90% at 100% 0%, var(--cat-soft) 0%, transparent 55%), ${col.card}`, borderRadius: 18, padding: compact ? "14px" : "16px 18px", border: `1px solid ${col.border}`, display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--a-shadow)" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--cat)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px -6px var(--cat)", flexShrink: 0 }}>
                      <s.Icon size={20} color="#fff" strokeWidth={2.2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: compact ? 24 : 26, fontWeight: 900, color: col.heading, letterSpacing: "-0.5px", lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
                      <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: col.muted }}>{s.l}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Classes + sidebar */}
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: 18 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Live classes */}
                  {d.activeClasses.length > 0 && (
                    <div className="kid-card" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                      <h2 style={{ margin: "0 0 14px", fontSize: 17, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}>
                        <Radio size={18} color="#ef4444" strokeWidth={2} /> {t('dashboard.liveAndSoon')}
                        <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 900 }}>{d.activeClasses.length}</span>
                      </h2>
                      <ActiveClasses activeClasses={d.activeClasses} onJoin={d.handleJoinClass} />
                    </div>
                  )}

                  {/* Upcoming */}
                  <div className="kid-card" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 24, padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}>
                        <CalendarDays size={18} color={col.accent} strokeWidth={2} /> {t('dashboard.upcomingClasses')}
                      </h2>
                      <button className="kid-btn" onClick={() => d.setActiveTab("schedule")} style={{ background: "transparent", border: "none", color: col.accent, fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                        {t('dashboard.viewAll')}
                      </button>
                    </div>
                    <UpcomingClasses upcomingClasses={d.upcomingClasses} onEnroll={() => d.showToast("Coming soon!")} />
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Today's goal / progress */}
                  <div className="kid-card" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 24, padding: 22 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}>
                      <Target size={17} color={col.accent} strokeWidth={2} /> {t('dashboard.myProgress')}
                    </h3>
                    <ProgressCard progress={d.progress} sunshine />
                  </div>

                  <StreakWidget isDarkMode={d.isDarkMode} onLoad={d.handleStreakLoaded} />

                  {/* Badges callout */}
                  <div className="kid-card" style={{ background: "radial-gradient(120% 100% at 100% 0%, color-mix(in srgb, #fbbf24 18%, transparent) 0%, transparent 60%), var(--a-surface)", border: `1px solid ${col.border}`, borderRadius: 20, padding: 22, boxShadow: "var(--a-shadow)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}><Award size={17} color={col.accent} strokeWidth={2} /> {t('dashboard.badges')}</h3>
                      <button className="kid-btn" onClick={() => d.setActiveTab("badges")} style={{ background: "transparent", border: "none", color: col.accent, fontWeight: 800, borderRadius: 10, cursor: "pointer", fontFamily: F, fontSize: 12 }}>{t('dashboard.seeAll')}</button>
                    </div>
                    {d.badges.length === 0 ? (
                      <p style={{ textAlign: "center", color: col.muted, fontSize: 13, fontWeight: 600, margin: 0 }}>{t('dashboard.noBadges')}</p>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                        {d.badges.slice(-4).map(b => (
                          <div key={b.id} title={b.name} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 34 }}>{b.icon}</div>
                            <p style={{ margin: "3px 0 0", fontSize: 10, fontWeight: 700, color: col.muted, maxWidth: 52 }}>{b.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {d.badges.length > 0 && (
                      <button className="kid-btn" onClick={() => d.shareAchievement("badge")} style={{ marginTop: 14, width: "100%", background: dashTheme.accentGradient, color: "#fff", border: "none", borderRadius: 14, padding: "10px 16px", fontWeight: 900, fontSize: 13, fontFamily: F, cursor: "pointer", boxShadow: `0 6px 14px ${dashTheme.tabShadow}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {t('dashboard.shareAchievement')}
                      </button>
                    )}
                  </div>

                  <div className="kid-card" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: 24, padding: 20 }}>
                    <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}><Bell size={17} color={col.accent} strokeWidth={2} /> {t('dashboard.notifications')}</h2>
                    <NotificationsCard notifications={d.notifications} onClearAll={() => d.setNotifications([])} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ HOMEWORK ══ */}
          {d.activeTab === "homework" && <StudentHomeworkTab studentInfo={d.student} isDarkMode={d.isDarkMode} />}

          {/* ══ QUIZ ══ */}
          {d.activeTab === "quiz" && <StudentQuizTab studentInfo={d.student} isDarkMode={d.isDarkMode} />}

          {/* ══ FLASHCARDS ══ */}
          {d.activeTab === "flashcards" && <FlashcardsTab isDarkMode={d.isDarkMode} />}

          {/* ══ PRONUNCIATION ══ */}
          {d.activeTab === "pronunciation" && <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><PronunciationTab isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CONVERSATION ══ */}
          {d.activeTab === "conversation" && <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><ConversationTab studentInfo={d.student} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CERTIFICATES ══ */}
          {d.activeTab === "certificates" && (
            <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <Suspense fallback={null}>
                <CertificatesTab isDarkMode={d.isDarkMode} />
              </Suspense>
            </div>
          )}

          {/* ══ BOOK A CLASS ══ */}
          {d.activeTab === "book-class" && (
            <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <Suspense fallback={null}>
                <BookingCalendarTab isDarkMode={d.isDarkMode} studentInfo={d.student} />
              </Suspense>
            </div>
          )}

          {/* ══ GROUP CLASSES ══ */}
          {d.activeTab === "group-classes" && (
            <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <Suspense fallback={null}>
                <GroupClassTab isDarkMode={d.isDarkMode} studentInfo={d.student} />
              </Suspense>
            </div>
          )}

          {/* ══ MESSAGES ══ */}
          {d.activeTab === "messages" && <div className="as-pink" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", overflow: "hidden", ...(chatFill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : null) }}><MessagesTab fill={chatFill} userRole="student" onUnreadCount={d.setUnreadMessages} /></div>}

          {/* ══ COMPLETED ══ */}
          {/* phones: no outer card + heading (the top bar says "Completed") — the list gets the width */}
          {d.activeTab === "completed-classes" && isMobile && (
            <StudentCompletedTab studentId={d.student.id} isDarkMode={d.isDarkMode} />
          )}
          {d.activeTab === "completed-classes" && !isMobile && (
            <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <h2 style={{ margin: "0 0 20px", fontSize: "22px", fontWeight: 900, color: col.heading, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle2 size={20} color={col.accent} strokeWidth={2} /> {t('dashboard.completedClasses')}</h2>
              <StudentCompletedTab studentId={d.student.id} isDarkMode={d.isDarkMode} />
            </div>
          )}

          {/* ══ CLASS REPORTS ══ */}
          {d.activeTab === "class-reports" && (
            <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <Suspense fallback={null}><ClassReportsTab isDarkMode={d.isDarkMode} /></Suspense>
            </div>
          )}

          {/* ══ SCHEDULE ══ */}
          {d.activeTab === "schedule" && <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}><StudentScheduleTab studentId={d.student.id} isDarkMode={d.isDarkMode} /></div>}

          {/* ══ CHARTS ══ */}
          {d.activeTab === "charts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : wideTouch ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: "14px" }}>
                {[
                  { icon: "📚", label: t('charts.totalClasses'), value: d.completedClasses.length,    color: "var(--a-accent-ink)" },
                  { icon: "🔥", label: t('charts.dayStreak'),    value: d.progress.streakDays,         color: "#ec4899" },
                  { icon: "⏱️", label: t('charts.totalHours'),   value: d.completedClasses.length > 0 ? Math.round(d.completedClasses.reduce((s,c) => s+c.duration,0)/60) : 0, color: "var(--a-accent-ink)" },
                ].map(({ icon, label, value, color }) => (
                  <div key={label} className="kid-card" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px", textAlign: "center" }}>
                    <div style={{ fontSize: "40px", marginBottom: "8px" }}>{icon}</div>
                    <div style={{ fontSize: "34px", fontWeight: 900, color, marginBottom: "4px" }}>{value}</div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: col.muted, textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
                  </div>
                ))}
              </div>
              {[{ title: t('charts.last7Days'), data: d.chartData.last7, type: "bar" }, { title: t('charts.last30Days'), data: d.chartData.last30, type: "line" }].map(({ title, data, type }) => (
                <div key={title} className="kid-card" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900, color: col.heading }}>{title}</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    {type === "bar"
                      ? <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={col.border}/><XAxis dataKey="date" stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><YAxis stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><RechartsTooltip contentStyle={tooltipStyle}/><Bar dataKey="classes" fill="var(--a-accent-ink)" radius={[8,8,0,0]} name={t('charts.classes')}/></BarChart>
                      : <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke={col.border}/><XAxis dataKey="date" stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><YAxis stroke={col.muted} style={{ fontFamily: F, fontSize: 11 }}/><RechartsTooltip contentStyle={tooltipStyle}/><Line type="monotone" dataKey="classes" stroke="var(--a-accent-ink)" strokeWidth={3} dot={{ fill:"var(--a-accent)", r:5 }} name={t('charts.classes')}/></LineChart>
                    }
                  </ResponsiveContainer>
                </div>
              ))}
              <div className="kid-card" style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 20px", fontSize: "18px", fontWeight: 900, color: col.heading }}>{t('charts.byTimeOfDay')}</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart><Pie data={d.chartData.timeDist} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({name,value})=>`${name}: ${value}`} labelLine={false}>{d.chartData.timeDist.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><RechartsTooltip contentStyle={tooltipStyle}/></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ══ BADGES ══ */}
          {d.activeTab === "badges" && (
            <BadgesTab badges={d.badges} progress={d.progress} completedClasses={d.completedClasses} col={col} isDarkMode={d.isDarkMode} shareAchievement={d.shareAchievement} accentGradient={dashTheme.accentGradient} tabShadow={dashTheme.tabShadow} fontFamily={dashTheme.font} />
          )}

          {d.activeTab === "recordings"  && <RecordingsTab  isDarkMode={d.isDarkMode} />}
          {d.activeTab === "reviews"     && <ReviewsTab     isDarkMode={d.isDarkMode} />}
          {d.activeTab === "referral"    && <ReferralTab    isDarkMode={d.isDarkMode} />}
          {d.activeTab === "leaderboard" && (
            <div style={{ background: col.card, border: `1px solid ${col.border}`, borderRadius: "24px", padding: "24px" }}>
              <LeaderboardTab isDarkMode={d.isDarkMode} />
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Share modal */}
      {d.showShareModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div className="pop-in kid-card" style={{ background: col.card, borderRadius: "28px", padding: "28px", maxWidth: "420px", width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: col.heading }}>{t('share.title')}</h3>
              <button className="kid-btn" onClick={() => d.setShowShareModal(false)} style={{ background: col.border, border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: col.body }}>✕</button>
            </div>
            <div style={{ background: "var(--a-accent-soft)", border: `2px solid ${"var(--a-accent-line)"}`, borderRadius: "18px", padding: "16px", marginBottom: "18px" }}>
              <h4 style={{ margin: "0 0 6px", fontWeight: 800, color: col.heading }}>{d.shareData?.title}</h4>
              <p style={{ margin: 0, fontSize: "14px", color: col.body, fontWeight: 600 }}>{d.shareData?.message}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button className="kid-btn" onClick={d.copyShareText} style={{ width: "100%", padding: "12px", border: `1px solid ${col.border}`, borderRadius: "16px", background: "transparent", color: col.heading, fontWeight: 800, cursor: "pointer", fontFamily: F, fontSize: "14px" }}>{t('share.copyClipboard')}</button>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[["twitter",t('share.twitter'),"#1DA1F2"],["facebook",t('share.facebook'),"#1877F2"],["whatsapp",t('share.whatsapp'),"#25D366"],["linkedin",t('share.linkedin'),"#0A66C2"]].map(([p,label,bg])=>(
                  <button key={p} className="kid-btn" onClick={()=>d.shareOnSocial(p)} style={{ padding:"11px", background:bg, color:"#fff", border:"none", borderRadius:"14px", fontWeight:800, cursor:"pointer", fontFamily:F, fontSize:"13px" }}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {d.showChangePassword    && <ChangePassword    onClose={() => d.setShowChangePassword(false)} onSuccess={() => { d.setShowChangePassword(false); d.showToast("Password changed! 🔒"); }} />}
      {d.showSessionManagement && <SessionManagement isOpen onClose={() => d.setShowSessionManagement(false)} userType="student" />}
      {d.showSettingsSidebar   && (
        <SettingsSidebar isOpen onClose={() => d.setShowSettingsSidebar(false)}
          onChangePassword={()=>{ d.setShowSettingsSidebar(false); d.setShowChangePassword(true); }}
          onManageSessions={()=>{ d.setShowSettingsSidebar(false); d.setShowSessionManagement(true); }}
          onManage2FA={()=>{ d.setShowSettingsSidebar(false); d.setShowSettingsModal(true); }}
          emailLanguageFor={d.student._id || d.student.id}
          userInfo={{ firstName: d.student.firstName, lastName: d.student.lastName, email: d.student.email }}
          isMobile={isMobile} forcedMode={forcedMode} onSetViewMode={setViewMode} tabletLayout />
      )}
      {d.showSettingsModal && <SettingsModal isOpen onClose={() => d.setShowSettingsModal(false)} userType="student" />}
      {d.showConfirmationModal && d.selectedConfirmation && (
        <ClassConfirmation booking={d.selectedConfirmation} isDarkMode={d.isDarkMode}
          onConfirm={()=>{ d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast("Class confirmed! ✅"); d.fetchStudentData(); }}
          onDispute={()=>{ d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); d.showToast("Dispute submitted."); d.fetchStudentData(); }}
          onClose={()=>{ d.setShowConfirmationModal(false); d.setSelectedConfirmation(null); }} />
      )}

      {/* Layout (mobile / desktop) is changed only in Settings → Display Mode, so a child
          can't flip it by accident from the dashboard itself. */}

      {/* ── MOBILE: floating glass tab bar ── */}
      {isMobile && (
        <nav className="ss-tabbar" aria-label={tr("sunshineShell.menu", "Main menu")}>
          {[
            { key: 'dashboard', Icon: Home,          label: tr("sunshineShell.home"),    cat: 'accent' },
            { key: 'homework',  Icon: BookOpen,      label: tr("sunshineShell.study"),   cat: 'sky' },
            { key: 'messages',  Icon: MessageCircle, label: tr("sunshineShell.chat"),    cat: 'pink' },
            { key: 'schedule',  Icon: CalendarDays,  label: tr("sunshineShell.classes"), cat: 'amber' },
          ].map(({ key, Icon, label, cat }) => {
            const isActive = d.activeTab === key;
            const badge = key === 'messages' ? (d.unreadMessages || 0) + (missedCallCount || 0) : 0;
            return (
              <button key={key} type="button" className={`ss-tab cat-${cat}`} aria-current={isActive ? 'page' : undefined}
                onClick={() => d.setActiveTab(key)}>
                <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                <span>{label}</span>
                {badge > 0 && <span className="ss-tab-badge">{badge > 99 ? '99+' : badge}</span>}
              </button>
            );
          })}
          <button type="button" className="ss-tab cat-stone" aria-haspopup="dialog" aria-expanded={showMobileMenu}
            onClick={() => setShowMobileMenu(true)}>
            <LayoutGrid size={21} strokeWidth={1.9} aria-hidden="true" />
            <span>{tr("sunshineShell.more")}</span>
          </button>
        </nav>
      )}

      {/* ── MOBILE: "More" sheet — every page as a tile + layout / theme / account ── */}
      {isMobile && showMobileMenu && (
        <div className="ss-sheet-wrap" role="dialog" aria-modal="true" aria-label={tr("sunshineShell.more")}>
          <button type="button" className="ss-sheet-backdrop" aria-label={tr("sunshineShell.close", "Close menu")} onClick={() => setShowMobileMenu(false)} />
          <div className="ss-sheet">
            <div className="ss-sheet-handle" aria-hidden="true" />

            <div className="ss-sheet-top">
              <div className="ss-sheet-avatar" aria-hidden="true">{(d.student.firstName?.[0] || 'S').toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: col.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.student.firstName} {d.student.lastName}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: col.muted }}>
                  {d.student.studentId ? `${d.student.studentId} · ` : ''}{t('sidebar.classesDone', { count: d.progress.completedLessons })}
                </div>
              </div>
              <button type="button" className="ss-sheet-close" aria-label={tr("sunshineShell.close", "Close menu")} onClick={() => setShowMobileMenu(false)}>
                <X size={18} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>

            {NAV_GROUPS.map((group, gi) => {
              const items = group.items.filter(item => !['dashboard', 'homework', 'messages', 'schedule'].includes(item.key));
              if (!items.length) return null;
              return (
                <section key={gi} aria-label={group.labelKey ? t(group.labelKey) : undefined}>
                  {group.labelKey && <p className="ss-sheet-label">{t(group.labelKey)}</p>}
                  <div className={`ss-sheet-grid cat-${GROUP_CAT[group.labelKey] || 'accent'}`}>
                    {items.map(item => {
                      const LI = item.lucide;
                      const isActive = d.activeTab === item.key;
                      return (
                        <button key={item.key} type="button" className="ss-sheet-tile" aria-current={isActive ? 'page' : undefined}
                          onClick={() => { d.setActiveTab(item.key); setShowMobileMenu(false); }}>
                          <span className="ss-sheet-chip"><LI size={19} strokeWidth={2.1} aria-hidden="true" /></span>
                          <span>{t(item.labelKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <p className="ss-sheet-label">{tr("sunshineShell.preferences", "Preferences")}</p>
            <div className="ss-sheet-card">
              <button type="button" className="ss-sheet-row" role="switch" aria-checked={d.isDarkMode} onClick={() => d.setIsDarkMode(v => !v)}>
                {d.isDarkMode ? <Moon size={18} color={col.muted} aria-hidden="true" /> : <Sun size={18} color={col.muted} aria-hidden="true" />}
                <span>{t('sidebar.darkMode')}</span>
                <span className="ss-switch" aria-hidden="true" style={{ background: d.isDarkMode ? 'var(--a-accent)' : 'var(--a-line-strong)' }}>
                  <i style={{ transform: `translateX(${d.isDarkMode ? 18 : 0}px)` }} />
                </span>
              </button>
              <div style={{ padding: '0 2px' }}><LanguageSwitcher col={col} fontFamily={F} /></div>
              <button type="button" className="ss-sheet-row" onClick={() => { setShowMobileMenu(false); d.setShowSettingsSidebar(true); }}>
                <Settings size={18} color={col.muted} aria-hidden="true" />
                <span>{t('sidebar.settings')}</span>
                <ChevronRight size={16} color={col.muted} style={{ marginLeft: 'auto' }} aria-hidden="true" />
              </button>
              <button type="button" className="ss-sheet-row" style={{ color: '#dc2626' }} onClick={d.handleLogout}>
                <LogOut size={18} aria-hidden="true" />
                <span>{t('sidebar.signOut')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
