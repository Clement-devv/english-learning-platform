// src/pages/teacher/dashboard-shells/TeacherTabContent.jsx
// Shared tab content renderer for all teacher dashboard shells.
// Each shell renders its own sidebar/topbar chrome and calls this component
// for the inner content area, optionally passing a wrapStyle for the card container.

import React from 'react';
import ClassList           from '../components/classes/ClassList';
import CompletedClassesTab from '../components/classes/CompletedClasses';
import StudentProgressList from '../components/students/StudentProgressList';
import BookingList         from '../components/bookings/BookingList';
import ScheduleTab         from '../tabs/ScheduleTab';
import PaymentTab          from '../tabs/PaymentTab';
import HomeworkTab         from '../tabs/HomeworkTab';
import QuizTab             from '../tabs/QuizTab';
import VocabTab            from '../tabs/VocabTab';
import RecordingsTab       from '../tabs/RecordingsTab';
import ReviewsTab          from '../tabs/ReviewsTab';
import ProfileTab          from '../tabs/ProfileTab';
import MessagesTab         from '../../../components/chat/MessagesTab';
import { Calendar, Users } from 'lucide-react';

/**
 * wrapStyle  – CSS object applied to the outer card container for non-messages tabs
 * msgStyle   – CSS object applied to the messages container (no padding by default)
 * headStyle  – CSS object for page headings inside the wrapper
 * mutedStyle – CSS object for page sub-headings
 */
export default function TeacherTabContent({ d, wrapStyle = {}, msgStyle = {}, headStyle = {}, mutedStyle = {} }) {
  const { activeTab, isDarkMode } = d;

  // ── SCHEDULE ──────────────────────────────────────────────────────────────
  if (activeTab === 'schedule') {
    return (
      <div style={wrapStyle}>
        <ScheduleTab
          teacherInfo={d.teacherInfo}
          isDarkMode={isDarkMode}
          classes={d.classes}
          bookings={d.bookings}
          students={d.students}
          onRefresh={d.fetchTeacherData}
        />
      </div>
    );
  }

  // ── CLASSES ───────────────────────────────────────────────────────────────
  if (activeTab === 'classes') {
    return (
      <div style={wrapStyle}>
        {d.classes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Calendar size={36} color={isDarkMode ? '#1e2235' : '#e2e8f0'} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: '14px', color: isDarkMode ? '#6b7090' : '#9b8ab0', margin: '0 0 4px', fontWeight: '600' }}>No classes scheduled yet</p>
            <p style={{ fontSize: '12px', color: isDarkMode ? '#6b7090' : '#9b8ab0', margin: 0 }}>Accept booking requests to add classes to your schedule</p>
          </div>
        ) : (
          <ClassList
            data={d.classes}
            onJoin={d.handleJoinClass}
            onDelete={d.askDeleteClass}
            isDarkMode={isDarkMode}
          />
        )}
      </div>
    );
  }

  // ── COMPLETED CLASSES ─────────────────────────────────────────────────────
  if (activeTab === 'completed-classes') {
    return (
      <div style={wrapStyle}>
        <CompletedClassesTab
          classes={d.completedClasses}
          teacherInfo={d.teacherInfo}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // ── STUDENTS ──────────────────────────────────────────────────────────────
  if (activeTab === 'students') {
    return (
      <div style={wrapStyle}>
        {d.students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Users size={36} color={isDarkMode ? '#1e2235' : '#e2e8f0'} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontSize: '14px', color: isDarkMode ? '#6b7090' : '#9b8ab0', margin: 0, fontWeight: '600' }}>No students assigned yet</p>
          </div>
        ) : (
          <StudentProgressList students={d.students} isDarkMode={isDarkMode} />
        )}
      </div>
    );
  }

  // ── BOOKINGS ──────────────────────────────────────────────────────────────
  if (activeTab === 'bookings') {
    return (
      <div style={wrapStyle}>
        <BookingList
          bookings={d.bookings}
          onAccept={d.handleAcceptBooking}
          onReject={d.handleRejectBooking}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // ── MESSAGES ──────────────────────────────────────────────────────────────
  if (activeTab === 'messages') {
    return (
      <div style={msgStyle}>
        <MessagesTab userRole="teacher" />
      </div>
    );
  }

  // ── PAYMENT ───────────────────────────────────────────────────────────────
  if (activeTab === 'payment') {
    return (
      <div style={wrapStyle}>
        <PaymentTab teacher={d.teacherInfo} isDarkMode={isDarkMode} />
      </div>
    );
  }

  // ── HOMEWORK ──────────────────────────────────────────────────────────────
  if (activeTab === 'homework') {
    return (
      <div style={wrapStyle}>
        <HomeworkTab teacherInfo={d.teacherInfo} students={d.students} isDarkMode={isDarkMode} />
      </div>
    );
  }

  // ── QUIZ ──────────────────────────────────────────────────────────────────
  if (activeTab === 'quiz') {
    return (
      <div style={wrapStyle}>
        <QuizTab teacherInfo={d.teacherInfo} students={d.students} isDarkMode={isDarkMode} />
      </div>
    );
  }

  // ── VOCABULARY ────────────────────────────────────────────────────────────
  if (activeTab === 'vocab') {
    return (
      <div style={wrapStyle}>
        <VocabTab teacherInfo={d.teacherInfo} students={d.students} isDarkMode={isDarkMode} />
      </div>
    );
  }

  // ── RECORDINGS ────────────────────────────────────────────────────────────
  if (activeTab === 'recordings') {
    return (
      <div style={wrapStyle}>
        <RecordingsTab isDarkMode={isDarkMode} />
      </div>
    );
  }

  // ── REVIEWS ───────────────────────────────────────────────────────────────
  if (activeTab === 'reviews') {
    return (
      <div style={wrapStyle}>
        <ReviewsTab teacherInfo={d.teacherInfo} isDarkMode={isDarkMode} />
      </div>
    );
  }

  // ── PROFILE ───────────────────────────────────────────────────────────────
  if (activeTab === 'profile') {
    return (
      <div style={wrapStyle}>
        <ProfileTab
          teacherInfo={d.teacherInfo}
          isDarkMode={isDarkMode}
          onUpdate={(updated) => {
            const merged = { ...d.teacherInfo, ...updated };
            d.setTeacherInfo(merged);
            localStorage.setItem('teacherInfo', JSON.stringify(merged));
          }}
        />
      </div>
    );
  }

  return null;
}
