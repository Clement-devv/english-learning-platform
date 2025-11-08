// src/pages/Classroom.jsx - WITH TIMER + WORKING VIDEO CALL
import React, { useState, useEffect, useRef } from 'react';
import { Clock, Users, AlertCircle, XCircle, LogOut, X, MessageCircle, Palette } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import VideoCall from './VideoCall';
import SharedWhiteboard from '../components/SharedWhiteboard';
import { completeBooking } from '../services/bookingService';
import { 
  updateClassroomAttendance, 
  endClassEarly 
} from '../services/classroomService';

export default function Classroom({ classData, userRole, onLeave }) {
  // UI States
  const [showChat, setShowChat] = useState(true);
  const [showWhiteboard, setShowWhiteboard] = useState(true);
  const [videoMaximized, setVideoMaximized] = useState(false);
  const [whiteboardMaximized, setWhiteboardMaximized] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Timer states
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [classStartTime, setClassStartTime] = useState(null);
  
  // Attendance tracking
  const [teacherJoinedAt, setTeacherJoinedAt] = useState(null);
  const [studentJoinedAt, setStudentJoinedAt] = useState(null);
  const [teacherActiveTime, setTeacherActiveTime] = useState(0);
  const [studentActiveTime, setStudentActiveTime] = useState(0);
  const [bothActiveTime, setBothActiveTime] = useState(0);
  
  // Status states
  const [isTeacherPresent, setIsTeacherPresent] = useState(false);
  const [isStudentPresent, setIsStudentPresent] = useState(false);
  const [classStatus, setClassStatus] = useState('waiting');
  
  // Early end modal
  const [showEndEarlyModal, setShowEndEarlyModal] = useState(false);
  const [endReason, setEndReason] = useState('');
  const [reportedBy, setReportedBy] = useState('');
  const [endDescription, setEndDescription] = useState('');
  
  // Refs
  const timerIntervalRef = useRef(null);
  const attendanceIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  
  // User info for video call
  const userInfo = JSON.parse(
    localStorage.getItem('teacherInfo') || 
    localStorage.getItem('studentInfo') || 
    '{}'
  );
  
  const userId = userInfo._id || userInfo.id || Date.now();
  const userName = `${userInfo.firstName || 'User'} ${userInfo.lastName || userInfo.surname || ''}`.trim();
  const channelName = classData?.id || classData?.bookingId || classData?.title?.replace(/\s+/g, '-') || `class-${Date.now()}`;

  console.log('🎓 Classroom opened:', { 
    classData, 
    userId, 
    userName, 
    channelName,
    userRole 
  });

  // Calculate required attendance time (83%)
  const getRequiredAttendanceTime = (duration) => {
    return Math.floor(duration * 0.83);
  };

  // Initialize classroom on mount
  useEffect(() => {
    initializeClassroom();
    return () => {
      clearInterval(timerIntervalRef.current);
      clearInterval(attendanceIntervalRef.current);
      clearInterval(heartbeatIntervalRef.current);
      handleUserLeaving();
    };
  }, []);

  const initializeClassroom = async () => {
    try {
      const durationMinutes = classData.duration || 60;
      const durationSeconds = durationMinutes * 60;
      setTotalDuration(durationSeconds);
      setTimeRemaining(durationSeconds);

      const now = new Date();
      if (userRole === 'teacher') {
        setIsTeacherPresent(true);
        setTeacherJoinedAt(now);
        setClassStartTime(now);
      } else if (userRole === 'student') {
        setIsStudentPresent(true);
        setStudentJoinedAt(now);
        if (!classStartTime) setClassStartTime(now);
      }

      await updateClassroomAttendance({
        bookingId: classData.bookingId || classData.id,
        userRole: userRole,
        action: 'join',
        timestamp: now.toISOString()
      });

      startHeartbeat();

      console.log('✅ Classroom initialized');
    } catch (err) {
      console.error('Error initializing classroom:', err);
    }
  };

  // Start timer when both users are present
  useEffect(() => {
    if (isTeacherPresent && isStudentPresent && !isTimerRunning) {
      startTimer();
      startAttendanceTracking();
      setClassStatus('active');
      console.log('✅ Both users present - Timer started!');
    }
  }, [isTeacherPresent, isStudentPresent]);

  const startTimer = () => {
    setIsTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          handleTimerComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startAttendanceTracking = () => {
    attendanceIntervalRef.current = setInterval(() => {
      if (isTeacherPresent) setTeacherActiveTime(prev => prev + 1);
      if (isStudentPresent) setStudentActiveTime(prev => prev + 1);
      if (isTeacherPresent && isStudentPresent) {
        setBothActiveTime(prev => prev + 1);
      }
    }, 1000);
  };

  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(async () => {
      try {
        await updateClassroomAttendance({
          bookingId: classData.bookingId || classData.id,
          userRole: userRole,
          action: 'heartbeat',
          timestamp: new Date().toISOString(),
          activeTime: userRole === 'teacher' ? teacherActiveTime : studentActiveTime
        });
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    }, 30000);
  };

  const handleTimerComplete = async () => {
    clearInterval(timerIntervalRef.current);
    clearInterval(attendanceIntervalRef.current);
    setIsTimerRunning(false);
    setClassStatus('completed');

    await checkAndCompleteClass();
  };

  const checkAndCompleteClass = async () => {
    try {
      const requiredSeconds = getRequiredAttendanceTime(totalDuration);
      const canComplete = bothActiveTime >= requiredSeconds;

      if (canComplete) {
        const result = await completeBooking(classData.bookingId || classData.id);
        
        if (userRole === 'student') {
          alert(`🎉 Class completed!\n\nYou have ${result.studentClassesRemaining} classes remaining.`);
        } else {
          alert('✅ Class completed successfully!');
        }

        setTimeout(() => onLeave(), 2000);
      } else {
        const shortfall = Math.ceil((requiredSeconds - bothActiveTime) / 60);
        alert(
          `⚠️ Class time completed, but attendance requirement not met.\n\n` +
          `Required: ${Math.floor(requiredSeconds / 60)} minutes together.\n` +
          `Short by: ${shortfall} minutes.\n\n` +
          `This class requires admin review.`
        );
        
        await endClassEarly({
          bookingId: classData.bookingId || classData.id,
          reason: 'insufficient_attendance',
          reportedBy: 'system',
          description: `Both participants were only active together for ${Math.floor(bothActiveTime / 60)} minutes out of ${Math.floor(requiredSeconds / 60)} minutes required.`,
          teacherActiveTime,
          studentActiveTime,
          bothActiveTime,
          requiredTime: requiredSeconds,
          endedAt: new Date().toISOString(),
          endedBy: 'system'
        });

        onLeave();
      }
    } catch (err) {
      console.error('Error checking class completion:', err);
      alert('Error processing class completion. Please contact admin.');
      onLeave();
    }
  };

  const handleUserLeaving = async () => {
    try {
      await updateClassroomAttendance({
        bookingId: classData.bookingId || classData.id,
        userRole: userRole,
        action: 'leave',
        timestamp: new Date().toISOString(),
        totalActiveTime: userRole === 'teacher' ? teacherActiveTime : studentActiveTime
      });
    } catch (err) {
      console.error('Error handling user leaving:', err);
    }
  };

  const handleLeaveClass = async () => {
    try {
      await handleUserLeaving();
      onLeave();
    } catch (err) {
      console.error('Error leaving class:', err);
      onLeave();
    }
  };

  const handleEndClassEarly = () => {
    if (userRole !== 'teacher') {
      alert('Only the teacher can end the class early.');
      return;
    }
    setShowEndEarlyModal(true);
  };

  const submitEarlyEnd = async () => {
    if (!endReason || !reportedBy || !endDescription.trim()) {
      alert('Please fill in all fields.');
      return;
    }

    try {
      await endClassEarly({
        bookingId: classData.bookingId || classData.id,
        reason: endReason,
        reportedBy: reportedBy,
        description: endDescription,
        teacherActiveTime,
        studentActiveTime,
        bothActiveTime,
        requiredTime: getRequiredAttendanceTime(totalDuration),
        endedAt: new Date().toISOString(),
        endedBy: userRole
      });

      alert('✅ Complaint submitted. Class marked as PENDING for admin review.');

      clearInterval(timerIntervalRef.current);
      clearInterval(attendanceIntervalRef.current);
      clearInterval(heartbeatIntervalRef.current);

      setShowEndEarlyModal(false);
      setTimeout(() => onLeave(), 1000);
    } catch (err) {
      console.error('Error ending class early:', err);
      alert('Error submitting complaint. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    const percentage = (timeRemaining / totalDuration) * 100;
    if (percentage > 50) return 'text-green-400';
    if (percentage > 20) return 'text-orange-400';
    return 'text-red-400';
  };

  const toggleVideoMaximize = () => {
    setVideoMaximized(!videoMaximized);
    if (!videoMaximized) setWhiteboardMaximized(false);
  };

  const toggleWhiteboardMaximize = () => {
    setWhiteboardMaximized(!whiteboardMaximized);
    if (!whiteboardMaximized) setVideoMaximized(false);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      const message = {
        id: Date.now(),
        text: newMessage,
        sender: userName,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages([...chatMessages, message]);
      setNewMessage('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col">
      {/* Header with Timer */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          {/* Class Info */}
          <div>
            <h2 className="text-xl font-bold">🎓 {classData?.title || "Virtual Classroom"}</h2>
            {classData?.topic && <p className="text-sm text-purple-100">{classData.topic}</p>}
          </div>

          {/* Timer */}
          <div className="flex items-center gap-6">
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <div className={`text-2xl font-bold ${getTimerColor()}`}>
                  {formatTime(timeRemaining)}
                </div>
              </div>
              <p className="text-xs text-center">
                {isTimerRunning ? 'Time Left' : 'Waiting...'}
              </p>
            </div>

            {/* Attendance */}
            <div className="bg-white/20 rounded-lg px-4 py-2 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4" />
                <span className="font-semibold">Status</span>
              </div>
              <div className="space-y-0.5">
                <div>Teacher: <span className={isTeacherPresent ? 'text-green-300' : 'text-red-300'}>
                  {isTeacherPresent ? '✓' : '✗'}
                </span></div>
                <div>Student: <span className={isStudentPresent ? 'text-green-300' : 'text-red-300'}>
                  {isStudentPresent ? '✓' : '✗'}
                </span></div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWhiteboard(!showWhiteboard)}
                className={`p-2 rounded-lg transition ${
                  showWhiteboard ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
                }`}
                title="Toggle Whiteboard"
              >
                <Palette className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowChat(!showChat)}
                className={`p-2 rounded-lg transition ${
                  showChat ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'
                }`}
                title="Toggle Chat"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="w-full bg-white/20 rounded-full h-2">
            <div
              className="bg-white h-2 rounded-full transition-all duration-1000"
              style={{ width: `${((totalDuration - timeRemaining) / totalDuration) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 flex ${showWhiteboard ? 'flex-row' : ''}`}>
          {/* Video Section */}
          <AnimatePresence>
            {(!whiteboardMaximized || !showWhiteboard) && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`${
                  videoMaximized ? 'w-full' : showWhiteboard ? 'w-1/2' : 'w-full'
                } transition-all`}
              >
                <VideoCall 
                  channelName={channelName}
                  userId={userId}
                  userName={userName}
                  onLeave={handleLeaveClass}
                  isMaximized={videoMaximized}
                  onToggleMaximize={showWhiteboard ? toggleVideoMaximize : null}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Whiteboard Section */}
          <AnimatePresence>
            {showWhiteboard && !videoMaximized && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={`${
                  whiteboardMaximized ? 'w-full' : 'w-1/2'
                } border-l-2 border-gray-700`}
              >
                <SharedWhiteboard 
                  isMaximized={whiteboardMaximized}
                  onToggleMaximize={toggleWhiteboardMaximize}
                  channelName={channelName}
                  userId={userId}
                  userName={userName}
                  userRole={userRole}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Chat Sidebar */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="w-80 bg-gray-800 border-l-2 border-gray-700 flex flex-col"
            >
              <div className="p-4 border-b border-gray-700">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Class Chat
                </h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-purple-300 font-semibold text-sm">
                        {msg.sender}
                      </span>
                      <span className="text-gray-400 text-xs">{msg.timestamp}</span>
                    </div>
                    <p className="text-white text-sm">{msg.text}</p>
                  </div>
                ))}
              </div>
              
              <form onSubmit={sendMessage} className="p-4 border-t border-gray-700">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full px-4 py-2 rounded-lg bg-gray-700 text-white border-none focus:ring-2 focus:ring-purple-500"
                />
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {userRole === 'teacher' && classStatus === 'active' && (
          <button
            onClick={handleEndClassEarly}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-lg"
          >
            <XCircle className="w-5 h-5" />
            End Class Early
          </button>
        )}
        
        <button
          onClick={handleLeaveClass}
          className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg shadow-lg"
        >
          <LogOut className="w-5 h-5" />
          Leave Class
        </button>
      </div>

      {/* End Early Modal */}
      {showEndEarlyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">End Class Early</h3>
              <button onClick={() => setShowEndEarlyModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
              <div className="flex gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Important:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>This will end the class immediately</li>
                    <li>Your complaint will be sent to admin</li>
                    <li>Class marked as PENDING until review</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Reason for Ending Early *
                </label>
                <select
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a reason</option>
                  <option value="network_issue">Network/Technical Issue</option>
                  <option value="student_absent">Student Not Responding</option>
                  <option value="student_unprepared">Student Unprepared</option>
                  <option value="emergency">Emergency</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Issue Related To *
                </label>
                <div className="space-y-2">
                  {['network', 'student', 'other'].map((option) => (
                    <label key={option} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reportedBy"
                        value={option}
                        checked={reportedBy === option}
                        onChange={(e) => setReportedBy(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="capitalize">{option === 'network' ? 'Network/Technical' : option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Detailed Description *
                </label>
                <textarea
                  value={endDescription}
                  onChange={(e) => setEndDescription(e.target.value)}
                  placeholder="Explain why you're ending the class early..."
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">{endDescription.length}/500</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEndEarlyModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={submitEarlyEnd}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold"
              >
                Submit Complaint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
