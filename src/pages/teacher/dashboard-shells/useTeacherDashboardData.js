// src/pages/teacher/dashboard-shells/useTeacherDashboardData.js
// Shared data hook for all teacher dashboard shells.
// Mirrors the pattern of useDashboardData.js used by student shells.

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext.jsx';
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

  // ── Modal visibility ───────────────────────────────────────────────────────
  const [showChangePassword,     setShowChangePassword]     = useState(false);
  const [showSessionManagement,  setShowSessionManagement]  = useState(false);
  const [showSettingsSidebar,    setShowSettingsSidebar]    = useState(false);
  const [showSettingsModal,      setShowSettingsModal]      = useState(false);
  const [showGoogleMeetSettings, setShowGoogleMeetSettings] = useState(false);
  const [showRecurringForm,      setShowRecurringForm]      = useState(false);
  const [isModalOpen,            setIsModalOpen]            = useState(false);
  const [confirmModal,           setConfirmModal]           = useState({ open: false, type: null, classId: null });

  // ── Push bootstrap ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pushSupported()) return;
    getPushStatus().then(setPushEnabled);
  }, []);

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

  // ── Fetch all teacher data ─────────────────────────────────────────────────
  const fetchTeacherData = async () => {
    try {
      setLoading(true);
      const teacherData = authUser || {};
      const teacherId = teacherData._id || teacherData.id;
      setGoogleMeetLink(teacherData.googleMeetLink || '');
      if (!teacherId) throw new Error('No teacher ID found');

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

      // Completed classes
      const completedMap = new Map();
      trueCompleted.forEach(booking => {
        const scheduledDate = new Date(booking.scheduledTime);
        const groupKey = `${booking.scheduledTime}_${booking.classTitle}`;
        if (completedMap.has(groupKey)) {
          completedMap.get(groupKey).students.push(`${booking.studentId.firstName} ${booking.studentId.lastName}`);
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
    localStorage.removeItem('teacherToken');
    localStorage.removeItem('teacherSessionToken');
    localStorage.removeItem('teacherInfo');
    navigate('/teacher/login');
  };

  const handlePasswordChangeSuccess = (msg) => showToast(msg);

  // ── Computed ───────────────────────────────────────────────────────────────
  const liveClasses    = classes.filter(c => c.status === 'live');
  const upcomingClasses = classes.filter(c => c.status === 'scheduled' || c.status === 'upcoming-soon');
  const pendingBookings = bookings.length;
  const completedCount  = completedClasses.length;

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
    // Push
    pushEnabled, pushSupported, togglePush,
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
