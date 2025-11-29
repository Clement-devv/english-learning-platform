// src/pages/Classroom.jsx - 🎨 COMPLETE FIX: Persistent Timer + End Class + Video Fix
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import VideoCall from "./VideoCall";
import api from "../api";
import { 
  Video, 
  FileText, 
  PenTool,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  Loader,
  Power,
  AlertTriangle
} from "lucide-react";

export default function Classroom({ classData, userRole: propUserRole, onLeave }) {
  const navigate = useNavigate();
  
  const userRole = propUserRole || localStorage.getItem("role");
  const userId = localStorage.getItem("userId");
  const userName = localStorage.getItem("name") || "User";
  const bookingId = classData?.bookingId || classData?.id;

  console.log('🎓 Classroom initialized:', { bookingId, userRole, userName, duration: classData?.duration });

  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("video");

  // Presence tracking
  const [isTeacherPresent, setIsTeacherPresent] = useState(userRole === "teacher");
  const [isStudentPresent, setIsStudentPresent] = useState(userRole === "student");

  // 🔥 PERSISTENT TIMER STATE
  const [sessionData, setSessionData] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0); // Seconds elapsed
  const [bothActiveTime, setBothActiveTime] = useState(0); // Time both present
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [classStarted, setClassStarted] = useState(false);
  
  const timerInterval = useRef(null);
  const syncInterval = useRef(null);
  const sessionCheckInterval = useRef(null);

  // 🔥 End Class Modal
  const [showEndModal, setShowEndModal] = useState(false);
  const [endReason, setEndReason] = useState("");

  // Fetch or create session data on mount
  useEffect(() => {
    fetchOrCreateSession();
    
    // Check session every 5 seconds for updates
    sessionCheckInterval.current = setInterval(() => {
      fetchSessionData();
    }, 5000);

    return () => {
      clearInterval(sessionCheckInterval.current);
      handleUserLeaving();
    };
  }, []);

  const fetchOrCreateSession = async () => {
    try {
      console.log('📊 Fetching session for booking:', bookingId);
      
      // Try to get existing session
      const { data } = await api.get(`/api/classroom/session/${bookingId}`);
      
      if (data.session) {
        console.log('✅ Found existing session:', data.session);
        setSessionData(data.session);
        
        // Calculate time elapsed since class started
        if (data.session.classStartedAt) {
          const startTime = new Date(data.session.classStartedAt);
          const now = new Date();
          const elapsed = Math.floor((now - startTime) / 1000);
          setTimeElapsed(elapsed);
          setBothActiveTime(data.session.bothActiveTime || 0);
          
          console.log('⏱️ Time elapsed:', elapsed, 'seconds');
          console.log('👥 Both active time:', data.session.bothActiveTime, 'seconds');
        }
      } else {
        // Create new session by sending join event
        await handleJoinSession();
      }
    } catch (err) {
      console.error('❌ Error fetching session:', err);
      // Create new session
      await handleJoinSession();
    }
  };

  const fetchSessionData = async () => {
    try {
      const { data } = await api.get(`/api/classroom/session/${bookingId}`);
      if (data.session) {
        setSessionData(data.session);
        setBothActiveTime(data.session.bothActiveTime || 0);
      }
    } catch (err) {
      console.error('Error syncing session:', err);
    }
  };

  const handleJoinSession = async () => {
    try {
      console.log('🚪 Joining session as:', userRole);
      
      await api.post('/api/classroom/attendance', {
        bookingId: bookingId,
        userRole: userRole,
        action: 'join',
        timestamp: new Date().toISOString()
      });

      // Fetch updated session
      await fetchSessionData();
      
      // Start heartbeat
      startHeartbeat();
      
      console.log('✅ Session joined successfully');
    } catch (err) {
      console.error('❌ Error joining session:', err);
    }
  };

  const handleUserLeaving = async () => {
    try {
      await api.post('/api/classroom/attendance', {
        bookingId: bookingId,
        userRole: userRole,
        action: 'leave',
        timestamp: new Date().toISOString(),
        activeTime: timeElapsed
      });
      
      clearInterval(syncInterval.current);
      console.log('👋 Left session');
    } catch (err) {
      console.error('Error leaving session:', err);
    }
  };

  const startHeartbeat = () => {
    // Send heartbeat every 10 seconds
    syncInterval.current = setInterval(async () => {
      try {
        await api.post('/api/classroom/attendance', {
          bookingId: bookingId,
          userRole: userRole,
          action: 'heartbeat',
          timestamp: new Date().toISOString(),
          activeTime: timeElapsed
        });
      } catch (err) {
        console.error('Heartbeat error:', err);
      }
    }, 10000);
  };

  // Start timer when both users present
  useEffect(() => {
    console.log('🔍 Presence check:', {
      isTeacherPresent,
      isStudentPresent,
      isTimerRunning,
      classStarted
    });

    if (isTeacherPresent && isStudentPresent && !isTimerRunning && !classStarted) {
      console.log('✅ Both users present - Starting timer!');
      setIsTimerRunning(true);
      setClassStarted(true);
      startTimer();
    }
  }, [isTeacherPresent, isStudentPresent]);

  const startTimer = () => {
    timerInterval.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
      
      // Increment bothActiveTime only if both present
      if (isTeacherPresent && isStudentPresent) {
        setBothActiveTime(prev => prev + 1);
      }
    }, 1000);
  };

  // Stop timer when someone leaves (but keep tracking)
  useEffect(() => {
    if ((!isTeacherPresent || !isStudentPresent) && isTimerRunning) {
      console.log('⏸️ One user left - Timer continues but not counting together time');
      // Don't stop timer, just stop incrementing bothActiveTime
    }
  }, [isTeacherPresent, isStudentPresent]);

  const handleUserJoined = (uid) => {
    console.log('✅ CALLBACK: Remote user joined!', uid);
    
    if (userRole === "teacher") {
      console.log('👨‍🎓 Student joined!');
      setIsStudentPresent(true);
    } else {
      console.log('👨‍🏫 Teacher joined!');
      setIsTeacherPresent(true);
    }
  };

  const handleUserLeft = (uid) => {
    console.log('👋 User left:', uid);
    
    if (userRole === "teacher") {
      setIsStudentPresent(false);
    } else {
      setIsTeacherPresent(false);
    }
  };

  const handleLeaveCall = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }
    
    handleUserLeaving();
    
    if (onLeave) {
      onLeave();
    } else {
      navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
    }
  };

  // 🔥 END CLASS FUNCTION (Teacher Only)
  const handleEndClass = async () => {
    if (userRole !== "teacher") return;
    
    try {
      console.log('🛑 Teacher ending class...');
      console.log('📊 Final stats:', {
        timeElapsed,
        bothActiveTime,
        requiredTime: getRequiredTime(classData.duration)
      });

      const requiredTime = getRequiredTime(classData.duration);
      const meetsRequirement = bothActiveTime >= requiredTime;

      if (!meetsRequirement) {
        alert(
          `⚠️ Attendance Requirement Not Met\n\n` +
          `Time together: ${formatMinutes(bothActiveTime)}\n` +
          `Required: ${formatMinutes(requiredTime)}\n\n` +
          `Short by: ${formatMinutes(requiredTime - bothActiveTime)}\n\n` +
          `This class will need admin review.`
        );
        
        // Create complaint for admin review
        await api.post('/api/classroom/end-early', {
          bookingId: bookingId,
          reason: 'insufficient_attendance',
          reportedBy: 'teacher',
          description: `Teacher ended class. Both active: ${formatMinutes(bothActiveTime)}, Required: ${formatMinutes(requiredTime)}`,
          teacherActiveTime: timeElapsed,
          studentActiveTime: timeElapsed,
          bothActiveTime: bothActiveTime,
          requiredTime: requiredTime,
          endedAt: new Date().toISOString(),
          endedBy: userRole
        });
        
        handleLeaveCall();
        return;
      }

      // Complete the booking
      const { data } = await api.put(`/api/bookings/${bookingId}/complete`);
      
      if (data.success) {
        alert('✅ Class completed successfully!');
        handleLeaveCall();
      }
    } catch (err) {
      console.error('❌ Error ending class:', err);
      alert('Error ending class. Please try again.');
    }
  };

  // Calculate required time based on duration
  const getRequiredTime = (duration) => {
    switch(duration) {
      case 30: return 25 * 60; // 25 mins out of 30
      case 45: return 40 * 60; // 40 mins out of 45
      case 60: return 50 * 60; // 50 mins out of 60
      default: return Math.floor(duration * 60 * 0.83); // 83% default
    }
  };

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (seconds) => {
    return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
  };

  const getTimeRemaining = () => {
    const totalSeconds = (classData?.duration || 60) * 60;
    const remaining = totalSeconds - timeElapsed;
    return Math.max(0, remaining);
  };

  const handleTabChange = (tab) => {
    console.log('🎚️ Switching to tab:', tab);
    setActiveTab(tab);
  };

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-2">Oops!</h2>
          <p className="text-gray-600 mb-6">Cannot load classroom without a valid booking ID.</p>
          <button
            onClick={handleLeaveCall}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full font-bold hover:shadow-lg transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const channelName = `class-${bookingId}`;
  const timeRemaining = getTimeRemaining();
  const requiredTime = getRequiredTime(classData.duration);
  const completionPercentage = Math.min(100, Math.round((bothActiveTime / requiredTime) * 100));

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      
      {/* 🎨 COMPACT HEADER */}
      <div className="bg-white shadow-md border-b-2 border-purple-200 px-6 py-3">
        <div className="flex items-center justify-between">
          
          {/* Left: Timer Info */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className="text-lg font-bold text-purple-700">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Elapsed: {formatTime(timeElapsed)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              <span className="text-gray-600 font-medium">
                {isTimerRunning ? 'In Progress' : 'Waiting...'}
              </span>
              <span className="text-xs text-gray-500">
                • Together: {formatTime(bothActiveTime)} / {formatTime(requiredTime)} ({completionPercentage}%)
              </span>
            </div>
          </div>

          {/* Center: Tabs */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full p-1">
            <button
              onClick={() => handleTabChange("video")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${
                activeTab === "video"
                  ? "bg-white text-purple-600 shadow-md scale-105"
                  : "text-purple-400 hover:text-purple-600"
              }`}
            >
              <Video className="w-4 h-4" />
              <span className="text-sm">Video</span>
            </button>

            <button
              onClick={() => handleTabChange("content")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${
                activeTab === "content"
                  ? "bg-white text-blue-600 shadow-md scale-105"
                  : "text-blue-400 hover:text-blue-600"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="text-sm">Content</span>
            </button>

            <button
              onClick={() => handleTabChange("whiteboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all ${
                activeTab === "whiteboard"
                  ? "bg-white text-pink-600 shadow-md scale-105"
                  : "text-pink-400 hover:text-pink-600"
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span className="text-sm">Whiteboard</span>
            </button>
          </div>

          {/* Right: Participants */}
          <div className="flex flex-col gap-1 items-end">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-bold text-purple-700">
                {(isTeacherPresent ? 1 : 0) + (isStudentPresent ? 1 : 0)}/2
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                {isTeacherPresent ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-gray-400" />
                )}
                <span className="text-gray-600 font-medium">Teacher</span>
              </div>
              <div className="flex items-center gap-1">
                {isStudentPresent ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <XCircle className="w-3 h-3 text-gray-400" />
                )}
                <span className="text-gray-600 font-medium">Student</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📱 MAIN CONTENT */}
      <div className="flex-1 overflow-hidden relative">
        
        {/* Video Tab - Always mounted, just hidden */}
        <div className={activeTab === "video" ? "h-full" : "hidden"}>
          <VideoCall
            key={`video-${bookingId}`}
            channelName={channelName}
            userId={userId}
            userName={userName}
            onLeave={handleLeaveCall}
            onUserJoined={handleUserJoined}
            onUserLeft={handleUserLeft}
            mode="video"
          />
        </div>

        {/* Content Tab */}
        {activeTab === "content" && (
          <div className="h-full flex">
            <div className="flex-1 bg-gradient-to-br from-blue-50 to-purple-50 p-4 flex items-center justify-center">
              <div className="w-full h-full bg-white rounded-3xl shadow-2xl border-4 border-blue-200 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-24 h-24 text-blue-400 mx-auto mb-4" />
                  <p className="text-2xl font-bold text-blue-600">Content Sharing</p>
                  <p className="text-gray-500 mt-2">PDF viewer or screen share will appear here</p>
                </div>
              </div>
            </div>
            <div className="w-64 bg-gradient-to-b from-purple-100 to-pink-100 p-3 flex flex-col gap-3">
              <div className="flex-1 bg-gradient-to-br from-purple-200 to-purple-300 rounded-2xl shadow-xl border-4 border-white flex items-center justify-center">
                <span className="text-white font-bold">Teacher</span>
              </div>
              <div className="flex-1 bg-gradient-to-br from-pink-200 to-pink-300 rounded-2xl shadow-xl border-4 border-white flex items-center justify-center">
                <span className="text-white font-bold">Student</span>
              </div>
            </div>
          </div>
        )}

        {/* Whiteboard Tab */}
        {activeTab === "whiteboard" && (
          <WhiteboardTab
            userRole={userRole}
          />
        )}

        {/* 🔥 END CLASS BUTTON (Teacher Only, Bottom Left) */}
        {userRole === "teacher" && (
          <button
            onClick={() => setShowEndModal(true)}
            className="absolute bottom-6 left-6 flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all z-50"
          >
            <Power className="w-5 h-5" />
            End Class
          </button>
        )}
      </div>

      {/* 🔥 END CLASS CONFIRMATION MODAL */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">End Class?</h2>
              <p className="text-gray-600">
                Are you sure you want to end this class?
              </p>
            </div>

            <div className="bg-blue-50 rounded-2xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Time Elapsed:</p>
                  <p className="font-bold text-gray-800">{formatTime(timeElapsed)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Together:</p>
                  <p className="font-bold text-gray-800">{formatTime(bothActiveTime)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Required:</p>
                  <p className="font-bold text-gray-800">{formatTime(requiredTime)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Progress:</p>
                  <p className={`font-bold ${completionPercentage >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
                    {completionPercentage}%
                  </p>
                </div>
              </div>
            </div>

            {completionPercentage < 100 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 mb-6">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Note:</strong> This class hasn't met the minimum attendance requirement. 
                  It will require admin review.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleEndClass}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full font-bold shadow-lg transition-all"
              >
                End Class
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🎨 WHITEBOARD TAB
function WhiteboardTab({ userRole }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);

  const colors = [
    "#000000", "#FF0000", "#00FF00", "#0000FF",
    "#FFFF00", "#FF00FF", "#00FFFF", "#FF8800"
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e) => {
    if (userRole !== "teacher") return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e) => {
    if (!isDrawing || userRole !== "teacher") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    if (userRole !== "teacher") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="h-full flex gap-4 p-4">
      <div className="flex-1 flex flex-col gap-3">
        {userRole === "teacher" && (
          <div className="bg-white rounded-2xl shadow-lg p-3 flex items-center justify-between border-2 border-purple-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-purple-600">Colors:</span>
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setCurrentColor(color)}
                  className={`w-8 h-8 rounded-full border-4 transition-all ${
                    currentColor === color ? "border-purple-500 scale-110" : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-purple-600">Size:</span>
              <input
                type="range"
                min="1"
                max="20"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-medium text-gray-600">{brushSize}px</span>
            </div>
            <button
              onClick={clearCanvas}
              className="px-4 py-2 bg-gradient-to-r from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white rounded-full font-bold text-sm shadow-lg"
            >
              Clear
            </button>
          </div>
        )}
        <div className="flex-1 bg-white rounded-3xl shadow-2xl border-4 border-purple-200 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={1200}
            height={700}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full h-full cursor-crosshair"
          />
        </div>
      </div>
      <div className="w-48 flex flex-col gap-3">
        <div className="flex-1 bg-gradient-to-br from-purple-200 to-purple-300 rounded-2xl shadow-xl border-4 border-white flex items-center justify-center">
          <span className="text-sm font-bold text-white">Teacher</span>
        </div>
        <div className="flex-1 bg-gradient-to-br from-pink-200 to-pink-300 rounded-2xl shadow-xl border-4 border-white flex items-center justify-center">
          <span className="text-sm font-bold text-white">Student</span>
        </div>
      </div>
    </div>
  );
}
