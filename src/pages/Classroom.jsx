import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import VideoCall from "./VideoCall";
import api from "../api";
import {
  Video, FileText, PenTool, Clock, Users,
  CheckCircle2, XCircle, Loader, Power, AlertTriangle,
  CheckCircle, X,
} from "lucide-react";

// ─── Whiteboard Tab ───────────────────────────────────────────────────────────
function WhiteboardTab({ userRole }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const colors = ["#000000","#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF","#00FFFF","#FF8800"];

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
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {userRole === "teacher" && (
        <div className="flex items-center gap-3 p-3 bg-gray-100 border-b">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setCurrentColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${currentColor === c ? "border-black scale-125" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input type="range" min="1" max="20" value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24" />
          <button onClick={clearCanvas} className="px-3 py-1 bg-red-500 text-white rounded text-sm">Clear</button>
        </div>
      )}
      <canvas
        ref={canvasRef} width={800} height={500}
        className="flex-1 cursor-crosshair"
        onMouseDown={startDrawing} onMouseMove={draw}
        onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
      />
    </div>
  );
}

// ─── Main Classroom Component ─────────────────────────────────────────────────
export default function Classroom({ classData, userRole: propUserRole, onLeave, teacherGoogleMeetLink }) {
  const navigate    = useNavigate();
  const location    = useLocation();
  const stateData   = location.state || {};
  
  const finalClassData = classData || stateData.classData;
  const userRole       = propUserRole || stateData.userRole || localStorage.getItem("role");
  const bookingId      = finalClassData?.bookingId || finalClassData?.id;
  const userId         = localStorage.getItem("userId");
  const userName       = localStorage.getItem("name") || "User";

  console.log("🎓 Classroom init:", { bookingId, userRole, duration: finalClassData?.duration });

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]                     = useState("video");
  const [activeVideoProvider, setActiveVideoProvider] = useState(null);
  const activeVideoProviderRef = useRef(null); // track latest value without re-render

  // Choose a video provider: sets local state AND persists to server so the
  // other participant's poll picks it up and auto-joins the same platform.
  const chooseProvider = useCallback(async (provider) => {
    setActiveVideoProvider(provider);
    activeVideoProviderRef.current = provider;
    if (!provider || !bookingId) return;
    try {
      await api.patch(`/api/classroom/session/${bookingId}/video-provider`, { videoProvider: provider });
    } catch (_) { /* non-critical — other user will still see it on next poll */ }
  }, [bookingId]);
  const [showLeaveModal, setShowLeaveModal]           = useState(false);
  const [error, setError]                             = useState(null);

  // ── Google Meet link — FIX 1: Single useState, no duplicate const ───────────
  const [resolvedGoogleMeetLink, setResolvedGoogleMeetLink] = useState(
    teacherGoogleMeetLink || finalClassData?.teacherGoogleMeetLink || ''
  );

  // Fallback: fetch from booking API if link wasn't passed in navigation state
  useEffect(() => {
    if (!resolvedGoogleMeetLink && bookingId) {
      api.get(`/api/bookings/${bookingId}`)
        .then(({ data }) => {
          const link = data.booking?.teacherId?.googleMeetLink || '';
          if (link) {
            console.log('✅ Fetched Google Meet link from booking:', link);
            setResolvedGoogleMeetLink(link);
          }
        })
        .catch(err => console.error('Failed to fetch Meet link:', err));
    }
  }, [bookingId]);

  // ── Presence (refs + state so setInterval can read current values) ──────────
  const [isTeacherPresent, setIsTeacherPresent] = useState(userRole === "teacher");
  const [isStudentPresent, setIsStudentPresent] = useState(userRole === "student");
  const teacherPresentRef = useRef(userRole === "teacher");
  const studentPresentRef = useRef(userRole === "student");

  // Keep refs in sync with state
  useEffect(() => { teacherPresentRef.current = isTeacherPresent; }, [isTeacherPresent]);
  useEffect(() => { studentPresentRef.current = isStudentPresent; }, [isStudentPresent]);

  // ── Timer state ─────────────────────────────────────────────────────────────
  const [timeElapsed,    setTimeElapsed]    = useState(0);
  const [bothActiveTime, setBothActiveTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [classStarted,   setClassStarted]   = useState(false);
  const classStartedRef = useRef(false); // ✅ FIX: ref to avoid stale closure in polling interval
  const timerRef   = useRef(null);
  const syncRef    = useRef(null);
  const sessionRef = useRef(null);
  const classStartedAtRef = useRef(null);   
  const bothActiveStartRef = useRef(null);
  const bothActiveAccRef = useRef(0);       

  // Keep classStartedRef in sync
  useEffect(() => { classStartedRef.current = classStarted; }, [classStarted]);

  // ── Auto-complete state ─────────────────────────────────────────────────────
  const [autoCompleting,   setAutoCompleting]   = useState(false);
  const [completionResult, setCompletionResult] = useState(null);
  const hasAutoCompletedRef = useRef(false);

  // ── Session state ───────────────────────────────────────────────────────────
  const [sessionData, setSessionData] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const getRequiredTime = (duration) =>
    Math.floor((duration || 60) * 60 * 0.83);

  const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds)) return "--:--";
    const s   = Math.max(0, Math.round(seconds));
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const formatMinutes = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const classDurationSeconds = (finalClassData?.duration || 60) * 60;
  const requiredTime         = getRequiredTime(finalClassData?.duration);
  const timeRemaining        = Math.max(0, classDurationSeconds - timeElapsed);
  const completionPct        = Math.min(100, Math.round((bothActiveTime / requiredTime) * 100));

  // ─────────────────────────────────────────────────────────────────────────────
  // Timer — uses refs to avoid stale closure on presence flags
  // ─────────────────────────────────────────────────────────────────────────────
  // NEW — timestamp-based, immune to tab throttling
