// src/pages/teacher/dashboard-shells/useTeacherDashboardData.js
// Shared data hook for all teacher dashboard shells.
// Mirrors the pattern of useDashboardData.js used by student shells.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
import { io } from 'socket.io-client';
import api from '../../../api';
import { useDarkMode } from '../../../hooks/useDarkMode';
import { getUserTimezone } from '../../../utils/timezone';
import { pushSupported, enablePush, disablePush, getPushStatus } from '../../../utils/pushNotifications';
import { getAssignedStudents } from '../../../services/teacherStudentService';
import { useLiveRefresh, refreshStale } from '../../../hooks/useLiveData';

// A pending parent dispute on a completed class (managed student): drives the red heartbeat warning
const parentDisputeOf = (b) =>
  b.parentCheck?.status === "denied" && b.disputeStatus === "pending"
    ? { deadline: b.parentCheck.disputeDeadline, comment: b.parentCheck.comment || "" }
    : null;
import {
  getTeacherBookings,
  acceptBooking,
  rejectBooking,
  deleteBooking,
  cancelBooking,
} from '../../../services/bookingService';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

// Data refresh is event-driven (hooks/useLiveData.js): the server pushes
// "data-changed" after any write that affects this teacher, so pending requests,
// classes, students and badge counts update within ~1s — plus on returning to the
// browser tab, on switching dashboard tab (if older than 30s), and a 5-minute
// safety refresh. TICK_MS only drives the client-side "LIVE" status (no API).
const TICK_MS = 30_000;

function classStatus(scheduledTime) {
  const diff = new Date(scheduledTime) - Date.now();
  if (diff < -3_600_000)  return 'completed';
  if (diff < 0)            return 'live';
  if (diff < 900_000)      return 'upcoming-soon';
  return 'scheduled';
}

