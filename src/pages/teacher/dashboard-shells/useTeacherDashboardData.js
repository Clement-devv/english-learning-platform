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
import {
  getTeacherBookings,
  acceptBooking,
  rejectBooking,
  deleteBooking,
  cancelBooking,
} from '../../../services/bookingService';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

// Heartbeat schedule (all intervals are multiples of TICK_MS):
//   Every 30s  — pending bookings (critical: teacher needs to respond fast)
//   Every 30s  — class status recomputation (client-side, no API)
//   Every 60s  — accepted/active classes (cancellations, new live classes)
//   Every 3min — completed classes (admin approvals, payment status)
//   Every 5min — students list (new assignments, credit changes)
const TICK_MS      = 30_000;
const TICK_PENDING  = 1;   // every 1 tick  = 30s
const TICK_ACTIVE   = 2;   // every 2 ticks = 60s
const TICK_COMPLETED= 6;   // every 6 ticks = 3min
const TICK_STUDENTS = 10;  // every 10 ticks = 5min

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
  const [completedClasses,  setCompletedClasses]  = useState([]);
  const [googleMeetLink,    setGoogleMeetLink]     = useState('');

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

  // ── Push bootstrap — auto-subscribe on first login ─────────────────────────
  useEffect(() => {
    if (!pushSupported()) return;
    getPushStatus().then(async subscribed => {
      if (subscribed) {
        setPushEnabled(true);
      } else if (Notification.permission !== 'denied') {
        const { ok } = await enablePush();
        setPushEnabled(ok);
      }
    });
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

  // ── Unread messages count — fetch on mount, reset when messages tab opened ─
  useEffect(() => {
    api.get('/direct-messages').then(({ data }) => {
      const total = (data.dms || []).reduce((sum, dm) => sum + (dm.unreadCount?.teacher || 0), 0);
      setUnreadMessages(total);
    }).catch(() => {});
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
    }
  }, [location.state?.classCompleted, location.state?.classMissed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Homework polling ───────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await api.get('/homework/my');
        const toGrade = (data.homework || []).filter(h => h.status === 'submitted').length;
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
    };
    check();
    const id = setInterval(check, 90_000);
    return () => clearInterval(id);
  }, []);

  // ── Quiz polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await api.get('/quiz/my');
        const attempted = (data.quizzes || []).filter(q => q.status === 'attempted').length;
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
    };
    check();
    const id = setInterval(check, 90_000);
    return () => clearInterval(id);
  }, []);

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
      const completedData = await getTeacherBookings(teacherId, 'completed');
      const missedData    = completedData.filter(b => b.status === 'missed');
      const trueCompleted = completedData.filter(b => b.status === 'completed');

      const completedMap = new Map();
      trueCompleted.forEach(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (completedMap.has(groupKey)) {
          const entry = completedMap.get(groupKey);
          entry.students.push(`${booking.studentId.firstName} ${booking.studentId.lastName}`);
          if (booking.adminRejected) entry.adminRejected = true;
        } else {
          completedMap.set(groupKey, {
            id: booking._id, title: booking.classTitle,
            topic: booking.topic || 'Completed Lesson',
            fullDateTime: new Date(booking.scheduledTime).toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
            scheduledTime: booking.scheduledTime,
            scheduledDate,
            students: [`${booking.studentId.firstName} ${booking.studentId.lastName}`],
            duration: booking.duration, status: 'completed',
            officiallyCompleted: true,
            adminRejected: booking.adminRejected || false,
            adminRejectedReason: booking.adminRejectedReason || '',
            adminRejectedAt: booking.adminRejectedAt || null,
            disputeRaised: booking.disputeRaised || false,
          });
        }
      });

      const missedMap = new Map();
      missedData.forEach(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (missedMap.has(groupKey)) {
          missedMap.get(groupKey).students.push(`${booking.studentId.firstName} ${booking.studentId.lastName}`);
        } else {
          missedMap.set(groupKey, {
            id: booking._id, title: booking.classTitle,
            topic: booking.topic || 'Missed Lesson',
            fullDateTime: scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
            scheduledTime: booking.scheduledTime, scheduledDate,
            students: [`${booking.studentId.firstName} ${booking.studentId.lastName}`],
            duration: booking.duration, status: 'missed', isMissed: true,
            missedReason: booking.missedReason || '',
            adminRejected: booking.adminRejected || false,
            adminRejectedReason: booking.adminRejectedReason || '',
            disputeRaised: booking.disputeRaised || false,
          });
        }
      });

      setCompletedClasses([
        ...Array.from(completedMap.values()),
        ...Array.from(missedMap.values()),
      ]);
    } catch { /* silent */ }
  }, []);

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
        name:         `${item.student.firstName} ${item.student.lastName}`,
        email:        item.student.email,
        status:       item.student.active ? 'Active' : 'Inactive',
        progress:     item.student.classCredits || 0,
        active:       item.student.active,
        age:          item.student.age || null,
        dateOfBirth:  item.student.dateOfBirth || null,
        rank:         item.student.rank || '',
        assignmentId: item.assignmentId,
        assignedDate: item.assignedDate,
      })));
    } catch { /* silent */ }
  }, []);

  // ── Heartbeat: smart tick counter ─────────────────────────────────────────
  // Runs every TICK_MS. Skips when the browser tab is hidden (saves battery/network).
  // Different data refreshes at different intervals via the tick counter.
  useEffect(() => {
    const tickRef = { current: 0 };
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      tickRef.current += 1;
      const tick = tickRef.current;

      // Every 30s — most critical: new booking requests
      if (tick % TICK_PENDING === 0) refreshPending();

      // Every 60s — active/live class list
      if (tick % TICK_ACTIVE === 0) refreshActive();

      // Every 3min — completed classes & payment status
      if (tick % TICK_COMPLETED === 0) refreshCompleted();

      // Every 5min — student list (new assignments)
      if (tick % TICK_STUDENTS === 0) refreshStudents();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [refreshPending, refreshActive, refreshCompleted, refreshStudents]);

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
      if (!teacherId) throw new Error('No teacher ID found');
      teacherIdRef.current = teacherId; // make available to heartbeat helpers

      api.patch(`/teachers/${teacherId}/timezone`, { timezone: getUserTimezone() }).catch(() => {});

      const { data: apiTeacherData } = await api.get(`/teachers/${teacherId}`);
      setTeacherInfo(apiTeacherData);
      setGoogleMeetLink(apiTeacherData.googleMeetLink || '');
      // Sync refreshed profile back into the global auth context + storage
      setAuthUser(apiTeacherData);

      const [studentsData, pendingData, acceptedData, completedData] = await Promise.all([
        getAssignedStudents(teacherId),
        getTeacherBookings(teacherId, 'pending'),
        getTeacherBookings(teacherId, 'accepted'),
        getTeacherBookings(teacherId, 'completed'),
      ]);

      const missedData    = completedData.filter(b => b.status === 'missed');
      const trueCompleted = completedData.filter(b => b.status === 'completed');

      // Students
      setStudents(studentsData.map(item => ({
        _id:          item.student._id,
        id:           item.student._id,
        firstName:    item.student.firstName,
        lastName:      item.student.lastName || '',
        classCredits:  item.student.classCredits || 0,
        name:         `${item.student.firstName} ${item.student.lastName}`,
        email:        item.student.email,
        status:       item.student.active ? 'Active' : 'Inactive',
        progress:     item.student.classCredits || 0,
        active:       item.student.active,
        age:          item.student.age || null,
        dateOfBirth:  item.student.dateOfBirth || null,
        rank:         item.student.rank || '',
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

      // Completed classes — bookings officially marked status='completed' by the system
      const completedMap = new Map();
      trueCompleted.forEach(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (completedMap.has(groupKey)) {
          const entry = completedMap.get(groupKey);
          entry.students.push(`${booking.studentId.firstName} ${booking.studentId.lastName}`);
          // If ANY booking in the group was admin-rejected, mark the whole slot as rejected
          if (booking.adminRejected) entry.adminRejected = true;
        } else {
          completedMap.set(groupKey, {
            id:                  booking._id,
            title:               booking.classTitle,
            topic:               booking.topic || 'Completed Lesson',
            fullDateTime:        scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
            scheduledTime:       booking.scheduledTime,
            scheduledDate,
            students:            [`${booking.studentId.firstName} ${booking.studentId.lastName}`],
            duration:            booking.duration,
            status:              'completed',
            officiallyCompleted: true,   // marked by server, not just past scheduled time
            adminRejected:       booking.adminRejected || false,
            adminRejectedReason: booking.adminRejectedReason || '',
            adminRejectedAt:     booking.adminRejectedAt || null,
            disputeRaised:       booking.disputeRaised || false,
          });
        }
      });

      // Missed classes
      const missedMap = new Map();
      missedData.forEach(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (missedMap.has(groupKey)) {
          missedMap.get(groupKey).students.push(`${booking.studentId.firstName} ${booking.studentId.lastName}`);
        } else {
          missedMap.set(groupKey, {
            id:                  booking._id,
            title:               booking.classTitle,
            topic:               booking.topic || 'Missed Lesson',
            fullDateTime:        scheduledDate.toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
            scheduledTime:       booking.scheduledTime,
            scheduledDate,
            students:            [`${booking.studentId.firstName} ${booking.studentId.lastName}`],
            duration:            booking.duration,
            status:              'missed',
            isMissed:            true,
            missedReason:        booking.missedReason || '',
            adminRejected:       booking.adminRejected || false,
            adminRejectedReason: booking.adminRejectedReason || '',
            disputeRaised:       booking.disputeRaised || false,
          });
        }
      });

      setCompletedClasses([
        ...finishedArr,
        ...Array.from(completedMap.values()),
        ...Array.from(missedMap.values()),
      ]);
    } catch (err) {
      console.error('Failed to load teacher data:', err);
      showToast('Failed to load data from server', 'error');
    } finally {
      setLoading(false);
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
      api.post('/auth/logout-session', { sessionToken }).catch(() => {});
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
  const completedCount = completedClasses.filter(
    c => c.officiallyCompleted && !c.adminRejected
  ).length;

  return {
    // State
    teacherInfo, setTeacherInfo,
    activeTab,   setActiveTab,
    loading,     mounted,
    toast,       showToast,
    sidebarOpen, setSidebarOpen,
    isDarkMode,  toggleDarkMode,
    // Data
    students, bookings, classes, liveClasses, upcomingClasses, completedClasses,
    googleMeetLink, setGoogleMeetLink,
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
