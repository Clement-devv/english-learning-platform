import { useStudioTimezone } from './useStudioTimezone';
import { useUploadQueue } from '../../context/UploadQueueContext';
import { useStudioInstall } from './useStudioInstall';
import StudioLanguageSwitch from './StudioLanguageSwitch';
import { useStudioLanguage } from './useStudioLanguage';
import { studioText } from './studioLanguage';
import { useState, useRef, useEffect, useLayoutEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useLocation, useNavigationType } from 'react-router-dom';
import { BookOpen, Building2, Users, CalendarDays, Link2, Wallet, MessageCircle, LogOut, SunMoon, ArrowUpRight, GraduationCap, Video, Gamepad2, ListChecks, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { teacherModeKey, studioClassroomState } from '../../utils/teacherMode';
import './teacherMode.css';
const TeacherResources = lazy(() => import('./TeacherResources'));
const TeacherCalendar = lazy(() => import('./TeacherCalendar'));
const TeacherClassHistory = lazy(() => import('./TeacherClassHistory'));
import { joinGroupClass } from '../../components/groupClass/joinGroupClass';
const Reviews = lazy(() => import('../teacher/tabs/ReviewsTab'));
const Ratings = lazy(() => import('../teacher/tabs/RatingDashboardTab'));
const StudentProgress = lazy(() => import('../teacher/components/students/StudentProgressList'));
const Schedule = lazy(() => import('../teacher/tabs/ScheduleTab'));
const ClassSummaries = lazy(() => import('../teacher/tabs/ClassSummariesTab'));
import TeacherWorkspaceOverview from './TeacherWorkspaceOverview';
import TeacherGlassFooter from './TeacherGlassFooter';
const LessonsSection = lazy(() => import('./StudioManagementTabs').then(module => ({ default: module.LessonsSection })));
const EarningsSection = lazy(() => import('./StudioManagementTabs').then(module => ({ default: module.EarningsSection })));
const ConversationsSection = lazy(() => import('./StudioManagementTabs').then(module => ({ default: module.ConversationsSection })));
const CentersSection = lazy(() => import('./StudioDirectoryTabs').then(module => ({ default: module.CentersSection })));
const StudentsSection = lazy(() => import('./StudioDirectoryTabs').then(module => ({ default: module.StudentsSection })));
const TeacherParentLinks = lazy(() => import('./TeacherParentLinks'));
import './teacherStudioDirectories.css';
import { StudioIntro } from './StudioUI';
import './teacherStudioSections.css';
const Homework = lazy(() => import('../teacher/tabs/HomeworkTab'));
const Quiz = lazy(() => import('../teacher/tabs/QuizTab'));
const Games = lazy(() => import('../teacher/tabs/WordSquadTab'));
const Recordings = lazy(() => import('../teacher/tabs/RecordingsTab'));
const Vocab = lazy(() => import('../teacher/tabs/VocabTab'));
const Profile = lazy(() => import('../teacher/tabs/ProfileTab'));
const TwoFactorManagement = lazy(() => import('../../components/TwoFactorManagement'));
const SessionManagement = lazy(() => import('../../components/SessionManagement'));
const ChangePassword = lazy(() => import('../../components/teacher/auth/ChangePassword'));
const toolCopy = {
  homework: ['PRACTICE WITH PURPOSE', 'A little practice. A lot of progress.', 'Assign the next steps, review student work, and share feedback with families.'],
  quizzes: ['MAKE UNDERSTANDING VISIBLE', 'See how far they’ve come.', 'Create thoughtful questions, reuse your templates, and follow each student’s understanding.'],
  games: ['A LITTLE PLAY GOES A LONG WAY', 'Bring a little play to learning.', 'Build Word Squad question sets and give your students another way to practise.'],
  vocab: ['NEW WORDS. BIGGER POSSIBILITIES.', 'Help their vocabulary grow.', 'Keep useful words, definitions, and examples together, then assign them to your students.'],
  recordings: ['KEEP THE MOMENT. SHARE THE PROGRESS.', 'Their learning, worth keeping.', 'Organize classroom recordings and saved meeting links. Share the moments that matter with families.'],
};
const tabs = [
  ['overview', 'Overview', BookOpen], ['classes', 'Classes & updates', CalendarDays], ['centers', 'My centers', Building2],
  ['students', 'Students', Users], ['completed-classes', 'Completed classes', ShieldCheck],
  ['class-summaries', 'Class summaries', BookOpen], ['recordings', 'Recordings', Video], ['parent-links', 'Parent links', Link2],
  ['schedule', 'Schedule', CalendarDays], ['availability', 'Working hours & time off', CalendarDays],
  ['student-progress', 'Student progress', GraduationCap], ['reviews', 'Reviews', MessageCircle], ['ratings', 'Rating dashboard', ListChecks],
  ['homework', 'Homework', GraduationCap], ['quizzes', 'Quizzes', ListChecks],
  ['games', 'Games', Gamepad2], ['vocab', 'Vocabulary', BookOpen],
  ['resources', 'Teaching library', BookOpen],
  ['parents', 'Parent responses', Link2], ['earnings', 'Earnings', Wallet],
  ['messages', 'Message E.G.O', MessageCircle], ['profile', 'Profile & security', Users],
];

export default function TeacherModeDashboard({ liveBookingId, onReturnToClass } = {}) {

  useStudioLanguage('teacher');
  const auth = useAuth(), navigate = useNavigate(), location = useLocation();
  const [showSessions, setShowSessions] = useState(false), [showPassword, setShowPassword] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('teacherModeDark') === 'true');
  const navigationType = useNavigationType();
  useStudioInstall(dark);
  const { hasActiveUploads } = useUploadQueue();
  const [tab, setTab] = useState(() => {
    if (liveBookingId) return 'classes';
    const navigation = window.performance.getEntriesByType?.('navigation')[0];
    if (navigationType === 'POP' && navigation?.type === 'reload') return 'overview';
    const state = location.state;
    if (state?.classMissed) return 'completed-classes';
    if (state?.classCompleted) return 'class-summaries';
    const shortcuts = { payment: 'earnings', 'completed-classes': 'completed-classes', 'class-summaries': 'class-summaries', classes: 'classes' };
    return shortcuts[state?.activeTab] || (new URLSearchParams(location.search).get('tab') === 'games' ? 'games' : 'overview');
  });
  const [centerId, setCenterId] = useState('');
  const [centers, setCenters] = useState([]), [students, setStudents] = useState([]), [work, setWork] = useState([]), [earnings, setEarnings] = useState([]), [messages, setMessages] = useState([]);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [studentCenterFilter, setStudentCenterFilter] = useState('');
  const filteredStudents = students.filter(s => !centerId || String(s.managedCenterId) === centerId);
  const filteredWork = work.filter(w => !centerId || String(w.managedCenterId) === centerId);
  const pendingMaterials = {
    'class-summaries': filteredWork.filter(w => w.needsSummary).length,
    recordings: filteredWork.filter(w => w.needsRecording).length,
  };
  const current = centers.find(c => c._id === centerId);
  const activeRefresh = useRef(null);
  const failedPaths = useRef([]);
  const [refreshError, setRefreshError] = useState('');
  const needsEarnings = tab === 'earnings';
  const refresh = useCallback(async (options = {}) => {
    if (!teacherModeKey()) { navigate('/teacher-mode/login', { replace: true }); return; }
    if (options?.background && activeRefresh.current) return;
    activeRefresh.current?.abort();
    const controller = new AbortController();
    activeRefresh.current = controller;
    const sections = [
      ['/managed-centers', 'centers', setCenters], ['/managed-students', 'students', setStudents],
      ['/work', 'classes', setWork], ['/earnings', 'earnings', setEarnings], ['/messages', 'messages', setMessages],
    ].filter(([path]) => (path !== '/earnings' || needsEarnings) && (!options?.failedOnly || failedPaths.current.includes(path)));
    const results = await Promise.allSettled(sections.map(async ([path, , update]) => {
      const params = path === '/messages' && ['parents', 'messages'].includes(tab) ? { read: true, family: tab === 'parents' } : undefined;
      const response = await api.get(path, { signal: controller.signal, params });
      if (!controller.signal.aborted) update(response.data.data);
    }));
    if (controller.signal.aborted) return;
    activeRefresh.current = null;
    const failed = sections.filter((_, index) => results[index].status === 'rejected');
    failedPaths.current = failed.map(([path]) => path);
    setRefreshError(failed.length ? `Could not update ${failed.map(([, label]) => label).join(', ')}.` : '');
    setLoading(false);
  }, [navigate, needsEarnings, centerId, tab]);
  useEffect(() => {
    const resume = () => {
      if (!document.hidden && navigator.onLine !== false) void refresh({ background: true });
    };
    resume();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      activeRefresh.current?.abort();
      activeRefresh.current = null;
    };
  }, [refresh, tab]);
  useLayoutEffect(() => {
    if (teacherModeKey()) sessionStorage.setItem('teacherModeCenter', centerId);
    setRecipient('');
  }, [centerId]);
  const run = async action => { setBusy(true); setError(''); setNotice(''); try { await action(); await refresh(); setNotice(previous => previous || 'Saved to your workspace.'); } catch (e) { setError(e.response?.data?.message || e.message || 'Please retry.'); } finally { setBusy(false); } };
  const copy = async url => { try { await navigator.clipboard.writeText(url); setNotice('Parent link copied. Share it privately with the family.'); } catch { setNotice(`Copy this private link: ${url}`); } };
  const teacherInfo = auth.user || JSON.parse(sessionStorage.getItem('teacherInfo') || '{}');
  useStudioTimezone(teacherInfo, auth.setUser, setNotice);
  const props = { teacherInfo, students: filteredStudents.map(s => ({ ...s, isManaged: true })), isDarkMode: dark, studio: true };
  const unreadParents = messages.filter(m => m.sender === 'family' && !m.readAt).length;
  const switchTab = (id, options = {}) => {
    setTab(id); setRecipient(''); setNotice('');
    if (id === 'students') setStudentCenterFilter(options.centerId || '');
    document.getElementById('teacher-workspace-content')?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
  };
  const toggleDark = () => { setDark(!dark); localStorage.setItem('teacherModeDark', String(!dark)); };
  return <main className="tm tm-shell" data-dark={dark} data-section={tab}>
    {teacherInfo.inspection && <div role="status" style={{ position: 'fixed', zIndex: 9999, top: 0, left: '50%', transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: '0 0 12px 12px', background: '#283d32', color: '#fff', boxShadow: '0 4px 16px #0003' }}>Super Admin view · Read-only · Session expires in 10 minutes <button type="button" style={{ marginLeft: 12, color: '#fff', background: 'transparent', border: '1px solid #ffffff99', borderRadius: 6, padding: '4px 9px' }} onClick={() => { sessionStorage.removeItem('teacherToken'); sessionStorage.removeItem('teacherInfo'); window.close(); }}>Exit view</button></div>}
    <a className="tm-skip-link" href="#teacher-workspace-content">Skip to workspace</a>
    <aside className="tm-sidebar">
      <a className="tm-brand" href="/teacher-mode/dashboard"><img src="/ego-studio/icon-192.png" width="40" height="40" alt="" style={{ borderRadius: 9 }} /><span className="tm-brand-name">E.G.O<span>THE TEACHER STUDIO</span></span></a>
      <div className="tm-studio-badge"><span className="tm-status-dot" />{studioText("Independent workspace")}</div>
      <nav aria-label="Teacher workspace">{tabs.map(([id, label, Icon]) => <div className="tm-nav-item" key={id}>{['overview', 'homework', 'parents'].includes(id) && <span className="tm-nav-label">{id === 'overview' ? 'YOUR WORKSPACE' : id === 'homework' ? 'TEACHING TOOLS' : 'CONNECTIONS & BUSINESS'}</span>}<button className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => switchTab(id)}><Icon size={17} strokeWidth={1.6} /><span>{studioText(label)}</span>{pendingMaterials[id] > 0 && <span className="tm-material-reminder" aria-label={pendingMaterials[id] + ' classes to share with families'}>{pendingMaterials[id]}</span>}{id === 'parents' && unreadParents > 0 && <span className="tm-unread-count">{unreadParents}</span>}</button></div>)}</nav>
      <div className="tm-sidebar-bottom"><div className="tm-sidebar-note"><span className="tm-eyebrow">A WINDOW INTO LEARNING</span><p>Great teaching.<br />Worth sharing.</p><button onClick={() => switchTab('parent-links')}>{studioText("Create a parent link")}<ArrowUpRight size={14} /></button></div>
      <div className="tm-sidebar-controls"><StudioLanguageSwitch /><button onClick={toggleDark} aria-label={dark ? 'Switch to light appearance' : 'Switch to dark appearance'}><SunMoon size={16} />{studioText(dark ? 'Evening' : 'Daylight')}</button><button aria-label="Sign out" disabled={!!liveBookingId} title={liveBookingId ? "Return to your classroom and end the class before signing out." : undefined} onClick={() => { auth.logout(); sessionStorage.removeItem('teacherModeCenter'); navigate('/teacher-mode/login'); }}><LogOut size={16} />{studioText("Sign out")}</button></div>
      <button className="tm-account" onClick={() => switchTab('profile')}><span className="tm-avatar">{teacherInfo.firstName?.slice(0, 1) || 'T'}</span><span><strong>{[teacherInfo.firstName, teacherInfo.lastName].filter(Boolean).join(' ') || 'My account'}</strong><small>Independent teacher</small></span><ArrowUpRight size={15} /></button></div>
    </aside>
    <section className="tm-main" id="teacher-workspace-content" tabIndex={-1}>
      <header className="tm-header"><div><span className="tm-eyebrow">YOUR SPACE TO MAKE A DIFFERENCE</span><h1>{tab === 'overview' ? studioText('The teacher studio') : studioText(tabs.find(t => t[0] === tab)?.[1])}</h1></div><div className="tm-header-controls"><button type="button" disabled={busy || hasActiveUploads || !!liveBookingId} title={liveBookingId ? "Return to your classroom and finish the class before refreshing." : hasActiveUploads ? "Wait for recording uploads to finish before refreshing." : undefined} onClick={() => window.location.reload()}><RefreshCw size={16} aria-hidden="true" />{studioText("Refresh page")}</button><span className="tm-header-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span>{!['students', 'parent-links'].includes(tab) && <label><span>{studioText("Workspace view")}</span><select value={centerId} onChange={e => setCenterId(e.target.value)}><option value="">{studioText("All centers")}</option>{centers.map(c => <option key={c._id} value={c._id}>{c.name}{c.archived ? ' · archived' : ''}</option>)}</select></label>}</div></header>
      {error && <div role="alert" className="tm-notice tm-error">{error}</div>}{refreshError && <div role="alert" className="tm-notice tm-error">{refreshError} <button onClick={() => refresh({ failedOnly: true })}>Retry</button></div>}{notice && <p role="status" className="tm-notice">{notice}</p>}{loading ? <div className="tm-card" role="status">Loading your workspace…</div> : <Suspense fallback={<div className="tm-card" role="status">Loading tab…</div>}>
      {tab === 'overview' && <TeacherWorkspaceOverview teacher={teacherInfo} centers={centers} students={filteredStudents} work={filteredWork} messages={messages.filter(m => !centerId || filteredStudents.some(s => s._id === m.studentId))} onNavigate={switchTab} />}
      {tab === 'centers' && <CentersSection centers={centers} students={students} busy={busy} run={run} onViewStudents={id => switchTab('students', { centerId: id })} />}
      {tab === 'students' && <StudentsSection centers={centers} students={students} busy={busy} run={run} refresh={refresh} centerFilter={studentCenterFilter} onCenterFilter={setStudentCenterFilter} />}
      {tab === 'parent-links' && <TeacherParentLinks centers={centers} students={students} busy={busy} run={run} copy={copy} onOpenTool={(kind, id) => { setCenterId(String(id)); switchTab({ homework: 'homework', quiz: 'quizzes', game: 'games', recording: 'recordings' }[kind]); }} />}
      {tab === 'classes' && <LessonsSection key={centerId} centerId={centerId} center={current} centers={centers} students={filteredStudents} work={filteredWork} busy={busy} run={run} refresh={refresh} onNavigate={switchTab} onCenterChange={setCenterId} isDarkMode={dark} liveBookingId={liveBookingId} onJoin={b => liveBookingId ? onReturnToClass() : b.isGroupClass ? joinGroupClass(b, { before: () => b.status === 'in-progress' ? Promise.resolve() : api.patch(`/group-classes/${b._id}/start`), onAgora: c => navigate('/classroom', { state: studioClassroomState(c, teacherInfo) }), onError: setError }).then(refresh) : navigate('/classroom', { state: studioClassroomState(b, teacherInfo) })} />}
      {['reviews', 'ratings', 'student-progress'].includes(tab) && <Suspense fallback={<p role="status">Loading teaching tools…</p>}><div className="tm-tool">{tab === 'reviews' ? <Reviews key={centerId} {...props} /> : tab === 'ratings' ? <Ratings key={centerId} isDarkMode={dark} /> : <StudentProgress isDarkMode={dark} students={filteredStudents.map(s => ({ ...s, id: s._id, name: [s.firstName, s.lastName].filter(Boolean).join(' '), paidProgress: (s.classesUsed || 0) + "/" + ((s.classesUsed || 0) + (s.classCredits || 0)), progress: s.classCredits, assignedDate: s.createdAt }))} />}</div></Suspense>}
      {tab === 'completed-classes' && <TeacherClassHistory refreshKey={work} onChanged={refresh} teacherInfo={teacherInfo} centerId={centerId} centers={centers} onCenterChange={setCenterId} onNavigate={switchTab} />}
      {['class-summaries', 'availability'].includes(tab) && <Suspense fallback={<p role="status">Loading teaching tools…</p>}><div className="tm-tool">{tab === 'class-summaries' ? <ClassSummaries key={centerId} studio isDarkMode={dark} /> : <Schedule teacherInfo={teacherInfo} isDarkMode={dark} students={filteredStudents} studio />}</div></Suspense>}
      {tab === 'schedule' && <TeacherCalendar work={filteredWork} centers={centers} onLesson={() => switchTab('classes')} />}
      {tab === 'profile' && <><StudioIntro eyebrow="THE PERSON BEHIND THE PROGRESS" title="Your profile. Your peace of mind.">Make this space yours, and keep your account secure.</StudioIntro><Suspense fallback={<div className="tm-card" role="status">Loading profile…</div>}><div className="tm-tool tm-tool-profile"><Profile studio teacherInfo={teacherInfo} isDarkMode={dark} onUpdate={user => auth.setUser(user)} /></div><section className="tm-card tm-security-settings"><div className="tm-form-heading"><span className="tm-round-icon"><ShieldCheck size={19} /></span><div><span className="tm-eyebrow">YOUR WORKSPACE, PROTECTED</span><h3>Account security</h3></div></div><div className="tm-security-actions"><div><strong>Password & devices</strong><p>Keep your password fresh and check where you’re signed in.</p></div><div className="tm-actions"><button onClick={() => setShowPassword(true)}>Change password</button><button onClick={() => setShowSessions(true)}>Manage devices</button></div></div><TwoFactorManagement userType="teacher" /></section><div className="tm-studio-dialogs">{showSessions && <SessionManagement isOpen onClose={() => setShowSessions(false)} />}{showPassword && <ChangePassword onClose={() => setShowPassword(false)} onSuccess={() => { auth.logout(); navigate('/teacher-mode/login', { replace: true }); }} />}</div></Suspense></>}
      {tab === 'resources' && <TeacherResources centerId={centerId} archived={current?.archived} />}
      {['homework', 'quizzes', 'games', 'recordings', 'vocab'].includes(tab) && <><StudioIntro eyebrow={toolCopy[tab][0]} title={toolCopy[tab][1]}>{toolCopy[tab][2]}</StudioIntro><div className={`tm-tool tm-tool-${tab}`}><Suspense fallback={<div className="tm-card" role="status">Loading teaching tools…</div>}>{tab === 'homework' && <Homework key={centerId} {...props} />}{tab === 'quizzes' && <Quiz key={centerId} {...props} />}{tab === 'games' && <Games key={centerId} isDarkMode={dark} />}{tab === 'recordings' && <Recordings key={centerId} isDarkMode={dark} studio onVisibilityChange={refresh} />}{tab === 'vocab' && <Vocab key={centerId} {...props} />}</Suspense></div></>}
      {tab === 'earnings' && <EarningsSection earnings={earnings} onCenterChange={setCenterId} centerId={centerId} center={current} busy={busy} run={run} onNavigate={switchTab} />}
      {['parents', 'messages'].includes(tab) && <ConversationsSection key={tab} platform={tab === 'messages'} students={filteredStudents} messages={messages.filter(m => !m.studentId || filteredStudents.some(s => s._id === m.studentId))} recipient={recipient} setRecipient={setRecipient} busy={busy} run={run} />}
      </Suspense>}<TeacherGlassFooter compact={tab !== 'overview'} onNavigate={switchTab} dark={dark} onToggleDark={toggleDark} /></section></main>;
}