export function useTeacherDashboardData() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user: authUser, setUser: setAuthUser, logout: authLogout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [teacherInfo,    setTeacherInfo]    = useState(null);
  const [activeTab,      setActiveTab]      = useState('dashboard');
  const [toast,          setToast]          = useState('');
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [mounted,        setMounted]        = useState(false);
  const [loading,        setLoading]        = useState(true);

  // ── Data ───────────────────────────────────────────────────────────────────
  const [students,          setStudents]          = useState([]);
  const [bookings,          setBookings]          = useState([]);
  const [classes,           setClasses]           = useState([]);
  // The Completed tab pages its own history from the server; the dashboard only
  // needs the total (stat cards) and a key to tell the tab to reload.
  const [completedCount,    setCompletedCount]    = useState(0);
  const [completedReloadKey, setCompletedReloadKey] = useState(0);
  const loadCompletedCount = useCallback(async (teacherId) => {
    try {
      const { data } = await api.get(`/bookings/teacher/${teacherId}/history`, { params: { limit: 1 } });
      setCompletedCount(data.counts?.completed ?? 0);
    } catch { /* silent */ }
  }, []);
  const [googleMeetLink,    setGoogleMeetLink]     = useState('');
  const [zoomLink,          setZoomLink]           = useState('');

  // ── Badge counts ───────────────────────────────────────────────────────────
  const [homeworkToGrade,   setHomeworkToGrade]   = useState(0);
  const [quizAttempted,     setQuizAttempted]     = useState(0);
  const prevHomeworkRef = useRef(null);
  const prevQuizRef     = useRef(null);

  // ── Classroom overlay ──────────────────────────────────────────────────────
  const [isClassroomOpen,   setIsClassroomOpen]   = useState(false);
  const [activeClass,       setActiveClass]       = useState(null);

  // ── Push notifications ─────────────────────────────────────────────────────
  const [pushEnabled,       setPushEnabled]       = useState(false);
  const [unreadMessages,    setUnreadMessages]    = useState(0);

  // ── Modal visibility ───────────────────────────────────────────────────────
  const [showChangePassword,     setShowChangePassword]     = useState(false);
  const [showSessionManagement,  setShowSessionManagement]  = useState(false);
  const [showSettingsSidebar,    setShowSettingsSidebar]    = useState(false);
  const [showSettingsModal,      setShowSettingsModal]      = useState(false);
  const [showGoogleMeetSettings, setShowGoogleMeetSettings] = useState(false);
  const [showRecurringForm,      setShowRecurringForm]      = useState(false);
  const [isModalOpen,            setIsModalOpen]            = useState(false);
  const [confirmModal,           setConfirmModal]           = useState({ open: false, type: null, classId: null });

  // ── Push status for THIS device (asking is done by DeviceNotificationPrompt) ─
  useEffect(() => {
    if (!pushSupported()) return;
    getPushStatus().then(setPushEnabled);
  }, []);

  // ── Socket connection — real-time messages and booking events ──────────────
  useEffect(() => {
    const token = sessionStorage.getItem('teacherToken') || localStorage.getItem('teacherToken');
    if (!token) return;

    let socket = null;
    let cancelled = false;

    const tid = setTimeout(() => {
      if (cancelled) return;
      socket = io(SOCKET_URL, { transports: ['websocket'], auth: { token } });
      socket.on('connect', () => { socket.emit('join-teacher-room'); });
      socket.on('new-direct-message', ({ senderName, message }) => {
        setUnreadMessages(prev => prev + 1);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`💬 Message from ${senderName}`, { body: message, icon: '/favicon.ico' });
        }
      });
      socket.on('new-group-message', ({ senderName }) => {
        setUnreadMessages(prev => prev + 1);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`💬 Group message from ${senderName || 'Someone'}`, { icon: '/favicon.ico' });
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(tid);
      if (socket) { socket.removeAllListeners(); socket.disconnect(); }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session guard: re-verify when tab becomes visible (catches force-logout from another device) ──
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        api.get('/auth/verify').catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ── Unread messages count — fetch on mount (DMs + group chats) ─────────────
  // Both fetches run in parallel so the badge is accurate on first paint even
  // when the user was offline and messages arrived while they were logged out.
  useEffect(() => {
    Promise.all([
      api.get('/direct-messages').catch(() => ({ data: {} })),
      api.get('/group-chats').catch(() => ({ data: {} })),
    ]).then(([{ data: dmData }, { data: gcData }]) => {
      const dmTotal = (dmData.dms   || []).reduce((sum, dm)   => sum + (dm.unreadCount?.teacher  || 0), 0);
      const gcTotal = (gcData.chats || []).reduce((sum, chat) => sum + (chat.unreadCount?.teacher || 0), 0);
      setUnreadMessages(dmTotal + gcTotal);
    });
  }, []);

  useEffect(() => {
    if (activeTab === 'messages') setUnreadMessages(0);
  }, [activeTab]);

  async function togglePush() {
    if (pushEnabled) {
      await disablePush();
      setPushEnabled(false);
      showToast('Notifications disabled');
    } else {
      const { ok, reason } = await enablePush();
      if (ok) {
        setPushEnabled(true);
        showToast('🔔 Notifications enabled! You\'ll be reminded before class.');
      } else if (reason === 'denied') {
        showToast('Notifications blocked — allow them in browser settings.', 'error');
      } else {
        showToast('Could not enable notifications.', 'error');
      }
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    const teacherData = authUser || {};
    if (!teacherData._id && !teacherData.id) {
      navigate('/teacher/login');
      return;
    }
    setTeacherInfo(teacherData);
    fetchTeacherData();
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Post-class navigation ──────────────────────────────────────────────────
  useEffect(() => {
    if (location.state?.classCompleted) {
      setActiveTab(location.state.activeTab || 'payment');
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.classMissed) {
      setActiveTab(location.state.activeTab || 'completed-classes');
      navigate(location.pathname, { replace: true, state: {} });
    } else if (location.state?.activeTab) {
      // Direct tab navigation (e.g. from classroom "Manage links in Profile" link)
      setActiveTab(location.state.activeTab);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.classCompleted, location.state?.classMissed, location.state?.activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Homework badge ─────────────────────────────────────────────────────────
  const checkHomework = useCallback(async () => {
      try {
        const { data } = await api.get('/homework/my', { params: { limit: 1 } }); // counts only
        const toGrade = data.counts?.submitted ?? 0;
        setHomeworkToGrade(toGrade);
        if (prevHomeworkRef.current !== null && toGrade > prevHomeworkRef.current) {
          const diff = toGrade - prevHomeworkRef.current;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📬 Homework Submitted!', {
              body: `${diff} student${diff > 1 ? 's have' : ' has'} submitted homework for you to grade.`,
              icon: '/favicon.ico',
            });
          }
        }
        prevHomeworkRef.current = toGrade;
      } catch { /* silent */ }
  }, []);
  useEffect(() => { checkHomework(); }, [checkHomework]);

  // ── Quiz badge ─────────────────────────────────────────────────────────────
  const checkQuizzes = useCallback(async () => {
      try {
        const { data } = await api.get('/quiz/my', { params: { limit: 1 } }); // counts only
        const attempted = data.counts?.attempted ?? 0;
        setQuizAttempted(attempted);
        if (prevQuizRef.current !== null && attempted > prevQuizRef.current) {
          const diff = attempted - prevQuizRef.current;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📝 Quiz Completed!', {
              body: `${diff} student${diff > 1 ? 's have' : ' has'} completed a quiz.`,
              icon: '/favicon.ico',
            });
          }
        }
        prevQuizRef.current = attempted;
      } catch { /* silent */ }
  }, []);
  useEffect(() => { checkQuizzes(); }, [checkQuizzes]);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(''), 3000);
  };

  // ── Heartbeat helpers ──────────────────────────────────────────────────────
  // These run silently in the background (no setLoading) so the UI doesn't flash.

  const teacherIdRef = useRef(null); // kept up to date after first successful fetch

  // Re-fetch pending booking requests. Notifies teacher if a new one arrives.
  const refreshPending = useCallback(async () => {
    const teacherId = teacherIdRef.current;
    if (!teacherId) return;
    try {
      const pendingData = await getTeacherBookings(teacherId, 'pending');
      setBookings(prev => {
        const prevIds = new Set(prev.map(b => b.id));
        const next    = pendingData.map(booking => {
          const scheduledDate = new Date(booking.scheduledTime);
          return {
            id:             booking._id,
            name:           `${booking.studentId.firstName} ${booking.studentId.lastName}`,
            studentId:      booking.studentId._id,
            studentName:    `${booking.studentId.firstName} ${booking.studentId.lastName}`,
            isManaged:      !!booking.studentId.isManaged,
            classTitle:     booking.classTitle,
            topic:          booking.topic,
            time:           scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
            duration:       booking.duration,
            notes:          booking.notes,
            status:         booking.status,
            isAdminBooking: booking.createdBy === 'admin',
            scheduledTime:  booking.scheduledTime,
            rawDate:        scheduledDate,
            teacherTimezone: booking.teacherTimezone || '',
            studentTimezone: booking.studentTimezone || '',
          };
        });
        // Notify for each genuinely new booking
        next.forEach(b => {
          if (!prevIds.has(b.id) && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('📅 New Booking Request', {
              body: `${b.name} wants to book "${b.classTitle}"`,
              icon: '/favicon.ico',
            });
          }
        });
        return next;
      });
    } catch { /* silent — heartbeat failures shouldn't interrupt the teacher */ }
  }, []);

  // Re-fetch accepted classes. Updates status (scheduled/live/past) from server.
  const refreshActive = useCallback(async () => {
    const teacherId = teacherIdRef.current;
    if (!teacherId) return;
    try {
      const acceptedData = await getTeacherBookings(teacherId, 'accepted');
      const classesMap   = new Map();
      acceptedData.forEach(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (classesMap.has(groupKey)) {
          const e = classesMap.get(groupKey);
          e.students.push(`${booking.studentId.firstName} ${booking.studentId.lastName}`);
          e.bookingIds.push(booking._id);
        } else {
          classesMap.set(groupKey, {
            id:            booking._id,
            title:         booking.classTitle,
            topic:         booking.topic || 'Scheduled Lesson',
            time:          scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            date:          scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            fullDateTime:  scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
            scheduledTime: booking.scheduledTime,
            scheduledDate,
            status:        classStatus(booking.scheduledTime),
            students:      [`${booking.studentId.firstName} ${booking.studentId.lastName}`],
            duration:      booking.duration,
            notes:         booking.notes,
            bookingId:     booking._id,
            bookingIds:    [booking._id],
          });
        }
      });
      const activeArr = [];
      classesMap.forEach(cls => { if (cls.status !== 'completed') activeArr.push(cls); });
      setClasses(activeArr);
    } catch { /* silent */ }
  }, []);

  // Re-fetch completed classes so admin approvals / rejections appear automatically.
  const refreshCompleted = useCallback(async () => {
    const teacherId = teacherIdRef.current;
    if (!teacherId) return;
    try {
      await loadCompletedCount(teacherId);
      setCompletedReloadKey(k => k + 1);
    } catch { /* silent */ }
  }, [loadCompletedCount]);

  // Re-fetch assigned students so new assignments appear automatically.
  const refreshStudents = useCallback(async () => {
    const teacherId = teacherIdRef.current;
    if (!teacherId) return;
    try {
      const studentsData = await getAssignedStudents(teacherId);
      setStudents(studentsData.map(item => ({
        _id:          item.student._id,
        id:           item.student._id,
        firstName:    item.student.firstName,
        lastName:     item.student.lastName || '',
        classCredits: item.student.classCredits || 0,
        name:         `${item.student.firstName} ${item.student.lastName || ''}`.trim(),
        isManaged:    !!item.student.isManaged,   // no-login student run by admin
        email:        item.student.email,
        status:       item.student.active ? 'Active' : 'Inactive',
        progress:     item.student.classCredits || 0,
        active:       item.student.active,
        age:          item.student.age || null,
        dateOfBirth:  item.student.dateOfBirth || null,
        rank:         item.student.rank || '',
        studentId:    item.student.studentId || null,
        assignmentId: item.assignmentId,
        assignedDate: item.assignedDate,
      })));
    } catch { /* silent */ }
  }, []);

  // ── Live refresh (replaces the old 30s–5min polling) ──────────────────────
  // Each loader runs when the server says that resource changed, when the
  // teacher comes back to the browser tab, or on the 5-minute safety refresh.
  const liveId = authUser?._id || authUser?.id || 'me';
  const [dataReady, setDataReady] = useState(false);
  const live = { enabled: dataReady };
  useLiveRefresh(['bookings', 'teacher', liveId, 'pending'],   refreshPending,   live);
  useLiveRefresh(['classes',  'teacher', liveId, 'accepted'],  refreshActive,    live);
  useLiveRefresh(['classes',  'teacher', liveId, 'completed'], refreshCompleted, live);
  useLiveRefresh(['students', 'teacher', liveId],              refreshStudents,  live);
  useLiveRefresh(['homework', 'teacher', liveId, 'count'],     checkHomework,    live);
  useLiveRefresh(['quizzes',  'teacher', liveId, 'count'],     checkQuizzes,     live);

  // Switching dashboard tab shows cached data at once and refreshes anything
  // older than 30s in the background — no more stale screens until reload.
  useEffect(() => {
    if (!dataReady) return;
    ['bookings', 'classes', 'students', 'homework', 'quizzes'].forEach(r => refreshStale([r, 'teacher', liveId]));
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Class-status ticker (client-side, no API) ─────────────────────────────
  // Re-derives scheduled/live/upcoming-soon/completed purely from the current
  // time. Runs every 30s so the "LIVE" indicator turns on automatically.
  useEffect(() => {
    const id = setInterval(() => {
      setClasses(prev => {
        if (!prev.length) return prev;
        const updated = prev.map(cls => ({ ...cls, status: classStatus(cls.scheduledTime) }));
        // Only trigger a re-render if something actually changed
        const changed = updated.some((cls, i) => cls.status !== prev[i].status);
        return changed ? updated.filter(cls => cls.status !== 'completed') : prev;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // ── Fetch all teacher data ─────────────────────────────────────────────────
  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      const teacherData = authUser || {};
      const teacherId = teacherData._id || teacherData.id;
      setGoogleMeetLink(teacherData.googleMeetLink || '');
      setZoomLink(teacherData.zoomLink || '');
      if (!teacherId) throw new Error('No teacher ID found');
      teacherIdRef.current = teacherId; // make available to heartbeat helpers

      api.patch(`/teachers/${teacherId}/timezone`, { timezone: getUserTimezone() }).catch(() => {});

      const { data: apiTeacherData } = await api.get(`/teachers/${teacherId}`);
      setTeacherInfo(apiTeacherData);
      setGoogleMeetLink(apiTeacherData.googleMeetLink || '');
      setZoomLink(apiTeacherData.zoomLink || '');
      // Sync refreshed profile back into the global auth context + storage
      setAuthUser(apiTeacherData);

      const [studentsData, pendingData, acceptedData] = await Promise.all([
        getAssignedStudents(teacherId),
        getTeacherBookings(teacherId, 'pending'),
        getTeacherBookings(teacherId, 'accepted'),
        loadCompletedCount(teacherId),
      ]);

      // Students
      setStudents(studentsData.map(item => ({
        _id:          item.student._id,
        id:           item.student._id,
        firstName:    item.student.firstName,
        lastName:      item.student.lastName || '',
        classCredits:  item.student.classCredits || 0,
        name:         `${item.student.firstName} ${item.student.lastName || ''}`.trim(),
        isManaged:    !!item.student.isManaged,   // no-login student run by admin
        email:        item.student.email,
        status:       item.student.active ? 'Active' : 'Inactive',
        progress:     item.student.classCredits || 0,
        active:       item.student.active,
        age:          item.student.age || null,
        dateOfBirth:  item.student.dateOfBirth || null,
        rank:         item.student.rank || '',
        studentId:    item.student.studentId || null,
        assignmentId: item.assignmentId,
        assignedDate: item.assignedDate,
      })));

      // Pending bookings
      setBookings(pendingData.map(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        return {
          id:             booking._id,
          name:           `${booking.studentId.firstName} ${booking.studentId.lastName}`,
          studentId:      booking.studentId._id,
          studentName:    `${booking.studentId.firstName} ${booking.studentId.lastName}`,
          isManaged:      !!booking.studentId.isManaged,
          classTitle:     booking.classTitle,
          topic:          booking.topic,
          time:           scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
          duration:       booking.duration,
          notes:          booking.notes,
          status:         booking.status,
          isAdminBooking: booking.createdBy === 'admin',
          scheduledTime:  booking.scheduledTime,
          rawDate:        scheduledDate,
          teacherTimezone: booking.teacherTimezone || '',
          studentTimezone: booking.studentTimezone || '',
        };
      }));

      // Active classes from accepted bookings
      const classesMap = new Map();
      acceptedData.forEach(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        const timeDiff      = scheduledDate - new Date();
        let status = 'scheduled';
        if      (timeDiff < -3600000)                 status = 'completed';
        else if (timeDiff < 0 && timeDiff > -3600000) status = 'live';
        else if (timeDiff > 0 && timeDiff < 900000)   status = 'upcoming-soon';
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (classesMap.has(groupKey)) {
          const existing = classesMap.get(groupKey);
          existing.students.push(`${booking.studentId.firstName} ${booking.studentId.lastName}`);
          existing.bookingIds.push(booking._id);
        } else {
          classesMap.set(groupKey, {
            id:            booking._id,
            title:         booking.classTitle,
            topic:         booking.topic || 'Scheduled Lesson',
            time:          scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            date:          scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            fullDateTime:  scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
            scheduledTime: booking.scheduledTime,
            scheduledDate,
            status,
            students:      [`${booking.studentId.firstName} ${booking.studentId.lastName}`],
            duration:      booking.duration,
            notes:         booking.notes,
            bookingId:     booking._id,
            bookingIds:    [booking._id],
          });
        }
      });
      const activeArr   = [];
      const finishedArr = [];
      classesMap.forEach(cls => (cls.status === 'completed' ? finishedArr : activeArr).push(cls));
      setClasses(activeArr);

      setCompletedReloadKey(k => k + 1);
    } catch (err) {
      console.error('Failed to load teacher data:', err);
      showToast('Failed to load data from server', 'error');
    } finally {
      setLoading(false);
      setDataReady(true);
    }
  };

  // ── Booking handlers ───────────────────────────────────────────────────────
  const handleAcceptBooking = async (booking) => {
    try {
      await acceptBooking(booking.id);
      setBookings(prev => prev.filter(b => b.id !== booking.id));
      const scheduledDate = new Date(booking.scheduledTime);
      const timeDiff = scheduledDate - new Date();
      let status = 'scheduled';
      if      (timeDiff < -3600000)               status = 'completed';
      else if (timeDiff < 900000 && timeDiff > 0) status = 'upcoming-soon';
      setClasses(prev => [...prev, {
        id:            booking.id,
        title:         booking.classTitle,
        topic:         booking.topic || 'Scheduled Lesson',
        time:          scheduledDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        date:          scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        fullDateTime:  scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
        scheduledTime: booking.scheduledTime,
        scheduledDate,
        status,
        students:      [booking.studentName],
        duration:      booking.duration,
        notes:         booking.notes,
        bookingId:     booking.id,
        bookingIds:    [booking.id],
      }]);
      showToast(`Accepted booking for ${booking.name}! Class added to your schedule.`);
      setTimeout(fetchTeacherData, 1000);
    } catch {
      showToast('Failed to accept booking. Please try again.', 'error');
    }
  };

  const handleRejectBooking = async (booking) => {
    try {
      const reason = prompt('Reason for rejection (optional):');
      await rejectBooking(booking.id, reason || '');
      setBookings(prev => prev.filter(b => b.id !== booking.id));
      showToast(`Rejected booking for ${booking.name}`);
    } catch {
      showToast('Failed to reject booking', 'error');
    }
  };

  // ── Class handlers ─────────────────────────────────────────────────────────
  const handleAddClass = async (newClass) => {
    try {
      if (!newClass.students || newClass.students.length === 0) {
        showToast('Please select at least one student for the class', 'error');
        return;
      }
      const teacherId  = teacherInfo._id || teacherInfo.id;
      const isoString  = new Date(newClass.time).toISOString();
      const promises   = newClass.students.map(async student => {
        const response = await api.post('/bookings', {
          teacherId, studentId: student.id, classTitle: newClass.title,
          topic: newClass.topic || '', scheduledTime: isoString,
          duration: parseInt(newClass.duration), notes: newClass.notes || 'Teacher-created class', createdBy: 'teacher',
        });
        if (response.data.booking.status === 'pending')
          return await acceptBooking(response.data.booking._id);
        return response.data.booking;
      });
      await Promise.all(promises);
      showToast(`Class "${newClass.title}" created for ${newClass.students.length} student(s)!`);
      await fetchTeacherData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create class.', 'error');
    }
  };

  const askCancelClass = (classItem) => {
    const classId = typeof classItem === 'object' ? (classItem.id || classItem.bookingId) : classItem;
    setConfirmModal({ open: true, type: 'cancel', classId });
  };

  const askDeleteClass = (classItem) => {
    const classId = typeof classItem === 'object' ? (classItem.id || classItem.bookingId) : classItem;
    setConfirmModal({ open: true, type: 'delete', classId });
  };

  const handleConfirm = async () => {
    if (confirmModal.type === 'cancel') {
      try {
        const cls = classes.find(c => c.id === confirmModal.classId);
        if (cls?.bookingIds?.length > 0)
          await Promise.all(cls.bookingIds.map(bid => cancelBooking(bid, 'Teacher cancelled class')));
        else
          await cancelBooking(confirmModal.classId, 'Teacher cancelled class');
        setClasses(prev => prev.map(c => c.id === confirmModal.classId ? { ...c, status: 'cancelled' } : c));
        showToast('Class cancelled successfully');
      } catch { showToast('Failed to cancel class', 'error'); }
    } else if (confirmModal.type === 'delete') {
      try {
        const cls = classes.find(c => c.id === confirmModal.classId);
        if (cls?.bookingIds?.length > 0)
          await Promise.all(cls.bookingIds.map(bid => deleteBooking(bid)));
        else
          await deleteBooking(confirmModal.classId);
        setClasses(prev => prev.filter(c => c.id !== confirmModal.classId));
        showToast('Class deleted successfully');
      } catch { showToast('Failed to delete class', 'error'); }
    }
    setConfirmModal({ open: false, type: null, classId: null });
  };

  const handleJoinClass = (classItem) => {
    navigate('/classroom', {
      state: {
        classData: {
          id:                    classItem.id || classItem.bookingId,
          bookingId:             classItem.bookingId || classItem.id,
          title:                 classItem.title,
          teacher:               `${teacherInfo.firstName} ${teacherInfo.lastName}`,
          students:              classItem.students || [],
          duration:              classItem.duration,
          scheduledTime:         classItem.scheduledTime,
          teacherGoogleMeetLink: googleMeetLink,
          teacherZoomLink:       zoomLink,
        },
        userRole: 'teacher',
      },
    });
  };

  const handleLeaveClassroom = () => {
    setIsClassroomOpen(false);
    setActiveClass(null);
  };

  const handleLogout = () => {
    const token        = sessionStorage.getItem('teacherToken') || localStorage.getItem('teacherToken');
    const sessionToken = sessionStorage.getItem('teacherSessionToken') || localStorage.getItem('teacherSessionToken');
    if (token && sessionToken) {
      // Pass the Authorization header explicitly so the async request interceptor
      // doesn't try to read from sessionStorage — which will already be cleared
      // by the synchronous removeItem calls below (race condition fix).
      api.post('/auth/logout-session', { sessionToken }, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    ['teacherToken', 'teacherSessionToken', 'teacherInfo'].forEach(k => {
      sessionStorage.removeItem(k);
      localStorage.removeItem(k);
    });
    localStorage.removeItem('pwa-last-role');
    navigate('/teacher/login', { replace: true });
  };

  const handlePasswordChangeSuccess = (msg) => showToast(msg);

  // ── Computed ───────────────────────────────────────────────────────────────
  const liveClasses    = classes.filter(c => c.status === 'live');
  const upcomingClasses = classes.filter(c => c.status === 'scheduled' || c.status === 'upcoming-soon');
  const pendingBookings = bookings.length;

  // Only count classes officially marked 'completed' by the server AND not
  // admin-rejected — i.e. the admin approved the class and the teacher was paid.
  // Excludes: missed classes, stale accepted bookings, admin-rejected completions.

  return {
    // State
    teacherInfo, setTeacherInfo,
    activeTab,   setActiveTab,
    loading,     mounted,
    toast,       showToast,
    sidebarOpen, setSidebarOpen,
    isDarkMode,  toggleDarkMode,
    // Data
    students, bookings, classes, liveClasses, upcomingClasses, completedReloadKey,
    googleMeetLink, setGoogleMeetLink,
    zoomLink, setZoomLink,
    // Computed
    pendingBookings, completedCount, homeworkToGrade, quizAttempted,
    // Push & messages
    pushEnabled, pushSupported, togglePush,
    unreadMessages, setUnreadMessages,
    // Classroom
    isClassroomOpen, activeClass,
    // Modals
    showChangePassword,     setShowChangePassword,
    showSessionManagement,  setShowSessionManagement,
    showSettingsSidebar,    setShowSettingsSidebar,
    showSettingsModal,      setShowSettingsModal,
    showGoogleMeetSettings, setShowGoogleMeetSettings,
    showRecurringForm,      setShowRecurringForm,
    isModalOpen,            setIsModalOpen,
    confirmModal,           setConfirmModal,
    // Handlers
    fetchTeacherData,
    handleAcceptBooking,
    handleRejectBooking,
    handleAddClass,
    handleJoinClass,
    handleLeaveClassroom,
    handleConfirm,
    askCancelClass,
    askDeleteClass,
    handleLogout,
    handlePasswordChangeSuccess,
  };
}