const startTimer = useCallback(() => {
  if (timerRef.current) return;

  // Record the real wall-clock start time
  if (!classStartedAtRef.current) {
    classStartedAtRef.current = Date.now();
  }

  timerRef.current = setInterval(() => {
    // Elapsed = real wall-clock time, not tick count
    const elapsed = Math.floor((Date.now() - classStartedAtRef.current) / 1000);
    setTimeElapsed(elapsed);

    // bothActiveTime: accumulate real segments when both are present
    if (teacherPresentRef.current && studentPresentRef.current) {
      if (!bothActiveStartRef.current) {
        bothActiveStartRef.current = Date.now(); // segment started
      }
      const segmentSeconds = Math.floor((Date.now() - bothActiveStartRef.current) / 1000);
      setBothActiveTime(bothActiveAccRef.current + segmentSeconds);
    } else {
      // One person left — close the segment, save accumulated time
      if (bothActiveStartRef.current) {
        bothActiveAccRef.current += Math.floor((Date.now() - bothActiveStartRef.current) / 1000);
        bothActiveStartRef.current = null;
      }
      setBothActiveTime(bothActiveAccRef.current);
    }
  }, 1000);
}, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Session: join, heartbeat, leave
  // ─────────────────────────────────────────────────────────────────────────────
  const joinSession = useCallback(async () => {
  try {
    const res = await api.post("/api/classroom/attendance", {
      bookingId,
      userRole,
      action: "join",
      timestamp: new Date().toISOString(),
    });

    const session = res.data.session;       // ← your new code starts here
    setSessionData(session);

    // Sync presence refs DIRECTLY from session response
    if (session) {
      const teacherIn = !!session.teacherJoinedAt;
      const studentIn = !!session.studentJoinedAt;
      teacherPresentRef.current = teacherIn;
      studentPresentRef.current = studentIn;
      setIsTeacherPresent(teacherIn);
      setIsStudentPresent(studentIn);
    }

    if (session?.classStartedAt) {
  const elapsed = Math.floor((Date.now() - new Date(session.classStartedAt)) / 1000);
  setTimeElapsed(elapsed);
  setBothActiveTime(session.bothActiveTime || 0);
  if (!classStartedRef.current) {
    classStartedRef.current = true;
    setClassStarted(true);
    setIsTimerRunning(true);
    classStartedAtRef.current = new Date(session.classStartedAt).getTime(); 
    bothActiveAccRef.current = session.bothActiveTime || 0;                 
    startTimer();
  }
}
    console.log(`✅ Joined session as ${userRole}`);  // ← your new code ends here

  } catch (err) {
    console.error("❌ Join session error:", err);
    setTimeout(() => {
      console.log("🔄 Retrying session join...");
      joinSession();
    }, 3000);
  }
}, [bookingId, userRole, startTimer]);

  const sendHeartbeat = useCallback(async (currentBothActiveTime) => {
    try {
      await api.post("/api/classroom/attendance", {
        bookingId,
        userRole,
        action: "heartbeat",
        timestamp: new Date().toISOString(),
        activeTime: currentBothActiveTime,
      });
    } catch (err) {
      console.error("Heartbeat error:", err);
    }
  }, [bookingId, userRole]);

  const leaveSession = useCallback(async (finalBothActiveTime) => {
    try {
      clearInterval(syncRef.current);
      clearInterval(sessionRef.current);
      await api.post("/api/classroom/attendance", {
        bookingId,
        userRole,
        action: "leave",
        timestamp: new Date().toISOString(),
        activeTime: finalBothActiveTime,
      });
      console.log("👋 Left session");
    } catch (err) {
      console.error("Leave session error:", err);
    }
  }, [bookingId, userRole]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-complete — called when timer hits 0
  // ─────────────────────────────────────────────────────────────────────────────
  const handleAutoComplete = useCallback(async (currentBothActiveTime) => {
    if (hasAutoCompletedRef.current) return;
    hasAutoCompletedRef.current = true;

    clearInterval(timerRef.current);
    timerRef.current = null;

    setAutoCompleting(true);
    console.log("🏁 Class time elapsed — auto-completing...", { currentBothActiveTime, requiredTime });

    try {
      const { data } = await api.post("/api/classroom/auto-complete", {
        bookingId,
        clientBothActiveTime: currentBothActiveTime,
      });
      setCompletionResult(data);
      console.log("✅ Auto-complete result:", data);
    } catch (err) {
      console.error("❌ Auto-complete error:", err);
      setCompletionResult({
        completed: false,
        missed: true,
        message: "Could not determine class outcome. Please contact admin.",
        error: true,
      });
    } finally {
      setAutoCompleting(false);
    }
  }, [bookingId, requiredTime]);


const handleAutoCompleteRef = useRef(handleAutoComplete);
useEffect(() => { 
  handleAutoCompleteRef.current = handleAutoComplete; 
}, [handleAutoComplete]);

 useEffect(() => {
  if (timeRemaining === 0 && classStarted && !hasAutoCompletedRef.current) {
    setBothActiveTime((current) => {
      handleAutoCompleteRef.current(current); // ✅ use ref not direct function
      return current;
    });
  }
}, [timeRemaining, classStarted]); // ✅ no handleAutoComplete dep = no infinite loop

 
  // ─────────────────────────────────────────────────────────────────────────────
// Mount: join session, heartbeat, poll for other user joining
// ─────────────────────────────────────────────────────────────────────────────
useEffect(() => {
  if (!bookingId) return;

  joinSession();

  let currentPollInterval = 2000;
  let pollTimeout = null;

  const poll = async () => {
    try {
      const { data } = await api.get(`/api/classroom/session/${bookingId}`);
      if (!data.session) return;
      setSessionData(data.session);

      const s         = data.session;
      const teacherIn = !!s.teacherJoinedAt;
      const studentIn = !!s.studentJoinedAt;

      // Update refs directly so timer sees changes immediately
      if (teacherIn !== teacherPresentRef.current) {
        teacherPresentRef.current = teacherIn;
        setIsTeacherPresent(teacherIn);
      }
      if (studentIn !== studentPresentRef.current) {
        studentPresentRef.current = studentIn;
        setIsStudentPresent(studentIn);
      }

      // Both just joined — start timer
      if (teacherIn && studentIn && !classStartedRef.current) {
        classStartedRef.current = true;

        // ✅ FIX: Hard-sync elapsed time from server's classStartedAt
        // So even if this user detects the join 2s late, they start at the
        // exact same point in time as the other user — no drift
        if (s.classStartedAt) {
          const elapsed = Math.floor((Date.now() - new Date(s.classStartedAt)) / 1000);
          setTimeElapsed(elapsed);
          // Sync bothActiveTime too — use server value if available, else elapsed
          setBothActiveTime(s.bothActiveTime > 0 ? s.bothActiveTime : elapsed);
        }

        setClassStarted(true);
        setIsTimerRunning(true);
        startTimer();

        // ✅ Slow down polling now that class is active — saves server load
        currentPollInterval = 5000;
      }

      // Auto-apply video provider if the other side already chose one
      if (s.videoProvider && !activeVideoProviderRef.current) {
        activeVideoProviderRef.current = s.videoProvider;
        setActiveVideoProvider(s.videoProvider);
      }

      // Other side already triggered auto-complete
      if ((s.status === "completed" || s.status === "incomplete") && !hasAutoCompletedRef.current) {
        hasAutoCompletedRef.current = true;
        clearInterval(timerRef.current);
        setBothActiveTime((cur) => {
          handleAutoCompleteRef.current(cur);
          return cur;
        });
        return; // stop polling
      }
    } catch (_) { /* session not created yet */ }

    // Schedule next poll with current interval
    pollTimeout = setTimeout(poll, currentPollInterval);
  };

  // Start first poll
  pollTimeout = setTimeout(poll, currentPollInterval);

  // Heartbeat every 15 seconds
  syncRef.current = setInterval(() => {
    setBothActiveTime((current) => {
      sendHeartbeat(current);
      return current;
    });
  }, 15000);

  return () => {
    clearTimeout(pollTimeout);
    clearInterval(timerRef.current);
    clearInterval(syncRef.current);
    clearInterval(sessionRef.current);
    setBothActiveTime((cur) => {
      leaveSession(cur);
      return cur;
    });
  };
}, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

// ── Resync from server when user switches back to this tab ──────────────────
useEffect(() => {
  const handleVisibilityChange = async () => {
    if (document.visibilityState !== "visible") return;
    if (!bookingId || !classStarted) return;

    try {
      const { data } = await api.get(`/api/classroom/session/${bookingId}`);
      const s = data.session;
      if (!s) return;

      console.log("👁️ Tab visible — resyncing from server...");

      // Recalculate elapsed from server's classStartedAt
      if (s.classStartedAt) {
        classStartedAtRef.current = new Date(s.classStartedAt).getTime();
        const elapsed = Math.floor((Date.now() - classStartedAtRef.current) / 1000);
        setTimeElapsed(elapsed);
      }

      // Restore server's authoritative bothActiveTime
      if (s.bothActiveTime > 0) {
        bothActiveAccRef.current = s.bothActiveTime;
        bothActiveStartRef.current = null; // reset segment
        setBothActiveTime(s.bothActiveTime);
      }
    } catch (err) {
      console.error("Resync error:", err);
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}, [bookingId, classStarted]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Video call presence callbacks (Agora only)
  // ─────────────────────────────────────────────────────────────────────────────
  const handleUserJoined = (uid) => {
    console.log("✅ Remote user joined video:", uid);
    if (userRole === "teacher") setIsStudentPresent(true);
    else setIsTeacherPresent(true);
  };

  const handleUserLeft = (uid) => {
    console.log("👋 Remote user left video:", uid);
    if (userRole === "teacher") setIsStudentPresent(false);
    else setIsTeacherPresent(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Leave early
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLeaveEarly = () => {
    clearInterval(timerRef.current);
    clearInterval(syncRef.current);
    clearInterval(sessionRef.current);
    setBothActiveTime((cur) => {
      leaveSession(cur);
      return cur;
    });
    if (onLeave) onLeave();
    else navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Guard: no bookingId
  // ─────────────────────────────────────────────────────────────────────────────
  if (!bookingId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-600 mb-2">Cannot Load Classroom</h2>
          <p className="text-gray-600 mb-6">No booking ID found. Please join from your dashboard.</p>
          <button
            onClick={() => navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard")}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full font-bold transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const channelName = `class-${bookingId}`;

  // ─────────────────────────────────────────────────────────────────────────────
  // Completion screen
  // ─────────────────────────────────────────────────────────────────────────────
  if (autoCompleting || completionResult) {
    const isCompleted = completionResult?.completed && !completionResult?.missed;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          {autoCompleting ? (
            <>
              <div className="w-20 h-20 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing Class...</h2>
              <p className="text-gray-500">Calculating attendance and updating records</p>
            </>
          ) : isCompleted ? (
            <>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Class Completed! 🎉</h2>
              <p className="text-gray-600 mb-6">{completionResult?.message || "Class successfully recorded."}</p>
              <div className="bg-emerald-50 rounded-2xl p-4 mb-6 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Time Together</span>
                  <span className="font-bold text-emerald-700">{formatMinutes(completionResult?.bothActiveTime || bothActiveTime)}</span>
                </div>
                {userRole === "teacher" && completionResult?.teacherEarned != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Earnings Added</span>
                    <span className="font-bold text-emerald-700">${completionResult.teacherEarned.toFixed(2)}</span>
                  </div>
                )}
                {userRole === "student" && completionResult?.studentClassesRemaining != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Classes Remaining</span>
                    <span className="font-bold text-emerald-700">{completionResult.studentClassesRemaining}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
                  { state: { classCompleted: true, activeTab: "payment" } }
                )}
                className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold transition-all"
              >
                Back to Dashboard
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-orange-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Class Not Completed</h2>
              <p className="text-gray-600 mb-4 text-sm">
                {completionResult?.reason || "Attendance requirements were not met."}
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6 text-sm text-left space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Teacher Joined</span>
                  <span className={`font-bold ${completionResult?.teacherJoined ? "text-emerald-600" : "text-red-600"}`}>
                    {completionResult?.teacherJoined ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Student Joined</span>
                  <span className={`font-bold ${completionResult?.studentJoined ? "text-emerald-600" : "text-red-600"}`}>
                    {completionResult?.studentJoined ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                {completionResult?.bothActiveTime != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time Together</span>
                    <span className="font-bold text-orange-700">{formatMinutes(completionResult.bothActiveTime)}</span>
                  </div>
                )}
                {completionResult?.requiredTime != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Required</span>
                    <span className="font-bold text-gray-700">{formatMinutes(completionResult.requiredTime)}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-4">No class was deducted and no earnings were added.</p>
              <button
                onClick={() => navigate(userRole === "teacher" ? "/teacher/dashboard" : "/student/dashboard",
                  { state: { classCompleted: true, activeTab: "payment" } }
                )}
                className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-800 text-white rounded-full font-bold transition-all"
              >
                Back to Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main classroom UI
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">

      {/* ── HEADER ── */}
      <div className="bg-white shadow-md border-b-2 border-purple-200 px-6 py-3 flex-shrink-0">

        {/* Row 1: class info + leave button */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-gray-800">{finalClassData?.title || "Class"}</h1>
            <p className="text-xs text-gray-500">{finalClassData?.topic || ""}</p>
          </div>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-full font-semibold text-sm transition-all"
          >
            <Power className="w-4 h-4" />
            Leave Early
          </button>
        </div>

        {/* Row 2: timer + tabs + presence */}
        <div className="flex items-center justify-between">

          {/* Left: Timer */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-600" />
                <span className={`text-xl font-bold ${timeRemaining < 60 ? "text-red-600 animate-pulse" : "text-purple-700"}`}>
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <span className="text-xs text-gray-400">elapsed: {formatTime(timeElapsed)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${isTimerRunning ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
              <span className="text-gray-500 font-medium">
                {classStarted ? "In Progress" : "Waiting for both to join..."}
              </span>
              {classStarted && (
                <span className="text-gray-400">
                  · Together: {formatTime(bothActiveTime)} / {formatTime(requiredTime)} ({completionPct}%)
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-1">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${completionPct >= 100 ? "bg-emerald-500" : "bg-purple-500"}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>

          {/* Center: Tabs */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full p-1">
            {["video", "content", "whiteboard"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-sm transition-all ${
                  activeTab === tab ? "bg-white shadow-md scale-105 text-purple-600" : "text-purple-400 hover:text-purple-600"
                }`}
              >
                {tab === "video"      && <Video    className="w-3.5 h-3.5" />}
                {tab === "content"    && <FileText  className="w-3.5 h-3.5" />}
                {tab === "whiteboard" && <PenTool   className="w-3.5 h-3.5" />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Right: Presence */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-bold text-purple-700">
                {(isTeacherPresent ? 1 : 0) + (isStudentPresent ? 1 : 0)}/2
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                {isTeacherPresent
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  : <XCircle      className="w-3 h-3 text-gray-300" />}
                <span className="text-gray-500">Teacher</span>
              </div>
              <div className="flex items-center gap-1">
                {isStudentPresent
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  : <XCircle      className="w-3 h-3 text-gray-300" />}
                <span className="text-gray-500">Student</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WAITING BANNER ── */}
      {!classStarted && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-center gap-2 text-sm text-amber-700">
          <Loader className="w-4 h-4 animate-spin" />
          Waiting for {isTeacherPresent ? "student" : "teacher"} to join before class begins...
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 overflow-hidden relative">

        {/*
          ── BUG FIX: Agora VideoCall must NEVER unmount while the session is active.
          ── Previously it was inside {activeTab === "video" && ...} which unmounted it
          ── every time the user switched tabs, calling client.leave() and ending the call.
          ──
          ── Solution: render VideoCall always (when provider=agora), hide with CSS only.
          ── visibility:hidden keeps the element in layout with real dimensions so Agora
          ── can continue rendering video frames. Switching back makes it visible instantly.
        */}
        {activeVideoProvider === "agora" && (
          <div
            className="absolute inset-0"
            style={{
              visibility: activeTab === "video" ? "visible" : "hidden",
              zIndex: activeTab === "video" ? 10 : 0,
              pointerEvents: activeTab === "video" ? "auto" : "none",
            }}
          >
            <VideoCall
              key={`video-${bookingId}`}
              channelName={channelName}
              userId={userId}
              userName={userName}
              onLeave={() => { activeVideoProviderRef.current = null; setActiveVideoProvider(null); }}
              onUserJoined={handleUserJoined}
              onUserLeft={handleUserLeft}
              mode="video"
            />
            <button
              onClick={() => { activeVideoProviderRef.current = null; setActiveVideoProvider(null); }}
              className="absolute top-4 left-4 px-4 py-2 bg-white/90 backdrop-blur rounded-lg shadow-lg hover:bg-white transition-all flex items-center gap-2 z-50 text-sm font-medium"
            >
              ← Change Platform
            </button>
          </div>
        )}

        {/* VIDEO TAB — provider selection or Google Meet monitor */}
        {activeTab === "video" && activeVideoProvider !== "agora" && (
          <div className="h-full" style={{ position: "relative", zIndex: 10 }}>
            {!activeVideoProvider ? (

              /* ── Video provider selection ── */
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50 p-8">
                <div className="max-w-2xl w-full">
                  <h2 className="text-3xl font-bold text-center text-gray-800 mb-3">Choose Video Platform</h2>
                  <p className="text-center text-gray-600 mb-8">Select which platform to use for this class</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Google Meet */}
                    <button
                      onClick={() => {
                        if (resolvedGoogleMeetLink) {
                          window.open(resolvedGoogleMeetLink, "_blank");
                          chooseProvider("googlemeet");
                        } else {
                          alert("⚠️ Google Meet link not configured. Ask your teacher to set it up.");
                        }
                      }}
                      disabled={!resolvedGoogleMeetLink}
                      className={`p-8 rounded-2xl border-4 transition-all ${
                        resolvedGoogleMeetLink
                          ? "bg-white border-green-300 hover:border-green-500 hover:shadow-xl cursor-pointer"
                          : "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60"
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${resolvedGoogleMeetLink ? "bg-green-500" : "bg-gray-400"}`}>
                          <Video className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Google Meet</h3>
                        <p className="text-sm text-gray-600 text-center mb-3">Opens in a new tab</p>
                        <span className={`px-4 py-1 rounded-full text-xs font-medium ${resolvedGoogleMeetLink ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                          {resolvedGoogleMeetLink ? "✓ Available" : "Not Configured"}
                        </span>
                      </div>
                    </button>

                    {/* Agora */}
                    <button
                      onClick={() => chooseProvider("agora")}
                      className="p-8 rounded-2xl border-4 bg-white border-blue-300 hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                          <Video className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Agora Video</h3>
                        <p className="text-sm text-gray-600 text-center mb-3">Embedded in browser</p>
                        <span className="px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">✓ Always Available</span>
                      </div>
                    </button>
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-6">
                    💡 Google Meet uses the teacher's subscription. Agora is always available as backup.
                  </p>
                </div>
              </div>

            ) : (

              /* ── Google Meet attendance monitor ── */
              <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-8 gap-6">

                <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border-2 border-green-200">
                  <div className="relative w-20 h-20 mx-auto mb-5">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center">
                      <Video className="w-10 h-10 text-white" />
                    </div>
                    {classStarted && <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-30" />}
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-1">Google Meet is Open</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    Your class is happening in the other tab.{" "}
                    <strong className="text-red-600">Do not close this page</strong> — it tracks your attendance.
                  </p>

                  <div className="bg-gray-50 rounded-2xl p-4 mb-5 text-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 font-medium">Attendance</span>
                      <span className={`font-bold text-base ${completionPct >= 100 ? "text-emerald-600" : "text-purple-600"}`}>{completionPct}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
                      <div className={`h-full rounded-full transition-all duration-1000 ${completionPct >= 100 ? "bg-emerald-500" : "bg-purple-500"}`} style={{ width: `${completionPct}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div><p className="text-gray-400">Time Together</p><p className="font-bold text-gray-700">{formatTime(bothActiveTime)}</p></div>
                      <div><p className="text-gray-400">Required</p><p className="font-bold text-gray-700">{formatTime(requiredTime)}</p></div>
                      <div><p className="text-gray-400">Remaining</p><p className={`font-bold ${timeRemaining < 120 ? "text-red-600 animate-pulse" : "text-gray-700"}`}>{formatTime(timeRemaining)}</p></div>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-center mb-5">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${isTeacherPresent ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                      <span className={`w-2 h-2 rounded-full ${isTeacherPresent ? "bg-emerald-500" : "bg-gray-300"}`} />
                      Teacher {isTeacherPresent ? "Present" : "Waiting"}
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${isStudentPresent ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                      <span className={`w-2 h-2 rounded-full ${isStudentPresent ? "bg-emerald-500" : "bg-gray-300"}`} />
                      Student {isStudentPresent ? "Present" : "Waiting"}
                    </div>
                  </div>

                  {!classStarted ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-4">
                      <Loader className="w-4 h-4 animate-spin flex-shrink-0" />
                      Waiting for both parties to open their classroom pages...
                    </div>
                  ) : completionPct >= 100 ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 mb-4">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      Attendance requirement met! Class will complete when the timer ends.
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-sm text-purple-700 bg-purple-50 rounded-xl px-4 py-3 mb-4">
                      <Clock className="w-4 h-4 animate-pulse flex-shrink-0" />
                      Class in progress — stay on Google Meet and keep this tab open.
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button onClick={() => window.open(resolvedGoogleMeetLink, "_blank")}
                      className="w-full px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full font-bold text-sm transition-all">
                      🔗 Reopen Google Meet
                    </button>
                    <button onClick={() => setActiveVideoProvider(null)}
                      className="w-full px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full text-sm transition-all">
                      ← Switch Video Platform
                    </button>
                  </div>
                </div>

                <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-2xl px-5 py-3 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 leading-relaxed">
                    <strong>Important:</strong> Closing this page will stop your attendance tracking and your class may be marked as incomplete.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONTENT TAB */}
        {activeTab === "content" && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-50" style={{ zIndex: 10 }}>
            <div className="text-center">
              <FileText className="w-24 h-24 text-blue-300 mx-auto mb-4" />
              <p className="text-xl font-bold text-blue-600">Content Sharing</p>
              <p className="text-gray-500 mt-2">PDF viewer coming soon</p>
            </div>
          </div>
        )}

        {/* WHITEBOARD TAB */}
        {activeTab === "whiteboard" && (
          <div className="absolute inset-0" style={{ zIndex: 10 }}>
            <WhiteboardTab userRole={userRole} />
          </div>
        )}
      </div>

      {/* ── LEAVE EARLY MODAL ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Leave Early?</h2>
            <p className="text-gray-600 text-sm mb-4">
              The class timer will continue running. Completion will be decided automatically when the full {finalClassData?.duration || 60} minutes elapse.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-xs text-amber-800">
              ⚠️ If you leave now, your time together ({formatTime(bothActiveTime)}) is saved.
              The class will complete or be marked missed at end-time regardless.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-bold transition-all"
              >
                Stay
              </button>
              <button
                onClick={handleLeaveEarly}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold transition-all"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
